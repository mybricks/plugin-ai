import type { MentionProvider } from "@plugin/index";
import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";
import { makeTurn } from "../lib/fixtures";

const longLabelMention: MentionProvider = {
  id: "long-label",
  label: "超长 Chip",
  menu: [
    {
      id: "long-1",
      label: "这是一个非常非常非常非常非常非常非常非常非常非常非常非常长的 Chip 标签用于测试超长文本在输入框和用户消息中的截断与展示效果",
      data: { prompt: "超长标签 1 的上下文内容。" },
    },
    {
      id: "long-2",
      label: "ShortLabelButVeryLongDataAndContextDescriptionThatGoesOnAndOnAndOnAndOnAndOnAndOnAndOnAndOnAndOn",
      data: { prompt: "超长标签 2 的上下文内容。" },
    },
    {
      id: "long-3",
      label: "中英文混合的超长标签 The quick brown fox jumps over the lazy dog and keeps running and running and running 而且还在继续延伸",
      data: { prompt: "超长标签 3 的上下文内容。" },
    },
    {
      id: "long-no-space",
      label: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      data: { prompt: "无空格超长标签的上下文内容。" },
    },
  ],
  search: (query) => {
    const items = [
      {
        id: "long-1",
        label: "这是一个非常非常非常非常非常非常非常非常非常非常非常非常长的 Chip 标签用于测试超长文本在输入框和用户消息中的截断与展示效果",
        data: { prompt: "超长标签 1 的上下文内容。" },
      },
      {
        id: "long-2",
        label: "ShortLabelButVeryLongDataAndContextDescriptionThatGoesOnAndOnAndOnAndOnAndOnAndOnAndOnAndOnAndOn",
        data: { prompt: "超长标签 2 的上下文内容。" },
      },
      {
        id: "long-3",
        label: "中英文混合的超长标签 The quick brown fox jumps over the lazy dog and keeps running and running and running 而且还在继续延伸",
        data: { prompt: "超长标签 3 的上下文内容。" },
      },
      {
        id: "long-no-space",
        label: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        data: { prompt: "无空格超长标签的上下文内容。" },
      },
    ];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) =>
      item.label.toLowerCase().includes(normalized)
    );
  },
  chip: {
    type: "long-label",
    render: (data) => ({ content: `@${data?.label ?? "超长"}` }),
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

const longChips = [
  { id: "long-1", label: "这是一个非常非常非常非常非常非常非常非常非常非常非常非常长的 Chip 标签用于测试超长文本在输入框和用户消息中的截断与展示效果", type: "long-label" },
  { id: "long-2", label: "ShortLabelButVeryLongDataAndContextDescriptionThatGoesOnAndOnAndOnAndOnAndOnAndOnAndOnAndOnAndOn", type: "long-label" },
  { id: "long-3", label: "中英文混合的超长标签 The quick brown fox jumps over the lazy dog and keeps running and running and running 而且还在继续延伸", type: "long-label" },
  { id: "long-no-space", label: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", type: "long-label" },
];

export const longChipCase: TestCase = {
  id: "long-chip-render",
  name: "Chip：超长标签渲染",
  group: "UI 渲染",
  description:
    "预设多轮包含超长 chip 的历史记录（纯中文超长、纯英文超长、中英混合超长、无空格超长），" +
    "验证 chip 在用户消息气泡中的截断/换行/溢出展示效果。" +
    "也可通过 + 菜单或 @ 搜索插入新 chip 验证 Sender 输入框中的渲染。",
  expectedBehavior:
    "① 用户消息气泡中每个超长 chip 不溢出气泡边界，合理截断或换行；" +
    "② 多个超长 chip 共存时布局正常；" +
    "③ 无空格超长标签不撑破布局；" +
    "④ Inspector 中可看到完整的超长标签文本和 <mentioned-prompts> 上下文块；" +
    "⑤ 在输入框中通过 @ 插入新超长 chip 时，Sender 输入框布局不溢出。",
  initialTurns: [
    makeTurn({
      userText: "[[chip:long-1]] 帮我检查一下这段代码",
      content: "收到，我来帮你检查。",
    }),
    makeTurn({
      userText: "[[chip:long-2]] 再看看这个配置文件 [[chip:long-3]]",
      content: "好的，配置文件也一起看了。",
    }),
    makeTurn({
      userText: "[[chip:long-1]] 和 [[chip:long-2]] 和 [[chip:long-3]] 和 [[chip:long-no-space]] 四个超长 chip 同时存在的极端场景",
      content: "收到，四个超长 chip 同时渲染的压力测试。",
    }),
  ].map((turn) => ({
    ...turn,
    meta: { chips: longChips },
  })),
  mentions: [longLabelMention],
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: [
        "收到，已看到多个超长 chip 的渲染效果。输入框和消息气泡中的截断/换行行为正常。",
      ],
      ttftMs: 250,
      chunkDelayMs: 30,
    },
  ]),
};
