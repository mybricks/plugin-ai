import { useCallback, useEffect, useMemo, useState } from "react";
import { context } from "../../../context";
import type { QueueItem } from "../../../context/queue";
import type { SenderProps } from "../../components/sender";
import type { AgentMode, CodeAgent } from "../../../../../agent/src";
import { AgentModeEnum } from "../../../../../agent/src";
import type { HistoryStatus } from "../../../../../agent/src";
import type { ModelSelection } from "../../../../../request/src/providers";
import { useSession } from "../use-session";
import { isHttpAgent, type HttpAgent } from "./http-agent";
import { useAguiAgentSession } from "./use-agui-agent-session";

export type ChatAgent = CodeAgent | HttpAgent;

export interface ChatPanelAgentState {
  source: "local" | "http";
  agent?: ChatAgent;
  messages: ReturnType<typeof useSession>["messages"];
  historyStatus: HistoryStatus;
  historyError: unknown;
  loading: boolean;
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
  const httpAgent = isHttpAgent(agent) ? agent : undefined;
  const localAgent = !isHttpAgent(agent) ? agent : undefined;
  const local = useLocalAgentSession({ agent: localAgent, disabled, onTurnStart, onTurnEnd });
  const agui = useAguiAgentSession({ agent: httpAgent, disabled, onTurnStart, onTurnEnd });
  return httpAgent ? agui : local;
}

function useLocalAgentSession({ agent, disabled = false, onTurnStart, onTurnEnd }: { agent?: CodeAgent; disabled?: boolean; onTurnStart?: () => void; onTurnEnd?: () => void; }): ChatPanelAgentState {
  const agentKey = agent?.key ?? "";
  const [loading, setLoading] = useState(() => context.aiQueue.isLoading(agentKey));
  const [pendingQueue, setPendingQueue] = useState<QueueItem[]>(() => context.aiQueue.getQueue(agentKey));
  const availableModes = agent?.getAvailableModes() ?? [AgentModeEnum.Build];
  const showChatMode = availableModes.length > 1;
  const [chatMode, setChatModeState] = useState<AgentMode>(() => agent?.getMode() ?? availableModes[0] ?? AgentModeEnum.Build);

  const llmProviders = agent?.getLLMProviders();
  const hasLLMProviders = !!(llmProviders && llmProviders.isValid());
  const [selectedModel, setSelectedModel] = useState<ModelSelection | null>(
    () => llmProviders?.getSelected() ?? null
  );

  const { messages, historyStatus, historyError, subscribeSession, clearSession } = useSession(agent);

  useEffect(() => {
    setLoading(context.aiQueue.isLoading(agentKey));
    setPendingQueue(context.aiQueue.getQueue(agentKey));
  }, [agentKey]);

  useEffect(() => {
    const lp = llmProviders;
    if (!lp) {
      setSelectedModel(null);
      return;
    }
    setSelectedModel(lp.getSelected());
    return lp.onSelectionChange((selection) => setSelectedModel(selection));
  }, [llmProviders]);

  const modelSelector = useMemo<SenderProps["modelSelector"]>(() => {
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
    const unsubscribeSession = subscribeSession(agent, { onTurnStart, onTurnEnd });
    const unsubscribeMode = agent.events.on("mode:change", ({ mode }) => setChatModeState(mode));
    setChatModeState(agent.getMode());
    return () => {
      unsubscribeSession?.();
      unsubscribeMode();
    };
  }, [agent, onTurnEnd, onTurnStart, subscribeSession]);

  useEffect(() => {
    const unLoading = context.aiQueue.events.on("loading", (data) => {
      if (data.key === agentKey) setLoading(data.loading);
    });
    const unQueue = context.aiQueue.events.on("queue", (data) => {
      if (data.key === agentKey) setPendingQueue([...data.queue]);
    });
    return () => {
      unLoading();
      unQueue();
    };
  }, [agentKey]);

  const historyFailed = historyStatus === "error";
  const historyLoading = historyStatus === "idle" || historyStatus === "loading";
  const isDisabled = !agent || !!disabled || historyLoading || historyFailed;
  const canExecutePlan = Boolean(agent && !isDisabled && availableModes.includes(AgentModeEnum.Build));

  const send = useCallback<SenderProps["onSend"]>((sendMessage) => {
    const { message, attachments, chips, mode } = sendMessage;
    if (!agent) return;
    const meta = chips?.length ? { chips } : undefined;
    context.aiQueue.send(
      agentKey,
      async () => {
        context.aiQueue.registerAbort(agentKey, () => agent.abort());
        await agent.requestAI({ message, attachments, ...(mode ? { mode } : {}), ...(meta ? { meta } : {}) });
      },
      { message, attachments }
    );
  }, [agent, agentKey]);

  const stop = useCallback(() => {
    context.aiQueue.stop(agentKey);
  }, [agentKey]);

  const removeFromQueue = useCallback((id: string) => {
    context.aiQueue.removeFromQueue(agentKey, id);
  }, [agentKey]);

  const clear = useCallback(async () => {
    if (!agent || isDisabled) return;
    await agent.clearHistory();
    clearSession();
  }, [agent, clearSession, isDisabled]);

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
      agentKey,
      async () => {
        context.aiQueue.registerAbort(agentKey, () => agent.abort());
        await agent.requestAI({ message, mode: AgentModeEnum.Build });
      },
      { message }
    );
  }, [agent, agentKey, canExecutePlan]);

  const setChatMode = useCallback((mode: AgentMode | null) => {
    if (mode) agent?.setMode(mode, "ui-change");
  }, [agent]);

  return {
    source: "local",
    agent,
    messages,
    historyStatus,
    historyError,
    loading,
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
