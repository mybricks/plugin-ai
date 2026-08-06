import type { ToolExecutionContext } from "../../../../agent/src/agent";
import type { LowCodeDesignerRuntime } from "../../designer";
import { buildLowCodeDesignerContext, buildLowCodeStableContext } from "../../project";
import { getTargetById } from "../../designer/execution";
import type { LowCodeGeneratePageTask } from "../types";
import { activeDSL } from "../../dsl";
import type { ActionDSL, CanonicalAction } from "../../dsl";
import {
  buildExecutionStatePrompt,
  buildPageActionSystemPrompt,
  type LowCodeActionExecutionReport,
  type LowCodeActionFailure,
} from "./prompt";

const ENABLE_RENDER_OPTIMIZATION = false;

function prepareActionForUpdatePage(action: CanonicalAction): CanonicalAction {
  if (ENABLE_RENDER_OPTIMIZATION || action.type !== "addChild") return action;
  if (!("ignore" in action) && !("enhance" in action)) return action;
  const { ignore: _ignore, enhance: _enhance, ...rest } = action as any;
  return rest as CanonicalAction;
}

function extractStreamingActionLines(dsl: ActionDSL, content: string): Array<{ action: CanonicalAction; line: string }> {
  const fenceMatch = content.match(/```(?:actions\.json|json)?\s*\n/);
  if (!fenceMatch || fenceMatch.index === undefined) return [];
  const rest = content.slice(fenceMatch.index + fenceMatch[0].length);
  const closeIndex = rest.indexOf("```");
  const text = closeIndex >= 0 ? rest.slice(0, closeIndex) : rest;
  const lines = text.split(/\r?\n/);
  return (closeIndex >= 0 ? lines : lines.slice(0, -1)).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return [];
    try {
      const actions = dsl.parseContent(trimmed);
      return actions.length === 1 ? [{ action: actions[0], line }] : [];
    } catch {
      return [];
    }
  });
}

export interface PageTaskProgress {
  content: string;
  thinkingContent: string;
  actionCount: number;
  succeeded: number;
  failed: number;
  attempts: number;
}

export async function generateActionsWithSubAgent(
  runtime: LowCodeDesignerRuntime,
  params: LowCodeGeneratePageTask,
  toolContext: ToolExecutionContext,
  onAction?: (action: CanonicalAction) => Promise<any>,
  onProgress?: (progress: PageTaskProgress) => void,
) {
  const dsl = activeDSL;
  const parentAgent = toolContext.getAgent();
  const { attachments } = toolContext.getUserMessage();
  const hasImage = attachments?.some((item: any) => item.type === "image" || item.mime?.startsWith?.("image/"));
  let lastContent = "";
  let lastThinkingContent = "";
  const emittedActionKeys = new Set<string>();
  const streamedActions: CanonicalAction[] = [];
  const streamedActionLines: string[] = [];
  const executedActions: CanonicalAction[] = [];
  const failures: LowCodeActionFailure[] = [];
  let requestRound = 0;
  let injectedFailureCount = 0;
  let actionQueue = Promise.resolve();
  const emit = () => onProgress?.({ content: lastContent, thinkingContent: lastThinkingContent, actionCount: streamedActions.length, succeeded: executedActions.length, failed: failures.length, attempts: requestRound });
  const subAgent = parentAgent.createFork({
    tools: [], system: buildPageActionSystemPrompt(dsl), aiRole: hasImage ? "image" : undefined, retry: false,
    hooks: { beforeRequest: () => {
      requestRound += 1;
      if (failures.length <= injectedFailureCount) return;
      injectedFailureCount = failures.length;
      return { additionalMessages: [{ role: "user", content: buildExecutionStatePrompt(failures) }] };
    } },
  });
  const enqueue = (action: CanonicalAction, actionIndex: number) => {
    if (!onAction) return;
    actionQueue = actionQueue.then(async () => {
      try {
        const result = await onAction(prepareActionForUpdatePage(action));
        if (result !== undefined) executedActions.push(result);
      } catch (error) {
        failures.push({ action, actionIndex, error: error instanceof Error ? error.message : String(error) });
      }
      emit();
    });
  };
  const unsubscribe = subAgent.events.on("llm:content", ({ content, thinkingContent }) => {
    lastContent = content || "";
    if (thinkingContent !== undefined) lastThinkingContent = thinkingContent || "";
    extractStreamingActionLines(dsl, lastContent).forEach(({ action, line }) => {
      const key = `${requestRound}:${JSON.stringify(action)}`;
      if (emittedActionKeys.has(key)) return;
      emittedActionKeys.add(key);
      streamedActions.push(action);
      streamedActionLines.push(line);
      enqueue(action, streamedActions.length);
    });
    emit();
  });
  let requestError: unknown;
  try {
    const target = getTargetById(runtime, params.targetId);
    const targetFocus = params.mode === "create" && params.targetId ? { ...runtime.focus, type: "page", pageId: params.targetId, comId: undefined } : runtime.focus;
    const request = [
      "根据以下用户需求和低代码上下文生成完整 actions。", "", "<用户需求>", params.prompt, "</用户需求>", "", "<目标>",
      `mode: ${params.mode}`, `targetId: ${params.targetId ?? target?.id ?? ""}`, target?.type ? `targetType: ${target.type}` : "", target?.pageId ? `pageId: ${target.pageId}` : "", "</目标>", "",
      "<低代码上下文>", buildLowCodeStableContext(runtime), "", buildLowCodeDesignerContext(runtime.api, targetFocus), "</低代码上下文>",
    ].filter(Boolean).join("\n");
    await subAgent.requestAI({ message: request });
    await actionQueue;
  } catch (error) { requestError = error; } finally { unsubscribe(); }
  const turns = subAgent.getTurns();
  const lastTurn = turns[turns.length - 1];
  const lastLLMIter = lastTurn?.iterations?.slice().reverse().find((iter: any) => !("type" in iter));
  const content = (lastLLMIter as any)?.content || lastContent;
  if (requestError) throw requestError;
  const generatedActions = streamedActions.length ? streamedActions : dsl.parseContent(content);
  const generatedActionLines = streamedActions.length ? streamedActionLines : extractStreamingActionLines(dsl, content).map(({ line }) => line);
  if (onAction && !streamedActions.length) generatedActions.forEach((action, index) => enqueue(action, index + 1));
  await actionQueue;
  if (!generatedActions.length) throw new Error("lowcode_generate_page subAgent did not generate any actions.");
  if (generatedActionLines.length !== generatedActions.length) throw new Error("lowcode_generate_page could not preserve the generated action lines.");
  return { actions: onAction ? executedActions : generatedActions, generatedActions, generatedActionLines, content, report: { succeeded: executedActions, failed: failures, attempts: requestRound } as LowCodeActionExecutionReport };
}
