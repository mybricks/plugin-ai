import React from "react";
import type { ToolExecutionContext } from "../../../../agent/src/agent";
import type { Tool } from "../../../../agent/src";
import { canonicalToExecutionAction } from "../../dsl";
import { createUpdatePageActionSession, executeCreatePageWithParams } from "../../designer/execution";
import { LOWCODE_GENERATE_PAGE_TOOL_NAME } from "../constants";
import type { LowCodeGeneratePageParams, LowCodeGeneratePageTask, LowCodeToolOptions } from "../types";
import { UpdatePageRenderer } from "./render";
import { generateActionsWithSubAgent } from "./task";

type GenerateActionsResult = Awaited<ReturnType<typeof generateActionsWithSubAgent>>;

/** Change this constant to switch all task orchestration between parallel and serial. */
const TASK_ORCHESTRATION_MODE: "parallel" | "serial" = "serial";

interface TaskResult {
  taskIndex: number;
  taskId?: string;
  taskName?: string;
  mode: LowCodeGeneratePageTask["mode"];
  targetId?: string;
  pageId?: string;
  title?: string;
  ok: boolean;
  actionCount: number;
  succeeded: number;
  failed: number;
  output: string;
  error?: string;
}

interface TaskProgress {
  taskIndex: number;
  taskId?: string;
  mode: LowCodeGeneratePageTask["mode"];
  status: "pending" | "complete" | "error";
  targetId?: string;
  actionCount: number;
  succeeded: number;
  failed: number;
}

function summarizeTaskResult(
  taskIndex: number,
  task: LowCodeGeneratePageTask,
  summary: { targetId?: string; actionCount?: number },
  generatedActionLines: GenerateActionsResult["generatedActionLines"],
  report: GenerateActionsResult["report"],
  createResult?: { pageId?: string; title?: string },
): TaskResult {
  const succeeded = report.succeeded.length;
  const failed = report.failed.length;
  const lines = [
    `<task index="${taskIndex + 1}"${task.id ? ` id="${task.id}"` : ""}${task.name ? ` name="${task.name}"` : ""}>`,
    `<summary mode="${task.mode}" title="${task.title ?? ""}" targetId="${summary.targetId ?? ""}" pageId="${createResult?.pageId ?? ""}" />`,
    "<generated-actions>",
    ...generatedActionLines,
    "</generated-actions>",
  ];
  if (failed) {
    lines.push([
      "<failed-actions>",
      ...report.failed.map((item) => `第 ${item.actionIndex} 条：${item.error}`),
      "</failed-actions>",
    ].join("\n"));
  }
  lines.push("</task>");
  return {
    taskIndex: taskIndex + 1,
    taskId: task.id,
    taskName: task.name,
    mode: task.mode,
    targetId: summary.targetId,
    pageId: createResult?.pageId,
    title: createResult?.title,
    ok: failed === 0,
    actionCount: summary.actionCount ?? 0,
    succeeded,
    failed,
    output: lines.join("\n\n"),
  };
}

export function createLowCodeGeneratePageTool(options: LowCodeToolOptions): Tool {
  const { runtime, onOperatorActions, enableRenderingOptimization = false } = options;
  return {
    name: LOWCODE_GENERATE_PAGE_TOOL_NAME,
    title: "生成或修改页面",
    render: (tool) => React.createElement(UpdatePageRenderer, { tool }),
    limits: { maxToken: false },
    description: "执行多个页面生成或修改任务。每个 tasks 项都会启动独立 subAgent，并按任务分别返回 actions 与执行结果。create 会先创建页面再生成内容；update 会修改已有页面或 UI 组件。",
    parameters: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          description: "独立页面任务列表。所有任务会并行启动；同一页面或存在依赖关系的任务不要放在同一批。",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "可选任务标识，会原样出现在对应输出中。" },
              name: { type: "string", description: "可选任务名称，用于在输出中识别该任务，不用于页面命名。" },
              mode: { type: "string", enum: ["create", "update"], description: "create：新建页面并生成内容；update：修改已有页面或 UI 组件。" },
              title: { type: "string", description: "新页面名称，仅 mode=create 时使用。" },
              prompt: { type: "string", description: "该任务完整、独立的需求描述，不依赖对话中的其他任务。" },
              targetId: { type: "string", description: "修改目标的页面 id 或 UI 组件 id。mode=update 且没有可靠 focus 时必填；mode=create 时忽略。" },
            },
            required: ["mode", "prompt"],
          },
        },
      },
      required: ["tasks"],
    },
    validate(params: LowCodeGeneratePageParams) {
      if (!Array.isArray(params?.tasks) || !params.tasks.length) throw new Error("lowcode_generate_page requires a non-empty tasks array.");
      const taskIds = new Set<string>();
      params.tasks.forEach((task, index) => {
        if (task?.mode !== "create" && task?.mode !== "update") throw new Error(`lowcode_generate_page task ${index + 1} requires mode to be create or update.`);
        if (typeof task.prompt !== "string" || !task.prompt.trim()) throw new Error(`lowcode_generate_page task ${index + 1} requires a non-empty prompt.`);
        if (task.id !== undefined) {
          if (!task.id.trim()) throw new Error(`lowcode_generate_page task ${index + 1} id must not be empty.`);
          if (taskIds.has(task.id)) throw new Error(`lowcode_generate_page task id "${task.id}" must be unique.`);
          taskIds.add(task.id);
        }
        if (task.name !== undefined && !task.name.trim()) throw new Error(`lowcode_generate_page task ${index + 1} name must not be empty.`);
      });
    },
    async execute(params: LowCodeGeneratePageParams, toolContext: ToolExecutionContext) {
      console.log("[plugin-lowcode] lowcode_generate_page", params);
      const progress: TaskProgress[] = params.tasks.map((task, taskIndex) => ({ taskIndex, taskId: task.id, mode: task.mode, status: "pending", actionCount: 0, succeeded: 0, failed: 0 }));
      const emitProgress = () => toolContext.emitProgress({
        taskCount: progress.length,
        completedTaskCount: progress.filter((item) => item.status !== "pending").length,
        actionCount: progress.reduce((total, item) => total + item.actionCount, 0),
        succeeded: progress.reduce((total, item) => total + item.succeeded, 0),
        failed: progress.reduce((total, item) => total + item.failed, 0),
        tasks: progress,
      });
      const runTask = async (task: LowCodeGeneratePageTask, taskIndex: number): Promise<TaskResult> => {
        let session: Awaited<ReturnType<typeof createUpdatePageActionSession>> | undefined;
        let createResult: Awaited<ReturnType<typeof executeCreatePageWithParams>> | undefined;
        const taskProgress = progress[taskIndex];
        try {
          createResult = task.mode === "create" ? await executeCreatePageWithParams(runtime, { title: task.title }) : undefined;
          const targetId = createResult?.pageId ?? task.targetId;
          taskProgress.targetId = targetId;
          session = await createUpdatePageActionSession(runtime, targetId, enableRenderingOptimization);
          const generated = await generateActionsWithSubAgent(runtime, { ...task, targetId }, toolContext, (action) => session!.execute(canonicalToExecutionAction(action)), (nextProgress) => {
            Object.assign(taskProgress, nextProgress);
            emitProgress();
          });
          onOperatorActions?.({ kind: "updatePage", targetId, actions: generated.actions });
          const result = summarizeTaskResult(taskIndex, task, await session.complete(), generated.generatedActionLines, generated.report, createResult);
          Object.assign(taskProgress, { status: "complete", targetId: result.targetId, actionCount: result.actionCount, succeeded: result.succeeded, failed: result.failed });
          emitProgress();
          return result;
        } catch (error) {
          console.error("[plugin-lowcode] lowcode_generate_page task error", { taskIndex, taskId: task.id, error });
          try {
            await session?.error();
          } catch (sessionError) {
            console.error("[plugin-lowcode] lowcode_generate_page task cleanup error", { taskIndex, taskId: task.id, error: sessionError });
          }
          const message = error instanceof Error ? error.message : String(error);
          const result: TaskResult = {
            taskIndex: taskIndex + 1, taskId: task.id, taskName: task.name, mode: task.mode, targetId: taskProgress.targetId ?? task.targetId, pageId: createResult?.pageId, title: createResult?.title,
            ok: false, actionCount: taskProgress.actionCount, succeeded: taskProgress.succeeded, failed: Math.max(1, taskProgress.failed),
            output: [`<task index="${taskIndex + 1}"${task.id ? ` id="${task.id}"` : ""}${task.name ? ` name="${task.name}"` : ""}>`, `<error>${message}</error>`, "</task>"].join("\n"), error: message,
          };
          Object.assign(taskProgress, { status: "error", targetId: result.targetId, failed: result.failed });
          emitProgress();
          return result;
        }
      };

      emitProgress();
      const results = TASK_ORCHESTRATION_MODE === "serial"
        ? await params.tasks.reduce<Promise<TaskResult[]>>(async (previous, task, taskIndex) => {
          const completed = await previous;
          completed.push(await runTask(task, taskIndex));
          return completed;
        }, Promise.resolve([]))
        : await Promise.all(params.tasks.map(runTask));
      const succeeded = results.reduce((total, result) => total + result.succeeded, 0);
      const failed = results.reduce((total, result) => total + result.failed, 0);
      return {
        output: results.map((result) => result.output).join("\n\n"),
        metadata: { ok: results.every((result) => result.ok), orchestrationMode: TASK_ORCHESTRATION_MODE, taskCount: results.length, actionCount: results.reduce((total, result) => total + result.actionCount, 0), succeeded, failed, tasks: results },
      };
    },
  };
}
