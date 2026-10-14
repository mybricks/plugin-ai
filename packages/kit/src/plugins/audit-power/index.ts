import type { CodeAgentPlugin, Tool, ToolResult } from "../../../../agent/src";
import auditPowerWorkflow from "./audit-power-workflow.md";

export const AUDIT_UNDERSTAND_PAGE_TOOL_NAME = "docs_understand_page";
export const AUDIT_VALIDATE_PAGE_TOOL_NAME = "docs_validate_page";

const UNDERSTAND_PAGE_PROFILES = ["basic", "ui", "interactions", "full"] as const;
export type AuditPowerProfile = typeof UNDERSTAND_PAGE_PROFILES[number];

/** The host owns execution only; AuditPower owns both public Tool contracts. */
export interface AuditPowerImplementation {
  understandPage(params: { file: string; profile?: AuditPowerProfile }): Promise<ToolResult>;
  validatePage(): Promise<ToolResult>;
}

export interface AuditPowerPluginOptions {
  configDirName: string;
  implementation?: AuditPowerImplementation;
  description?: string;
}

function isUnderstandPageProfile(value: unknown): value is AuditPowerProfile {
  return typeof value === "string" && (UNDERSTAND_PAGE_PROFILES as readonly string[]).includes(value);
}

function unavailable(method: keyof AuditPowerImplementation): never {
  throw new Error(`audit-power: host did not provide ${method} implementation`);
}

function createAuditPowerTools(implementation?: AuditPowerImplementation): Tool[] {
  return [
    {
      name: AUDIT_UNDERSTAND_PAGE_TOOL_NAME,
      title: "页面分析",
      description: "分析 React TSX/JSX 页面，返回组件拓扑、接口调用、变量和事件信息。生成关联 YAML 文档前使用。",
      parameters: {
        type: "object",
        properties: {
          file: { type: "string", description: "项目根目录下的相对路径，例如 pages/SignIn/index.tsx" },
          profile: { type: "string", enum: [...UNDERSTAND_PAGE_PROFILES], description: "分析 profile，默认 full" },
        },
        required: ["file"],
      },
      validate(params: { file?: unknown; profile?: unknown }) {
        if (typeof params?.file !== "string" || !params.file.trim()) {
          throw new Error("understand_page: file is required and must be a non-empty string");
        }
        if (params.profile !== undefined && !isUnderstandPageProfile(params.profile)) {
          throw new Error(`understand_page: invalid profile \"${String(params.profile)}\"`);
        }
      },
      execute(params: { file: string; profile?: AuditPowerProfile }) {
        return implementation ? implementation.understandPage(params) : unavailable("understandPage");
      },
    },
    {
      name: AUDIT_VALIDATE_PAGE_TOOL_NAME,
      title: "页面文档校验",
      description: "校验 graph 下 YAML 文档的事件覆盖、源码定位与基础结构。修改关联文档后使用。",
      parameters: { type: "object", properties: {} },
      execute() {
        return implementation ? implementation.validatePage() : unavailable("validatePage");
      },
    },
  ];
}

/** Creates the shared Skill and its stable browser/local tool declarations. */
export function createAuditPowerPlugin(options: AuditPowerPluginOptions): CodeAgentPlugin {
  const configDirName = options.configDirName.replace(/^\/+|\/+$/g, "");
  if (!configDirName) throw new Error("audit-power: configDirName is required");
  const prompt = auditPowerWorkflow.replaceAll("<configDirName>", configDirName);

  return {
    name: "audit-power",
    description: options.description ?? "按需审计页面或组件的接口、状态与事件。",
    skills: [{
      name: "audit-power",
      files: [{ path: "SKILL.md", content: prompt }],
    }],
    tools: createAuditPowerTools(options.implementation),
  };
}

export const AuditPowerPlugin = createAuditPowerPlugin;
