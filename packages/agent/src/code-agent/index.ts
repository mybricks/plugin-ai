import { Agent, type AgentOptions } from "../agent";
import type { Tool } from "../types";
import {
  createReadTool, READ_TOOL_NAME,
  createWriteTool, WRITE_TOOL_NAME,
  createEditTool, EDIT_TOOL_NAME,
} from "./tools";
import { getCodeAgentSystemPrompt, type CodeAgentPromptOptions } from "./prompt";
import { type SkillFile, resolveSkillMeta } from "./skills";

export type { SkillFile };
export { resolveSkillMeta };

// ─── 沙箱适配器接口 ───────────────────────────────────────────────────────────

/**
 * 文件系统适配器接口，由调用方通过 window._configSandBox_ 注入。
 * CodeAgent 通过此接口操作任意文件系统（组件沙箱、本地 fs、HTTP 接口等）。
 */
export interface SandboxAdapter {
  getFiles(): Promise<Array<{ path: string; content: string }>>;
  updateFiles(files: Array<{ path: string; content: string }>): Promise<void>;
  /**
   * 获取当前沙箱状态（如编译状态、运行状态、错误信息等）。
   * 返回的文本内容会通过 getContextMessages 注入到 LLM 上下文中。
   */
  getStatus?: () => Promise<string | null>;
  /**
   * 获取当前动态上下文信息（如焦点组件、选中区域、画布状态等）。
   * 返回的文本内容会通过 getContextMessages 注入到 LLM 上下文中。
   */
  getContext?: () => Promise<string | null>;
}

export interface CodeAgentOptions extends AgentOptions {
  /**
   * 沙箱适配器，提供文件读写工具的底层实现。
   * 通常由 plugin 侧通过 window._configSandBox_ 注入。
   */
  adapter?: SandboxAdapter;
  /**
   * 系统提示词定制选项（可覆盖内置默认值）。
   * 目前支持 identity：覆盖默认的角色声明文本。
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
}

const SANDBOX_TOOL_NAMES = [READ_TOOL_NAME, WRITE_TOOL_NAME, EDIT_TOOL_NAME] as const;

/** 虚拟 skills 路径前缀 */
const SKILLS_PREFIX = ".skills/";

/**
 * CodeAgent：面向代码编辑场景的 Agent。
 *
 * 内置原子级文件操作工具（read_file / write_file / edit_file），通过 SandboxAdapter 接口
 * 连接任意文件系统/编译系统/运行系统。
 *
 * plugin 初始化时可传入：
 *   - `agentsMd`  — agents.md 规则文档，追加到系统 prompt 末尾
 *   - `skills`    — 技能文件列表，挂载为虚拟文件系统，LLM 按需读取
 *   - `tools`     — 额外自定义工具（与内置原子工具合并）
 *   - `system`    — 系统 prompt
 */
export class CodeAgent extends Agent {
  private adapter?: SandboxAdapter;

  constructor(options: CodeAgentOptions) {
    const { adapter, skills, ...agentOptions } = options;

    // ── 包装 adapter.getFiles()，追加 skills 虚拟文件 ──────────────────────────
    const wrappedAdapter: SandboxAdapter | undefined = adapter
      ? {
          ...adapter,
          getFiles: async () => {
            const realFiles = await adapter.getFiles();
            const skillFiles = (skills ?? []).map((s) => ({
              path: `${SKILLS_PREFIX}${s.path}`,
              content: s.content,
            }));
            return [...realFiles, ...skillFiles];
          },
        }
      : undefined;

    const sandboxTools: Tool[] = wrappedAdapter
      ? [createReadTool(wrappedAdapter), createWriteTool(wrappedAdapter), createEditTool(wrappedAdapter)]
      : [];

    // 将内置系统提示词与外部传入的 system 融合（外部优先追加，不覆盖）
    const builtinSystem = getCodeAgentSystemPrompt(agentOptions.promptOptions, skills);
    const mergedSystem = agentOptions.system
      ? `${builtinSystem}\n\n${agentOptions.system}`
      : builtinSystem;

    // 用 ref 包裹 adapter，使闭包在 setAdapter 调用后也能读到最新值
    const adapterRef = { current: wrappedAdapter as SandboxAdapter | undefined };

    // adapter.getContext 作为 getContextMessages：每轮请求前调用，返回文本注入为 user 消息
    const getContextMessages = async (): Promise<import("../types").Message[]> => {
      const context = await adapterRef.current?.getContext?.() ?? null;
      if (!context) return [];
      return [{ role: "user", content: context }];
    };

    super({
      ...agentOptions,
      system: mergedSystem,
      getContextMessages,
      tools: [...sandboxTools, ...(agentOptions.tools ?? [])],
    });

    this.adapter = wrappedAdapter;
    this._adapterRef = adapterRef;
    this._skills = skills ?? [];
  }

  private _adapterRef!: { current: SandboxAdapter | undefined };
  private _skills: SkillFile[];

  /** 动态更新沙箱适配器（_configSandBox_ 调用后可用此方法刷新） */
  setAdapter(adapter: SandboxAdapter) {
    const skills = this._skills;
    // 重新包装新 adapter，保留 skills 虚拟文件
    const wrapped: SandboxAdapter = {
      ...adapter,
      getFiles: async () => {
        const realFiles = await adapter.getFiles();
        const skillFiles = skills.map((s) => ({
          path: `${SKILLS_PREFIX}${s.path}`,
          content: s.content,
        }));
        return [...realFiles, ...skillFiles];
      },
    };
    this.adapter = wrapped;
    this._adapterRef.current = wrapped;
    const customTools = (this.options.tools ?? []).filter(
      (t) => !(SANDBOX_TOOL_NAMES as readonly string[]).includes(t.name)
    );
    this.options.tools = [
      createReadTool(wrapped),
      createWriteTool(wrapped),
      createEditTool(wrapped),
      ...customTools,
    ];
  }
}
