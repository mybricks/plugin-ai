import type {
  AgentMode,
  Tool,
  ToolUIChannel,
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

type PendingUIResponse = {
  requestId: string;
  resolve: (value: unknown | null) => void;
};

type RequestJson = <T = unknown>(
  path: string,
  init?: RequestInit,
) => Promise<T>;

export class BrowserToolBridge<TAgent> {
  private tools: Tool[];
  /**
   * Browser Tool 目前串行执行；ask_questions 在其 execute 内等待用户回答，
   * 因此单个 pending slot 足以将聊天卡片的操作回传给当前 browser task。
   */
  private pendingUIResponse: PendingUIResponse | null = null;
  private readonly toolUI: ToolUIChannel = {
    wait: <T>(requestId: string) => this.waitForUIResponse<T>(requestId),
    respond: (_toolCallId, value) => this.settleUIResponse(value),
    cancel: (_toolCallId) => this.settleUIResponse(null),
    dispose: () => {
      this.settleUIResponse(null);
    },
  };

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

  /** 供远端 HttpAgent 的工具卡片 renderer 提交或取消浏览器工具交互。 */
  getToolUI(): ToolUIChannel {
    return this.toolUI;
  }

  /** 在 Agent run 前登记当前浏览器可执行 Browser Tool。 */
  async connect(agentId?: string, signal?: AbortSignal): Promise<void> {
    if (!this.tools.length || this.options.canHandleRequests?.() === false) {
      return;
    }
    await this.options.requestJson(
      `/workspaces/${encodeURIComponent(this.options.workspaceId)}/browser/connect`,
      {
        method: "POST",
        signal,
        body: JSON.stringify(agentId ? { agentId } : {}),
      },
    );
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
      // ask_questions 会在这里等待；工具卡片的 submit/cancel 通过 getToolUI()
      // 唤醒同一个等待，再由既有 browser task 协议回传服务端。
      waitUIRender: <T>() => this.toolUI.wait<T>(request.requestId),
      // 新协议只定义最终 HTTP 回传；进度由具体工具自行展示。
      emitProgress: () => {},
    };
  }

  private waitForUIResponse<T>(requestId: string): Promise<T | null> {
    if (this.pendingUIResponse) {
      return Promise.reject(
        new Error(
          `Browser tool is already waiting for UI input: ${this.pendingUIResponse.requestId}`,
        ),
      );
    }
    return new Promise<T | null>((resolve) => {
      this.pendingUIResponse = {
        requestId,
        resolve: resolve as (value: unknown | null) => void,
      };
    });
  }

  private settleUIResponse(value: unknown | null): boolean {
    const pending = this.pendingUIResponse;
    if (!pending) return false;
    this.pendingUIResponse = null;
    pending.resolve(value);
    return true;
  }

  private logRegisteredTools(): void {
    if (!this.tools.length) return;
    console.info(
      "[plugin-ai] registered browser tools:",
      this.tools.map((tool) => tool.name),
    );
  }
}
