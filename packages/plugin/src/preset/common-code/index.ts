import type { PluginAIParams } from "../../index";
import type { PromptSections } from "../../prompts";
import type { SkillFile } from "../../../../agent/src";
import { READ_TOOL_NAME, EDIT_TOOL_NAME, WRITE_TOOL_NAME, DELETE_TOOL_NAME, MULTI_EDIT_TOOL_NAME } from "../../../../agent/src";
import { GREP_TOOL_NAME } from "../../../../agent/src/code-agent/tools/grep";
import { INIT_PROJECT_TOOL_NAME } from "../../sandbox/tools/init-project";
import { MYBRICKS_JSDOC_PROMPT_SECTIONS } from "../../prompts/mybricks-jsdoc";

export type PluginAIPreset = Partial<PluginAIParams>;

interface FrontendDevelopSpecRuntimeContext {
  designer?: {
    getEffectiveLibraries(): Array<{ name: string; version?: string; usage: string }> | Promise<Array<{ name: string; version?: string; usage: string }>>;
  };
  codeRules?: string;
  designRules?: string;
}

function wrapRules(tag: string, value?: string): string {
  const content = value?.trim();
  return content ? `<${tag}>\n${content}\n</${tag}>` : "";
}

function formatLibraryDocs(libraries: Array<{ name: string; version?: string; usage: string }>): string {
  return libraries
    .map((library) => `---\nname: ${library.name}\nversion: ${library.version ?? ""}\n---\n${library.usage}`)
    .join("\n\n");
}

const FRONTEND_ENVIRONMENT_VARIABLES_SECTION = [
  "以下是系统注入的环境变量，可在组件代码中通过 `process.env.<变量名>` 访问，**禁止自行声明或覆盖这些变量**：",
  "",
  "| 变量名 | 类型 | 设计态值 | 运行态值 | 说明 |",
  "|--------|------|----------|----------|------|",
  "| `process.env.POPUP_VISIBLE` | `boolean` | `true` | `false` | 控制浮层（弹窗/抽屉等）的默认显示状态。设计态下为 `true` 使浮层保持展开，方便设计者选中浮层内元素进行编辑；运行态下为 `false`，由业务逻辑控制显隐。**浮层组件必须将此变量与业务状态做 `||` 合并使用**，例如：`visible={process.env.POPUP_VISIBLE \\|\\| store.modalVisible}` |",
  "| `process.env.POPUP_NODE` | `HTMLElement` | 设计器画布容器节点 | 页面容器节点 | 浮层的挂载容器。设计、运行态下均指向设计器画布，确保浮层渲染在画布内部。例如一些三方库的指定挂载节点：`getContainer={() => process.env.POPUP_NODE}` |",
].join("\n");

const COMMON_CODE_PROMPT_SECTIONS: PromptSections = {
  agent: {
    identitySection: `你是一个通用代码助手，面向软件工程任务协助用户理解、修改、生成和维护项目代码。
你的核心能力包括：阅读项目结构、定位相关实现、修复 bug、开发功能、重构代码、解释设计取舍、同步必要文档，并在完成后给出简明结果说明。

工作时请优先基于当前项目上下文做判断，遇到信息不足时，先通过工具补齐上下文；
如果仍存在关键歧义，再向用户提出明确问题。
如果发现用户假设有误、相邻风险或安全问题时，应直接指出并给出更稳妥的处理方式。

优先做用户明确要求的事情，避免额外功能、过度抽象和无关重构。
`,
    usingToolsSection: `# 工具使用
> 当前「项目空间」通常只提供文件路径列表，不含完整源码。需要理解现有实现时，优先使用 \`${GREP_TOOL_NAME}\` 搜索定位，再使用 \`${READ_TOOL_NAME}\` 读取相关文件。
> 调用工具前必须输出一句简短说明，告诉用户你接下来要做什么以及原因。

!IMPORTANT: 所有文件内容中禁止使用 emoji、特殊字符、表情符号。

<常用工作流>
1. 理解意图：结合用户消息、项目空间和必要文件内容，判断任务目标与影响范围。
2. 定位代码：如果已知关键词、类名、函数名或文件片段，使用 \`${GREP_TOOL_NAME}\` 搜索；如果已确定少量目标文件，使用 \`${READ_TOOL_NAME}\` 读取完整内容。
3. 开发修改：
  - 新项目或批量初始化时，可以使用 \`${INIT_PROJECT_TOOL_NAME}\` 快速写入基础文件；
  - 修改已有文件优先使用 \`${EDIT_TOOL_NAME}\` 或 \`${MULTI_EDIT_TOOL_NAME}\`；
  - 新建少量文件或需要完整重写文件时使用 \`${WRITE_TOOL_NAME}\`；
  - 删除文件时使用 \`${DELETE_TOOL_NAME}\`。
4. 检查验证：修改完成后检查渲染、编译、LSP 或项目状态；如果发现问题，回到开发修改阶段继续修复。
5. 文档同步：如实现变化影响 README.md、requirement.md 或其他说明文档，应同步更新。
</常用工作流>

<并行调用工具原则：必须遵守>
CRITICAL: 尽量在同一个响应中并行调用多个代码工具，除非工具之间存在明确先后依赖。
  <推荐的模式>
  - 同时调用 \`${GREP_TOOL_NAME}\` 和 \`${READ_TOOL_NAME}\` 来探索代码；
  - 一次响应中并行调用多个 \`${EDIT_TOOL_NAME}\` 修改互不冲突的文件。
  </推荐的模式>

  <禁止的反模式>
  - 读一个文件 → 回复给用户 → 再读下一个文件；
  - 调用工具 → 思考分析 → 再调用下一个工具；
  - 分多轮完成本可以一轮完成的独立操作。
  </禁止的反模式>
</并行调用工具原则>

完成任务时，请回复一份简明报告，说明完成内容、关键发现和验证结果。`,
  },
  developeGuide: {
    firstOfAll: "",
    assetsUsageSection: "",
    architectureSection: "",
    examplesSection: "",
    end: "",
  },
  designGuide: {
    firstOfAll: "",
  },
  documentGuide: {
    firstOfAll: "",
    requirementGuide: "",
  },
};

const MYBRICKS_FRONTEND_DEVELOPMENT_SKILL_CONTENT = [
  "---",
  "name: Frontend Development",
  "description: 前端开发规范、设计规范、节点 JSDoc 注释与 requirement 文档同步规范。",
  "when_to_use: 需要在 MyBricks 项目中开发、修改、重构前端页面、组件、样式、hooks、路由、弹窗，或同步节点 JSDoc 注释 / requirement.md 时使用。",
  "---",
  "# MyBricks Frontend Development",
  "MyBricks 前端开发、设计、节点 JSDoc 注释和需求文档相关规范。",
  "## 开发宪章",
  MYBRICKS_JSDOC_PROMPT_SECTIONS.developeGuide.firstOfAll,
  "## 资源使用",
  MYBRICKS_JSDOC_PROMPT_SECTIONS.developeGuide.assetsUsageSection,
  "## 架构与文件规范",
  MYBRICKS_JSDOC_PROMPT_SECTIONS.developeGuide.architectureSection,
  "## 示例",
  MYBRICKS_JSDOC_PROMPT_SECTIONS.developeGuide.examplesSection,
  MYBRICKS_JSDOC_PROMPT_SECTIONS.developeGuide.end,
  "## 设计指南",
  MYBRICKS_JSDOC_PROMPT_SECTIONS.designGuide.firstOfAll,
  "## JSDoc 注释规范",
  MYBRICKS_JSDOC_PROMPT_SECTIONS.documentGuide.firstOfAll,
  "## requirement.md 文档规范",
  MYBRICKS_JSDOC_PROMPT_SECTIONS.documentGuide.requirementGuide,
].filter(Boolean).join("\n\n");

const MYBRICKS_FRONTEND_DEVELOPMENT_SKILL: SkillFile = {
  name: "frontend-develop-spec",
  files: [
    {
      path: "SKILL.md",
      content: MYBRICKS_FRONTEND_DEVELOPMENT_SKILL_CONTENT,
    },
  ],
  /**
   * @deprecated 临时兼容运行时动态 Skill 内容注入，后续应迁移到更明确的动态资源机制。
   */
  updateContent: async function (context?: unknown) {
    const runtimeContext = context as FrontendDevelopSpecRuntimeContext | undefined;
    const libraries = await runtimeContext?.designer?.getEffectiveLibraries() ?? [];
    const codeRules = wrapRules("code_rules", runtimeContext?.codeRules);
    const designRules = wrapRules("design_rules", runtimeContext?.designRules);
    const libraryDocs = formatLibraryDocs(libraries);
    const dynamicSections = [
      "## 环境变量\n\n" + FRONTEND_ENVIRONMENT_VARIABLES_SECTION,
      codeRules ? "## 代码规范\n\n" + codeRules : "",
      designRules ? "## 设计规范补充\n\n" + designRules : "",
      libraryDocs ? "## 允许使用的类库\n\n---\n\n" + libraryDocs : "",
    ].filter(Boolean).join("\n\n");
    const skillMd = this.files.find((file) => file.path === "SKILL.md");
    if (skillMd) {
      skillMd.content = [MYBRICKS_FRONTEND_DEVELOPMENT_SKILL_CONTENT, dynamicSections]
        .filter(Boolean)
        .join("\n\n");
    }
  },
};

export const commonCodePreset: PluginAIPreset = {
  promptSections: COMMON_CODE_PROMPT_SECTIONS,
  skills: [MYBRICKS_FRONTEND_DEVELOPMENT_SKILL],
};
