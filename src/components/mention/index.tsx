import React from "react";
import { Mention } from "../types";
import css from "./index.less";

interface MentionTagProps {
  mention: Mention
  focusarea?: boolean;
  onClick?: (mention: Mention) => void;
}
const MentionTag = (props: MentionTagProps) => {
  const { mention, focusarea, onClick } = props;
  return (
    <div className={css.mention} onClick={() => onClick?.(mention)}>
      <div className={css.text}>{`@${mention.title || mention.name}`}{focusarea && mention.focusArea ? `(${mention.focusArea.title || "区域"})` : ""}</div>
    </div>
  );
};

export { MentionTag }
