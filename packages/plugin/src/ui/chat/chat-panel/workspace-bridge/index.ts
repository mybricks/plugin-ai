import type {
  AgentMode,
  Tool,
  ToolUIChannel,
} from "../../../../../../agent/src";
import type { AgentSandbox } from "../../../../../../agent/src";
import {
  BrowserToolBridge,
  type BrowserToolRequest,
} from "./browser-tool-bridge";
import { FileHmr } from "./file-hmr";

type RequestJson = <T = unknown>(
  path: string,
  init?: RequestInit,
) => Promise<T>;

export class WorkspaceBridge<TAgent> {
  private readonly fileHmr: FileHmr;
  private readonly browserTools: BrowserToolBridge<TAgent>;

  constructor(options: {
    workspaceId: string;
    requestJson: RequestJson;
    agent: TAgent;
    tools?: Tool[];
    canHandleBrowserTasks?: () => boolean;
    getMode: () => AgentMode;
    setMode: (mode: AgentMode, reason?: string) => void;
  }) {
    this.fileHmr = new FileHmr({
      workspaceId: options.workspaceId,
      requestJson: options.requestJson,
    });
    this.browserTools = new BrowserToolBridge({
      workspaceId: options.workspaceId,
      requestJson: options.requestJson,
      agent: options.agent,
      tools: options.tools,
      canHandleRequests: options.canHandleBrowserTasks,
      getMode: options.getMode,
      setMode: options.setMode,
    });
  }

  getTools(): Tool[] {
    return this.browserTools.getTools();
  }

  setTools(tools: Tool[]): void {
    this.browserTools.setTools(tools);
  }

  getToolUI(): ToolUIChannel {
    return this.browserTools.getToolUI();
  }

  handleBrowserTask(request: BrowserToolRequest): Promise<void> {
    return this.browserTools.handleRequest(request);
  }

  clearPendingBrowserTools(toolName?: string, callId?: string): void {
    this.browserTools.clearPending(toolName, callId);
  }

  connectBrowserTools(agentId?: string, signal?: AbortSignal): Promise<void> {
    return this.browserTools.connect(agentId, signal);
  }

  waitInitialized(): Promise<void> {
    return this.fileHmr.waitInitialized();
  }

  syncFileChanges(targetVersion?: number): Promise<void> {
    return this.fileHmr.syncChanges(targetVersion);
  }

  syncFileChangesToVersion(targetVersion: number): Promise<void> {
    return this.fileHmr.syncToVersion(targetVersion);
  }

  runAtVersion(targetVersion: number, action: () => void): Promise<void> {
    return this.fileHmr.runAtVersion(targetVersion, action);
  }

  bindSandbox(sandbox: AgentSandbox): Promise<void> {
    return this.fileHmr.bindSandbox(sandbox);
  }

  syncSnapshot(sandbox?: AgentSandbox): Promise<void> {
    return this.fileHmr.syncSnapshot(sandbox);
  }

  ensureConnected(): Promise<void> {
    return this.fileHmr.ensureConnected();
  }

  disconnect(): void {
    this.fileHmr.disconnect();
  }
}

export type {
  BrowserToolRequest,
  BrowserToolResult,
} from "./browser-tool-bridge";
