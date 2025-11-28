import React from "react";
import { Mention } from "../types";
import css from "./index.less";


interface MentionTagProps {
  mention: Mention
}
const MentionTag = (props: MentionTagProps) => {
  const { mention } = props;
  return <div className={css.mention} onClick={mention.onClick}>{`@${mention.name}`}</div>;
};

export { MentionTag }
