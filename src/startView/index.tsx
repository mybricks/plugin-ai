import React, { useEffect, useRef, useState } from "react"
import classNames from "classnames";
import { Rxai } from "@mybricks/rxai";
import { message } from "antd";
import { ArrowUp, Attachment, Loading, Close } from "../components/icons";
import { Agents } from "../agents";
import css from "./index.less"

interface StartViewParams {
  createRxai: () => Rxai;
}
const StartView = (params: StartViewParams) => {
  const inputEditorRef = useRef<HTMLDivElement>(null);
  const rxai = useRef<Rxai>(params.createRxai());
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

        const reader = new FileReader();
        reader.onload = function (event) {
          if (event.target) {
            const base64 = event.target.result as string;
            setAttachments((attachments) => {
              return [...attachments, base64]
            })
          } else {
            console.error("[@mybricks/plugin-ai - 上传附件失败]", event);
            message.error("[@mybricks/plugin-ai - 上传附件失败]" + event);
          }
        };
        reader.onerror = function (event) {
          console.error("[@mybricks/plugin-ai - 上传附件失败]", event);
          message.error("[@mybricks/plugin-ai - 上传附件失败]");
        };
        reader.readAsDataURL(file);
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

  useEffect(() => {
    inputEditorRef.current!.focus();
  }, [])

  return (
    <div className={css.editor}>
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
  )
}

export { StartView }
