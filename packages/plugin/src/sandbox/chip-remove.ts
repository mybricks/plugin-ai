import type { ChatChipInstance } from "../../../agent/src";
import type { ChatChipRemoveHandler, SandboxChipConfig } from "./types";

const chipRemoveHandlerMap = new Map<string, Record<string, ChatChipRemoveHandler>>();

export function registerChipRemoveHandlers(agentKey: string, chips?: SandboxChipConfig[]): void {
  if (!chips?.length) return;
  const current = chipRemoveHandlerMap.get(agentKey) ?? {};
  const next = { ...current };

  for (const chip of chips) {
    if (chip.onRemove) {
      next[chip.type] = chip.onRemove;
    }
  }

  chipRemoveHandlerMap.set(agentKey, next);
}

export function triggerChipRemove(agentKey: string, chip: ChatChipInstance): void {
  const handler = chipRemoveHandlerMap.get(agentKey)?.[chip.type];
  if (!handler) return;

  try {
    handler(chip);
  } catch (error) {
    console.error("[@mybricks/plugin-ai - chip remove handler failed]", error);
  }
}
