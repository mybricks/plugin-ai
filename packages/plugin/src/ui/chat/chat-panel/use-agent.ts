import { useCallback, useEffect, useMemo, useState } from "react";
import { context } from "../../../context";
import { chipRegistry } from "../../../sandbox/setup";
import type { QueueItem } from "../../../context/queue";
import type { SenderProps } from "../../components/sender";
import type { AgentMode, CodeAgent } from "../../../../../agent/src";
import { AgentModeEnum } from "../../../../../agent/src";
import type { HistoryStatus } from "../../../../../agent/src";
import type { ModelSelection } from "../../../../../request/src/providers";
import { useSession } from "../use-session";
import { isHttpAgent, type HttpAgent } from "./http-agent";
import {
  useSessionState,
  type UseSessionStateOptions,
} from "./use-session-state";
import type { SenderPromptTemplateSlashCommand, SenderSlashCommand } from "../../components/sender/slash-command";
import { jsonStringifySafe } from "../../../utils/json";

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
  loadingTurnId?: string;
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
  retry: (turnId: string) => void;
  slashCommands: SenderSlashCommand[];
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

  useEffect(() => context.events.on("pluginState", () => {
    setPluginRevision((revision) => revision + 1);
  }), []);

  const mbsTemplateCommands = useMemo<SenderPromptTemplateSlashCommand[]>(() => {
    if (!agent || isHttpAgent(agent)) return [];
    return agent.getMbsTemplates().map((template) => ({
      kind: "prompt-template",
      name: template.name,
      displayName: template.displayName,
      description: template.description,
      scope: template.scope,
      reference: template.reference,
    }));
  }, [agent, pluginRevision]);

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

  const retry = useCallback((turnId: string) => {
    if (!agent || isDisabled) return;
    context.aiQueue.send(
      agent,
      () => agent.retry(turnId),
      { message: "重试" },
    );
  }, [agent, isDisabled]);

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
    loadingTurnId,
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
    retry,
    setChatMode,
    slashCommands: mbsTemplateCommands,
  };
}
