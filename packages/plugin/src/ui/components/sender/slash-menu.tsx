import React, { useCallback, useMemo, useState } from "react";
import classNames from "classnames";
import { handleListNavigationKeyDown } from "../menu-keyboard";
import { Skill, Code } from "../icons";
import type { SenderSlashCommand } from "./slash-command";
import type { SlashMenuInput } from "./slash-editor";
import css from "./slash-menu.less";

export interface UseSlashMenuOptions {
  commands: SenderSlashCommand[];
  disabled?: boolean;
  readInput: () => SlashMenuInput;
  onSelectCommand: (command: SenderSlashCommand) => void;
}

/**
 * Sender-only slash UX: trigger detection, keyboard navigation, and text
 * completion. It deliberately has no execute callback and knows nothing about
 * whether a command is handled by the UI or CodeAgent.
 */
export function useSlashMenu({ commands, disabled = false, readInput, onSelectCommand }: UseSlashMenuOptions) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);

  const matches = useMemo(() => commands.filter((command) => {
    const normalizedQuery = query.toLowerCase();
    return command.name.toLowerCase().startsWith(normalizedQuery) ||
      command.displayName?.toLowerCase().startsWith(normalizedQuery);
  }), [commands, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHighlightIndex(0);
  }, []);

  const select = useCallback((command: SenderSlashCommand) => {
    onSelectCommand(command);
    close();
  }, [close, onSelectCommand]);

  const onInput = useCallback(() => {
    if (disabled || commands.length === 0) {
      close();
      return;
    }
    const { query } = readInput();
    if (query === null) {
      close();
      return;
    }
    const normalizedQuery = query.toLowerCase();
    if (!commands.some((command) =>
      command.name.toLowerCase().startsWith(normalizedQuery) ||
      command.displayName?.toLowerCase().startsWith(normalizedQuery)
    )) {
      close();
      return;
    }
    setQuery(query);
    setHighlightIndex(0);
    setOpen(true);
  }, [close, commands, disabled, readInput]);

  const onKeyDown = useCallback((event: Pick<KeyboardEvent | React.KeyboardEvent, "key" | "preventDefault">): boolean => {
    return handleListNavigationKeyDown(event, {
      open,
      items: matches,
      highlightedIndex: highlightIndex,
      onMoveHighlight: (step, itemCount) => {
        setHighlightIndex((previous) => (previous + step + itemCount) % itemCount);
      },
      onSelect: select,
      onClose: close,
    });
  }, [close, highlightIndex, matches, open, select]);

  const node = open ? (
    <div className={css.menu} onMouseDown={(event) => event.preventDefault()}>
      {matches.map((command, index) => {
        const startsActionGroup = index > 0 && command.kind === "action" && matches[index - 1]?.kind !== "action";
        return (
          <React.Fragment key={`${command.scope}:${command.kind}:${command.name}`}>
            {startsActionGroup ? (
              <div className={css.groupDivider} role="separator" />
            ) : null}
            <button
              type="button"
              className={classNames(css.item, { [css.highlighted]: index === highlightIndex })}
              onMouseMove={() => setHighlightIndex(index)}
              onClick={() => select(command)}
            >
              <span className={css.icon}>
                {command.icon ?? (command.kind === "prompt-template" ? <Skill /> : <Code />)}
              </span>
              <span className={css.name}>{command.displayName ?? command.name}</span>
              <span className={css.description}>{command.description}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  ) : null;

  return { open, node, onInput, onKeyDown, close };
}
