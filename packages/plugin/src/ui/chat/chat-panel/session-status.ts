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

/** 内置文案仅是默认展示；Agent 层不再保存展示字符串。 */
export function getDefaultSessionStageText(
  stage: AgentRuntimeStage | undefined,
): string {
  switch (stage?.key) {
    case CODE_AGENT_SESSION_STAGE.AWAITING_MODEL:
      return "模型响应中...";
    case HTTP_AGENT_SESSION_STAGE.PREPARING:
      return "准备中...";
    case HTTP_AGENT_SESSION_STAGE.SYNCING_FILES:
      return "获取最新文件...";
    case HTTP_AGENT_SESSION_STAGE.CONFIGURING:
      return "获取配置...";
    default:
      return "等待模型响应...";
  }
}
