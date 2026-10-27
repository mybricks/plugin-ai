import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MentionProvider } from "@plugin/index";
import type { ReferData, ReferResolver } from "@plugin/sandbox/setup";
import { lang } from "@plugin/i18n";
import { ASK_QUESTIONS_TOOL_NAME, Tools } from "@agent/index";
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

type PlaygroundTaskRefer = ReferData & {
  status: string;
  verification: string;
  summary: string;
};

const playgroundTasks: Record<string, PlaygroundTaskRefer> = {
  "T-102": {
    id: "T-102",
    title: "支持 refer mention 的 playground 验收",
    status: "待验证",
    verification: "问题文本的 Markdown 与任务 hover 卡片均正常展示。",
    summary: "确认 ask_questions 支持行内 Markdown，并且 task 引用能展示自定义 hover 卡片。",
  },
};

function PlaygroundTaskReferCard({ data }: { data: PlaygroundTaskRefer }) {
  const [hovered, setHovered] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState({ left: 8, top: 0 });
  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 276)), top: rect.top - 7 });
  }, []);

  useLayoutEffect(() => {
    if (!hovered) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [hovered, updatePosition]);

  return (
    <span
      ref={triggerRef}
      style={{ position: "relative", display: "inline-flex", verticalAlign: "baseline" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          display: "inline-flex",
          padding: "1px 6px",
          borderRadius: 4,
          background: "#e6f4ff",
          color: "#1677ff",
          cursor: "default",
          fontWeight: 500,
        }}
      >
        <span>{lang.common.taskReferencePrefix()}{data.title}</span>
      </span>
      {hovered && createPortal(
        <span
          role="tooltip"
          style={{
            position: "fixed",
            zIndex: 2147483647,
            top: position.top,
            left: position.left,
            transform: "translateY(-100%)",
            width: 260,
            padding: "9px 10px",
            border: "1px solid #d9d9d9",
            borderRadius: 6,
            background: "#fff",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.14)",
            color: "#1f1f1f",
            fontSize: 12,
            fontWeight: 400,
            lineHeight: 1.5,
            pointerEvents: "none",
          }}
        >
          <strong style={{ display: "block", marginBottom: 5 }}>{data.title}</strong>
          <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#8c8c8c", marginBottom: 5 }}>
            <i style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4d4f" }} />
            状态：{data.status}
          </span>
          <span style={{ display: "block", marginBottom: 5 }}><b>验证条件：</b>{data.verification}</span>
          <span style={{ display: "block", color: "#8c8c8c" }}>{data.summary}</span>
        </span>
      , document.body)}
    </span>
  );
}

const playgroundTaskReferResolver: ReferResolver = {
  scheme: "task",
  resolve: async (id) => playgroundTasks[id] ?? null,
  renderCard: (data) => <PlaygroundTaskReferCard data={data as PlaygroundTaskRefer} />,
};

export const referMentionCase: TestCase = {
  id: "refer-mention",
  name: "Refer mention：Markdown + 自定义 hover 卡片",
  group: "Mention",
  description: "在 ask_questions 的 question 和助手消息中使用 task:// 引用，验证行内 Markdown 与外部自定义 UI 的渲染链路。",
  expectedBehavior: "发送任意消息后，问题中的粗体、行内代码正常显示；[T-102](task://T-102) 被蓝色任务标签替换而不是普通链接。悬停标签会出现任务详情卡片；回答后，助手消息里的同一引用也保持该交互。",
  initialTurns: [],
  tools: [Tools.createAskQuestions()],
  referResolvers: [playgroundTaskReferResolver],
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      delayMs: 180,
      calls: [{
        id: "call_refer_mention_001",
        name: ASK_QUESTIONS_TOOL_NAME,
        args: {
          questions: [{
            question: "请确认 **[T-102](task://T-102)** 的 `Markdown + hover` 验收是否通过？",
            header: "任务验收",
            options: [
              { label: "通过", description: "Markdown 和 hover 卡片均符合预期。" },
              { label: "不通过", description: "需要继续定位渲染问题。", input: true, inputPlaceholder: "说明复现现象" },
            ],
          }],
        },
      }],
    },
    {
      type: "content",
      chunks: ["已记录 **[T-102](task://T-102)** 的验收结果，会按你的选择继续处理。"],
      ttftMs: 80,
      chunkDelayMs: 24,
    },
  ], { loop: true }),
};
