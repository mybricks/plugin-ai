import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";

export const toolDeleteCase: TestCase = {
  id: "tool-delete-file",
  name: "delete_file 删除",
  group: "工具调用",
  description: "LLM 调用 delete_file 删除 src/styles/global.css",
  expectedBehavior: "工具卡片绿色，FS Viewer 中 global.css 消失。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{ id: "c_del_1", name: "delete_file", args: { paths: ["src/styles/global.css"] } }],
      delayMs: 300,
    },
    {
      type: "content",
      chunks: ["已删除 global.css。如果需要重新添加样式，可以创建新的 CSS 文件。"],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};

export const toolDeletePartialPermissionCase: TestCase = {
  id: "tool-delete-partial-permission",
  name: "delete_file 部分不可删",
  group: "工具调用",
  priority: "P0",
  description: "LLM 批量删除 3 个文件，其中 1 个文件没有删除权限",
  expectedBehavior: "工具调用成功而不是 invalid_args；可删除文件消失，不可删除文件保留，结果列出 deletedPaths 和 failedPaths。",
  initialTurns: [],
  initialFiles: [
    { path: "src/delete-a.ts", content: "export const a = 1;" },
    { path: "src/delete-b.ts", content: "export const b = 2;" },
    {
      path: "frontend/.agent/agent.md",
      content: "# internal agent file",
      permissions: { read: true, write: false, delete: false },
    },
  ],
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "c_del_partial_permission",
        name: "delete_file",
        args: {
          paths: [
            "src/delete-a.ts",
            "src/delete-b.ts",
            "frontend/.agent/agent.md",
          ],
        },
      }],
      delayMs: 300,
    },
    {
      type: "content",
      chunks: ["已尽量删除可删除文件，frontend/.agent/agent.md 因权限限制未删除。"],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
  assertions: [
    {
      name: "可删文件已删除，不可删文件保留",
      run: ({ agent, memFS }) => {
        const lastTurn = (agent as any)?.turns?.at?.(-1);
        if (!lastTurn || lastTurn.status !== "success" || !memFS) return null;
        const toolCall = lastTurn.iterations
          ?.flatMap((iter: any) => iter.toolCalls ?? [])
          ?.find((tool: any) => tool.name === "delete_file");
        if (!toolCall || toolCall.status !== "success") return null;
        const files = new Set(memFS.snapshot().map((file) => file.path));
        const pass = !files.has("src/delete-a.ts") &&
          !files.has("src/delete-b.ts") &&
          files.has("frontend/.agent/agent.md");
        return {
          pass,
          message: pass ? "文件系统状态符合预期" : `当前文件: ${Array.from(files).join(", ")}`,
        };
      },
    },
    {
      name: "工具结果不是 invalid_args 且包含部分失败明细",
      run: ({ agent }) => {
        const lastTurn = (agent as any)?.turns?.at?.(-1);
        if (!lastTurn || lastTurn.status !== "success") return null;
        const toolCall = lastTurn.iterations
          ?.flatMap((iter: any) => iter.toolCalls ?? [])
          ?.find((tool: any) => tool.name === "delete_file");
        if (!toolCall) return null;
        const metadata = toolCall.result?.metadata;
        const deletedPaths = metadata?.deletedPaths ?? [];
        const failedPaths = metadata?.failedPaths ?? [];
        const pass = toolCall.status === "success" &&
          toolCall.errorType !== "invalid_args" &&
          deletedPaths.includes("src/delete-a.ts") &&
          deletedPaths.includes("src/delete-b.ts") &&
          failedPaths.some((item: any) => item.path === "frontend/.agent/agent.md" && item.reason === "cannot be deleted");
        return {
          pass,
          message: pass
            ? "工具成功返回 deletedPaths/failedPaths"
            : `tool status=${toolCall.status}, errorType=${toolCall.errorType}, metadata=${JSON.stringify(metadata)}`,
        };
      },
    },
  ],
};
