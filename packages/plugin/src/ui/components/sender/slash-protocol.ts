import type { SenderPromptTemplateSlashCommand } from "./slash-command";

/**
 * Map a durable MBS reference to the current command metadata. A fallback
 * keeps copied history displayable if its plugin has since been disabled.
 */
export function resolvePromptTemplateSlashCommand(
  reference: SenderPromptTemplateSlashCommand["reference"],
  commands: SenderPromptTemplateSlashCommand[],
): SenderPromptTemplateSlashCommand {
  return commands.find((item) => item.reference === reference) ?? {
    kind: "prompt-template",
    name: reference.slice("mbs-template:".length),
    displayName: reference.slice("mbs-template:".length),
    description: "",
    scope: "plugin",
    reference,
  };
}
