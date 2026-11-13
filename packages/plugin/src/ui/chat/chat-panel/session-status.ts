import {
  CODE_AGENT_SESSION_STAGE,
  type AgentRuntimeStage,
} from "../../../context/agent-runtime";

/** HttpAgent 暴露给 UI 的阶段 key；事件名称仍由 HttpAgent 自己消化。 */
export const HTTP_AGENT_SESSION_STAGE = {
  PREPARING: "http:preparing",
  SYNCING_FILES: "http:syncing-files",
  CONFIGURING: "http:configuring",
  AWAITING_MODEL: "http:awaiting-model",
} as const;

/**
 * 将 Agent 阶段转换为 UI 文案。返回 undefined 时使用内置文案。
 * 业务可通过 ChatPanel / ChatStartView 注入自己的实现。
 */
export type SessionStageTextResolver = (
  stage: AgentRuntimeStage | undefined,
) => string | undefined;

/** WebSocketAgent 暴露给 UI 的阶段 key。 */
export const WEBSOCKET_AGENT_SESSION_STAGE = {
  PREPARING: "websocket:preparing",
  AWAITING_MODEL: "websocket:awaiting-model",
  /** 团队轮：展示当前正在执行的成员。 */
  TEAM_RUNNING: "websocket:team-running",
} as const;

/**
 * 团队成员 → 展示名。
 */
export function getTeamMemberLabel(member: string): string {
  if (member.startsWith("frontend")) return "前端";
  if (member.startsWith("wangfa")) return "后端";
  return "工程师";
}

/** 团队成员在本轮的状态（原始状态码，文案由 UI 映射）。 */
export type TeamMemberState = { member: string; status: "RUNNING" | "DONE" | "FAILED" };

/** 团队成员状态码 → 展示文案。 */
export function getTeamMemberStateLabel(status: TeamMemberState["status"]): string {
  switch (status) {
    case "RUNNING":
      return "开发中";
    case "DONE":
      return "已完成";
    case "FAILED":
      return "失败";
    default:
      return "";
  }
}

/** 团队执行中文案 */
export function getTeamRunningText(members: TeamMemberState[] | undefined): string {
  return (members ?? [])
    .map(({ member, status }) => `${getTeamMemberLabel(member)}${getTeamMemberStateLabel(status)}`)
    .join(" · ");
}

/** 内置文案仅是默认展示；Agent 层不再保存展示字符串。 */
export function getDefaultSessionStageText(
  stage: AgentRuntimeStage | undefined,
): string {
  switch (stage?.key) {
    case CODE_AGENT_SESSION_STAGE.AWAITING_MODEL:
      return "模型响应中...";
    case HTTP_AGENT_SESSION_STAGE.PREPARING:
    case WEBSOCKET_AGENT_SESSION_STAGE.PREPARING:
      return "准备中...";
    case HTTP_AGENT_SESSION_STAGE.SYNCING_FILES:
      return "获取最新文件...";
    case HTTP_AGENT_SESSION_STAGE.CONFIGURING:
      return "获取配置...";
    case WEBSOCKET_AGENT_SESSION_STAGE.AWAITING_MODEL:
      return "模型响应中...";
    case WEBSOCKET_AGENT_SESSION_STAGE.TEAM_RUNNING:
      return getTeamRunningText(stage.meta?.members as TeamMemberState[] | undefined);
    default:
      return "等待模型响应...";
  }
}
