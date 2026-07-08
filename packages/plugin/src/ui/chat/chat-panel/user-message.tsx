import React from "react";
import { MentionTag } from "../../components/mention";
import type { MessageRecord } from "../use-session";
import css from "./index.less";

const UserMessageChip = ({ label, tightLeft }: { label: string; tightLeft?: boolean }) => (
  <span
    className={[
      css["user-message-chip"],
      tightLeft ? css["user-message-chip-tight-left"] : "",
    ].filter(Boolean).join(" ")}
  >
    <span className={css["user-message-chip-text"]}>{label}</span>
  </span>
);

function renderUserTextWithChips(userText: string, chips?: { id: string; label: string }[]): React.ReactNode {
  if (!chips?.length || !userText.includes("[[chip:")) {
    return userText;
  }

  const chipMap = new Map(chips.map((c) => [c.id, c]));
  const parts = userText.split(/(\[\[chip:[^\]]+\]\])/);
  let previousRenderedNodeIsChip = false;

  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[\[chip:([^\]]+)\]\]$/);
        if (match) {
          const chip = chipMap.get(match[1]);
          if (!chip) return null;
          const node = <UserMessageChip key={i} label={chip.label} tightLeft={previousRenderedNodeIsChip} />;
          previousRenderedNodeIsChip = true;
          return node;
        }

        if (!part) return null;
        previousRenderedNodeIsChip = false;
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

export const DefaultUserMessage = ({ record }: { record: MessageRecord }) => {
  const focus = record.meta?.focus;
  const chips = record.meta?.chips as { id: string; label: string }[] | undefined;

  return (
    <span>
      {focus && (
        <span className={css["user-message-focus"]}>
          <MentionTag focus={focus} />
          {" "}
        </span>
      )}
      {renderUserTextWithChips(record.userText, chips)}
    </span>
  );
};
