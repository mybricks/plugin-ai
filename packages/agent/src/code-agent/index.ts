import { Agent, type AgentOptions } from "../agent";
import type { Tool } from "../types";
import {
  createReadTool, READ_TOOL_NAME,
  createWriteTool, WRITE_TOOL_NAME,
  createMultiWriteTool, MULTI_WRITE_TOOL_NAME,
  createEditTool, EDIT_TOOL_NAME,
  createMultiEditTool, MULTI_EDIT_TOOL_NAME,
  createDeleteTool, DELETE_TOOL_NAME,
} from "./tools";
import { getCodeAgentSystemPrompt, type CodeAgentPromptOptions } from "./prompt";
export type { CodeAgentPromptOptions };
import { type SkillFile, resolveSkillMeta } from "./skills";

export type { SkillFile };
export { resolveSkillMeta };

// ─── 沙箱接口 ─────────────────────────────────────────────────────────────────

/**
 * 沙箱接口，由调用方通过 window._registSandBox_ 注入。
 * CodeAgent 通过此接口操作文件系统（读取、写入文件）。
 * 额外的设计器状态、日志等能力通过 tools 参数注入，CodeAgent 本身不感知。
 */
export interface Sandbox {
  getFiles(): Promise<Array<{ path: string; content: string }>>;
  /**
   * 写入文件。失败时 reject（抛出错误）。
   */
  updateFiles(files: Array<{ path: string; content: string }>): Promise<void>;
  /**
   * 删除文件。失败时 reject（抛出错误）。
   */
  deleteFiles(paths: string[]): Promise<void>;
  /**
   * 获取当前动态上下文信息（代码规则、主题等项目信息）。
   * 返回的文本内容会通过 getContextMessages 注入到 LLM 上下文中。
   */
  getContext?: () => Promise<string | null>;
}

// ─── CodeAgentOptions ────────────────────────────────────────────────────────

export interface CodeAgentOptions extends Omit<AgentOptions, 'system'> {
  /**
   * 沙箱，提供文件读写工具的底层实现。
   * 通常由 plugin 侧通过 window._registSandBox_ 注入。
   */
  sandbox?: Sandbox;
  /**
   * 系统提示词定制选项（可覆盖内置默认值）。
   */
  promptOptions?: CodeAgentPromptOptions;
  /**
   * 技能文件列表（Skills）。
   *
   * 对标 claude-code 的 .claude/skills/ 目录机制：
   *   - 每个 SkillFile 挂载为虚拟文件（路径前缀 .skills/）
   *   - system prompt 中列出 skills 目录（name + description）
   *   - LLM 按需通过 read_file 工具读取完整内容
   *   - 不全量注入，避免 token 浪费
   */
  skills?: SkillFile[];
  /**
   * 追加到内置 system prompt 末尾的额外系统提示词。
   * 可用于注入项目特定规范、约束或上下文。
   */
  system?: string;
}

/** 虚拟 skills 路径前缀 */
const SKILLS_PREFIX = ".skills/";

// ─── CodeAgent ────────────────────────────────────────────────────────────────

/**
 * CodeAgent：面向代码编辑场景的 Agent。
 *
 * 内置原子级文件操作工具（read_file / write_file / edit_file），通过 Sandbox 接口
 * 连接任意文件系统/编译系统/运行系统。
 *
 * 额外能力（如 check_design_status）通过 `tools` 参数从外部注入，
 * CodeAgent 本身不感知 project / hooks 等具体概念。
 *
 * plugin 初始化时可传入：
 *   - `sandbox`   — 沙箱（文件读写）
 *   - `tools`     — 额外自定义工具（如 check_design_status）
 *   - `agentsMd`  — agents.md 规则文档，追加到系统 prompt 末尾
 *   - `skills`    — 技能文件列表，挂载为虚拟文件系统，LLM 按需读取
 */
export class CodeAgent extends Agent {
  constructor(options: CodeAgentOptions) {
    const { sandbox, skills, system, ...agentOptions } = options;

    // ── 包装 sandbox.getFiles()，追加 skills 虚拟文件 ─────────────────────────
    const wrappedSandbox: Sandbox | undefined = sandbox
      ? {
          ...sandbox,
          getFiles: async () => {
            const realFiles = await sandbox.getFiles();
            const skillFiles = (skills ?? []).map((s) => ({
              path: `${SKILLS_PREFIX}${s.path}`,
              content: s.content,
            }));
            return [...realFiles, ...skillFiles];
          },
        }
      : undefined;

    const sandboxTools: Tool[] = wrappedSandbox
      ? [createReadTool(wrappedSandbox), createWriteTool(wrappedSandbox), createEditTool(wrappedSandbox), createMultiEditTool(wrappedSandbox), createDeleteTool(wrappedSandbox)]
      : [];

    // ── sandbox.getContext 作为 getContextMessages ────────────────────────────
    const getContextMessages = async (): Promise<import("../types").Message[]> => {
      const ctx = await wrappedSandbox?.getContext?.() ?? null;
      if (!ctx) return [];
      return [{ role: "user", content: ctx }];
    };

    const builtinSystem = getCodeAgentSystemPrompt(agentOptions.promptOptions, skills);
    const finalSystem = system ? `${builtinSystem}\n\n${system}` : builtinSystem;

    super({
      ...agentOptions,
      system: finalSystem,
      getContextMessages,
      // 内置沙箱工具在前，外部注入工具（如 check_design_status）在后
      tools: [...sandboxTools, ...(agentOptions.tools ?? [])],
    });
  }
}
