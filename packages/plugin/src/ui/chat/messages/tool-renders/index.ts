import type { ToolRecord } from "./renders";

export type ToolRenderer = (tool: ToolRecord) => React.ReactElement;

const registry = new Map<string, ToolRenderer>();

export function registerToolRenderer(toolName: string, renderer: ToolRenderer) {
  registry.set(toolName, renderer);
}

export function getToolRenderer(toolName: string): ToolRenderer | undefined {
  return registry.get(toolName);
}
