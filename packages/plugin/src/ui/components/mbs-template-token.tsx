import React from "react";
import css from "./mbs-template-token.less";

/**
 * One visual representation for a durable `[$mbs-template:...]` record.
 * The marker itself remains the stored/copyable text; this is display only.
 */
export const MbsTemplateToken = ({ name, displayName }: { name: string; displayName?: string }) => (
  <span className={css.token}>/{displayName ?? name}</span>
);
