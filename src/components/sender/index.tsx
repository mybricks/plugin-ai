import React, { useEffect, useRef, useState, useImperativeHandle, PropsWithoutRef, forwardRef } from "react"
import classNames from "classnames";
import { message } from "antd";
import { Attachment, Loading, Send } from "../icons";
import { MentionTag } from "../mention";
import { AttachmentsList } from "../attachments";
import { Mention, Attachments } from "../types";
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
  }) => void;
  onMentionClick?: (mention: Mention) => void;
  loading?: boolean;
  placeholder?: string;
}

interface SenderRef {
  focus: () => void;
  // TODO: 目前仅展示聚焦组件且单个比较简单直接set即可，后续可通过输入框@唤起选择多个
  setMentions: (mentions: Mention[]) => void;
}

const Sender = forwardRef<SenderRef, SenderProps>((props, ref) => {
  const { loading, placeholder = "请输入", onMentionClick } = props;
  const inputEditorRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [inputContent, setInputContent] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachments>([]);
  const [mentions, setMentions] = useState<Mention[]>([]);

  useImperativeHandle(ref, () => {
    return {
      focus: () => {
        inputEditorRef.current!.focus()
      },
      setMentions: (mentions) => {
        setMentions(mentions)
      },
    };
  }, []);

  const send = () => {
    const inputContent = inputEditorRef.current!.textContent;
    if (inputContent && !loading) {
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
    if (attachments.length > 1) {
      message.info("当前只能上传两张图片");
      return true;
    }
    return false;
  }

  const updateAttachmentsByFile = (file: File) => {
    readFileToBase64(file)
      .then((base64) => {
        setAttachments((attachments) => {
          return [...attachments, { type: "image", content: base64 }]
        })
        if (!inputContent) {
          const defaultContent = "根据附件中的图片内容进行设计开发，要求尽可能还原其中的各类设计细节以及功能，在此基础上可做调整优化创新";
          setInputContent(defaultContent);
          const selection = window.getSelection();

          if (!selection?.rangeCount) {
            return;
          }

          const range = selection.getRangeAt(0);
          const textNode = document.createTextNode(defaultContent);
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

  const uploadAttachment = () => {
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
    <div className={css.container}>
      <div className={css.editor}>
        {/* {attachments.length ? (
          <div className={css.topArea}>
            <AttachmentsList attachments={attachments} onDelete={onAttachmentsDelete}/>
          </div>
        ) : null} */}
        {mentions.length ? (
          <div className={css.mentions}>
            <span>对于</span>
            <MentionTag mention={mentions[0]} onClick={onMentionClick} />
            <span>{mentions[0].type === "page" ? "页面" : "组件"}</span>
            {/* {mentions.map((mention) => {
              return <MentionTag key={mention.id} mention={mention} onClick={onMentionClick} />
            })} */}
          </div>
        ) : null}
        <div className={css.input}>
          <div className={css.inputEditorContainer}>
            <div
              ref={inputEditorRef}
              className={css.inputEditor}
              contentEditable={true}
              onKeyDown={onKeyDown}
              onCompositionStart={onCompositionStart}
              onCompositionEnd={onCompositionEnd}
              onInput={onInput}
              onPaste={onPaste}
            ></div>
            {!inputContent && <div className={css.inputPlaceholder}>
              {placeholder}
            </div>}
          </div>
        </div>
        <div className={css.editorAction}>
          <div className={css.leftArea}>
            <div className={css.attachmentButton} onClick={uploadAttachment}>
              <Attachment />
            </div>
            {attachments.length ? (
              <AttachmentsList attachments={attachments} onDelete={onAttachmentsDelete}/>
            ) : null}
          </div>
          <div className={css.rightArea}>
            <div className={classNames(css.sendButtonContainer, {
              [css.disabled]: !inputContent || loading
            })} onClick={send}>
              <div className={classNames(css.sendButton, {
                [css.loadingButton]: loading
              })}>
                {loading ? <Loading /> : <Send />}
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
