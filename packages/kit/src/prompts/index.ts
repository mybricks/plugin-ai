export type { MybricksPromptSections } from "./mybricks";

export {
  buildDevelopmentGuideContext,
  buildExtraProjectInfoSection,
  buildProjectInfoSection,
  parseAgentMdFrontmatter,
  type AgentMdFrontmatter,
  type BuildDevelopmentGuideContextOptions,
  type BuildExtraProjectInfoSectionOptions,
  type DevelopmentGuideLibrary,
  type ExtraProjectInfo,
  type ProjectInfoFile,
} from "./sections";


/**
 * Agent 身份与工具使用相关提示词节，对应 CodeAgentPromptOptions。
 */
export interface PromptSectionsAgent {
  /** Agent 身份定位描述，说明助手的角色与能力范围 */
  identitySection?: string;
  /** 工具使用规范，描述何时、如何调用各类工具 */
  usingToolsSection?: string;
}

/**
 * 开发规范相关提示词节。
 */
export interface PromptSectionsDevelopeGuide {
  /** 总体开发规则、画布宽度、页面/弹窗拆分等基础规范 */
  firstOfAll?: string;
  /** 系统注入的环境变量说明 */
  environmentVariablesSection?: string;
  /** 图标与图片资源的使用规范 */
  assetsUsageSection?: string;
  /** 项目目录结构、jsx/less/store 等文件编写规范 */
  architectureSection?: string;
  /** 示例代码块，展示典型开发模式 */
  examplesSection?: string;
  /** 追加到本节末尾 */
  end?: string;
}

/**
 * 设计风格相关提示词节。
 */
export interface PromptSectionsDesignGuide {
  /** 视觉美学指南，描述主题、配色、布局等设计原则 */
  firstOfAll?: string;
}

/**
 * 文档规范相关提示词节。
 */
export interface PromptSectionsDocumentGuide {
  /** 代码说明文档（README.md / JSDoc 注释）与 requirement.md 的书写规范 */
  firstOfAll?: string;
  /** requirement.md 的产品需求文档书写规范 */
  requirementGuide?: string;
}

/**
 * 系统提示词各节的完整定义。
 *
 * 每个字段均为可选，未提供时使用内置默认实现（`MYBRICKS_PROMPT_SECTIONS`）中对应的值。
 * 支持按 key 深度 assign：仅覆盖提供的字段，其余保留默认。
 *
 * `agent` 部分最终映射为 `CodeAgentPromptOptions`，传给底层 `CodeAgent`。
 */
export interface PromptSections {
  /** Agent 身份与工具使用相关提示词 */
  agent?: PromptSectionsAgent;
  /** 开发规范提示词 */
  developeGuide?: PromptSectionsDevelopeGuide;
  /** 设计风格提示词 */
  designGuide?: PromptSectionsDesignGuide;
  /** 文档规范提示词 */
  documentGuide?: PromptSectionsDocumentGuide;
}
