import React, { useEffect, useState } from "react";
import type { MemFS } from "../lib/mem-fs";
import { makeScriptedRequest } from "../lib/scripted-request";
import type { TestCase } from "./types";

const taskPath = "TASKS.md";
const taskContent = (status: string) => `# 任务列表

## BadCase 核查卡片归因操作内联
- **更新时间**：2026-11-03 14:24
- **状态**：${status}
- **交接给**：服务端
- **交接原因**：接口需要补充 taskId 字段。

> 在 BadCase 核查卡片中内联提交归因操作。
`;

function VerifyBlock({ fs, release }: { fs: MemFS; release: () => void }) {
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState("");

  const transition = async (next: string) => {
    const current = fs.readFile(taskPath);
    if (!current?.includes("**状态**：待验证")) return;
    await fs.updateFiles([{ path: taskPath, content: current.replace("**状态**：待验证", `**状态**：${next}`) }]);
    release();
  };

  return (
    <div style={{ margin: "8px 12px", padding: 12, border: "1px solid #d9d9d9", borderRadius: 8 }}>
      <strong>待验证 · BadCase 核查卡片归因操作内联</strong>
      <p>在 BadCase 核查卡片中内联提交归因操作。</p>
      {editing ? (
        <>
          <input aria-label="验证反馈" placeholder="哪里不符合预期？" value={feedback} onChange={(event) => setFeedback(event.target.value)} />
          <button onClick={() => setEditing(false)}>取消</button>
          <button disabled={!feedback.trim()} onClick={() => void transition("待处理")}>确认</button>
        </>
      ) : (
        <>
          <div>验证条件</div>
          <p>暂无验证条件，请自行确认效果</p>
          <button onClick={() => setEditing(true)}>不符合预期</button>
          <button onClick={() => void transition("待交接")}>符合预期</button>
        </>
      )}
    </div>
  );
}

export const taskVerifyHandoffNoCriteriaCase: TestCase = {
  id: "task-verify-handoff-no-criteria",
  name: "历史任务：无编号且没有验证条件",
  group: "任务与输入区",
  priority: "P0",
  description: "模拟聊天记录中的无编号任务，任务包含交接信息但没有验证条件。",
  expectedBehavior: "模拟验证卡片中选择符合预期时文件状态变为待交接；重置后提交反馈，状态变为待处理。真实状态写回另由组件库回归案例覆盖。",
  initialTurns: [],
  initialFiles: [{ path: taskPath, content: taskContent("待验证") }],
  request: makeScriptedRequest([{ type: "content", chunks: ["已收到任务反馈。"], ttftMs: 200 }]),
  lifecycleFactory: (fs) => {
    let visible = true;
    const listeners = new Set<(visible: boolean) => void>();
    const setVisible = (next: boolean) => { visible = next; listeners.forEach((listener) => listener(next)); };
    function MockTodoArea({ setActive }: { setActive: (active: boolean) => void }) {
      const [shown, setShown] = useState(visible);
      useEffect(() => { listeners.add(setShown); return () => { listeners.delete(setShown); }; }, []);
      useEffect(() => { setActive(shown); }, [shown, setActive]);
      return shown ? <VerifyBlock fs={fs} release={() => setVisible(false)} /> : null;
    }
    return {
      plugins: [{ name: "mock-legacy-task", ui: { todoArea: MockTodoArea } }],
      hooks: {},
      dispose() { setVisible(false); },
    };
  },
};
