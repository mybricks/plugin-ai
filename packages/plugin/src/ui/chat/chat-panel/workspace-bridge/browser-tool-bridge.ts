import type {
  AgentMode,
  Tool,
} from "../../../../../../agent/src";
import type { Sandbox } from "../../../../../../agent/src/code-agent";

export interface BrowserToolRequest {
  requestId: string;
  workspaceId: string;
  browserId: string;
  name: string;
  input: Record<string, unknown>;
}

export interface BrowserToolResult {
  requestId?: string;
  workspaceId?: string;
  browserId?: string;
  output?: unknown;
  metadata?: Record<string, unknown>;
  error?: string;
}

export type BrowserToolHandler<TAgent> = (
  request: BrowserToolRequest,
  context: {
    agent: TAgent;
    sandbox?: Sandbox;
  },
) => Promise<BrowserToolResult | unknown> | BrowserToolResult | unknown;

type RequestJson = <T = unknown>(
  path: string,
  init?: RequestInit,
) => Promise<T>;

export class BrowserToolBridge<TAgent> {
  private tools: Tool[];
  private handler?: BrowserToolHandler<TAgent>;

  constructor(
    private readonly options: {
      workspaceId: string;
      requestJson: RequestJson;
      agent: TAgent;
      tools?: Tool[];
      handler?: BrowserToolHandler<TAgent>;
      getSandbox: () => Sandbox | undefined;
      getMode: () => AgentMode;
      setMode: (mode: AgentMode, reason?: string) => void;
    },
  ) {
    this.tools = options.tools ?? [];
    this.handler = options.handler;
    this.logRegisteredTools();
  }

  getTools(): Tool[] {
    return this.tools;
  }

  setTools(tools: Tool[]): void {
    this.tools = tools;
    this.logRegisteredTools();
  }

  setHandler(handler?: BrowserToolHandler<TAgent>): void {
    this.handler = handler;
  }

  async handleRequest(request: BrowserToolRequest): Promise<void> {
    if (!request?.requestId || !request.name) return;
    const result: BrowserToolResult = {};
    try {
      const tool = this.tools.find((item) => item.name === request.name);
      if (tool) {
        const toolContext = this.createToolContext(request);
        tool.validate?.(request.input, toolContext);
        const toolResult = await tool.execute(request.input, toolContext);
        Object.assign(result, {
          output: toolResult.output,
          ...(toolResult.metadata ? { metadata: toolResult.metadata } : {}),
        });
      } else if (this.handler) {
        const output = await this.handler(request, {
          agent: this.options.agent,
          sandbox: this.options.getSandbox(),
        });
        Object.assign(result, normalizeBrowserToolResult(output));
      } else {
        throw new Error(
          `No browser tool handler registered for ${request.name}.`,
        );
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    await this.options.requestJson(
      `/workspaces/${encodeURIComponent(this.options.workspaceId)}/browser/tasks/${encodeURIComponent(request.requestId)}`,
      {
        method: "POST",
        body: JSON.stringify({
          ...(result.output !== undefined ? { output: result.output } : {}),
          ...(result.metadata ? { metadata: result.metadata } : {}),
          ...(result.error ? { error: result.error } : {}),
        }),
      },
    );
  }

  private createToolContext(request: BrowserToolRequest): any {
    let aiRole: string | undefined;
    return {
      turnId: request.requestId,
      iterations: [],
      getUserMessage: () => ({ message: "", attachments: [] }),
      getAgent: () => this.options.agent,
      getAiRole: () => aiRole,
      setAiRole: (value?: string) => {
        aiRole = value || undefined;
      },
      mode: this.options.getMode(),
      getMode: this.options.getMode,
      setMode: this.options.setMode,
      // 新协议只定义最终 HTTP 回传；进度由具体工具自行展示。
      emitProgress: () => {},
    };
  }

  private logRegisteredTools(): void {
    if (!this.tools.length) return;
    console.info(
      "[plugin-ai] registered browser tools:",
      this.tools.map((tool) => tool.name),
    );
  }
}

function normalizeBrowserToolResult(output: unknown): Partial<BrowserToolResult> {
  if (
    output &&
    typeof output === "object" &&
    ("output" in output || "metadata" in output || "error" in output)
  ) {
    const result = output as BrowserToolResult;
    return {
      ...(result.output !== undefined ? { output: result.output } : {}),
      ...(result.metadata ? { metadata: result.metadata } : {}),
      ...(result.error ? { error: result.error } : {}),
    };
  }
  return { output };
}
