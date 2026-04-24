import React, { useEffect, useRef, useState, useImperativeHandle, PropsWithoutRef, forwardRef } from "react"
import classNames from "classnames";
import { message } from "antd";
import { Attachment, Loading, Send, Code } from "../icons";
import { MentionTag } from "../mention";
import { AttachmentsList } from "../attachments";
import type { Attachment as AttachmentItem } from "../attachments";
import { Mention, Attachments } from "../types";
import { ChatMode, type ChatModeType } from "../chat-mode";
import type { QueueItem } from "../../context/queue";
import type { ModelSelection } from "../../../../../request/src/providers";
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

const PendingQueue = ({ queue, onRemove }: { queue: QueueItem[]; onRemove?: (id: string) => void }) => {
  const [expanded, setExpanded] = useState(true);
  if (!queue.length) return null;
  return (
    <div className={css.pendingQueue}>
      <div className={css.pendingQueueHeader} onClick={() => setExpanded(v => !v)}>
        <span className={css.pendingQueueArrow}>{expanded ? <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="12" height="12" style={{ transform: 'rotate(0deg)', display: 'block' }}><path d="M512 714.666667c-8.533333 0-17.066667-2.133333-23.466667-8.533334l-341.333333-341.333333c-12.8-12.8-12.8-32 0-44.8 12.8-12.8 32-12.8 44.8 0l320 317.866667 317.866667-320c12.8-12.8 32-12.8 44.8 0 12.8 12.8 12.8 32 0 44.8L533.333333 704c-4.266667 8.533333-12.8 10.666667-21.333333 10.666667z" fill="currentColor"/></svg> : <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="12" height="12" style={{ transform: 'rotate(-90deg)', display: 'block' }}><path d="M512 714.666667c-8.533333 0-17.066667-2.133333-23.466667-8.533334l-341.333333-341.333333c-12.8-12.8-12.8-32 0-44.8 12.8-12.8 32-12.8 44.8 0l320 317.866667 317.866667-320c12.8-12.8 32-12.8 44.8 0 12.8 12.8 12.8 32 0 44.8L533.333333 704c-4.266667 8.533333-12.8 10.666667-21.333333 10.666667z" fill="currentColor"/></svg>}</span>
        <span>{queue.length} 个待发送问题</span>
      </div>
      {expanded && (
        <div className={css.pendingQueueList}>
          {queue.map((item, index) => (
            <div key={item.id} className={css.pendingQueueItem}>
              <span className={css.pendingQueueDot} />
              {item.params?.focus && (item.params.focus.focusArea || item.params.focus.title) && (
                <span className={css.pendingQueueFocus}>
                  {/* <span>对于</span> */}
                  <span className={css.pendingQueueFocusArea}>
                    {item.params.focus.focusArea?.title || item.params.focus.title}
                  </span>
                </span>
              )}
              <span className={css.pendingQueueMsg}>{item.message || `消息 ${index + 1}`}</span>
              {item.attachments && item.attachments.length > 0 && (
                <span className={css.pendingQueueBadge}>{item.attachments.length} 个附件</span>
              )}
              <button className={css.pendingQueueDel} onClick={() => onRemove?.(item.id)}>
                <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" fill="none"><path d="M874.666667 241.066667h-202.666667V170.666667c0-40.533333-34.133333-74.666667-74.666667-74.666667h-170.666666c-40.533333 0-74.666667 34.133333-74.666667 74.666667v70.4H149.333333c-17.066667 0-32 14.933333-32 32s14.933333 32 32 32h53.333334V853.333333c0 40.533333 34.133333 74.666667 74.666666 74.666667h469.333334c40.533333 0 74.666667-34.133333 74.666666-74.666667V305.066667H874.666667c17.066667 0 32-14.933333 32-32s-14.933333-32-32-32zM416 170.666667c0-6.4 4.266667-10.666667 10.666667-10.666667h170.666666c6.4 0 10.666667 4.266667 10.666667 10.666667v70.4h-192V170.666667z m341.333333 682.666666c0 6.4-4.266667 10.666667-10.666666 10.666667H277.333333c-6.4 0-10.666667-4.266667-10.666666-10.666667V309.333333h490.666666V853.333333z" fill="currentColor"/><path d="M426.666667 736c17.066667 0 32-14.933333 32-32V490.666667c0-17.066667-14.933333-32-32-32s-32 14.933333-32 32v213.333333c0 17.066667 14.933333 32 32 32zM597.333333 736c17.066667 0 32-14.933333 32-32V490.666667c0-17.066667-14.933333-32-32-32s-32 14.933333-32 32v213.333333c0 17.066667 14.933333 32 32 32z" fill="currentColor"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface ModelSelectorProps {
  modelSelector: NonNullable<SenderProps['modelSelector']>;
  disabled?: boolean;
}

const ModelSelector = ({ modelSelector, disabled }: ModelSelectorProps) => {
  const { models, selected: initialSelected, onSelect } = modelSelector;
  
  // 内部维护 selected 状态，实现响应式
  const [selected, setSelected] = useState<ModelSelection | null | undefined>(initialSelected);

  // 同步外部 initialSelected 的变化
  useEffect(() => {
    setSelected(initialSelected);
  }, [initialSelected]);

  return (
    <select
      className={css.modelSelect}
      disabled={disabled}
      value={selected ? `${selected.providerId}|${selected.modelId}` : ''}
      onChange={(e) => {
        const [providerId, modelId] = e.target.value.split('|');
        const newSelected = { providerId, modelId };
        setSelected(newSelected);
        onSelect(newSelected);
      }}
    >
      {models.map((m) => (
        <option key={`${m.providerId}|${m.modelId}`} value={`${m.providerId}|${m.modelId}`}>
          {m.modelName}
        </option>
      ))}
    </select>
  );
};

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
  pendingQueue?: QueueItem[];
  onRemoveFromQueue?: (id: string) => void;
  /** 输入框上方的 focus 信息渲染（mention 区域展示） */
  renderFocus?: () => React.ReactNode;
  /** 模型选择器配置 */
  modelSelector?: {
    models: Array<ModelSelection & { modelName: string }>;
    selected?: ModelSelection | null;
    onSelect: (selection: ModelSelection) => void;
  };
}

interface SenderRef {
  focus: () => void;
  // TODO: 目前仅展示聚焦组件且单个比较简单直接set即可，后续可通过输入框@唤起选择多个
  setMentions: (mentions: Mention[]) => void;
}

const Sender = forwardRef<SenderRef, SenderProps>((props, ref) => {
  const { loading, placeholder = "请输入", disabled, onMentionClick, onBlur, attachmentsPrompt, mode, chatMode, onChatModeChange, variant = 'compact', onUpload, onStop, pendingQueue, onRemoveFromQueue, renderFocus, modelSelector } = props;
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
    if (inputContent && !disabled && !uploading && !hasUploadingAttachment) {
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
    if (disabled || uploading) {
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
    if (disabled || uploading) {
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
      {pendingQueue && pendingQueue.length > 0 && (
        <PendingQueue queue={pendingQueue} onRemove={onRemoveFromQueue} />
      )}
      <div className={classNames(css.editor, {
        [css.noMentions]: mode === "mention" && !mentions.length
      })}>
        {attachments.length ? (
          <div className={css.topArea}>
            <AttachmentsList attachments={attachments} onDelete={onAttachmentsDelete}/>
          </div>
        ) : null}
        {renderFocus ? (
          <div className={css.mentions}>
            {renderFocus()}
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
            [css.disabled]: disabled || uploading
          })}>
            <div data-zone-type="ai-request" className={css.attachmentButton} onClick={uploadAttachment}>
              <Attachment />
            </div>
            {/* 模式切换，暂时去除 */}
            {/* {chatMode ? <ChatMode disabled={disabled} chatMode={chatMode} onChange={onChatModeChange} /> : null} */}
            {modelSelector && modelSelector.models.length > 0 && (
              <ModelSelector modelSelector={modelSelector} disabled={disabled || uploading || loading} />
            )}
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
                onClick={(e) => {
                  if (loading) {
                    e.stopPropagation();
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
