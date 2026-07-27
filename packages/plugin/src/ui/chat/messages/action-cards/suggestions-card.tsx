import React from "react";
import classNames from "classnames";
import type { CodeAgent } from "../../../../../../agent/src";
import { context } from "../../../../context";
import { useChatPanel } from "../../chat-panel/context";
import css from "./suggestions-card.less";

export const SuggestionsBlock = ({
  turnId,
  suggestions,
  agent,
}: {
  turnId: string;
  suggestions: { desc?: string; options: string[] };
  agent: CodeAgent;
}) => {
  const { disabled } = useChatPanel();

  const handleClick = (option: string) => {
    if (disabled) return;
    context.aiQueue.send(
      agent,
      async () => {
        await agent.requestAI({ message: option });
      },
      { message: option }
    );
  };
  const handleDismiss = () => {
    if (disabled) return;
    void agent.dismissSuggestions(turnId);
  };

  return (
    <div className={css["suggestions-message"]}>
      <div className={css["suggestions-block"]}>
        <div className={css["suggestions-options"]}>
          {suggestions.options.map((opt, i) => (
            <div
              key={i}
              role="button"
              tabIndex={disabled ? -1 : 0}
              className={classNames(css["suggestion-option"], { [css["suggestion-option-disabled"]]: disabled })}
              onClick={() => handleClick(opt)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleClick(opt);
                }
              }}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <svg className={css["suggestion-option-icon"]} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 2V7C2 8.10457 2.89543 9 4 9H10M10 9L7.5 6.5M10 9L7.5 11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className={css["suggestion-option-text"]}>{opt}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
