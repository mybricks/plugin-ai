import type { ChatChipInstance } from "../../../agent/src";
import type { ChatChipRemoveHandlers } from "./types";

const chipRemoveHandlerMap = new Map<string, ChatChipRemoveHandlers>();

export function registerChipRemoveHandlers(agentKey: string, handlers?: ChatChipRemoveHandlers): void {
  if (!handlers) return;
  const current = chipRemoveHandlerMap.get(agentKey) ?? {};
  chipRemoveHandlerMap.set(agentKey, { ...current, ...handlers });
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
