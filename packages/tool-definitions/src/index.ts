import { createReadTool } from "../../agent/src/code-agent/tools/read";
import { createWriteTool } from "../../agent/src/code-agent/tools/write";
import { createEditTool } from "../../agent/src/code-agent/tools/edit";
import { createMultiEditTool } from "../../agent/src/code-agent/tools/multi-edit";
// import { createMultiWriteTool } from "../../agent/src/code-agent/tools/multi-write";
import { createDeleteTool } from "../../agent/src/code-agent/tools/delete";
import { createGrepTool } from "../../agent/src/code-agent/tools/grep";
// import { createGlobTool } from "../../agent/src/code-agent/tools/glob";
import { createBashTool } from "../../agent/src/code-agent/tools/bash";
// import { createCheckStatusTool } from "../../plugin/src/sandbox/tools/check-status";
import type { AgentSandbox, AgentSandboxCommands } from "../../agent/src/agent-sandbox";
import type { Tool } from "../../agent/src/types";

export type ToolDefinition = Pick<Tool, "name" | "description" | "parameters">;

// Build-time only: factories create closures but must never access the sandbox.
const sandbox = new Proxy({} as AgentSandbox, {
  get(_target, key) {
    throw new Error(`Metadata extraction unexpectedly accessed sandbox.${String(key)}`);
  },
});
const commands = new Proxy({} as AgentSandboxCommands, {
  get(_target, key) {
    if (key === "sandboxDesc") return undefined;
    throw new Error(`Metadata extraction unexpectedly accessed commands.${String(key)}`);
  },
});

function definition({ name, description, parameters }: Tool): ToolDefinition {
  return { name, description, parameters };
}

export const toolDefinitions = {
  read_file: definition(createReadTool(sandbox)),
  write_file: definition(createWriteTool(sandbox)),
  edit_file: definition(createEditTool(sandbox)),
  multi_edit: definition(createMultiEditTool(sandbox)),
  // multi_write: definition(createMultiWriteTool(sandbox)),
  delete_file: definition(createDeleteTool(sandbox)),
  grep_search: definition(createGrepTool(sandbox)),
  // glob_search: definition(createGlobTool(sandbox)),
  bash: definition(createBashTool(commands)),
  // "check-status": definition(createCheckStatusTool({ current: undefined })),
};

export const { read_file, write_file, edit_file, multi_edit, 
  // multi_write,
  delete_file, grep_search, 
  // glob_search, 
  bash, 
  // "check-status": check_status 
} = toolDefinitions;
export const tools = Object.values(toolDefinitions);
export default toolDefinitions;
