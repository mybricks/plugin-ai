import React from "react";
import type { Mention } from "../types";
import css from "./index.less";

interface MentionTagProps {
  // mention: Mention
  // focusarea?: boolean;
  onClick?: (mention: Mention) => void;
  focus: {
    comId: string;
    title: string;
    focusArea?: {
      title: string;
    }
  }
}
const MentionTag = (props: MentionTagProps) => {
  const mention = {
    comId: props.focus.comId,
    pageId: "",
    title: props.focus.title,
    type: "uiCom" as const,
    focusArea: props.focus.focusArea ? {
      selector: "",
      title: props.focus.focusArea.title,
    } : undefined,
  } satisfies Mention;
  return (
    <div className={css.mention} onClick={() => props.onClick?.(mention)}>
      {/* <div className={css.text}>{`@${mention.title || mention.name}`}{focusarea && mention.focusArea ? `(${mention.focusArea.title || "区域"})` : ""}</div> */}

      {/* <div className={css.text}>@{focusarea && mention.focusArea ? `${mention.focusArea.title || "区域"}` : (mention.title || mention.name)}</div> */}
      <div className={css.text}>@{props.focus?.focusArea ? (props.focus.focusArea?.title ?? '区域') : props.focus?.title}</div>
    </div>
  );
};

export { MentionTag }
