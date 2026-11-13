import React, { useEffect, useState } from "react";
import { context } from "@plugin/context";
import type { MemFS } from "../lib/mem-fs";
import { makeScriptedRequest } from "../lib/scripted-request";
import type { TestCase } from "./types";

const taskPath = "TASKS.md";
const taskContent = (status: string) => `# 任务列表\n\n## T-001 调整登录按钮\n- **状态**：${status}\n- **验证条件**：确认登录按钮显示为蓝色。\n`;

function VerifyBlock({ agentKey, fs, release }: { agentKey: string; fs: MemFS; release: () => void }) {
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  const transition = async (next: string) => {
    const current = fs.readFile(taskPath);
    if (!current?.includes("**状态**：待验证")) {
      release();
      return false;
    }
    await fs.updateFiles([{ path: taskPath, content: current.replace("**状态**：待验证", `**状态**：${next}`) }]);
    return true;
  };

  return (
    <div style={{ margin: "8px 12px", padding: 12, border: "1px solid #d9d9d9", borderRadius: 8 }}>
      <strong>T-001 调整登录按钮 · 待验证</strong>
      <div style={{ margin: "6px 0" }}>验证条件：确认登录按钮显示为蓝色。</div>
      <input aria-label="验证反馈" placeholder="不符合预期时填写反馈" value={feedback} onChange={(event) => setFeedback(event.target.value)} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button disabled={busy} onClick={async () => {
          setBusy(true);
          if (await transition("已完成")) release();
          setBusy(false);
        }}>符合预期</button>
        <button disabled={busy} onClick={async () => {
          setBusy(true);
          if (await transition("处理中")) {
            release();
            const agent = context.agentMap.get(agentKey);
            if (agent) {
              const params = { message: `T-001 验证未通过，请继续修改。反馈：${feedback || "未填写"}` };
              context.aiQueue.send(agent, () => agent.requestAI(params), params);
            }
          }
          setBusy(false);
        }}>不符合预期，提交修改</button>
      </div>
    </div>
  );
}

export const taskVerifySenderBlockCase: TestCase = {
  id: "task-verify-sender-block",
  name: "任务待验证与 Sender Block",
  group: "任务与输入区",
  priority: "P0",
  description: "发送任意需求，mock Agent 写入 TASKS.md 并将任务改为待验证；轮次结束后在 Sender 上方展示验证卡片。",
  expectedBehavior: "查看右侧 FS Viewer 中的 TASKS.md。点击符合预期后状态变为已完成且卡片消失；或填写反馈并点击不符合预期，状态先变为处理中、反馈发送给 Agent，mock 修改完成后再次变为待验证并展示卡片。Reset 可重新开始。",
  initialTurns: [],
  initialFiles: [{ path: taskPath, content: taskContent("处理中") }],
  request: makeScriptedRequest([
    { type: "tool_calls", calls: [{ id: "mock_task_write", name: "write_file", args: { path: taskPath, content: taskContent("待验证") } }], delayMs: 200, streamChunkDelayMs: 0 },
    { type: "content", chunks: ["修改已完成，请在输入框上方验证任务。"], ttftMs: 200 },
  ], { loop: true }),
  lifecycleFactory: (fs, agentKey) => {
    let before: string | undefined;
    let visible = false;
    const listeners = new Set<(visible: boolean) => void>();
    let disposed = false;
    const setVisible = (next: boolean) => { visible = next; listeners.forEach((listener) => listener(next)); };
    const free = () => setVisible(false);
    function MockTodoArea({ setActive }: { setActive: (active: boolean) => void }) {
      const [shown, setShown] = useState(visible);
      useEffect(() => { listeners.add(setShown); return () => { listeners.delete(setShown); }; }, []);
      useEffect(() => { setActive(shown); }, [shown, setActive]);
      return shown ? <VerifyBlock agentKey={agentKey} fs={fs} release={free} /> : null;
    }
    return {
      plugins: [{ name: "mock-task", ui: { todoArea: MockTodoArea } }],
      hooks: {
        beforeTurn() { before = fs.readFile(taskPath); },
        afterTurn() {
          if (disposed) return;
          const after = fs.readFile(taskPath);
          if (after !== before && after?.includes("**状态**：待验证")) {
            setVisible(true);
          }
        },
      },
      dispose() { disposed = true; free(); },
    };
  },
};
