import type { ToolExecutionContext } from "../../../../agent/src/agent";
import type { LowCodeDesignerRuntime } from "../../designer";
import type { LowCodeGeneratePageTask } from "../types";
import { activeDSL } from "../../dsl";
import type { ActionDSL, CanonicalAction } from "../../dsl";
import {
  buildExecutionStatePrompt,
  buildPageActionSystemPrompt,
  type LowCodeActionExecutionReport,
} from "./prompt";
import { UpdatePageRun, type UpdatePageActionExecutor } from "./action-pipeline";

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

export interface PageRequestProgress {
  content: string;
  thinkingContent: string;
  actionCount: number;
  succeeded: number;
  failed: number;
  attempts: number;
}

/** Executes one LowCodeGeneratePageTask; all mutable state lives in UpdatePageRun. */
export async function runUpdatePageTask(
  runtime: LowCodeDesignerRuntime,
  params: LowCodeGeneratePageTask,
  toolContext: ToolExecutionContext,
  executor?: UpdatePageActionExecutor,
  onProgress?: (progress: PageRequestProgress) => void,
  enableRenderingOptimization = false,
) {
  const dsl = activeDSL;
  const parentAgent = toolContext.getAgent();
  const { attachments } = toolContext.getUserMessage();
  const hasImage = attachments?.some((item: any) => item.type === "image" || item.mime?.startsWith?.("image/"));
  let lastContent = "";
  let lastThinkingContent = "";
  const emittedActionKeys = new Set<string>();
  const run = executor ? new UpdatePageRun({ request: params, dsl, executor, enableRenderingOptimization }) : undefined;
  let requestRound = 0;
  let injectedFailureCount = 0;
  let receivedActionCount = 0;
  let actionQueue = Promise.resolve();
  const emit = () => onProgress?.({ content: lastContent, thinkingContent: lastThinkingContent, actionCount: run?.sourceActions.length ?? 0, succeeded: run?.executedActions.length ?? 0, failed: run?.failures.length ?? 0, attempts: requestRound });
  const subAgent = parentAgent.createFork({
    tools: [], system: buildPageActionSystemPrompt(dsl), aiRole: hasImage ? "image" : undefined, retry: false,
    hooks: { beforeRequest: () => {
      requestRound += 1;
      const failures = run?.failures ?? [];
      if (failures.length <= injectedFailureCount) return;
      injectedFailureCount = failures.length;
      return { additionalMessages: [{ role: "user", content: buildExecutionStatePrompt(failures) }] };
    } },
  });
  const enqueue = (action: CanonicalAction, actionIndex: number) => {
    if (!run) return;
    run.push(action, actionIndex);
    actionQueue = actionQueue.then(async () => { await run.drain(); emit(); });
  };
  const unsubscribe = subAgent.events.on("llm:content", ({ content, thinkingContent }) => {
    lastContent = content || "";
    if (thinkingContent !== undefined) lastThinkingContent = thinkingContent || "";
    extractStreamingActionLines(dsl, lastContent).forEach(({ action }) => {
      const key = `${requestRound}:${JSON.stringify(action)}`;
      if (emittedActionKeys.has(key)) return;
      emittedActionKeys.add(key);
      if (run) {
        receivedActionCount += 1;
        enqueue(action, receivedActionCount);
      }
    });
    emit();
  });
  let requestError: unknown;
  try {
    const request = [
      "根据以下用户需求生成完整 actions。", "", "<用户需求>", params.prompt, "</用户需求>", "", "<目标>",
      `mode: ${params.mode}`, `targetId: ${params.targetId ?? ""}`, "</目标>",
    ].filter(Boolean).join("\n");
    await subAgent.requestAI({ message: request });
    await actionQueue;
  } catch (error) { requestError = error; } finally { unsubscribe(); }
  const turns = subAgent.getTurns();
  const lastTurn = turns[turns.length - 1];
  const lastLLMIter = lastTurn?.iterations?.slice().reverse().find((iter: any) => !("type" in iter));
  const content = (lastLLMIter as any)?.content || lastContent;
  if (requestError) throw requestError;
  const parsedActions = run?.sourceActions.length ? undefined : dsl.parseContent(content);
  if (run && parsedActions) parsedActions.forEach((action, index) => enqueue(action, index + 1));
  await actionQueue;
  const generatedActions = run?.resolvedActions ?? parsedActions ?? [];
  const generatedActionLines = run?.resolvedActionLines ?? generatedActions.map((action) => dsl.serializeAction(action));
  if (!generatedActions.length) throw new Error("lowcode_generate_page subAgent did not generate any actions.");
  if (generatedActionLines.length !== generatedActions.length) throw new Error("lowcode_generate_page could not preserve the generated action lines.");
  return {
    actions: run?.executedActions ?? generatedActions,
    generatedActions,
    generatedActionLines,
    content,
    report: { succeeded: run?.executedActions ?? [], failed: run?.failures ?? [], attempts: requestRound } as LowCodeActionExecutionReport,
  };
}
