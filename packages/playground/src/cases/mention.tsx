import type { MentionProvider } from "@plugin/index";
import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";

const quickPromptMention: MentionProvider = {
  id: "quick-prompt",
  label: "常用语",
  menu: [
    {
      id: "dev",
      label: "开发",
      children: [
        {
          id: "fix-bug",
          label: "修复问题",
          description: "让模型先定位原因再改代码",
          data: { prompt: "请先定位问题原因，再给出最小修改方案并实现。" },
        },
        {
          id: "add-test",
          label: "补测试",
          description: "要求补充覆盖关键路径",
          data: { prompt: "请补充一个覆盖关键路径的测试用例，并说明验证点。" },
        },
      ],
    },
    {
      id: "review",
      label: "代码审查",
      description: "按风险优先输出 review",
      data: { prompt: "请以 code review 视角检查风险，按严重程度排序。" },
    },
  ],
  search: (query) => {
    const items = [
      {
        id: "fix-bug",
        label: "修复问题",
        description: "让模型先定位原因再改代码",
        data: { prompt: "请先定位问题原因，再给出最小修改方案并实现。" },
      },
      {
        id: "add-test",
        label: "补测试",
        description: "要求补充覆盖关键路径",
        data: { prompt: "请补充一个覆盖关键路径的测试用例，并说明验证点。" },
      },
      {
        id: "review",
        label: "代码审查",
        description: "按风险优先输出 review",
        data: { prompt: "请以 code review 视角检查风险，按严重程度排序。" },
      },
    ];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(normalized));
  },
  chip: {
    type: "quick-prompt",
    render: (data) => ({ content: `@${data?.label ?? "常用语"}` }),
    format: ({ message, chips }) => {
      let resolved = message;
      const blocks: string[] = [];
      for (const chip of chips) {
        resolved = resolved.replace(`[[chip:${chip.id}]]`, `@${chip.label}`);
        blocks.push(`- ${chip.label}: ${chip.data?.prompt ?? ""}`);
      }
      return `${resolved}\n\n<mentioned-prompts>\n${blocks.join("\n")}\n</mentioned-prompts>`;
    },
  },
};

export const mentionCustomCase: TestCase = {
  id: "mention-custom",
  name: "Mention：自定义常用语",
  group: "Mention",
  description:
    "点击 + 展开菜单，进入「常用语」子菜单插入 chip；也可以在输入框输入 @ 唤起同一组 mention。",
  expectedBehavior:
    "输入框出现自定义 mention chip；发送后 Inspector 中可看到 @常用语 和 <mentioned-prompts> 上下文块。",
  initialTurns: [],
  mentions: [quickPromptMention],
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: ["收到，自定义 mention 已被格式化进本次请求上下文。"],
      ttftMs: 250,
      chunkDelayMs: 30,
    },
  ]),
};
