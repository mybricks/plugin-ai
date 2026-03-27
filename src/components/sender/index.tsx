import React, { useEffect, useRef, useState, useImperativeHandle, PropsWithoutRef, forwardRef } from "react"
import classNames from "classnames";
import { message } from "antd";
import { Attachment, Loading, Send, Code } from "../icons";
import { MentionTag } from "../mention";
import { AttachmentsList } from "../attachments";
import type { Attachment as AttachmentItem } from "../attachments";
import { Mention, Attachments } from "../types";
import { ChatMode, type ChatModeType } from "../chatMode";
import css from "./index.less"

const readFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (event) {
      if (event.target) {
        const base64 = event.target.result as string;
        resolve(base64);
      } else {
        reject(event);
      }
    };
    reader.onerror = function (event) {
      reject(event);
    };
    reader.readAsDataURL(file);
  })
}

interface SenderProps {
  onSend: (message: {
    message: string;
    attachments: Attachments;
    mentions: Mention[];
    [key: string]: any;
  }) => void;
  onMentionClick?: (mention: Mention) => void;
  loading?: boolean;
  placeholder?: string;
  attachmentsPrompt?: string;
  disabled?: boolean;
  onBlur?: () => void;
  mode?: "mention"
  chatMode?: ChatModeType;
  onChatModeChange?: (chatMode: ChatModeType) => void;
  /** 输入框风格：compact（紧凑，默认）| loose（松散，padding 更大）*/
  variant?: 'compact' | 'loose';
  /** 自定义图片上传函数，返回 CDN URL；不传则使用 base64 */
  onUpload?: (file: File) => Promise<string>;
  onStop?: () => void;
}

interface SenderRef {
  focus: () => void;
  // TODO: 目前仅展示聚焦组件且单个比较简单直接set即可，后续可通过输入框@唤起选择多个
  setMentions: (mentions: Mention[]) => void;
}

const Sender = forwardRef<SenderRef, SenderProps>((props, ref) => {
  const { loading, placeholder = "请输入", disabled, onMentionClick, onBlur, attachmentsPrompt, mode, chatMode, onChatModeChange, variant = 'compact', onUpload, onStop } = props;
  const inputEditorRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [inputContent, setInputContent] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [vibeCoding, setVibeCoding] = useState(false);
  const [uploading, setUploading] = useState(false);

  useImperativeHandle(ref, () => {
    return {
      focus: () => {
        inputEditorRef.current!.focus()
      },
      setMentions: (mentions) => {
        setMentions(mentions)
        setVibeCoding(mentions[0]?.vibeCoding || false);
      },
    };
  }, []);

  const send = () => {
    const inputContent = inputEditorRef.current!.textContent;
    const hasUploadingAttachment = attachments.some((a) => a.uploading);
    if (inputContent && !loading && !disabled && !uploading && !hasUploadingAttachment) {
      props.onSend({
        message: inputContent,
        attachments,
        mentions,
      })

      setAttachments([]);
      setInputContent("");
      inputEditorRef.current!.textContent = "";
    }
  }

  const onInput = () => {
    setInputContent(inputEditorRef.current!.textContent)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      if (isComposing) {
        return;
      }

      if (event.shiftKey) {

      } else {
        event.preventDefault();
        send();
      }
    }
  }

  const onCompositionStart = () => {
    setIsComposing(true);
  }

  const onCompositionEnd = () => {
    setIsComposing(false);
  }

  /** 检查附件数量是否超出限制，超出返回 true */
  const checkAttachmentsLimit = () => {
    if (attachments.length > 4) {
      message.info("当前最多只能上传五张图片");
      return true;
    }
    return false;
  }

  const updateAttachmentsByFile = (file: File) => {
    if (file.size > 5000 * 1024) {
      message.info(`当前文件大小 ${(file.size / 1024).toFixed(2)}K，超过了5000K，建议您截取页面中的某个区域作为附件`)
      return;
    }

    if (onUpload) {
      // 先插入占位，上传完成后替换为真实 URL
      const localUrl = URL.createObjectURL(file);
      const placeholder: AttachmentItem = { type: "image", content: localUrl, uploading: true };
      setAttachments((prev) => [...prev, placeholder]);
      setUploading(true);
      onUpload(file)
        .then((url) => {
          URL.revokeObjectURL(localUrl);
          setAttachments((prev) => {
            const next = [...prev];
            const idx = next.findIndex((a) => a === placeholder);
            if (idx !== -1) next[idx] = { type: "image", content: url };
            return next;
          });
          if (!inputContent && attachmentsPrompt) {
            setInputContent(attachmentsPrompt);
            const selection = window.getSelection();
            if (!selection?.rangeCount) return;
            const range = selection.getRangeAt(0);
            const textNode = document.createTextNode(attachmentsPrompt);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
          }
        })
        .catch((event) => {
          URL.revokeObjectURL(localUrl);
          setAttachments((prev) => prev.filter((a) => a !== placeholder));
          console.error("[@mybricks/plugin-ai - 图片上传CDN失败]", event);
          message.error("图片上传失败，请重试");
        })
        .finally(() => {
          setUploading(false);
        });
    } else {
      // 无 onUpload，走 base64
      readFileToBase64(file)
        .then((base64) => {
          setAttachments((attachments) => {
            return [...attachments, { type: "image", content: base64 }]
          })
          if (!inputContent && attachmentsPrompt) {
            setInputContent(attachmentsPrompt);
            const selection = window.getSelection();

            if (!selection?.rangeCount) {
              return;
            }

            const range = selection.getRangeAt(0);
            const textNode = document.createTextNode(attachmentsPrompt);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
          }
        })
        .catch((event) => {
          console.error("[@mybricks/plugin-ai - 上传附件失败]", event);
          message.error("[@mybricks/plugin-ai - 上传附件失败]");
        })
    }
  }

  const uploadAttachment = () => {
    if (loading || disabled || uploading) {
      return;
    }
    if (checkAttachmentsLimit()) {
      return;
    }
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';

    fileInput.addEventListener('change', function (e) {
      const target = e.target as HTMLInputElement;
      if (!target) {
        return;
      }
      const file = target.files?.[0];

      if (file) {
        if (!file.type.startsWith('image/')) {
          return;
        }

        updateAttachmentsByFile(file);
      }
    });

    fileInput.click();
  };

  const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (loading || disabled || uploading) {
      return;
    }
    const file = event.clipboardData.files[0];
    if (file?.type.startsWith('image/')) {
      if (checkAttachmentsLimit()) {
        return;
      }
      updateAttachmentsByFile(file);
    } else {
      const content = event.clipboardData.getData('text/plain');

      if (!content) {
        return;
      }

      const selection = window.getSelection();

      if (!selection?.rangeCount) {
        return;
      }

      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(content);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);

      setInputContent(inputEditorRef.current!.textContent)
    }
  }

  const onAttachmentsDelete = (index: number) => {
    setAttachments((attachments) => {
      attachments.splice(index, 1)
      return [...attachments]
    })
  }

  return (
    <div className={classNames(css.container, { [css.loose]: variant === 'loose' })}>
      <div className={classNames(css.editor, {
        [css.noMentions]: mode === "mention" && !mentions.length
      })}>
        {attachments.length ? (
          <div className={css.topArea}>
            <AttachmentsList attachments={attachments} onDelete={onAttachmentsDelete}/>
          </div>
        ) : null}
        {mentions.length ? (
          <div className={css.mentions}>
            <span>对于</span>
            {chatMode === "agent" || chatMode === "vibe" && !mentions[0].focusArea && <MentionTag mention={mentions[0]} onClick={onMentionClick} />}
            {chatMode === "agent" && <span>{(mentions[0].type === "page" ? "页面" : "组件") + (mentions[0].focusArea ? "的" : "")}</span>}
            {mentions[0].focusArea ? (
              <span className={css.focusarea}>
                {mentions[0].focusArea.title || "区域"}
              </span>
            ) : null}
            {/* {vibeCoding ? <span className={css.vibeCoding}>(开发中)</span> : null} */}
            {/* {mentions.map((mention) => {
              return <MentionTag key={mention.id} mention={mention} onClick={onMentionClick} />
            })} */}
          </div>
        ) : null}
        <div className={css.input}>
          <div className={css.inputEditorContainer}>
            <div
              data-zone-type="ai-request"
              ref={inputEditorRef}
              className={css.inputEditor}
              contentEditable={disabled ? false : true}
              onKeyDown={onKeyDown}
              onCompositionStart={onCompositionStart}
              onCompositionEnd={onCompositionEnd}
              onInput={onInput}
              onPaste={onPaste}
              onBlur={onBlur}
            ></div>
            {!inputContent && <div className={css.inputPlaceholder}>
              {placeholder}
            </div>}
          </div>
        </div>
        <div className={css.editorAction}>
          <div className={classNames(css.leftArea, {
            [css.disabled]: loading || disabled || uploading
          })}>
            {/* 模式切换，暂时去除 */}
            {/* {chatMode ? <ChatMode disabled={disabled} chatMode={chatMode} onChange={onChatModeChange} /> : null} */}
            <div data-zone-type="ai-request" className={css.attachmentButton} onClick={uploadAttachment}>
              <Attachment />
            </div>
          </div>
          <div className={css.rightArea}>
            <div data-zone-type="ai-request" className={classNames(css.sendButtonContainer, {
              [css.disabled]: !loading && (disabled || !inputContent || uploading || attachments.some((a) => a.uploading))
            })} onClick={send}>
              <div
                data-zone-type="ai-request"
                className={classNames(css.sendButton, {
                  [css.loadingButton]: loading || uploading
                })}
                data-mybricks-tip={loading ? "停止" : ""}
                onClick={() => {
                  if (loading) {
                    onStop?.();
                  }
                }}
              >
                {(loading || uploading) ? <Loading /> : <Send />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export { Sender }
export type { SenderRef, SenderProps }
