import React, { useEffect, useRef, useState, useImperativeHandle, PropsWithoutRef, forwardRef } from "react"
import classNames from "classnames";
import { message, Image } from "antd";
import { ArrowUp, Attachment, Loading, Close } from "../icons";
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

interface SenderProps extends PropsWithoutRef<any> {
  onSend: (message: {
    message: string;
    attachments: {type: "image"; content: string}[];
  }) => void;
  loading?: boolean;
  placeholder?: string;
}

const Sender = forwardRef<{ focus: () => void }, SenderProps>((props, ref) => {
  const { loading, placeholder = "请输入" } = props;
  const inputEditorRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [inputContent, setInputContent] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<string[]>([]);

  useImperativeHandle(ref, () => {
    return {
      focus: () => {
        inputEditorRef.current!.focus()
      }
    };
  }, []);

  const send = () => {
    const inputContent = inputEditorRef.current!.textContent;
    if (inputContent && !loading) {
      props.onSend({
        message: inputContent,
        attachments: attachments.map((attachment) => {
          return {
            type: "image",
            content: attachment
          }
        }),
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

        readFileToBase64(file)
          .then((base64) => {
            setAttachments((attachments) => {
              return [...attachments, base64]
            })
          })
          .catch((event) => {
            console.error("[@mybricks/plugin-ai - 上传附件失败]", event);
            message.error("[@mybricks/plugin-ai - 上传附件失败]");
          })
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
      readFileToBase64(file)
        .then((base64) => {
          setAttachments((attachments) => {
            return [...attachments, base64]
          })
        })
        .catch((event) => {
          console.error("[@mybricks/plugin-ai - 上传附件失败]", event);
          message.error("[@mybricks/plugin-ai - 上传附件失败]");
        })
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

  useEffect(() => {
    inputEditorRef.current!.focus();
  }, [])

  return (
    <div className={css.container}>
      <div className={css.editor}>
        {attachments.length ? (
          <Attachments attachments={attachments} onDelete={onAttachmentsDelete}/>
        ) : null}
        <div className={css.input}>
          <div className={css.inputEditorContainer}>
            <div
              ref={inputEditorRef}
              className={css.inputEditor}
              contentEditable={!loading}
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
          </div>
          <div className={css.rightArea}>
            <div className={classNames(css.sendButtonContainer, {
              [css.disabled]: !inputContent || loading
            })} onClick={send}>
              <div className={classNames(css.sendButton, {
                [css.loadingButton]: loading
              })}>
                {loading ? <Loading /> : <ArrowUp />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export { Sender }

interface AttachmentsProps {
  attachments: string[];
  onDelete: (index: number) => void;
}
/** 附件图片 */
const Attachments = (props: AttachmentsProps) => {
  const { attachments, onDelete } = props;
  const [preiviewVisible, setPreiviewVisible] = useState(false);
  const [preiviewCurrent, setPreiviewCurrent] = useState(0);
  return (
    <>
      <div className={css.topArea}>
        {attachments.map((attachment, index) => {
          return (
            <div className={css.imageThumbnail}>
              <img
                src={attachment}
                onClick={() => {
                  setPreiviewCurrent(index);
                  setPreiviewVisible(true);
                }}
              />
              <div className={css.imageDeleteContainer} onClick={() => onDelete(index)}>
                <div className={css.imageDeleteIcon}>
                  <Close />
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'none' }}>
        <Image.PreviewGroup 
          preview={{ 
            visible: preiviewVisible,
            onVisibleChange: setPreiviewVisible,
            current: preiviewCurrent,
          }}
        >
          {attachments.map((src, index) => (
            <Image key={index} src={src} />
          ))}
        </Image.PreviewGroup>
      </div>
    </>
  )
}
