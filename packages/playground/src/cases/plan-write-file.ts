import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";

const planFilePath = ".agent/plans/2026-06-25/generate-plan-file.md";

const planFileContent = `---
status: active
title: "生成文件示例"
desc: "验证计划模式过程中写入计划文件"
---

# 生成文件示例

## 背景与目标
验证在计划模式中，Agent 可以通过 write_file 写入 .agent/plans/ 目录下的计划文件，并在文件系统中生成对应文件。

## 内容理解
- 用户先手动切换到计划模式。
- Agent 在过程中创建计划文件，而不是修改业务项目文件。
- 写入完成后，消息区展示计划文件卡片，FS Viewer 展示新增文件。

## 推荐方案
创建一个 active 状态的计划文件，记录本次验证的目标、影响和验证方式。

## 任务列表
- 切换到计划模式
- 写入计划文件
- 检查生成结果

## 影响与风险
只影响 .agent/plans/ 目录，不改变业务源码。

## 验证方式
查看工具卡片是否成功，并在右侧 FS Viewer 中确认 ${planFilePath} 已生成。
`;

/**
 * P0 测试用例：计划模式过程中写文件并生成计划文件。
 *
 * 使用方式：
 *  1. 在输入框左侧手动切换到「计划」模式
 *  2. 发送任意需求，例如「先帮我写一个计划」
 *  3. LLM 调用 write_file 写入 .agent/plans/ 下的 active 计划文件
 *
 * 验证要点：
 *  - write_file 工具卡片成功
 *  - 计划文件卡片正常渲染
 *  - FS Viewer 中新增 .agent/plans/2026-06-25/generate-plan-file.md
 */
export const planWriteGeneratedFileCase: TestCase = {
  id: "plan-write-generated-file",
  name: "计划模式写文件并生成计划文件",
  group: "计划模式",
  priority: "P0",
  description:
    "先手动切换到「计划」模式，再发送消息。LLM 在计划模式过程中调用 write_file，写入 .agent/plans/ 下的 active 计划文件，验证计划文件生成和卡片渲染。",
  expectedBehavior:
    "手动切到计划模式后发送消息，write_file 工具卡片成功，并以计划卡片样式展示；右侧 FS Viewer 出现 .agent/plans/2026-06-25/generate-plan-file.md，文件内容包含 active frontmatter。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [
        {
          id: "c_plan_write_1",
          name: "write_file",
          args: {
            path: planFilePath,
            content: planFileContent,
          },
        },
      ],
      delayMs: 400,
    },
    {
      type: "content",
      chunks: [
        "已在计划模式中写入计划文件：",
        `\n\n\`${planFilePath}\``,
        "\n\n你可以在右侧 FS Viewer 中查看生成的文件；消息区也会展示对应的计划文件卡片。",
      ],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};
