import type { AgentMode, Tool } from "../../../../../../agent/src";
import type { Sandbox } from "../../../../../../agent/src/code-agent";
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
      getSandbox: () => this.fileHmrSandbox,
      getMode: options.getMode,
      setMode: options.setMode,
    });
  }

  private fileHmrSandbox?: Sandbox;

  getTools(): Tool[] {
    return this.browserTools.getTools();
  }

  setTools(tools: Tool[]): void {
    this.browserTools.setTools(tools);
  }

  handleBrowserTask(request: BrowserToolRequest): Promise<void> {
    return this.browserTools.handleRequest(request);
  }

  prepareRun(): Promise<void> {
    return this.fileHmr.prepareRun();
  }

  syncFileChanges(targetVersion?: number): Promise<void> {
    return this.fileHmr.syncChanges(targetVersion);
  }

  bindSandbox(sandbox: Sandbox): void {
    this.fileHmrSandbox = sandbox;
    this.fileHmr.bindSandbox(sandbox);
  }

  syncSnapshot(sandbox?: Sandbox): Promise<void> {
    if (sandbox) this.fileHmrSandbox = sandbox;
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
