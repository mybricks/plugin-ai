import React, { useEffect, useRef, useState } from "react";
import classNames from "classnames";
import { Sender, SenderRef, SenderProps } from "../../components/sender";
import { context } from "../../../context";
import { chipRegistry } from "../../../sandbox/setup";
import type { AgentMode, CodeAgent } from "../../../../../agent/src";
import type { AttachProcessor } from "../../../content-limits";
import type { MentionProvider } from "../../components/types";
import type { ActivePlanFile } from "../../../../../agent/src/mode-manager";
import { SenderActivePlanCard, usePlanState } from "../../components/plan";
import { ensureAIPanelOpen } from "../../../utils/ensure-ai-panel-open";
import { isHttpAgent } from "../chat-panel/http-agent";
import { useAgent, type ChatAgent } from "../chat-panel/use-agent";
import css from "./index.less";

// ─── LoadingView ────────────────────────────────────────────────────────────
export interface LoadingViewProps {
  tip: string;
}

const LoadingView = (props: LoadingViewProps) => {
  return (
    <div className={css["loading-view"]}>
      <div className={css["loading-dots"]}>
        <span className={css["dot"]} />
        <span className={css["dot"]} />
        <span className={css["dot"]} />
      </div>
      <span className={css["loading-text"]}>{props.tip}</span>
    </div>
  )
}

// ─── ChatStartView ────────────────────────────────────────────────────────────

export interface ChatStartViewProps {
  /** agent 实例 */
  agent?: ChatAgent;
  /** sandbox 组件 ID，用于打开对应面板 */
  comId?: string;
  /** 上传文件回调 */
  onUpload?: (file: File) => Promise<string>;
  /** 占位符文案 */
  placeholder?: string;
  /** 欢迎语标题文案 */
  welcomeTitle?: string;
  /**
   * 附件前置处理器列表。详见 ChatPanelProps.attachProcessors。
   */
  attachProcessors?: AttachProcessor[];
  /** 自定义 mention 注册源 */
  mentions?: MentionProvider[];
}

const ChatStartView = ({
  agent,
  comId,
  onUpload,
  placeholder = "请尽量详细描述您的需求，或者上传图片作为补充。完成后您可以导出源码或者Figma设计稿。",
  welcomeTitle = "在这里，开始您的需求",
  attachProcessors,
  mentions = context.pluginParams.mentions ?? [],
}: ChatStartViewProps) => {
  const senderRef = useRef<SenderRef>(null);
  const [empty, setEmpty] = useState(true);
  const [contextDisabled, setContextDisabled] = useState(() => context.disabled);
  const chatAgent = useAgent({ agent, disabled: contextDisabled });
  const loading = chatAgent.loading;
  const loadingTip = chatAgent.loadingTip;
  const historyStatus = chatAgent.historyStatus;
  const historyBlocked = historyStatus === "loading" || historyStatus === "idle" || historyStatus === "error";
  const localAgent = agent && !isHttpAgent(agent) ? agent as CodeAgent : undefined;
  const {
    activePlan,
  } = usePlanState(localAgent);

  useEffect(() => {
    const unD = context.events.on("disabled", (v: boolean) => setContextDisabled(v));
    return () => { unD(); };
  }, []);

  const onSend = (params: Parameters<SenderProps["onSend"]>[0]) => {
    if (loading || historyBlocked || !agent || !comId) return;
    setEmpty(false);

    ensureAIPanelOpen(comId).then(() => {
      chatAgent.send(params);
    });
  };

  const onExecutePlan = (plan: ActivePlanFile) => {
    if (!agent || !comId || historyBlocked || !chatAgent.canExecutePlan) return;
    const title = plan.title ?? plan.path;
    ensureAIPanelOpen(comId).then(() => {
      chatAgent.executePlan(title);
    });
  };

  const abovePanels = activePlan ? [{
    key: "active-plan",
    content: (
      <SenderActivePlanCard
        plan={activePlan}
        canExecute={chatAgent.canExecutePlan && !historyBlocked}
        onExecute={() => onExecutePlan(activePlan)}
        // TODO: 先隐藏「废弃方案」入口，后续确认交互价值后再恢复。
        onAbandon={undefined}
      />
    ),
  }] : undefined;

  return (
    <div className={classNames(css["start-view"], { [css["empty"]]: empty && !loading })}>
      {empty && !loading && (
        <div className={css["welcome-header"]}>
          <div className={css["welcome-title"]}>{welcomeTitle}</div>
        </div>
      )}
      {loading && (
        <LoadingView tip={loadingTip} />
      )}
      {!loading && (
        <Sender
          ref={senderRef}
          loading={loading}
          disabled={chatAgent.isDisabled || historyBlocked}
          onSend={onSend}
          variant="loose"
          chatMode={chatAgent.showChatMode ? chatAgent.chatMode : null}
          onChatModeChange={(nextMode: AgentMode | null) => {
            chatAgent.setChatMode(nextMode);
          }}
          placeholder={placeholder}
          attachmentsPrompt="根据附件中的图片内容进行设计开发，要求尽可能还原其中的各类设计细节以及功能"
          onUpload={onUpload}
          chipTypes={chipRegistry.getAll()}
          modelSelector={chatAgent.modelSelector}
          abovePanels={abovePanels}
          attachProcessors={attachProcessors}
          agent={localAgent}
          mentions={mentions}
        />
      )}
    </div>
  );
};

// ─── ComChatStartView ─────────────────────────────────────────────────────────

export interface ComChatStartViewProps extends Omit<ChatStartViewProps, "agent"> {
  /** sandbox 组件 ID，用于从 context 查找对应的 agent */
  comId: string;
}

const ComChatStartView = ({ comId, ...rest }: ComChatStartViewProps) => {
  const agentKey = context.getAgentKey(comId);
  const agent = context.agentMap.get(agentKey);
  return <ChatStartView agent={agent} comId={comId} onUpload={context.pluginParams.onUpload} {...rest} />;
};

export { ChatStartView, ComChatStartView, LoadingView };
