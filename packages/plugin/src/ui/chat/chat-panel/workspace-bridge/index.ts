import type { AgentMode, Tool } from "../../../../../../agent/src";
import type { Sandbox } from "../../../../../../agent/src/code-agent";
import {
  BrowserToolBridge,
  type BrowserToolHandler,
} from "./browser-tool-bridge";
import { FileHmr, type BrowserFileChangeEvent } from "./file-hmr";
import { WorkspaceSocket } from "./workspace-socket";

type RequestJson = <T = unknown>(
  path: string,
  init?: RequestInit,
) => Promise<T>;

export class WorkspaceBridge<TAgent> {
  private readonly socket: WorkspaceSocket<BrowserFileChangeEvent>;
  private readonly fileHmr: FileHmr;
  private readonly browserTools: BrowserToolBridge<TAgent>;

  constructor(options: {
    origin: string;
    workspaceId: string;
    requestJson: RequestJson;
    agent: TAgent;
    tools?: Tool[];
    handler?: BrowserToolHandler<TAgent>;
    getMode: () => AgentMode;
    setMode: (mode: AgentMode, reason?: string) => void;
  }) {
    let fileHmr: FileHmr;
    this.socket = new WorkspaceSocket({
      origin: options.origin,
      workspaceId: options.workspaceId,
      getVersion: () => fileHmr?.getVersion() ?? 0,
    });
    fileHmr = new FileHmr({
      workspaceId: options.workspaceId,
      requestJson: options.requestJson,
      socket: this.socket,
    });
    this.fileHmr = fileHmr;
    this.browserTools = new BrowserToolBridge({
      workspaceId: options.workspaceId,
      socket: this.socket,
      agent: options.agent,
      tools: options.tools,
      handler: options.handler,
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

  setToolHandler(handler?: BrowserToolHandler<TAgent>): void {
    this.browserTools.setHandler(handler);
  }

  setEnabled(enabled: boolean): void {
    this.fileHmr.setEnabled(enabled);
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

export type { BrowserToolHandler };
export type {
  BrowserToolRequest,
  BrowserToolResult,
} from "./browser-tool-bridge";
