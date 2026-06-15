import React, { useEffect, useMemo, useRef, useState } from "react";
import classNames from "classnames";
import { Sender, SenderRef, SenderProps } from "../../components/sender";
import { context } from "../../../context";
import { chipRegistry } from "../../../sandbox/setup";
import type { AgentMode, CodeAgent } from "../../../../../agent/src";
import { AgentModeEnum } from "../../../../../agent/src";
import type { ModelSelection } from "../../../../../request/src/providers";
import { useSession } from "../use-session";
import { ensureAIPanelOpen } from "../../../utils/ensure-ai-panel-open";
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
  agent?: CodeAgent;
  /** sandbox 组件 ID，用于打开对应面板 */
  comId?: string;
  /** 上传文件回调 */
  onUpload?: (file: File) => Promise<string>;
  /** 占位符文案 */
  placeholder?: string;
  /** 欢迎语标题文案 */
  welcomeTitle?: string;
}

const ChatStartView = ({
  agent,
  comId,
  onUpload,
  placeholder = "请尽量详细描述您的需求，或者上传图片作为补充。完成后您可以导出源码或者Figma设计稿。",
  welcomeTitle = "在这里，开始您的需求",
}: ChatStartViewProps) => {
  const senderRef = useRef<SenderRef>(null);
  const agentKey = agent?.key ?? "";
  const [loading, setLoading] = useState(() => context.aiQueue.isLoading(agentKey));
  const [empty, setEmpty] = useState(true);
  const [contextDisabled, setContextDisabled] = useState(() => context.disabled);
  const availableModes = agent?.getAvailableModes() ?? [AgentModeEnum.Build];
  const showChatMode = availableModes.length > 1;
  const [chatMode, setChatMode] = useState<AgentMode>(() => agent?.getMode() ?? availableModes[0] ?? AgentModeEnum.Build);

  const { syncAgent, subscribeSession } = useSession(agent);

  // 模型选择器状态 —— 与 chat-panel 对称，通过 llmProviders 实例事件同步
  const llmProviders = context.llmProviders;
  const hasLLMProviders = !!(llmProviders && llmProviders.isValid());
  const [selectedModel, setSelectedModel] = useState<ModelSelection | null>(
    () => llmProviders?.getSelected() ?? null
  );

  useEffect(() => {
    const lp = context.llmProviders;
    if (!lp) return;
    setSelectedModel(lp.getSelected());
    return lp.onSelectionChange((sel) => setSelectedModel(sel));
  }, [context.llmProviders]);

  const modelSelector = useMemo(() => {
    if (!hasLLMProviders || !llmProviders) return undefined;
    return {
      models: llmProviders.getValidModels(),
      selected: selectedModel,
      onSelect: (selection: ModelSelection) => {
        llmProviders.setSelected(selection.providerId, selection.modelId);
      },
    };
  }, [hasLLMProviders, llmProviders, selectedModel]);

  useEffect(() => {
    if (!agent) return;
    syncAgent(agent).catch(console.error);
    subscribeSession(agent);
    // 同步 agent 内部的 mode 变化（与 ChatPanel 保持一致）
    const unsubMode = agent.events.on("mode:change", ({ mode }) => setChatMode(mode));
    return unsubMode;
  }, [agent]);

  // 与 ChatPanel 保持同步：通过 aiQueue 事件驱动 loading，而非本地管理
  useEffect(() => {
    if (!agentKey) return;
    const unL = context.aiQueue.events.on("loading", (d) => {
      if (d.key === agentKey) setLoading(d.loading);
    });
    const unD = context.events.on("disabled", (v: boolean) => setContextDisabled(v));
    return () => { unL(); unD(); };
  }, [agentKey]);

  const onSend = (params: Parameters<SenderProps["onSend"]>[0]) => {
    if (loading || !agent || !comId) return;
    setEmpty(false);
    const { message, attachments, chips, mode } = params;
    const meta = chips?.length ? { chips } : undefined;

    ensureAIPanelOpen(comId).then(() => {
      context.aiQueue.send(
        agentKey,
        async () => {
          context.aiQueue.registerAbort(agentKey, () => agent.abort());
          await agent.requestAI({ message, attachments, ...(mode ? { mode } : {}), ...(meta ? { meta } : {}) });
        },
        { message: params.message, attachments: params.attachments }
      );
    });
  };

  return (
    <div className={classNames(css["start-view"], { [css["empty"]]: empty && !loading })}>
      {empty && !loading && (
        <div className={css["welcome-header"]}>
          <div className={css["welcome-title"]}>{welcomeTitle}</div>
        </div>
      )}
      {loading && (
        <LoadingView tip="正在思考中..." />
      )}
      {!loading && (
        <Sender
          ref={senderRef}
          loading={loading}
          disabled={loading || contextDisabled}
          onSend={onSend}
          variant="loose"
          chatMode={showChatMode ? chatMode : null}
          onChatModeChange={(nextMode: AgentMode | null) => {
            if (nextMode) agent?.setMode(nextMode, "ui-change");
          }}
          placeholder={placeholder}
          attachmentsPrompt="根据附件中的图片内容进行设计开发，要求尽可能还原其中的各类设计细节以及功能"
          onUpload={onUpload}
          chipTypes={chipRegistry.getAll()}
          modelSelector={modelSelector}
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
