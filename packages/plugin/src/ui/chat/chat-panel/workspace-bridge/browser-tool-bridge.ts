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

type RequestJson = <T = unknown>(
  path: string,
  init?: RequestInit,
) => Promise<T>;

export class BrowserToolBridge<TAgent> {
  private tools: Tool[];

  constructor(
    private readonly options: {
      workspaceId: string;
      requestJson: RequestJson;
      agent: TAgent;
      tools?: Tool[];
      /** Browser task 是否仍可由当前客户端执行并回传。 */
      canHandleRequests?: () => boolean;
      getSandbox: () => Sandbox | undefined;
      getMode: () => AgentMode;
      setMode: (mode: AgentMode, reason?: string) => void;
    },
  ) {
    this.tools = options.tools ?? [];
    this.logRegisteredTools();
  }

  getTools(): Tool[] {
    return this.tools;
  }

  setTools(tools: Tool[]): void {
    this.tools = tools;
    this.logRegisteredTools();
  }

  async handleRequest(request: BrowserToolRequest): Promise<void> {
    if (
      !request?.requestId ||
      !request.name ||
      this.options.canHandleRequests?.() === false
    ) {
      return;
    }
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
      } else {
        throw new Error(
          `No browser tool registered for ${request.name}.`,
        );
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    // 执行期间可能切换为禁用态，此时不回传 Browser Tool 结果。
    if (this.options.canHandleRequests?.() === false) return;

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
