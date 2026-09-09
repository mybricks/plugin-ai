import type { CodeAgentPlugin } from "@agent/code-agent";
import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";

const TEMPLATE_NAME = "release-notes";
const TEMPLATE_RECORD = `[$mbs-template:${TEMPLATE_NAME}]`;
const TEMPLATE_PROMPT = `---
displayName: 发布说明
description: 将变更整理为面向用户的发布说明
---

你正在编写发布说明。

待整理的变更：$@

请按「亮点」「修复」「升级提示」三个小节，用简洁的中文输出。`;

const promptTemplatePlugin: CodeAgentPlugin = {
  name: "playground-prompts",
  promptTemplates: [
    {
      name: TEMPLATE_NAME,
      files: [{ path: "PROMPT.md", content: TEMPLATE_PROMPT }],
    },
  ],
};

/**
 * Exercises the complete UI → MBS record → CodeAgent formatting path.
 * In the Sender type `/` and select “/release-notes”, then append a change
 * description and send it. The editor will hold a copyable MBS record while
 * the request inspector shows the expanded prompt.
 */
export const promptTemplateMbsCase: TestCase = {
  id: "prompt-template-mbs",
  name: "Prompt Template（UI Slash → MBS → 模型展开）",
  group: "Prompt Template",
  priority: "P0",
  description:
    "输入 / 后选择 /release-notes，输入框会变成 [$mbs-template:release-notes]。追加变更说明并发送，验证 UI 只处理 slash，CodeAgent 仅展开 MBS template。",
  expectedBehavior:
    "聊天历史显示并保留 [$mbs-template:release-notes] 加参数；Request Inspector 的 user 消息是展开后的发布说明提示词，不含该 marker。复制这条 marker 文本后再次粘贴发送，行为相同。",
  initialTurns: [],
  plugins: [promptTemplatePlugin],
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: [
        "## 亮点\n- 新的发布说明模板已启用。\n\n",
        "## 修复\n- 已验证 MBS marker 会在模型请求前展开。\n\n",
        "## 升级提示\\n- 可复制历史中的 marker 并再次粘贴使用。",
      ],
      ttftMs: 250,
      chunkDelayMs: 40,
    },
  ], { loop: true }),
  assertions: [
    {
      name: "插件 template 已提供 MBS descriptor",
      run: ({ agent }) => {
        if (!agent) return null;
        const template = agent.getMbsTemplates().find((item) => item.reference === `mbs-template:${TEMPLATE_NAME}`);
        return template
          ? { pass: true }
          : { pass: false, message: "未找到 mbs-template:release-notes" };
      },
    },
    {
      name: "历史保留 MBS marker，模型请求使用展开文本",
      run: ({ agent, snapshots }) => {
        const turn = agent?.getTurns()[0];
        if (!turn || snapshots.length === 0) return null;
        const markerStored = turn.userText.startsWith(TEMPLATE_RECORD);
        const requestText = JSON.stringify(snapshots[0].params.messages ?? []);
        const templateExpanded = requestText.includes("你正在编写发布说明") && !requestText.includes(TEMPLATE_RECORD);
        return markerStored && templateExpanded
          ? { pass: true }
          : {
              pass: false,
              message: "请通过菜单选择 /release-notes，并在 marker 后追加任意变更说明再发送。",
            };
      },
    },
  ],
};
