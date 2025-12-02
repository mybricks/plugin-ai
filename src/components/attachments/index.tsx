import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Close } from "../icons";
import css from "./index.less";
import classNames from "classnames";

interface Attachment {
  type: "image";
  content: string;
}

interface AttachmentsProps {
  attachments: Attachment[];
  className?: string;
  onDelete?: (index: number) => void;
}
/** 附件图片 */
const AttachmentsList = (props: AttachmentsProps) => {
  const { attachments, onDelete, className } = props;

  return (
    <div className={classNames(css.attachments, className)}>
      {attachments.map((attachment, index) => {
        return <Attachment key={index} attachment={attachment} onDelete={() => onDelete?.(index)} />
      })}
    </div>
  )
}

export { AttachmentsList };

const Attachment = (props: { attachment: Attachment, onDelete: () => void; }) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const { attachment, onDelete } = props;
  const [previewBCR, setPreviewBCR] = useState<DOMRect | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      if (previewBCR) {
        const imgBcr = imgRef.current!.getBoundingClientRect();

        previewRef.current!.style.top = `${imgBcr.top - previewBCR.height - 4}px`
        
        if (imgBcr.left + previewBCR.width > document.body.offsetWidth) {
          previewRef.current!.style.left = `${imgBcr.left + imgBcr.width - previewBCR.width}px`
        } else {
          previewRef.current!.style.left = `${imgBcr.left}px`;
        }

        previewRef.current!.style.visibility = "visible";
      }
    } else {
      previewRef.current!.style.visibility = "hidden";
    }
  }, [previewBCR, visible])

  return (
    <>
      <div
        className={css.imageThumbnail}
        onMouseEnter={() => {
          setVisible(true);
        }}
        onMouseLeave={() => {
          setVisible(false);
        }}
      >
        <img ref={imgRef} src={attachment.content} />
        {onDelete && <div className={css.imageDeleteContainer} onClick={onDelete}>
          <div className={css.imageDeleteIcon}>
            <Close />
          </div>
        </div>}
      </div>
      {createPortal((
        <div ref={previewRef} className={css.preview}>
          <img src={attachment.content} onLoad={(event) => {
            setPreviewBCR((event.target as HTMLImageElement).parentElement!.getBoundingClientRect())
          }} />
        </div>
      ), document.body)}
    </>
  )
}
