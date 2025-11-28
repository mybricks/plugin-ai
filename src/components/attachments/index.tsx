import React, { useState } from "react";
import { Image } from "antd";
import { Close } from "../icons";
import css from "./index.less";
import classNames from "classnames";

interface AttachmentsProps {
  attachments: {type: "image"; content: string;}[];
  className?: string;
  onDelete?: (index: number) => void;
}
/** 附件图片 */
const AttachmentsList = (props: AttachmentsProps) => {
  const { attachments, onDelete,className } = props;
  const [preiviewVisible, setPreiviewVisible] = useState(false);
  const [preiviewCurrent, setPreiviewCurrent] = useState(0);

  return (
    <>
      <div className={classNames(css.attachments, className)}>
        {attachments.map((attachment, index) => {
          return (
            <div key={index} className={css.imageThumbnail}>
              <img
                src={attachment.content}
                onClick={() => {
                  setPreiviewCurrent(index);
                  setPreiviewVisible(true);
                }}
              />
              {onDelete && <div className={css.imageDeleteContainer} onClick={() => onDelete(index)}>
                <div className={css.imageDeleteIcon}>
                  <Close />
                </div>
              </div>}
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
          {attachments.map((attachment, index) => (
            <Image key={index} src={attachment.content} />
          ))}
        </Image.PreviewGroup>
      </div>
    </>
  )
}

export { AttachmentsList };
