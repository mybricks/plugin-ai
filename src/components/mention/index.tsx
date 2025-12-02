import React from "react";
import { Mention } from "../types";
import css from "./index.less";

interface MentionTagProps {
  mention: Mention
  onClick?: (mention: Mention) => void;
}
const MentionTag = (props: MentionTagProps) => {
  const { mention, onClick } = props;
  return (
    <div className={css.mention} onClick={() => onClick?.(mention)}>
      <div className={css.text}>{`@${mention.name}`}</div>
    </div>
  );
};

export { MentionTag }
