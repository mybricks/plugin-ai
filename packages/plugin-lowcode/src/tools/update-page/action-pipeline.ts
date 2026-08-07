import { canonicalToExecutionAction } from "../../dsl";
import type { ActionDSL, CanonicalAction } from "../../dsl";
import type { LowCodeGeneratePageTask } from "../types";
import type { LowCodeActionFailure, LowCodeActionExecutionReport } from "./prompt";

const COM_ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
/** 三位 base62 ID 的总容量：62³ = 238,328。 */
const COM_ID_SPACE_SIZE = COM_ID_ALPHABET.length ** 3;
/** 插件运行期内已分配的真实 comId，跨 UpdatePageRun 共享。 */
const allocatedComIds = new Set<string>();
let nextComIdValue = Math.floor(Math.random() * COM_ID_SPACE_SIZE);

/** 将递增序号编码为固定三位的 base62 comId。 */
function encodeComId(value: number): string {
  let remaining = value;
  let result = "";
  for (let index = 0; index < 3; index += 1) {
    result = COM_ID_ALPHABET[remaining % COM_ID_ALPHABET.length] + result;
    remaining = Math.floor(remaining / COM_ID_ALPHABET.length);
  }
  return result;
}

export interface UpdatePageActionExecutor {
  execute(action: any): Promise<any>;
}

interface ActionPipelineContext {
  /** action 在本次页面请求中的序号，用于失败反馈。 */
  actionIndex: number;
  /** DSL 解析后的模型原始 action，其中 comId 可能仍是三位 alias。 */
  sourceAction: CanonicalAction;
  /** 当前执行的 stage 名称，失败时写入 report。 */
  stageName?: string;
  /** alias 已替换为真实 ID 的 canonical action。 */
  canonicalAction?: CanonicalAction;
  /** 转成 MyBricks 设计器格式后的 action。 */
  designerAction?: any;
  /** updatePage 成功后由设计器返回的 action。 */
  executedAction?: any;
}

interface ActionPipelineStage {
  name: string;
  run(context: ActionPipelineContext): void | Promise<void>;
}

export interface UpdatePageRunOptions {
  /** 正在执行的页面请求；它是只读输入，不存放运行期状态。 */
  request: LowCodeGeneratePageTask;
  dsl: ActionDSL;
  executor: UpdatePageActionExecutor;
  enableRenderingOptimization?: boolean;
  onChange?: () => void;
}

/**
 * 一次 LowCodeGeneratePageTask 的运行实例。
 *
 * 模型通常使用三位 alias 引用刚创建的组件；即使 alias 不合法或过长，也会
 * 自动映射为我们分配的三位真实 ID。alias 映射只在本次运行内有效。
 * 对外输出和发送给 updatePage 的 action 都使用本运行分配的真实三位 comId。
 */
export class UpdatePageRun {
  readonly request: LowCodeGeneratePageTask;
  /** 模型解析出的原始 action，仅用于诊断。 */
  readonly sourceActions: CanonicalAction[] = [];
  /** 已完成 ID 替换和 action 修复的 action，也是 tool output 的来源。 */
  readonly resolvedActions: CanonicalAction[] = [];
  /** 与 resolvedActions 对应的 DSL 行。 */
  readonly resolvedActionLines: string[] = [];
  /** 实际成功提交给设计器的 action。 */
  readonly executedActions: any[] = [];
  /** 任意 stage 失败都会在这里记录，供下一轮模型修复使用。 */
  readonly failures: LowCodeActionFailure[] = [];

  private readonly aliases = new Map<string, string>();
  private readonly createdAliases = new Set<string>();
  private readonly stages: ActionPipelineStage[];
  private queue = Promise.resolve();

  constructor(private readonly options: UpdatePageRunOptions) {
    this.request = options.request;
    // stage 顺序就是 action 的唯一处理路径；新增处理逻辑应插入这里，
    // 不要绕过管道直接调用 updatePage。
    this.stages = [
      {
        name: "collect-source-action",
        run: (context) => {
          // 保留模型给出的三位 alias，方便排障。
          this.sourceActions.push(context.sourceAction);
        },
      },
      {
        name: "resolve-com-id",
        run: (context) => {
          // addChild 分配真实 ID；后续 action 对 alias 的引用同步替换。
          context.canonicalAction = this.resolveComIds(context.sourceAction);
        },
      },
      {
        name: "prepare-canonical-action",
        run: (context) => {
          // canonical 层修复，同时收集最终 output 所需的 DSL 行。
          context.canonicalAction = this.prepareForDesigner(this.requireCanonicalAction(context));
          this.resolvedActions.push(context.canonicalAction);
          this.resolvedActionLines.push(this.options.dsl.serializeAction(context.canonicalAction));
        },
      },
      {
        name: "canonical-to-designer-action",
        run: (context) => {
          // DSL 内部格式转换为 { comId, target, type, params }。
          context.designerAction = canonicalToExecutionAction(this.requireCanonicalAction(context));
        },
      },
      {
        // session 会在 updatePage 前补齐 root target、namespace、configs 和 layout。
        name: "designer-polyfill-and-update-page",
        run: async (context) => {
          context.executedAction = await this.options.executor.execute(context.designerAction);
        },
      },
      {
        name: "collect-executed-action",
        run: (context) => {
          // 仅收集真正执行成功的设计器 action。
          if (context.executedAction !== undefined) this.executedActions.push(context.executedAction);
        },
      },
    ];
  }

  get report(): LowCodeActionExecutionReport {
    return { succeeded: this.executedActions, failed: this.failures, attempts: 0 };
  }

  /** 将一条已解析的模型 action 入队；流式到达时也保持原有顺序。 */
  push(action: CanonicalAction, actionIndex: number): void {
    this.queue = this.queue.then(() => this.process(action, actionIndex));
  }

  async drain(): Promise<void> {
    await this.queue;
  }

  private async process(sourceAction: CanonicalAction, actionIndex: number): Promise<void> {
    const context: ActionPipelineContext = { actionIndex, sourceAction };
    try {
      for (const stage of this.stages) {
        context.stageName = stage.name;
        await stage.run(context);
      }
    } catch (error) {
      // stage 名属于开发诊断信息，不要透传给模型或 tool output，避免模型学习到
      // 内部实现细节并干扰下一轮修复。
      console.error("[plugin-lowcode] update-page action pipeline error", {
        stage: context.stageName,
        actionIndex,
        action: context.canonicalAction ?? sourceAction,
        error,
      });
      this.failures.push({
        action: context.canonicalAction ?? sourceAction,
        actionIndex,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    this.options.onChange?.();
  }

  private requireCanonicalAction(context: ActionPipelineContext): CanonicalAction {
    if (!context.canonicalAction) throw new Error("A canonical action is required before this pipeline stage.");
    return context.canonicalAction;
  }

  private resolveComIds(action: CanonicalAction): CanonicalAction {
    const comId = this.resolveReference(action.comId);
    if (action.type !== "addChild") return { ...action, comId };

    const alias = action.newComId;
    if (!alias || typeof alias !== "string") throw new Error("addChild requires a non-empty newComId.");
    if (this.createdAliases.has(alias)) {
      throw new Error(`newComId alias "${alias}" is already used in this page request; use a different three-character alias.`);
    }
    this.createdAliases.add(alias);
    // 模型 alias 与持久化 ID 分离：无论 alias 长度如何，真实 ID 都由我们分配。
    const newComId = this.createPersistentComId();
    this.aliases.set(alias, newComId);
    return { ...action, comId, newComId };
  }

  private resolveReference(comId: string): string {
    return this.aliases.get(comId) ?? comId;
  }

  private createPersistentComId(): string {
    // 运行期全局递增分配，不依赖 crypto；达到三位空间上限时明确报错。
    for (let attempts = 0; attempts < COM_ID_SPACE_SIZE; attempts += 1) {
      const comId = encodeComId(nextComIdValue);
      nextComIdValue = (nextComIdValue + 1) % COM_ID_SPACE_SIZE;
      if (allocatedComIds.has(comId)) continue;
      allocatedComIds.add(comId);
      return comId;
    }
    throw new Error("The three-character component ID space is exhausted.");
  }

  private prepareForDesigner(action: CanonicalAction): CanonicalAction {
    if (this.options.enableRenderingOptimization || action.type !== "addChild") return action;
    if (!("ignore" in action) && !("enhance" in action)) return action;
    const { ignore: _ignore, enhance: _enhance, ...rest } = action as any;
    return rest as CanonicalAction;
  }
}
