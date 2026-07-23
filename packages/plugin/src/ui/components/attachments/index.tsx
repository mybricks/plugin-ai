import React, { useRef, useState } from "react";
import { Close } from "../icons";
import css from "./index.less";
import classNames from "classnames";
import { ImagePreviewGroup } from "../image-preview";

interface Attachment {
  type: "image";
  content: string;
  /** 上传中状态，true 时显示灰色占位 */
  uploading?: boolean;
}

interface AttachmentsProps {
  attachments: Attachment[];
  className?: string;
  onDelete?: (index: number) => void;
}
/** 附件图片 */
const AttachmentsList = (props: AttachmentsProps) => {
  const { attachments, onDelete, className } = props;
  const [preiviewVisible, setPreiviewVisible] = useState(false);
  const [preiviewCurrent, setPreiviewCurrent] = useState(0);

  // 预览时只使用已上传完成的附件
  const previewableAttachments = attachments.filter((a) => !a.uploading);

  return (
    <div className={classNames(css.attachments, className)}>
      {attachments.map((attachment, index) => {
        return (
          <AttachmentItem
            key={index}
            attachment={attachment}
            onDelete={onDelete ? () => onDelete(index) : undefined}
            onPreview={() => {
              const previewIndex = previewableAttachments.indexOf(attachment);
              if (previewIndex !== -1) {
                setPreiviewVisible(true);
                setPreiviewCurrent(previewIndex);
              }
            }}
          />
        )
      })}
      <ImagePreviewGroup
        images={previewableAttachments.map((attachment) => attachment.content)}
        visible={preiviewVisible}
        current={preiviewCurrent}
        onVisibleChange={setPreiviewVisible}
        onCurrentChange={setPreiviewCurrent}
      />
    </div>
  )
}

export { AttachmentsList };
export type { Attachment };

const AttachmentItem = (props: { attachment: Attachment, onDelete?: () => void; onPreview?: () => void; }) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const { attachment, onDelete, onPreview } = props;

  return (
    <>
      <div
        className={classNames(css.imageThumbnail, {
          [css.uploadingThumbnail]: attachment.uploading,
        })}
      >
        {attachment.uploading ? (
          <div className={css.uploadingPlaceholder}>
            <span className={css.uploadingText}>上传</span>
            <span className={css.uploadingText}>中...</span>
          </div>
        ) : (
          <img ref={imgRef} src={attachment.content} onClick={() => onPreview?.()} />
        )}
        {!attachment.uploading && onDelete && (
          <div className={css.imageDeleteContainer} onClick={onDelete}>
            <div className={css.imageDeleteIcon}>
              <Close />
            </div>
          </div>
        )}
      </div>
    </>
  )
}
