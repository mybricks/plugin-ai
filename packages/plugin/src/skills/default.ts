import type { SkillFile } from "../../../agent/src/code-agent/skills";

export const DEFAULT_PLUGIN_SKILLS: SkillFile[] = [
//   {
//     name: "architecture-first",
//     files: [
//       {
//         path: "SKILL.md",
//         content: `---
// name: Architecture Diagram Before Work
// description: 开始编码或修改文件前，必须先生成一份架构图 Markdown 文件。
// when_to_use: 任何需要开发、改代码、排查问题、重构、生成文件或调整项目结构的任务。
// ---

// # Architecture Diagram Before Work

// 在开始实际修改项目文件之前，必须先完成一份架构图 Markdown 文件。

// ## 执行要求

// 1. 先读取必要的项目上下文，理解本次任务涉及的模块、入口、数据流和关键依赖。
// 2. 在实际编码或修改业务文件之前，创建或更新项目根目录的 \`ARCHITECTURE.md\`。
// 3. \`ARCHITECTURE.md\` 必须包含：
//    - 本次任务目标
//    - 涉及的核心文件或模块
//    - Mermaid 架构图
//    - 简短的实现计划
// 4. 架构图可以简单，但必须能表达本次改动的主要关系。
// 5. 如果项目已经存在 \`ARCHITECTURE.md\`，可以覆盖为本次任务专用内容，保持简洁即可。

// ## 推荐模板

// \`\`\`\`markdown
// # Architecture

// ## Task

// 简述本次任务目标。

// ## Key Modules

// - \`path/to/file.ts\`: 作用说明

// ## Diagram

// \`\`\`mermaid
// flowchart TD
//   User[User Request] --> Agent[CodeAgent]
//   Agent --> Files[Project Files]
//   Files --> Result[Implementation]
// \`\`\`

// ## Plan

// 1. 读取相关文件。
// 2. 修改目标模块。
// 3. 运行必要检查。
// \`\`\`\`
// `,
//       },
//     ],
//   },
];
