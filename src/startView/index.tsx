import React, { useEffect, useRef, useState } from "react"
import classNames from "classnames";
import { message } from "antd";
import { ArrowUp, Attachment, Loading, Close } from "../components/icons";
import { Agents } from "../agents";
import { Messages } from "../view/components/messages/messages";
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

const StartView = ({ user }: any) => {
  const inputEditorRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [inputContent, setInputContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);

  const send = () => {
    const inputContent = inputEditorRef.current!.textContent;
    if (inputContent && !loading) {
      setLoading(true);

      Agents.requestGenerateCanvasAgent({
        message: inputContent,
        attachments: attachments.map((attachment) => {
          return {
            type: "image",
            content: attachment
          }
        }),
      }).then(() => {

      }).catch((e) => {
        message.error(e)
      }).finally(() => {
        setLoading(false);
      });
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

  const uploadAttachment = () => {
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

  const deleteAttachment = (index: number) => {
    setAttachments((attachments) => {
      attachments.splice(index, 1)
      return [...attachments]
    })
  }

  const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.clipboardData.files[0];
    if (file?.type.startsWith('image/')) {
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

  useEffect(() => {
    inputEditorRef.current!.focus();
  }, [])

  return (
    <>
    {/* TODO：临时，把Messages再封装下 */}
    <div className={css.temp} style={{ display: loading ? "flex" : "none"}}>
      <Messages user={user}/>
    </div>
    <div className={css.editor} style={{ display: !loading ? "block" : "none"}}>
      {attachments.length ? <div className={css.topArea}>
        {attachments.map((attachment, index) => {
          return (
            <div className={css.imageThumbnail}>
              <img src={attachment} />
              <div className={css.imageDeleteContainer} onClick={() => deleteAttachment(index)}>
                <div className={css.imageDeleteIcon}>
                  <Close />
                </div>
              </div>
            </div>
          )
        })}
      </div> : null}
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
            您好，我是智能助手，请详细描述您要搭建的应用内容
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
    </>
  )
}

export { StartView }
