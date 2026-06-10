import React from "react";
import classNames from "classnames";
import type { CodeAgent } from "../../../../../../agent/src";
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
    agent.requestAI({ message: option });
  };
  const handleDismiss = () => {
    if (disabled) return;
    void agent.dismissSuggestions(turnId);
  };

  return (
    <div className={css["suggestions-message"]}>
      <div className={css["suggestions-block"]}>
        <div className={css["suggestions-desc"]}>
          <span className={css["suggestions-header-title"]}>[ 对下一步的建议 ]</span>
          {suggestions.desc && <span className={css["suggestions-desc-text"]}>{suggestions.desc}</span>}
        </div>
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
              <span className={css["suggestion-option-text"]}>{opt}</span>
            </div>
          ))}
          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            className={classNames(css["suggestion-option"], css["suggestion-option-dismiss"], { [css["suggestion-option-disabled"]]: disabled })}
            onClick={handleDismiss}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleDismiss();
              }
            }}
            style={{ animationDelay: `${suggestions.options.length * 60}ms` }}
          >
            <span className={css["suggestion-option-text"]}>以上都不需要</span>
          </div>
        </div>
      </div>
    </div>
  );
};
