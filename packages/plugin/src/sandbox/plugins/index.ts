import type { CodeAgentPlugin } from "../../../../agent/src";
import { designerPlugin } from "./designer";

/** 所有 sandbox 共享的内置 Agent 插件。 */
export const builtInSandboxPlugins: CodeAgentPlugin[] = [designerPlugin];

export { designerPlugin } from "./designer";
