import React, { useState } from "react";
import type { CodeAgent, SkillFile } from "@agent/code-agent";
import type { Tool } from "@agent/types";
import type { RequestAsStreamFn } from "@request/types";
import type { TestCase } from "./types";

const RUNTIME_A_TOOL: Tool = {
  name: "runtime_a_tool",
  description: "Runtime A 专属工具",
  parameters: { type: "object", properties: {} },
  async execute() {
    return { output: "runtime A" };
  },
};

const RUNTIME_B_TOOL: Tool = {
  name: "runtime_b_tool",
  description: "Runtime B 专属工具",
  parameters: { type: "object", properties: {} },
  async execute() {
    return { output: "runtime B" };
  },
};

const RUNTIME_A_SKILL: SkillFile = {
  name: "runtime-a-skill",
  files: [{ path: "SKILL.md", content: "# Runtime A Skill\n当前处于 Runtime A。" }],
};

const RUNTIME_B_SKILL: SkillFile = {
  name: "runtime-b-skill",
  files: [{ path: "SKILL.md", content: "# Runtime B Skill\n当前处于 Runtime B。" }],
};

const RUNTIME_B_SYSTEM = "[PLAYGROUND_RUNTIME_B] 当前运行时已切换到 B。";

const runtimeInspectorRequest: RequestAsStreamFn = async (params) => {
  const messages = params.messages ?? [];
  const system = messages.find((message) => message.role === "system");
  const systemText = typeof system?.content === "string" ? system.content : "";
  const contextText = JSON.stringify(messages);
  const toolNames = params.tools?.map((tool) => tool.name) ?? [];
  const activeRuntime = systemText.includes(RUNTIME_B_SYSTEM) ? "B" : "A";
  const content = [
    `当前 Runtime：${activeRuntime}`,
    `Tools：${toolNames.includes("runtime_b_tool") ? "runtime_b_tool" : "runtime_a_tool"}`,
    `Skills：${contextText.includes("runtime-b-skill") ? "runtime-b-skill" : "runtime-a-skill"}`,
    `消息数：${messages.length}（应随着两次发送持续增长）`,
  ].join("\n");

  params.emits.cancel(() => {});
  params.emits.write(content);
  params.emits.onFinishReason?.("stop");
  params.emits.complete("");
};

function RuntimeSwitchControls({ agent }: { agent: CodeAgent | null }) {
  const [switched, setSwitched] = useState(false);

  const switchToB = () => {
    if (!agent || switched) return;

    const privateAgent = agent as any;
    const currentBaseTools = privateAgent._base.tools as Tool[];
    const builtinTools = currentBaseTools.slice(0, currentBaseTools.length - 1);
    privateAgent._base.skills = [RUNTIME_B_SKILL];
    privateAgent._base.tools = [...builtinTools, RUNTIME_B_TOOL];
    privateAgent._rebuildDynamicTools();
    agent.options.system = RUNTIME_B_SYSTEM;
    setSwitched(true);
  };

  return (
    <div style={{ marginBottom: 12, padding: 12, border: "1px solid #d9e6ff", borderRadius: 8, background: "#f7faff" }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>实验性：同实例 Runtime 切换</div>
      <div style={{ fontSize: 12, color: "#5b6472", lineHeight: 1.6, marginBottom: 10 }}>
        先发送一条消息（Runtime A），点击后再发送一条。消息列表应保留第一轮；右侧 Request Inspector 的 system、tools 与 skills 会变为 Runtime B。
      </div>
      <button type="button" onClick={switchToB} disabled={!agent || switched}>
        {switched ? "已切换到 Runtime B" : "切换到 Runtime B"}
      </button>
    </div>
  );
}

export const agentRuntimeSwitchCase: TestCase = {
  id: "experimental-agent-runtime-switch",
  name: "同实例 Runtime 切换",
  group: "实验性",
  priority: "P2",
  description: "在不重建 CodeAgent 的前提下，原地切换 system、tools 与 skills，观察 ChatPanel 历史是否连续。",
  expectedBehavior: "发送第一条消息后点击“切换到 Runtime B”，再发送第二条消息：消息列表保留两轮；第二轮回复和 Request Inspector 显示 Runtime B、runtime_b_tool、runtime-b-skill。",
  initialTurns: [],
  request: runtimeInspectorRequest,
  tools: [RUNTIME_A_TOOL],
  skills: [RUNTIME_A_SKILL],
  renderRightPanelActions: ({ agent }) => <RuntimeSwitchControls agent={agent} />,
};
