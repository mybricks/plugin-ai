import { useCallback, useEffect, useMemo, useState } from "react";
import { context } from "../../../context";
import { chipRegistry } from "../../../sandbox/setup";
import type {
  AgentQueueState,
  QueueItem,
} from "../../../context/queue";
import type { SenderProps } from "../../components/sender";
import type { AgentMode, CodeAgent } from "../../../../../agent/src";
import { AgentModeEnum } from "../../../../../agent/src";
import type { HistoryStatus } from "../../../../../agent/src";
import type { ModelSelection } from "../../../../../request/src/providers";
import { useSession } from "../use-session";
import { isHttpAgent, type HttpAgent } from "./http-agent";

export type ChatAgent = CodeAgent | HttpAgent;

export interface ChatPanelAgentState {
  source: "local" | "http";
  agent?: ChatAgent;
  messages: ReturnType<typeof useSession>["messages"];
  historyStatus: HistoryStatus;
  historyError: unknown;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreHistory: (count?: number) => Promise<void>;
  loading: boolean;
  loadingTip: string;
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
  clear: () => Promise<void>;
  exportHistory: () => Promise<void>;
  executePlan: (title: string) => void;
  setChatMode: (mode: AgentMode | null) => void;
  retry?: (turnId: string) => void;
  deleteTurn?: (turnId: string) => void;
}

export interface UseAgentOptions {
  agent?: ChatAgent;
  disabled?: boolean;
  onTurnStart?: () => void;
  onTurnEnd?: () => void;
}

export function useAgent({ agent, disabled = false, onTurnStart, onTurnEnd }: UseAgentOptions): ChatPanelAgentState {
  return useAgentSession({ agent, disabled, onTurnStart, onTurnEnd });
}

function useAgentSession({ agent, disabled = false, onTurnStart, onTurnEnd }: { agent?: ChatAgent; disabled?: boolean; onTurnStart?: () => void; onTurnEnd?: () => void; }): ChatPanelAgentState {
  const [queueState, setQueueState] = useState<AgentQueueState>(() =>
    agent
      ? context.aiQueue.getState(agent)
      : { running: false, queue: [] },
  );
  const loading = queueState.running;
  const loadingTip = queueState.statusText ?? "等待模型响应...";
  const pendingQueue = queueState.queue;
  const availableModes = agent?.getAvailableModes() ?? [AgentModeEnum.Build];
  const showChatMode = availableModes.length > 1;
  const [chatMode, setChatModeState] = useState<AgentMode>(() => agent?.getMode() ?? availableModes[0] ?? AgentModeEnum.Build);

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
    if (!agent) {
      setQueueState({ running: false, queue: [] });
      return;
    }
    return context.aiQueue.subscribe(agent, setQueueState);
  }, [agent]);

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
    context.aiQueue.send(
      agent,
      async () => {
        await agent.requestAI(chipRegistry.formatRequestParams({ message, attachments, ...(mode ? { mode } : {}), ...(meta ? { meta } : {}) }));
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

  const clear = useCallback(async () => {
    if (!agent || isDisabled) return;
    await agent.clearHistory();
    clearSession();
  }, [agent, clearSession, isDisabled]);

  const loadMoreHistory = useCallback(async (count = 1) => {
    if (!agent) return;
    await loadMoreHistoryBase(agent, count);
  }, [agent, loadMoreHistoryBase]);

  const exportHistory = useCallback(async () => {
    if (!agent) return;
    try {
      const content = {
        agentKey: agent.key,
        exportedAt: new Date().toISOString(),
        turns: agent.getTurns(),
        compactRecord: agent.getCompactRecord?.() ?? null,
      };
      const name = `rxai-${Date.now()}.json`;
      await context.pluginParams.onDownload({ name, content: JSON.stringify(content) });
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

  const setChatMode = useCallback((mode: AgentMode | null) => {
    if (mode) agent?.setMode(mode, "ui-change");
  }, [agent]);

  return {
    source: isHttpAgent(agent) ? "http" : "local",
    agent,
    messages,
    historyStatus,
    historyError,
    hasMore,
    isLoadingMore,
    loadMoreHistory,
    loading,
    loadingTip,
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
    clear,
    exportHistory,
    executePlan,
    setChatMode,
  };
}
