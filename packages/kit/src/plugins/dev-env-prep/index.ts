import {
  ASK_QUESTIONS_TOOL_NAME,
  type CodeAgentPlugin,
  type SubAgentConfig,
  type Tool,
  type ToolResult,
  ToolValidationError,
} from "../../../../agent/src";
import type { ToolExecutionContext } from "../../../../agent/src/types/agent";
import devEnvPrepSystem from "./dev-env-prep.md";

export const PROJECT_RUNNER_TOOL_NAME = "project-runner";
export const PROJECT_RUNNER_START_COMMAND = "lingstyle start";
export const PROJECT_RUNNER_LOGS_COMMAND = "lingstyle logs";

/** 项目运行时由宿主（灵创客户端）管理，本包只声明受限命令的工具契约。 */
export interface ProjectRunnerImplementation {
  execute(
    params: { command: string; timeoutMs?: number },
    context?: ToolExecutionContext,
  ): Promise<ToolResult>;
}

function normalizeCommand(command: string): string {
  return command.trim().split(/\s+/).join(" ");
}

function assertSupportedCommand(command: unknown): asserts command is string {
  if (typeof command !== "string" || !command.trim()) {
    throw new ToolValidationError("command is required and must be a non-empty string");
  }
  const normalized = normalizeCommand(command);
  if (normalized !== PROJECT_RUNNER_START_COMMAND && normalized !== PROJECT_RUNNER_LOGS_COMMAND) {
    throw new ToolValidationError(`仅支持命令：${PROJECT_RUNNER_LOGS_COMMAND}、${PROJECT_RUNNER_START_COMMAND}`);
  }
}

function createProjectRunnerTool(implementation?: ProjectRunnerImplementation): Tool {
  return {
    name: PROJECT_RUNNER_TOOL_NAME,
    title: "项目运行时",
    description: `通过灵创客户端读取或启动当前项目运行时。仅支持 \`${PROJECT_RUNNER_LOGS_COMMAND}\`、\`${PROJECT_RUNNER_START_COMMAND}\`。`,
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: `要执行的项目命令：${PROJECT_RUNNER_LOGS_COMMAND}（读取已有日志）或 ${PROJECT_RUNNER_START_COMMAND}（启动项目）` },
        description: { type: "string", description: "简短一句话，本次命令的用途说明" },
        timeout_ms: { type: "number", description: `仅 ${PROJECT_RUNNER_START_COMMAND} 可用：可选启动超时（毫秒）；到期后客户端会停止本次项目运行时` },
      },
      required: ["command"],
    },
    validate(params: { command?: unknown; timeout_ms?: unknown }) {
      assertSupportedCommand(params?.command);
      if (params.timeout_ms !== undefined && (typeof params.timeout_ms !== "number" || !Number.isFinite(params.timeout_ms) || params.timeout_ms <= 0)) {
        throw new ToolValidationError("timeout_ms must be a positive number");
      }
    },
    execute(params: { command: string; description?: string; timeout_ms?: number }, context?: ToolExecutionContext) {
      assertSupportedCommand(params.command);
      if (!implementation) {
        throw new Error("project-runner: host did not provide an execute implementation");
      }
      return implementation.execute({
        command: normalizeCommand(params.command),
        ...(params.timeout_ms === undefined ? {} : { timeoutMs: params.timeout_ms }),
      }, context);
    },
  };
}

function createDevEnvPrepTools(implementation?: ProjectRunnerImplementation): Tool[] {
  return [
    createProjectRunnerTool(implementation),
  ];
}

/**
 * 子 Agent：开发环境准备。
 *
 * 职责是把目标项目准备到可以被 `xxx:lingchuang` 启动脚本直接跑起来的状态（装依赖、
 * 补配置、排查基础环境问题），但不负责执行启动命令本身——启动交给专门的 Lingchuang
 * 启动流程完成，二者职责不重叠。
 */
function createDevEnvPrepSubAgent(implementation?: ProjectRunnerImplementation): SubAgentConfig {
  return {
    name: "dev-env-prep",
    title: "开发环境处理",
    description: "专门用于处理项目启动的各类问题，帮助初始化环境等。任何情况下项目启动不了、启动报错，都应该优先使用 dev-env-prep 而不是自己看项目文件和尝试启动脚本。",
    system: devEnvPrepSystem,
    // 装依赖、补配置、查基础环境问题属于轻量确定性任务，用 flash 省成本。
    aiRole: "flash",
    // SubAgent 工具执行上下文不支持 waitUIRender，ask_questions 调用会直接失败，需排除。
    disallowedTools: [ASK_QUESTIONS_TOOL_NAME],
    tools: createDevEnvPrepTools(implementation),
  };
}

/**
 * 创建「开发环境准备」插件。
 *
 * project-runner 的具体执行由宿主通过 `implementation` 传入；不传时工具仍会注册，
 * 调用会报错提示宿主未提供实现，便于尽早发现接入缺口。
 */
export function createDevEnvPrepPlugin(options?: { projectRunnerImplementation?: ProjectRunnerImplementation }): CodeAgentPlugin {
  return {
    name: "dev-env-prep-plugin",
    agents: [createDevEnvPrepSubAgent(options?.projectRunnerImplementation)],
  };
}

export const DevEnvPrepPlugin = createDevEnvPrepPlugin;
