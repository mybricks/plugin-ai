import React, { useRef, useState } from "react";
import { Close, FileIcon } from "../icons";
import css from "./index.less";
import classNames from "classnames";
import { ImagePreviewGroup } from "../image-preview";
import { lang } from "../../../i18n";

interface Attachment {
  type: "image" | "file";
  /** 图片为 dataURI/URL；file 类型可缺省（文件 chip 仅展示文件名） */
  content?: string;
  /** file 类型的文件名（展示用），兼容 filename 兜底 */
  title?: string;
  /** 上传中状态，true 时显示灰色占位 */
  uploading?: boolean;
}

interface AttachmentsProps {
  attachments: Attachment[];
  className?: string;
  onDelete?: (index: number) => void;
}

const isFileAttachment = (attachment: Attachment) => attachment.type === "file";

const getAttachmentFileName = (attachment: Attachment) =>
  (attachment as { filename?: string }).filename ?? attachment.title ?? "";

/** 附件列表：image 渲染缩略图（可预览），file 渲染文件名 chip（不可点击查看） */
const AttachmentsList = (props: AttachmentsProps) => {
  const { attachments, onDelete, className } = props;
  const [preiviewVisible, setPreiviewVisible] = useState(false);
  const [preiviewCurrent, setPreiviewCurrent] = useState(0);

  // 预览时只使用已上传完成的图片附件
  const previewableAttachments = attachments.filter((a) => !isFileAttachment(a) && !a.uploading);

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
        images={previewableAttachments.map((attachment) => attachment.content as string)}
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
          [css.fileThumbnail]: isFileAttachment(attachment),
        })}
      >
        {attachment.uploading ? (
          <div className={css.uploadingPlaceholder}>
            <span className={css.uploadingText}>{lang.sender.uploading()}</span>
          </div>
        ) : isFileAttachment(attachment) ? (
          <div className={css.fileChip} title={getAttachmentFileName(attachment)}>
            <span className={css.fileChipIcon}><FileIcon /></span>
            <span className={css.fileChipName}>{getAttachmentFileName(attachment)}</span>
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
