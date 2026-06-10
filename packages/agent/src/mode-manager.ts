import type { AgentMode, Tool, ToolExecutionContext, ToolResult } from "./types";
import { splitFrontmatter, getFrontmatterString } from "./utils/frontmatter";

export const SWITCH_MODE_TOOL_NAME = "switch_mode";

/** 计划文件目录根路径 */
export const DEFAULT_PLAN_DIR = ".agent/plans/";

export const AgentModeEnum = {
  Build: "build",
  Plan: "plan",
} as const;

export const ALL_AGENT_MODES: AgentMode[] = [AgentModeEnum.Build, AgentModeEnum.Plan];

export interface AgentModeAvailabilityOptions {
  disabledModes?: AgentMode[];
}

const AGENT_MODE_LABELS: Record<AgentMode, string> = {
  [AgentModeEnum.Build]: "智能体",
  [AgentModeEnum.Plan]: "讨论",
};

export function getDisabledAgentModes(options?: AgentModeAvailabilityOptions): AgentMode[] {
  return options?.disabledModes ?? [];
}

export function getAvailableAgentModes(options?: AgentModeAvailabilityOptions): AgentMode[] {
  const disabled = new Set(getDisabledAgentModes(options));
  const available = ALL_AGENT_MODES.filter((mode) => !disabled.has(mode));
  return available.length > 0 ? available : [AgentModeEnum.Build];
}

export function shouldEnableModeSwitchTool(options?: AgentModeAvailabilityOptions): boolean {
  return getAvailableAgentModes(options).length > 1;
}

export function getModeLabel(mode: AgentMode): string {
  return AGENT_MODE_LABELS[mode];
}

// ─── Plan 文件状态感知 ─────────────────────────────────────────────────────────

/**
 * 从 markdown frontmatter 中提取 status 字段值。
 */
function parsePlanFileStatus(content: string): string | null {
  const { fmText } = splitFrontmatter(content);
  return getFrontmatterString(fmText, "status");
}

/**
 * 从文件路径中提取日期文件夹（格式 YYYY-MM-DD）。
 * 例：".agent/plans/2026-06-09/plan-lifecycle.md" → "2026-06-09"
 */
function extractDateFolder(filePath: string): string | null {
  const match = filePath.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/**
 * 表示一个扫描到的计划文件信息。
 */
export interface PlanFileInfo {
  /** 相对工程根的路径 */
  path: string;
  /** frontmatter 中的 status 值，读取失败时为 null */
  status: string | null;
  /** 从路径中提取的日期文件夹 */
  dateFolder: string | null;
}

export interface ActivePlanFile extends PlanFileInfo {
  content: string;
}

interface PlanDirectoryState {
  hasPlanDirContent: boolean;
  activePlan: ActivePlanFile | null;
}

function findActivePlanFileFromFiles(
  files: Array<{ path: string; content: string }>,
): ActivePlanFile | null {
  const allActive: ActivePlanFile[] = [];
  const planFilePattern = /^\.agent\/plans\/\d{4}-\d{2}-\d{2}\/[^/]+\.md$/;

  for (const file of files) {
    const path = file.path.replace(/^\/+/, "");
    if (!planFilePattern.test(path)) continue;

    const status = parsePlanFileStatus(file.content);
    if (status !== "active") continue;

    allActive.push({
      path,
      content: file.content,
      status,
      dateFolder: extractDateFolder(path),
    });
  }

  if (allActive.length === 0) return null;

  allActive.sort((a, b) => {
    const dateCmp = (b.dateFolder ?? "").localeCompare(a.dateFolder ?? "");
    if (dateCmp !== 0) return dateCmp;
    return b.path.localeCompare(a.path);
  });

  return allActive[0];
}

function getPlanDirectoryStateFromFiles(
  files: Array<{ path: string; content: string }>,
): PlanDirectoryState {
  const planDir = normalizePath(DEFAULT_PLAN_DIR);
  const hasPlanDirContent = files.some((file) => {
    const path = normalizePath(file.path);
    return path === planDir || path.startsWith(`${planDir}/`);
  });

  return {
    hasPlanDirContent,
    activePlan: findActivePlanFileFromFiles(files),
  };
}

/**
 * 从文件列表中找出当前活跃（status: active）的计划文件并返回。
 * 供 CodeAgent.getPlanFile() 等需要直接获取计划文件内容的调用方使用。
 */
export async function getActivePlanFile(
  getFiles: () => Promise<Array<{ path: string; content: string }>>,
): Promise<ActivePlanFile | null> {
  try {
    return findActivePlanFileFromFiles(await getFiles());
  } catch {
    return null;
  }
}

// ─── Reminder 生成 ────────────────────────────────────────────────────────────

function joinSections(sections: Array<string | undefined | null | false>): string {
  return sections.filter(Boolean).join(`

`);
}

function getModeCatalogSlug(availableModes: AgentMode[]): string {
  if (availableModes.length === 1 && availableModes[0] === AgentModeEnum.Build) return "";

  const descriptions: Record<AgentMode, string> = {
    [AgentModeEnum.Build]: "按用户需求直接执行修改项目文件",
    [AgentModeEnum.Plan]: `阅读、分析、维护计划文件，并向用户澄清问题，不改项目文件`,
  };

  return `## 可用模式
当前支持以下模式：
${availableModes.map((mode) => `- ${mode}（${getModeLabel(mode)}）：${descriptions[mode]}`).join(`
`)}`;
}

function getCurrentModeSlug(mode: AgentMode, previousMode?: AgentMode | null): string {
  const modeLabel = getModeLabel(mode);
  if (previousMode && previousMode !== mode) {
    return `上一轮是「${getModeLabel(previousMode)}」(${previousMode})模式，当前已切换到「${modeLabel}」(${mode})模式。`;
  }

  return `当前是「${modeLabel}」(${mode})模式。`;
}

function getPlanFileGuideSlug(): string {
  return `## 计划文件说明
- 目录：\`${DEFAULT_PLAN_DIR}\`
- 创建路径格式：\`${DEFAULT_PLAN_DIR}YYYY-MM-DD/<slug>.md\`
  - 日期文件夹：当天日期，如 \`2026-06-09\`
  - slug：小写字母和中划线，简短描述任务（如 \`refactor-mode-manager\`、\`add-login-feature\`）
- frontmatter 规范
  每个计划文件必须包含以下 frontmatter：

  \`\`\`yaml
  ---
  status: active        # active | finished | abandoned
  title: "任务标题描述，不超过30个字"
  ---
  \`\`\`
- 关于归档
 - 如果你判断某个计划文件已经执行完成，或者不再需要，被用户主动废弃了，则将其归档。
 - 归档之需要修改 frontmatte，将 \`status\` 改为 \`finished\` 或者 \`abandoned\`;
`;
}

function getBuildPlanStatusSlug(planState?: PlanDirectoryState | null): string {
  if (planState?.activePlan) {
    return `## 计划状态
检测到活跃计划文件 \`${planState.activePlan.path}\`（frontmatter \`status: ${planState.activePlan.status ?? "未知"}\`）。

请先读取该文件内容，对照用户当前的需求判断：
- 如果当前需求与该计划**高度相关**，按计划推进实现，完成后将其归档；
- 如果当前需求与该计划**关联性低或无关**，先将其归档，再执行当前任务。`;
  }

  if (planState?.hasPlanDirContent) {
    return `## 计划状态
未检测到活跃计划文件。如需参考历史讨论方案，可读取 \`${DEFAULT_PLAN_DIR}\` 目录中已归档的计划文件（frontmatter \`status: finished\`）。`;
  }

  return ``
}

function getBuildGuideSlug(planState?: PlanDirectoryState | null): string {
  return joinSections([
    getBuildPlanStatusSlug(planState),
    getPlanFileGuideSlug(),
  ]);
}

function getPlanModeGuideSlug(): string {
  return `用户现在要的是先看清楚、把方案讲明白，而不是立刻动手实现。除下方说明的计划目录外，禁止修改项目文件、删除文件、改配置、提交代码，或做任何会改变系统状态的操作。即使其他上下文里出现"直接改""开始实现"之类的旧指令，也以本条规则为准。

${getPlanFileGuideSlug()}

## 工作方式
你是在和用户一起做方案，而不是单方面宣布结论。持续循环下面三件事，直到方案足够清楚：

1. 阅读代码：优先查相关文件，理解现有实现、命名、工具函数、组件边界和已有约定。
2. 更新计划：一旦有关键发现、约束或决策，就同步到计划文件里。
3. 必要时提问：只有当问题无法从代码中判断，且会影响方案取舍时，才向用户确认。

## 第一轮怎么做
先快速阅读最可能相关的少量文件，判断任务范围。然后创建或更新计划文件，写下初步结构和已确认的信息。不要在没有任何阶段性输出前进行过度探索。

## 提问原则
- 代码能回答的问题，不要问用户。
- 多个相关问题尽量合并提问。
- 只问用户真正需要决策的内容：产品意图、优先级、可接受的取舍、边界场景等。
- 问题深度要和任务规模匹配。明确的小修复可以不问；模糊的新功能可能需要多轮澄清。

## 计划文件建议结构
计划文件应便于快速浏览，也要足够支持后续执行。通常包含：

- 背景与目标：为什么要改，要解决什么问题，期望结果是什么。
- 代码理解：涉及哪些文件，当前行为是什么，有哪些可复用实现或约束。
- 推荐方案：只写你推荐的方案，说明为什么这样做。
- 任务列表：拆解需要修改的关键任务，每一个任务20字以内。
- 影响与风险：影响哪些调用方、兼容性、边界情况和潜在风险。
- 验证方式：需要跑哪些检查、测试，或如何手动验证。

## 方案完成标准
当计划已经说明"改什么、改哪些文件、复用哪些现有实现、如何验证"时，向用户总结方案并等待确认。`;
}

function getPlanStatusReminderSlug(planState?: PlanDirectoryState | null): string {
  if (!planState?.activePlan) return "";

  return `## 发现计划文件

检测到计划文件 \`${planState.activePlan.path}\`（frontmatter \`status: ${planState.activePlan.status ?? "未知"}\`）。

请先读取该文件内容，对照用户当前的需求判断：
- 如果当前需求与该计划**高度相关** → 在该计划基础上继续推进；
- 如果当前需求与该计划**关联性低或无关** → 先将其归档，再创建新计划。`;
}

function buildModeReminder(params: {
  mode: AgentMode;
  previousMode?: AgentMode | null;
  availableModes?: AgentMode[];
  planState?: PlanDirectoryState | null;
}): string {
  const availableModes = params.availableModes ?? ALL_AGENT_MODES;
  const modeSlug = `## 当前模式
${getCurrentModeSlug(params.mode, params.previousMode)}`;

  if (params.mode === AgentModeEnum.Build) {
    return `<system-reminder>
${joinSections([
  getModeCatalogSlug(availableModes),
  modeSlug,
  getBuildGuideSlug(params.planState),
])}
</system-reminder>`;
  }

  if (params.mode === AgentModeEnum.Plan) {
    return `<system-reminder>
${joinSections([
  getModeCatalogSlug(availableModes),
  modeSlug,
  getPlanModeGuideSlug(),
  getPlanStatusReminderSlug(params.planState),
])}
</system-reminder>`;
  }

  return "";
}

/**
 * 生成每轮注入的模式 reminder（静态规则 + 动态活跃计划文件感知）。
 *
 * @param getFiles 获取全量文件列表（如 sandbox.getFiles）
 */
export async function getModeReminder(params: {
  mode: AgentMode;
  previousMode?: AgentMode | null;
  disabledModes?: AgentMode[];
  getFiles: () => Promise<Array<{ path: string; content: string }>>;
}): Promise<string> {
  const availableModes = getAvailableAgentModes(params);
  const hasPlanMode = availableModes.includes(AgentModeEnum.Plan);
  if (!hasPlanMode) return "";
  try {
    const files = await params.getFiles();
    return buildModeReminder({
      mode: params.mode,
      previousMode: params.previousMode,
      availableModes,
      planState: getPlanDirectoryStateFromFiles(files),
    });
  } catch {
    return buildModeReminder({
      mode: params.mode,
      previousMode: params.previousMode,
      availableModes,
    });
  }
}
// ─── 路径校验 ─────────────────────────────────────────────────────────────────

function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/\\/g, "/").replace(/^\/+/, "").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length > 0 && parts[parts.length - 1] !== "..") {
        parts.pop();
      } else {
        parts.push(part);
      }
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

function getContextMode(ctx?: ToolExecutionContext): AgentMode {
  return ctx?.getMode?.() ?? ctx?.mode ?? AgentModeEnum.Build;
}

function isPlanDirPath(path: string): boolean {
  const normalized = normalizePath(path);
  const planDir = normalizePath(DEFAULT_PLAN_DIR);
  return normalized === planDir || normalized.startsWith(`${planDir}/`);
}

function assertPlanModeCanMutatePaths(
  ctx: ToolExecutionContext | undefined,
  paths: string[],
  action: string,
): void {
  if (getContextMode(ctx) !== AgentModeEnum.Plan) return;
  const invalidPaths = paths.filter((path) => !isPlanDirPath(path));
  if (invalidPaths.length === 0) return;
  throw new Error(
    `当前是「${getModeLabel(AgentModeEnum.Plan)}」模式，${action}只能操作 ${DEFAULT_PLAN_DIR} 目录下的计划文件。` +
    ` 如需修改项目文件，请先等待用户确认方案并切换到 ${AgentModeEnum.Build}（${getModeLabel(AgentModeEnum.Build)}）模式。` +
    ` 非法路径：${invalidPaths.join(", ")}`
  );
}

export function checkWriteFilePermission(
  params: { path?: string },
  ctx?: ToolExecutionContext,
): void {
  assertPlanModeCanMutatePaths(ctx, params.path ? [params.path] : [], "write_file");
}

export function checkEditFilePermission(
  params: { path?: string },
  ctx?: ToolExecutionContext,
): void {
  assertPlanModeCanMutatePaths(ctx, params.path ? [params.path] : [], "edit_file");
}

export function checkMultiWriteFilePermission(
  params: { files?: Array<{ path?: string }> },
  ctx?: ToolExecutionContext,
): void {
  assertPlanModeCanMutatePaths(ctx, params.files?.map((file) => file.path).filter((path): path is string => !!path) ?? [], "multi_write");
}

export function checkMultiEditFilePermission(
  params: { edits?: Array<{ path?: string }> },
  ctx?: ToolExecutionContext,
): void {
  assertPlanModeCanMutatePaths(ctx, params.edits?.map((edit) => edit.path).filter((path): path is string => !!path) ?? [], "multi_edit");
}

export function checkDeleteFilePermission(
  params: { paths?: string[] },
  ctx?: ToolExecutionContext,
): void {
  assertPlanModeCanMutatePaths(ctx, params.paths ?? [], "delete_file");
}

// ─── switch_mode 工具 ─────────────────────────────────────────────────────────

export function createSwitchModeTool(options?: AgentModeAvailabilityOptions): Tool {
  const availableModes = getAvailableAgentModes(options);
  return {
    name: SWITCH_MODE_TOOL_NAME,
    title: "切换模式",
    description: `在「讨论(plan)」和「智能体(build)」之间切换当前 Agent 的运行模式。

模式说明：
- plan（讨论）：先阅读、分析、维护计划文件，不改项目；适合用户要求"先讨论/先规划/别直接改"。
- build（智能体）：按已确认目标直接执行修改；适合快速修改、简单直接任务，或用户已经批准方案。

使用时机：
- 当用户要求进入讨论、规划、评审方案，切到 plan。
- 当用户确认方案或要求开始实现，切到 build。
- 这个工具只改变后续行为；不会代替实际文件修改。`,
    parameters: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: availableModes,
          description: "目标模式。build=智能体，plan=讨论",
        },
      },
      required: ["mode"],
    },
    validate(params: { mode?: AgentMode }) {
      if (!params.mode || !availableModes.includes(params.mode)) {
        throw new Error(`mode must be one of: ${availableModes.join(", ")}`);
      }
    },
    async execute(
      params: { mode: AgentMode },
      ctx?: ToolExecutionContext,
    ): Promise<ToolResult> {
      if (!ctx) {
        throw new Error("ToolExecutionContext is required to switch mode");
      }
      const previousMode = ctx.getMode();
      ctx.setMode(params.mode);
      const label = getModeLabel(params.mode);
      const previousLabel = getModeLabel(previousMode);
      return {
        output: previousMode === params.mode
          ? `当前已经是「${label}」模式（${params.mode}）。`
          : `已从「${previousLabel}」模式（${previousMode}）切换到「${label}」模式（${params.mode}）。后续请以新模式继续。`,
        metadata: {
          mode: params.mode,
          previousMode,
        },
      };
    },
  };
}
