/** Where a slash command was contributed. This is not its behavior. */
export type SlashCommandScope = "config" | "plugin" | "project" | "builtin";

interface SenderSlashCommandBase {
  /** Stable command name used for search and fallback display. */
  name: string;
  /** Preferred user-facing label; may be localized. */
  displayName?: string;
  description: string;
  scope: SlashCommandScope;
}

/**
 * A CodeAgent-backed command. Sender serializes it to an MBS marker and the
 * CodeAgent later expands that marker into the template prompt.
 */
export interface SenderPromptTemplateSlashCommand extends SenderSlashCommandBase {
  kind: "prompt-template";
  reference: `mbs-template:${string}`;
}

/**
 * A UI-owned command. It is executed immediately and never enters model
 * context or message persistence as an MBS marker.
 */
export interface SenderActionSlashCommand extends SenderSlashCommandBase {
  kind: "action";
  execute: () => void | Promise<void>;
}

/** Sender can render both UI actions and CodeAgent-backed prompt templates. */
export type SenderSlashCommand = SenderPromptTemplateSlashCommand | SenderActionSlashCommand;
