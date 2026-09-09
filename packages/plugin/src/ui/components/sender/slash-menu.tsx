import React, { useCallback, useMemo, useState } from "react";
import classNames from "classnames";
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
    if (!open) return false;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return true;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (matches.length) {
        const step = event.key === "ArrowDown" ? 1 : -1;
        setHighlightIndex((previous) => (previous + step + matches.length) % matches.length);
      }
      return true;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      const command = matches[highlightIndex];
      if (!command) return false;
      event.preventDefault();
      select(command);
      return true;
    }
    return false;
  }, [close, highlightIndex, matches, open, select]);

  const node = open ? (
    <div className={css.menu} onMouseDown={(event) => event.preventDefault()}>
      {matches.map((command, index) => (
        <button
          key={`${command.scope}:${command.kind}:${command.name}`}
          type="button"
          className={classNames(css.item, { [css.highlighted]: index === highlightIndex })}
          onMouseMove={() => setHighlightIndex(index)}
          onClick={() => select(command)}
        >
          <span className={css.name}>/{command.displayName ?? command.name}</span>
          <span className={css.description}>{command.description}</span>
        </button>
      ))}
    </div>
  ) : null;

  return { open, node, onInput, onKeyDown, close };
}
