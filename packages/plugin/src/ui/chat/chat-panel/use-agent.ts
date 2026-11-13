import { useCallback, useEffect, useMemo, useState, createElement } from "react";
import { context } from "../../../context";
import { chipRegistry } from "../../../sandbox/setup";
import type { QueueItem } from "../../../context/queue";
import type { SenderProps } from "../../components/sender";
import type { AgentMode, CodeAgent, CodeAgentPlugin } from "../../../../../agent/src";
import { AgentModeEnum } from "../../../../../agent/src";
import type { HistoryStatus } from "../../../../../agent/src";
import type { ModelSelection } from "../../../../../request/src";
import { useSession } from "../use-session";
import { usePendingSubmissions } from "./use-pending-submissions";
import { isHttpAgent, type HttpAgent } from "./remote/http-agent";
import { isWebSocketAgent, type WebSocketAgent } from "./websocket-agent";
import { HTTP_AGENT_SESSION_STAGE } from "./session-status";
import {
  useSessionState,
  type UseSessionStateOptions,
} from "./use-session-state";
import type { SenderActionSlashCommand, SenderPromptTemplateSlashCommand, SenderSlashCommand } from "../../components/sender/slash-command";
import { jsonStringifySafe } from "../../../utils/json";
import { lang } from "../../../i18n";
import { ChatModeIcon, getChatModePresentation } from "../../components/chat-mode";
import { Skill } from "../../components/icons";

export type ChatAgent = CodeAgent | HttpAgent | WebSocketAgent;

export interface ChatPanelAgentState {
  source: "local" | "http" | "websocket";
  agent?: ChatAgent;
  messages: ReturnType<typeof useSession>["messages"];
  historyStatus: HistoryStatus;
  historyError: unknown;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreHistory: (count?: number) => Promise<void>;
  loading: boolean;
  loadingTip: string;
  loadingTurnId?: string;
  finalizing: boolean;
  pendingQueue: QueueItem[];
  availableModes: AgentMode[];
  showChatMode: boolean;
  chatMode: AgentMode | null;
  modelSelector?: SenderProps["modelSelector"];
  isDisabled: boolean;
  canExecutePlan: boolean;
  send: SenderProps["onSend"];
  stop: () => void;
  removeFromQueue: (id: string) => void;
  sendNowFromQueue: (id: string) => void;
  clear: () => Promise<void>;
  exportHistory: () => Promise<void>;
  executePlan: (title: string) => void;
  setChatMode: (mode: AgentMode | null) => void;
  retry: (turnId: string, selection?: ModelSelection) => void;
  slashCommands: SenderSlashCommand[];
  todoArea?: NonNullable<CodeAgentPlugin["ui"]>["todoArea"];
}

export interface UseAgentOptions {
  agent?: ChatAgent;
  disabled?: boolean;
  onTurnStart?: () => void;
  onTurnEnd?: () => void;
  /** 覆盖当前 Agent 运行阶段的默认展示文案。 */
  resolveSessionStageText?: UseSessionStateOptions["resolveStageText"];
}

export function useAgent({ agent, disabled = false, onTurnStart, onTurnEnd, resolveSessionStageText }: UseAgentOptions): ChatPanelAgentState {
  return useAgentSession({
    agent,
    disabled,
    onTurnStart,
    onTurnEnd,
    resolveSessionStageText,
  });
}

function useAgentSession({ agent, disabled = false, onTurnStart, onTurnEnd, resolveSessionStageText }: {
  agent?: ChatAgent;
  disabled?: boolean;
  onTurnStart?: () => void;
  onTurnEnd?: () => void;
  resolveSessionStageText?: UseSessionStateOptions["resolveStageText"];
}): ChatPanelAgentState {
  const sessionState = useSessionState(agent, {
    resolveStageText: resolveSessionStageText,
  });
  const loading = sessionState.loading;
  const loadingTip = sessionState.statusText;
  const loadingTurnId = sessionState.turnId;
  const pendingQueue = sessionState.pendingQueue;
  const availableModes = agent?.getAvailableModes() ?? [AgentModeEnum.Build];
  const showChatMode = availableModes.length > 1;
  const [chatMode, setChatModeState] = useState<AgentMode>(() => agent?.getMode() ?? availableModes[0] ?? AgentModeEnum.Build);
  const submissions = usePendingSubmissions(agent);
  const [pluginRevision, setPluginRevision] = useState(0);

  const modelSelection = context.getModelSelection(agent?.key);
  const hasModelSelection = !!(modelSelection && modelSelection.isValid());
  const [selectedModel, setSelectedModel] = useState<ModelSelection | null>(
    () => modelSelection?.getSelected() ?? null
  );

  const {
    messages,
    historyStatus,
    historyError,
    hasMore,
    isLoadingMore,
    subscribeSession,
    clearSession,
    loadMoreHistory: loadMoreHistoryBase,
  } = useSession(agent);

  useEffect(() => {
    if (!modelSelection) {
      setSelectedModel(null);
      return;
    }
    setSelectedModel(modelSelection.getSelected());
    return modelSelection.onSelectionChange((selection) => setSelectedModel(selection));
  }, [modelSelection]);

  const modelSelector = useMemo<SenderProps["modelSelector"]>(() => {
    if (!hasModelSelection || !modelSelection) return undefined;
    return {
      models: modelSelection.getValidModels(),
      selected: selectedModel,
      onSelect: (selection: ModelSelection) => {
        modelSelection.setSelected(selection.providerId, selection.modelId);
      },
    };
  }, [hasModelSelection, modelSelection, selectedModel]);

  useEffect(() => {
    if (!agent || isWebSocketAgent(agent)) return;
    let active = true;
    agent.initializePlugins().then(() => {
      if (active) setPluginRevision((revision) => revision + 1);
    });
    return () => { active = false; };
  }, [agent]);

  const mbsTemplateCommands = useMemo<SenderPromptTemplateSlashCommand[]>(() => {
    // WebSocket Agent 的模板/插件能力由平台侧配置，本地不维护。
    if (!agent || isHttpAgent(agent) || isWebSocketAgent(agent)) return [];
    return agent.getMbsTemplates().map((template) => ({
      kind: "prompt-template",
      name: template.name,
      displayName: template.displayName,
      description: template.description,
      scope: template.scope,
      reference: template.reference,
      icon: createElement(Skill),
    }));
  }, [agent, pluginRevision]);

  const todoArea = useMemo(() => {
    if (!agent || isWebSocketAgent(agent)) return undefined;
    return agent.getPlugins().find((plugin) => plugin.ui?.todoArea)?.ui?.todoArea;
  }, [agent, pluginRevision]);

  const modeSlashCommands = useMemo<SenderActionSlashCommand[]>(() => {
    if (!agent) return [];
    const currentMode = chatMode ?? agent.getMode();
    return agent.getAvailableModes()
      .filter((mode) => mode !== currentMode)
      .map((mode) => {
        const presentation = getChatModePresentation(mode);
        return {
          kind: "action",
          name: mode,
          displayName: presentation.triggerTitle,
          description: presentation.description,
          scope: "builtin",
          icon: createElement(ChatModeIcon, { mode }),
          execute: () => agent.setMode(mode, "slash-command"),
        } satisfies SenderActionSlashCommand;
      });
  }, [agent, chatMode, pluginRevision]);

  const slashCommands = useMemo<SenderSlashCommand[]>(
    () => [...mbsTemplateCommands, ...modeSlashCommands],
    [mbsTemplateCommands, modeSlashCommands],
  );

  useEffect(() => {
    if (!agent) return;
    const unsubscribeSession = subscribeSession(agent, { onTurnStart, onTurnEnd });
    const unsubscribeMode = agent.events.on("mode:change", ({ mode }) => setChatModeState(mode));
    setChatModeState(agent.getMode());
    return () => {
      unsubscribeSession?.();
      unsubscribeMode();
    };
  }, [agent, onTurnEnd, onTurnStart, subscribeSession]);

  const historyFailed = historyStatus === "error";
  const historyLoading = historyStatus === "idle" || historyStatus === "loading";
  const isDisabled = !agent || !!disabled || historyLoading || historyFailed;
  const canExecutePlan = Boolean(agent && !isDisabled && availableModes.includes(AgentModeEnum.Build));

  const send = useCallback<SenderProps["onSend"]>((sendMessage) => {
    const { message, attachments, chips, mode } = sendMessage;
    if (!agent) return;
    const meta = chips?.length ? { chips } : undefined;
    // 模板变量随请求发送，由 WebSocketAgent 等远端通道在 consumeChatStream 中
    // 透传给智能体平台。空字符串 / undefined / 空数组视为未设置，不发送。
    const variables = Object.fromEntries(
      Object.entries(context.getVariables()).filter(([, value]) => {
        if (value === "" || value === undefined || value === null) return false;
        if (Array.isArray(value) && value.length === 0) return false;
        return true;
      })
    );
    context.aiQueue.send(
      agent,
      async () => {
        await agent.requestAI(chipRegistry.formatRequestParams({
          message, attachments, ...(mode ? { mode } : {}), ...(meta ? { meta } : {}),
          ...(Object.keys(variables).length ? { variables } : {}),
        }) as any);
      },
      { message, attachments }
    );
  }, [agent]);

  const stop = useCallback(() => {
    if (agent) context.aiQueue.stop(agent);
  }, [agent]);

  const removeFromQueue = useCallback((id: string) => {
    if (agent) context.aiQueue.remove(agent, id);
  }, [agent]);

  const sendNowFromQueue = useCallback((id: string) => {
    if (!agent) return;
    const item = context.aiQueue.getState(agent).queue.find((queued) => queued.id === id);
    const wsAgent = isWebSocketAgent(agent) ? agent : undefined;
    // 「优先发送」：WebSocket Agent 走平台插话（steer:true），由平台决定插入当前轮还是滚下一轮。
    if (wsAgent && item) {
      // 队列项 id（如 q-1）同时作为占位记录 id 与 agent 的 clientMessageId，建轮时回声以便让位。
      // submittedAt 一并传下去：建轮时沿用提交时刻，保证时间线排序与提交顺序一致。
      const submittedAt = Date.now();
      submissions.add({
        id,
        userText: item.message,
        userAttachments: item.attachments ?? [],
        startTime: submittedAt,
      });
      context.aiQueue.remove(agent, id);
      void wsAgent
        .steer({
          message: item.message,
          attachments: item.attachments,
          clientMessageId: id,
          submittedAt,
        })
        .catch(() => {
          // 无论用户终止还是投递失败：消息都保留在屏幕上（去掉等待提示）。
          // 后续如需区分"失败"状态，在这里给占位加标记即可。
          submissions.settle(id);
        })
        .then(() => {
          // steer 结束时若已无任何轮在跑：这条消息没落成 turn（可能还没走到接口），
          // 消息保留在屏幕上，只去掉"等待响应"提示。
          if (!wsAgent.getSessionState().running) submissions.settle(id);
        });
      return;
    }
    context.aiQueue.sendNow(agent, id);
  }, [agent, submissions]);

  const clear = useCallback(async () => {
    if (!agent || isDisabled) return;
    await agent.clearHistory();
    submissions.reset();
    clearSession();
  }, [agent, clearSession, isDisabled, submissions]);

  const loadMoreHistory = useCallback(async (count = 1) => {
    if (!agent) return;
    await loadMoreHistoryBase(agent, count);
  }, [agent, loadMoreHistoryBase]);

  const exportHistory = useCallback(async () => {
    if (!agent) return;
    try {
      let turns;
      if (isHttpAgent(agent)) turns = await agent.getTurnsForExport();
      if (isWebSocketAgent(agent)) turns = agent.getTurns();
      else turns = await context.pluginParams.history.load(agent.key);
      const content = {
        agentKey: agent.key,
        exportedAt: new Date().toISOString(),
        turns,
        compactRecord: agent.getCompactRecord?.() ?? null,
      };
      const name = `rxai-${Date.now()}.json`;
      await context.pluginParams.onDownload({ name, content: jsonStringifySafe(content) });
    } catch (error) {
      console.error("[plugin-ai] export history failed", error);
    }
  }, [agent]);

  const executePlan = useCallback((title: string) => {
    if (!agent || !canExecutePlan) return;
    const message = `执行「${title}」方案`;
    context.aiQueue.send(
      agent,
      async () => {
        await agent.requestAI({ message, mode: AgentModeEnum.Build });
      },
      { message }
    );
  }, [agent, canExecutePlan]);

  const retry = useCallback((turnId: string, selection?: ModelSelection) => {
    if (!agent) return;
    // 交给 aiQueue 的 request guard 统一处理禁用态并提示用户；在这里
    // 提前返回会让消息气泡的“重试”按钮变成无反馈的静默操作。
    context.aiQueue.send(
      agent,
      // WebSocket Agent 的模型在平台侧固定，忽略本地 selection。
      () => selection && !isWebSocketAgent(agent) ? agent.retry({ turnId, ...selection }) : agent.retry(turnId),
      { message: lang.common.retry() },
    );
  }, [agent]);

  const setChatMode = useCallback((mode: AgentMode | null) => {
    if (mode) agent?.setMode(mode, "ui-change");
  }, [agent]);

  const messagesWithPending = useMemo(() => submissions.merge(messages), [messages, submissions]);

  return {
    source: isWebSocketAgent(agent) ? "websocket" : isHttpAgent(agent) ? "http" : "local",
    agent,
    messages: messagesWithPending,
    historyStatus,
    historyError,
    hasMore,
    isLoadingMore,
    loadMoreHistory,
    loading,
    loadingTip,
    loadingTurnId,
    finalizing: sessionState.stage?.key === HTTP_AGENT_SESSION_STAGE.FINALIZING,
    pendingQueue,
    availableModes,
    showChatMode,
    chatMode: showChatMode ? chatMode : null,
    modelSelector,
    isDisabled,
    canExecutePlan,
    send,
    stop,
    removeFromQueue,
    sendNowFromQueue,
    clear,
    exportHistory,
    executePlan,
    retry,
    setChatMode,
    slashCommands,
    todoArea,
  };
}
