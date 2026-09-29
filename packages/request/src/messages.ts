export type ModelCapabilityLike = {
  input?: { image?: boolean; pdf?: boolean };
  toolResultMedia?: boolean;
};

export type MessageAttachment = {
  type?: string;
  content?: string;
  url?: string;
  filename?: string;
  title?: string;
  mime?: string;
  mediaType?: string;
};

type AttachmentInputKey = "image" | "pdf";

/** 移除 Agent 内部字段，避免它们泄漏到任何上游模型协议。 */
export function sanitizeMessages(messages: any[]): any[] {
  return messages.map((message) => {
    const {
      status: _status,
      errorType: _errorType,
      cache: _cache,
      attachments: _attachments,
      ...rest
    } = message;
    return rest;
  });
}

function attachmentTypeToInputKey(type?: string): AttachmentInputKey | undefined {
  if (!type) return undefined;
  if (type === "image" || type.startsWith("image/")) return "image";
  if (type === "pdf" || type === "application/pdf") return "pdf";
  return undefined;
}

function getDataUrlMime(value?: string): string | undefined {
  if (!value?.startsWith("data:")) return undefined;
  return value.split(";")[0].replace("data:", "") || undefined;
}

function isHttpUrl(value?: string): boolean {
  return !!value && /^https?:\/\//i.test(value);
}

function inferMimeFromUrl(value?: string): string | undefined {
  if (!value || !isHttpUrl(value)) return undefined;
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    if (/\.(png|jpe?g|webp|gif)$/.test(pathname)) return "image";
    if (/\.pdf$/.test(pathname)) return "application/pdf";
  } catch {
    return undefined;
  }
  return undefined;
}

function getAttachmentResource(attachment: MessageAttachment): string {
  return attachment.url ?? attachment.content ?? "";
}

function getAttachmentInputKey(attachment: MessageAttachment): AttachmentInputKey | undefined {
  const resource = getAttachmentResource(attachment);
  return (
    attachmentTypeToInputKey(attachment.type) ??
    attachmentTypeToInputKey(attachment.mime) ??
    attachmentTypeToInputKey(attachment.mediaType) ??
    attachmentTypeToInputKey(getDataUrlMime(resource)) ??
    attachmentTypeToInputKey(inferMimeFromUrl(resource))
  );
}

function isSupportedInput(
  inputKey: AttachmentInputKey | undefined,
  capabilities?: ModelCapabilityLike,
): boolean {
  if (!inputKey) return true;
  return capabilities?.input?.[inputKey] ?? true;
}

function unsupportedInputText(inputKey: AttachmentInputKey, filename?: string): any {
  const name = filename ? `"${filename}"` : inputKey;
  return {
    type: "text",
    text: `ERROR: Cannot read ${name} (this model does not support ${inputKey} input). Inform the user.`,
  };
}

function messagePartToInputKey(part: any): AttachmentInputKey | undefined {
  if (part.type === "image" || part.type === "image_url") {
    const resource = part.image_url?.url ?? part.url ?? part.content;
    return attachmentTypeToInputKey(
      part.semanticType ?? getDataUrlMime(resource) ?? inferMimeFromUrl(resource) ?? "image",
    );
  }
  if (part.type === "file") {
    const resource = part.file?.file_data ?? part.file?.url ?? part.content;
    return attachmentTypeToInputKey(
      part.semanticType ?? part.mime ?? part.mediaType ?? getDataUrlMime(resource),
    );
  }
  return undefined;
}

function messagePartFilename(part: any): string | undefined {
  return part.filename ?? part.file?.filename;
}

export function attachmentToMessagePart(attachment: MessageAttachment): any {
  const content = getAttachmentResource(attachment);
  const filename = attachment.filename ?? attachment.title;
  const inputKey = getAttachmentInputKey(attachment);

  if (inputKey === "image") {
    return {
      type: "image_url" as const,
      image_url: { url: content, detail: "auto" },
    };
  }

  if (inputKey === "pdf") {
    if (isHttpUrl(content)) {
      return {
        type: "text" as const,
        text: `Attached PDF URL${filename ? ` (${filename})` : ""}: ${content}`,
      };
    }
    return {
      type: "file" as const,
      file: {
        filename: filename ?? "attachment.pdf",
        file_data: content,
      },
      semanticType: "pdf",
    };
  }

  if (isHttpUrl(content)) {
    return {
      type: "text" as const,
      text: `Attached file URL${filename ? ` (${filename})` : ""}: ${content}`,
    };
  }

  return {
    type: "file" as const,
    file: {
      filename: filename ?? "attachment",
      file_data: content,
    },
  };
}

function attachmentToSupportedMessagePart(
  attachment: MessageAttachment,
  capabilities?: ModelCapabilityLike,
): any {
  const filename = attachment.filename ?? attachment.title;
  const inputKey = getAttachmentInputKey(attachment);
  if (!isSupportedInput(inputKey, capabilities)) {
    return unsupportedInputText(inputKey!, filename);
  }
  return attachmentToMessagePart(attachment);
}

/**
 * 根据模型能力处理用户附件和 tool result 附件。
 * 该函数只生成请求消息，不修改 Agent 历史记录。
 */
export function prepareMessagesForModel(
  messages: any[],
  capabilities?: ModelCapabilityLike,
): any[] {
  const result: any[] = [];
  let pendingToolAttachments: Array<{ part: any; filename: string }> = [];

  const flushPendingToolAttachments = () => {
    if (pendingToolAttachments.length === 0) return;
    const filenames = pendingToolAttachments.map(
      ({ filename }, index) => `${index + 1}. ${filename}`,
    );
    result.push({
      role: "user",
      content: [
        {
          type: "text",
          text: `<system-reminder>The following files were produced by the preceding tool results:\n${filenames.join("\n")}</system-reminder>`,
        },
        ...pendingToolAttachments.map(({ part }) => part),
      ],
    });
    pendingToolAttachments = [];
  };

  for (const message of messages) {
    if (message.role !== "tool") flushPendingToolAttachments();

    if (message.role === "user") {
      if (!Array.isArray(message.content)) {
        result.push(message);
        continue;
      }
      const content = message.content.map((part: any) => {
        if (part.type !== "image_url" && part.type !== "file" && part.type !== "image") {
          return part;
        }
        const inputKey = messagePartToInputKey(part);
        if (!inputKey || isSupportedInput(inputKey, capabilities)) return part;
        return unsupportedInputText(inputKey, messagePartFilename(part));
      });
      result.push({ ...message, content });
      continue;
    }

    if (
      message.role === "tool" &&
      Array.isArray(message.attachments) &&
      message.attachments.length > 0
    ) {
      const attachments: MessageAttachment[] = message.attachments.filter(
        (attachment: MessageAttachment) => attachment?.content || attachment?.url,
      );
      if (!attachments.length) {
        result.push(message);
        continue;
      }

      const formattedAttachments = attachments.map((attachment, index) => ({
        part: attachmentToSupportedMessagePart(attachment, capabilities),
        filename:
          attachment.title ??
          attachment.filename ??
          `attachment-${pendingToolAttachments.length + index + 1}`,
      }));

      if (capabilities?.toolResultMedia === true) {
        const baseContent =
          typeof message.content === "string"
            ? [{ type: "text", text: message.content }]
            : Array.isArray(message.content)
              ? message.content
              : [{ type: "text", text: String(message.content) }];
        const { attachments: _attachments, ...rest } = message;
        result.push({
          ...rest,
          content: [
            ...baseContent,
            ...formattedAttachments.map(({ part }) => part),
          ],
        });
      } else {
        pendingToolAttachments.push(...formattedAttachments);
        const { attachments: _attachments, ...rest } = message;
        result.push(rest);
      }
      continue;
    }

    result.push(message);
  }

  flushPendingToolAttachments();
  return result;
}

/** @deprecated 使用 prepareMessagesForModel。 */
export const preprocessMessagesForModel = prepareMessagesForModel;
