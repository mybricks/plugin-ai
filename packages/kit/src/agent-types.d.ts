/**
 * Declaration-build shim for the peer dependency.
 *
 * Published declarations continue to import these names from
 * `@mybricks/agent`; consumers receive the concrete types from that package.
 */
export interface UnifiedFile {
  path: string;
  content: string;
  [key: string]: unknown;
}

export type CodeAgentPromptOptions = any;

export interface AgentOptions {
  disabledModes?: string[];
  [key: string]: any;
}

export type CodeAgentBuiltinToolName = string;

export interface CodeAgentOptions {
  tools?: Tool[];
  disabledModes?: string[];
  builtinTools?: CodeAgentBuiltinToolName[];
  getAttachmentContextMessages?: (context: any) => Promise<string[]>;
  [key: string]: any;
}

export interface Tool {
  [key: string]: any;
}

export declare const BASH_TOOL_NAME: string;
export declare const DELETE_TOOL_NAME: string;
export declare const EDIT_TOOL_NAME: string;
export declare const GREP_TOOL_NAME: string;
export declare const INIT_PROJECT_TOOL_NAME: string;
export declare const MULTI_EDIT_TOOL_NAME: string;
export declare const READ_TOOL_NAME: string;
export declare const WRITE_TOOL_NAME: string;
