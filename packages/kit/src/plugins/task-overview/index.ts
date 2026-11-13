import type { CodeAgentPluginFactory } from "../../../../agent/src";
import { createTaskFirstPlugin } from "../task-first";

/** Task-first with an additional, branch-local module overview document. */
export function createTaskOverviewPlugin(): CodeAgentPluginFactory {
  const taskFirst = createTaskFirstPlugin({ overview: true });
  const factory: CodeAgentPluginFactory = async (context) => ({ ...await taskFirst(context), name: "task-overview" });
  return Object.assign(factory, { pluginName: "task-overview" });
}
