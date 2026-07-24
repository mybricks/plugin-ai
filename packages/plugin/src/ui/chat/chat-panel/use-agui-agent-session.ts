import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  AgentModeEnum,
  type HistoryStatus,
  type TurnRecord,
} from "../../../../../agent/src";
import type { MessageRecord } from "../use-session";
import type { ChatPanelAgentState } from "./use-agent";
import type { AguiEvent, HttpAgent } from "./http-agent";
import {
  appendMessage,
  ensureLastLLMIter,
  findLastPendingId,
  normalizeAttachments,
  parsePartialArgs,
  turnsToMessageRecords,
  updateLastLLMIter,
  updateLastLLMIterTool,
  updateMessage,
} from "./message-state";

export interface UseAguiAgentSessionOptions {
  agent?: HttpAgent;
  disabled?: boolean;
  onTurnStart?: () => void;
  onTurnEnd?: () => void;
}

export function useAguiAgentSession({
  agent,
  disabled = false,
  onTurnStart,
  onTurnEnd,
}: UseAguiAgentSessionOptions): ChatPanelAgentState {
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [historyStatus, setHistoryStatus] = useState<HistoryStatus>("ready");
  const [historyError, setHistoryError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const pendingTurnIdRef = useRef<string | null>(null);
  const contentRef = useRef("");
  const thinkingRef = useRef("");
  const toolArgsRef = useRef<Record<string, string>>({});
  const runUnsubscribeRef = useRef<(() => void) | null>(null);
  const applyAguiEventRef = useRef<((event: AguiEvent) => void) | null>(null);

  const resetStreamingRefs = useCallback((turnId?: string | null) => {
    pendingTurnIdRef.current = turnId ?? null;
    contentRef.current = "";
    thinkingRef.current = "";
    toolArgsRef.current = {};
  }, []);

  const handleStreamEvent = useCallback((event: AguiEvent) => {
    applyAguiEventRef.current?.(event);
  }, []);

  const mergeMessages = useCallback((older: MessageRecord[], newer: MessageRecord[]) => {
    const byId = new Map<string, MessageRecord>();
    for (const record of older) byId.set(record.id, record);
    for (const record of newer) byId.set(record.id, record);
    return Array.from(byId.values());
  }, []);

  const applyAguiEvent = useCallback(
    (event: AguiEvent) => {
      if (!event || typeof event.type !== "string") return;
      const now = event.timestamp ?? Date.now();
      const contentMode = agent?.streamContentMode ?? "delta";
      const finishRun = (turnId: string | null, status: "success" | "abort" | "error", error?: string) => {
        setLoading(false);
        if (turnId) {
          setMessages((prev) =>
            updateMessage(prev, turnId, (record) => ({
              ...record,
              status,
              ...(error ? { error } : {}),
              endTime: now,
            })),
          );
        }
        resetStreamingRefs();
        onTurnEnd?.();
      };

      switch (event.type) {
        case "STATE_SNAPSHOT": {
          const agentState = event.snapshot?.agent ?? event.agent;
          setLoading(agentState?.status === "running");
          return;
        }
        case "RUN_STARTED": {
          const turnId = String(
            event.runId ?? event.turnId ?? `turn-${now}`,
          );
          resetStreamingRefs(turnId);
          setLoading(true);
          setMessages((prev) =>
            appendMessage(prev, {
              id: turnId,
              startTime: now,
              userText: String(event.message ?? ""),
              userAttachments: normalizeAttachments(event.attachments),
              ...(event.meta ? { meta: event.meta } : {}),
              status: "pending",
              iterations: [],
            }),
          );
          onTurnStart?.();
          return;
        }
        case "TEXT_MESSAGE_START": {
          const turnId = pendingTurnIdRef.current;
          if (!turnId) return;
          contentRef.current = "";
          thinkingRef.current = "";
          setMessages((prev) =>
            updateMessage(prev, turnId, (record) => ({
              ...record,
              iterations: [
                ...record.iterations,
                { content: "", toolCalls: [], startTime: now },
              ],
            })),
          );
          return;
        }
        case "TEXT_MESSAGE_CONTENT": {
          const turnId = pendingTurnIdRef.current;
          if (!turnId) return;
          const nextContent = String(event.delta ?? event.content ?? "");
          const nextThinking = event.thinkingDelta ?? event.thinkingContent;
          contentRef.current =
            contentMode === "delta"
              ? contentRef.current + nextContent
              : nextContent;
          if (nextThinking !== undefined) {
            const value = String(nextThinking);
            thinkingRef.current =
              contentMode === "delta" ? thinkingRef.current + value : value;
          }
          setMessages((prev) =>
            updateMessage(prev, turnId, (record) =>
              updateLastLLMIter(ensureLastLLMIter(record, now), (iter) => ({
                ...iter,
                content: contentRef.current,
                responseTime: (iter as any).responseTime ?? now,
                ...(nextThinking !== undefined
                  ? { thinkingContent: thinkingRef.current }
                  : {}),
              })),
            ),
          );
          return;
        }
        case "TEXT_MESSAGE_END": {
          const turnId = pendingTurnIdRef.current;
          if (!turnId) return;
          setMessages((prev) =>
            updateMessage(prev, turnId, (record) =>
              updateLastLLMIter(record, (iter) => ({ ...iter, endTime: now })),
            ),
          );
          contentRef.current = "";
          thinkingRef.current = "";
          return;
        }
        case "TOOL_CALL_ARGS": {
          const turnId = pendingTurnIdRef.current;
          if (!turnId) return;
          const callId = String(event.toolCallId ?? event.callId ?? "");
          if (!callId) return;
          const chunk = String(event.delta ?? event.args ?? "");
          const content =
            contentMode === "delta"
              ? (toolArgsRef.current[callId] ?? "") + chunk
              : chunk;
          toolArgsRef.current[callId] = content;
          const partialArgs = parsePartialArgs(content);
          setMessages((prev) =>
            updateMessage(prev, turnId, (record) =>
              updateLastLLMIter(ensureLastLLMIter(record, now), (iter) => {
                const existing = iter.toolCalls.find(
                  (tool) => tool.callId === callId,
                );
                if (existing) {
                  return {
                    ...iter,
                    toolCalls: iter.toolCalls.map((tool) =>
                      tool.callId === callId
                        ? {
                            ...tool,
                            argsContent: content,
                            ...(partialArgs ? { args: partialArgs } : {}),
                          }
                        : tool,
                    ),
                  };
                }
                return {
                  ...iter,
                  toolCalls: [
                    ...iter.toolCalls,
                    {
                      callId,
                      name: String(event.toolCallName ?? event.name ?? "tool"),
                      args: partialArgs ?? {},
                      status: "pending",
                      execStartTime: now,
                      execEndTime: 0,
                      argsContent: content,
                    },
                  ],
                };
              }),
            ),
          );
          return;
        }
        case "TOOL_CALL_START": {
          const turnId = pendingTurnIdRef.current;
          if (!turnId) return;
          const callId = String(event.toolCallId ?? event.callId ?? "");
          if (!callId) return;
          const name = String(event.toolCallName ?? event.name ?? "tool");
          setMessages((prev) =>
            updateMessage(prev, turnId, (record) =>
              updateLastLLMIter(ensureLastLLMIter(record, now), (iter) => {
                const existing = iter.toolCalls.find(
                  (tool) => tool.callId === callId,
                );
                if (existing) {
                  return {
                    ...iter,
                    toolCalls: iter.toolCalls.map((tool) =>
                      tool.callId === callId
                        ? {
                            ...tool,
                            name,
                            args: event.args ?? tool.args ?? {},
                            argsContent: undefined,
                            execStartTime: now,
                          }
                        : tool,
                    ),
                  };
                }
                return {
                  ...iter,
                  toolCalls: [
                    ...iter.toolCalls,
                    {
                      callId,
                      name,
                      args: event.args ?? {},
                      status: "pending",
                      execStartTime: now,
                      execEndTime: 0,
                    },
                  ],
                };
              }),
            ),
          );
          return;
        }
        case "TOOL_CALL_END": {
          const turnId = pendingTurnIdRef.current;
          if (!turnId) return;
          const callId = String(event.toolCallId ?? event.callId ?? "");
          if (!callId) return;
          setMessages((prev) =>
            updateMessage(prev, turnId, (record) =>
              updateLastLLMIterTool(record, callId, (tool) =>
                event.error !== undefined
                  ? {
                      ...tool,
                      status: "error",
                      execEndTime: now,
                      error: String(event.error),
                    }
                  : {
                      ...tool,
                      status: "success",
                      execEndTime: now,
                      result: event.result,
                    },
              ),
            ),
          );
          return;
        }
        case "RUN_ERROR": {
          finishRun(
            pendingTurnIdRef.current,
            "error",
            String(event.message ?? event.error ?? "Agent run failed"),
          );
          return;
        }
        case "RUN_FINISHED": {
          finishRun(
            pendingTurnIdRef.current,
            event.aborted ? "abort" : "success",
          );
          return;
        }
        case "CUSTOM":
          applyCustomEvent(event, pendingTurnIdRef.current, setMessages);
          return;
        default:
          return;
      }
    },
    [agent?.streamContentMode, onTurnEnd, onTurnStart, resetStreamingRefs],
  );

  useEffect(() => {
    applyAguiEventRef.current = applyAguiEvent;
  }, [applyAguiEvent]);

  useEffect(() => {
    if (!agent) {
      setMessages([]);
      setHistoryStatus("ready");
      setHistoryError(null);
      setLoading(false);
      resetStreamingRefs();
      return;
    }

    let cancelled = false;
    const init = async () => {
      setHistoryStatus("loading");
      setHistoryError(null);
      let initialized = false;
      try {
        runUnsubscribeRef.current?.();
        runUnsubscribeRef.current = agent.agui.subscribe({
          limit: 1,
          onEvent: (event) => {
            if (
              event.type === "STATE_SNAPSHOT" &&
              !initialized
            ) {
              initialized = true;
              const snapshot = event.snapshot ?? {};
              setLoading(snapshot.agent?.status === "running");
              setHistoryStatus("ready");
              // /connect?limit=1 的 STATE_SNAPSHOT 是历史初始化来源。
              // 如果 snapshot.agent 为 null 或 snapshot.turns 缺失，表示服务端当前没有历史数据，
              // 前端不再额外调用 /turns 猜测补齐。
              const currentRecords = turnsToMessageRecords(
                (snapshot.turns ?? []) as TurnRecord[],
              );
              pendingTurnIdRef.current = findLastPendingId(currentRecords);
              setMessages(currentRecords);

              const before = snapshot.oldestTurnId;
              if (before) {
                void agent.agui
                  .getTurns({ before, limit: 10 })
                  .then((page) => {
                    if (cancelled) return;
                    const olderRecords = turnsToMessageRecords(
                      (page.turns ?? []) as TurnRecord[],
                    );
                    setMessages((prev) => mergeMessages(olderRecords, prev));
                  })
                  .catch((error) => {
                    setHistoryError(error);
                    console.error("[plugin-ai] load AGUI previous turns failed", error);
                  });
              }
              return;
            }
            handleStreamEvent(event);
          },
          onError: (error) => {
            if (cancelled) return;
            setHistoryStatus("error");
            setHistoryError(error);
            setLoading(false);
            runUnsubscribeRef.current = null;
          },
          onClose: () => {
            runUnsubscribeRef.current = null;
            if (!initialized && !cancelled) {
              setHistoryStatus("ready");
            }
          },
        });
        if (cancelled) return;
      } catch (error) {
        if (cancelled) return;
        setHistoryStatus("error");
        setHistoryError(error);
      }
    };

    void init();

    return () => {
      cancelled = true;
      runUnsubscribeRef.current?.();
      runUnsubscribeRef.current = null;
    };
  }, [agent, handleStreamEvent, mergeMessages, resetStreamingRefs]);

  const send: ChatPanelAgentState["send"] = useCallback(
    (sendMessage) => {
      if (!agent || disabled) return;
      const meta = sendMessage.chips?.length
        ? { chips: sendMessage.chips }
        : undefined;
      setLoading(true);
      runUnsubscribeRef.current?.();
      const controller = new AbortController();
      runUnsubscribeRef.current = () => controller.abort();
      void agent
        .requestAI({
          message: sendMessage.message,
          attachments: sendMessage.attachments,
          ...(sendMessage.mode ? { mode: sendMessage.mode } : {}),
          ...(meta ? { meta } : {}),
          signal: controller.signal,
          onEvent: handleStreamEvent,
          onError: (error) => {
            setLoading(false);
            runUnsubscribeRef.current = null;
            console.error("[plugin-ai] AGUI run stream failed", error);
          },
          onClose: () => {
            runUnsubscribeRef.current = null;
          },
        })
        .catch((error) => {
          if ((error as Error)?.name === "AbortError") return;
          setLoading(false);
          setHistoryError(error);
          console.error("[plugin-ai] send AGUI agent message failed", error);
        });
    },
    [agent, disabled, handleStreamEvent],
  );

  const clear = useCallback(async () => {
    if (!agent || disabled) return;
    await agent.clearHistory();
    setMessages([]);
    resetStreamingRefs();
  }, [agent, disabled, resetStreamingRefs]);

  return {
    source: "http",
    agent,
    messages,
    historyStatus,
    historyError,
    loading,
    pendingQueue: [],
    availableModes: agent?.getAvailableModes() ?? [AgentModeEnum.Build],
    showChatMode: false,
    chatMode: null,
    modelSelector: undefined,
    isDisabled:
      !agent ||
      disabled ||
      historyStatus === "idle" ||
      historyStatus === "loading" ||
      historyStatus === "error",
    canExecutePlan: false,
    send,
    stop: () => {
      void agent
        ?.abort()
        .catch((error) =>
          console.error("[plugin-ai] abort AGUI agent failed", error),
        );
    },
    removeFromQueue: () => {},
    clear,
    exportHistory: async () => {},
    executePlan: () => {},
    setChatMode: () => {},
  };
}

function applyCustomEvent(
  event: AguiEvent,
  pendingTurnId: string | null,
  setMessages: Dispatch<SetStateAction<MessageRecord[]>>,
) {
  const name = String(event.name ?? "");
  const value = event.value ?? {};
  const now = event.timestamp ?? Date.now();

  if (name === "warmup:start" && pendingTurnId) {
    const data = value as any;
    setMessages((prev) =>
      updateMessage(prev, pendingTurnId, (record) => ({
        ...record,
        iterations: [
          ...record.iterations,
          {
            type: "warmup",
            status: "loading",
            content: String(data.content ?? ""),
            startTime: data.startTime ?? now,
            toolCalls: [],
          },
        ],
      })),
    );
    return;
  }

  if (name === "warmup:content" && pendingTurnId) {
    const data = value as any;
    setMessages((prev) =>
      updateMessage(prev, pendingTurnId, (record) => {
        const iterations = [...record.iterations];
        const last = iterations[iterations.length - 1];
        if (!last || last.type !== "warmup") return record;
        iterations[iterations.length - 1] = {
          ...last,
          content: String(data.content ?? ""),
        };
        return { ...record, iterations };
      }),
    );
    return;
  }

  if (name === "warmup:complete" && pendingTurnId) {
    const data = value as any;
    setMessages((prev) =>
      updateMessage(prev, pendingTurnId, (record) => {
        const iterations = [...record.iterations];
        const last = iterations[iterations.length - 1];
        if (!last || last.type !== "warmup") return record;
        iterations[iterations.length - 1] = {
          ...last,
          status: data.status ?? "success",
          content: String(data.content ?? last.content),
          endTime: data.endTime ?? now,
        };
        return { ...record, iterations };
      }),
    );
  }
}
