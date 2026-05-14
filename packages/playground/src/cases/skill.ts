import type { TestCase } from "./types";
import type { SkillFile } from "@agent/code-agent";
import { USE_SKILL_TOOL_NAME } from "@agent/code-agent";
import { makeScriptedRequest } from "../lib/scripted-request";

// ─── 自定义 Skill 定义 ──────────────────────────────────────────────────────

/**
 * Playground 专用自定义 Skill：代码审查助手。
 *
 * 用于测试 use_skill 工具的完整流程：
 *   1. LLM 调用 use_skill 加载 Skill 内容
 *   2. 工具返回 SKILL.md 内容 + 目录树
 *   3. 后续对话中 LLM 基于 Skill 指导继续回复
 */
export const PLAYGROUND_SKILL_NAME = "code-review";

const PLAYGROUND_SKILL_MD = `---
name: Code Review
description: 代码审查助手，提供结构化的代码审查建议
when_to_use: 审查代码、Code Review、检查代码变更
---

# Code Review Skill

## 审查流程

当用户请求代码审查时，请按以下步骤进行：

1. **读取检查清单**：先读取 \`checklist.md\` 获取审查要点清单
2. **读取文件**：使用 \`read_file\` 工具读取用户指定的文件
3. **逐项审查**：对照检查清单逐项分析代码
4. **给出建议**：按严重程度分类（Critical / Warning / Info），参照 \`rules.json\` 中的规则定义

## 输出格式

使用结构化格式输出审查结果：

\`\`\`
## 代码审查报告

### Critical
- [描述] (文件路径#行号)

### Warning
- [描述] (文件路径#行号)

### Info
- [建议] (文件路径#行号)

## 总结
[整体评价和建议]
\`\`\`

## 审查原则

- 优先关注 Critical 级别问题
- 每个 Issue 要给出具体的修复建议
- 总结中要给出整体改进方向

## 参考文件

- \`checklist.md\` — 审查要点清单
- \`rules.json\` — 严重程度规则定义
`;

const PLAYGROUND_SKILL_CHECKLIST = `# Code Review 审查清单

## 代码质量
- [ ] 命名是否清晰且一致
- [ ] 函数/组件职责单一
- [ ] 无重复代码（DRY）
- [ ] 注释必要且准确

## 潜在 Bug
- [ ] 空值/null 检查
- [ ] 类型安全（无隐式 any）
- [ ] 边界条件处理
- [ ] 异步操作错误处理

## 性能
- [ ] 无不必要的重渲染
- [ ] 大列表使用虚拟滚动
- [ ] 惰性加载（Lazy load）
- [ ] 无内存泄漏风险

## 安全
- [ ] 无 XSS 风险
- [ ] 权限校验完整
- [ ] 敏感数据不暴露
`;

const PLAYGROUND_SKILL_RULES = JSON.stringify({
  critical: {
    label: "Critical",
    color: "#e74c3c",
    description: "必须立即修复的问题，可能导致崩溃、数据丢失或安全漏洞",
  },
  warning: {
    label: "Warning",
    color: "#f39c12",
    description: "建议修复的问题，影响代码质量或可维护性",
  },
  info: {
    label: "Info",
    color: "#3498db",
    description: "改进建议，不影响功能但可提升体验或性能",
  },
}, null, 2);

export const playgroundSkill: SkillFile = {
  name: PLAYGROUND_SKILL_NAME,
  files: [
    { path: "SKILL.md", content: PLAYGROUND_SKILL_MD },
    { path: "checklist.md", content: PLAYGROUND_SKILL_CHECKLIST },
    { path: "rules.json", content: PLAYGROUND_SKILL_RULES },
  ],
};

// ─── Cases ──────────────────────────────────────────────────────────────────

/**
 * P0 测试用例：自定义 Skill 使用流程（含支持文件）。
 *
 * 流程：
 *  1. 用户发送「审查一下 src/App.tsx 的代码」
 *  2. LLM 调用 use_skill 工具加载 code-review Skill（返回 SKILL.md + 目录树）
 *  3. LLM 根据 Skill 指导，调用 read_file 读取支持文件 checklist.md
 *  4. LLM 调用 read_file 读取目标文件 src/App.tsx
 *  5. LLM 基于 Skill 格式给出结构化审查报告
 *  6. 用户继续对话，LLM 基于 Skill 指导回复
 *
 * 验证要点：
 *  - use_skill 工具卡片正常显示（skill name + 目录树含 checklist.md / rules.json）
 *  - read_file 能读取 Skill 支持文件（路径 .agent/skills/code-review/checklist.md）
 *  - Skill 加载后，LLM 后续回复遵循 Skill 指导的格式和流程
 *  - 环境消息中包含 Skill 目录信息
 */
export const skillUseThenContinueCase: TestCase = {
  id: "skill-use-then-continue",
  name: "自定义 Skill（加载 → 读取支持文件 → 应用 → 继续对话）",
  group: "Skill 技能",
  priority: "P0",
  description:
    "自定义 code-review Skill（含 checklist.md 和 rules.json 支持文件）：第一步 LLM 调用 use_skill 加载 Skill，第二步读取 checklist.md 支持文件，第三步读取目标文件并给出审查报告，验证 Skill 含支持文件的完整流程。",
  expectedBehavior:
    "第 1 步 use_skill 工具卡片显示成功（skill name = code-review，目录树含 checklist.md / rules.json），第 2 步 read_file 读取 .agent/skills/code-review/checklist.md 成功，第 3 步 read_file 读取 src/App.tsx 成功，最后 LLM 输出结构化审查报告。后续对话中 LLM 继续基于 Skill 指导回复。",
  initialTurns: [],
  skills: [playgroundSkill],
  request: makeScriptedRequest([
    // Step 1: LLM 调用 use_skill 加载 Skill（返回 SKILL.md + 目录树含支持文件）
    {
      type: "tool_calls",
      calls: [
        {
          id: "skill_call_1",
          name: USE_SKILL_TOOL_NAME,
          args: { skill: PLAYGROUND_SKILL_NAME },
        },
      ],
      delayMs: 400,
    },
    // Step 2: LLM 根据 Skill 指导，调用 read_file 读取支持文件 checklist.md
    {
      type: "tool_calls",
      calls: [
        {
          id: "read_skill_file_1",
          name: "read_file",
          args: { path: ".agent/skills/code-review/checklist.md" },
        },
      ],
      delayMs: 300,
    },
    // Step 3: LLM 调用 read_file 读取目标文件 src/App.tsx
    {
      type: "tool_calls",
      calls: [
        {
          id: "read_call_1",
          name: "read_file",
          args: { path: "src/App.tsx" },
        },
      ],
      delayMs: 300,
    },
    // Step 4: LLM 基于 Skill 格式给出审查报告
    {
      type: "content",
      chunks: [
        "## 代码审查报告\n\n",
        "### Warning\n",
        "- 组件名称与文件名一致，结构清晰 (src/App.tsx#L1)\n",
        "- 建议添加 ErrorBoundary 提升健壮性 (src/App.tsx#L5)\n\n",
        "### Info\n",
        "- 可考虑使用 React.memo 优化渲染 (src/App.tsx#L3)\n\n",
        "## 总结\n",
        "App.tsx 整体结构良好，对照审查清单已逐项检查，建议增加错误边界和性能优化。",
      ],
      ttftMs: 500,
      chunkDelayMs: 60,
    },
    // Step 5: 用户继续对话，LLM 基于 Skill 指导回复
    {
      type: "content",
      chunks: [
        "根据 Code Review Skill 的审查原则，",
        "ErrorBoundary 是 React 应用的关键防御机制，",
        "建议在 App 组件外层包裹，捕获子组件的渲染错误。",
      ],
      ttftMs: 400,
      chunkDelayMs: 50,
    },
  ]),
};