import React, { useEffect, useRef, useState, useMemo } from "react";
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
        return <Attachment key={index} attachment={attachment} onDelete={onDelete ? () => onDelete(index) : undefined} />
      })}
    </div>
  )
}

export { AttachmentsList };

const Attachment = (props: { attachment: Attachment, onDelete?: () => void; }) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const { attachment, onDelete } = props;
  const [previewBCR, setPreviewBCR] = useState<DOMRect | null>(null);
  const [visible, setVisible] = useState(false);

  const delayedTask = useMemo(() => {
    return new DelayedTask<[boolean]>((visible) => {
      setVisible(visible);
    }, 50)
  }, [])

  useEffect(() => {
    if (visible) {
      if (previewBCR) {
        const imgBcr = imgRef.current!.getBoundingClientRect();

        const topSpace = imgBcr.top - 4 - previewBCR.height;

        if (topSpace > 0) {
          previewRef.current!.style.top = `${topSpace}px`;
        } else {
          previewRef.current!.style.top = `${imgBcr.top + imgBcr.height}px`;
        }
        
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
          delayedTask.startNow(true);
        }}
        onMouseLeave={() => {
          delayedTask.start(false);
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
        <div
          ref={previewRef}
          className={css.preview}
          onMouseEnter={() => {
            delayedTask.startNow(true);
          }}
          onMouseLeave={() => {
            delayedTask.start(false);
          }}
        >
          <img src={attachment.content} onLoad={(event) => {
            setPreviewBCR((event.target as HTMLImageElement).parentElement!.getBoundingClientRect())
          }} />
        </div>
      ), document.body)}
    </>
  )
}

class DelayedTask<T extends unknown[]> {
  private timerId: number | null = null;
  constructor(private callback: (...args: T) => void, private delay: number) {}

  start(...args: T) {
    this.cancel();
    this.timerId = setTimeout(() => {
      this.callback(...args);
      this.timerId = null;
    }, this.delay) as unknown as number;

    return this;
  }

  cancel() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    return this;
  }

  startNow(...args: T) {
    this.cancel();
    this.callback(...args);
    return this;
  }
}
