import type { ToolExecutionContext } from "../../../agent/src/agent";
import { buildLowCodeStableContext } from "../project";
import type { LowCodeDesignerRuntime } from "../designer";

const SYSTEM_PROMPT = `你是一名专业的低代码页面产品经理。你的任务是将用户的一句话需求扩写成详细的页面搭建需求文档。

<输出规则>
直接输出扩写后的需求文档，不要输出任何解释、前言或总结。
</输出规则>

<扩写要求>
根据一句话需求，为页面扩写布局和具体的模块内容，让一句话需求变成内容详细的需求文档，无需设计样式，和具体文案：
1. **区块与组件**：从上到下、从左到右列举每个区块的内容，说明每个区块包含哪些组件（文本、图片、按钮、表格、卡片、图表等），以及它们的排列方式。
2. **内容细节**：为每个关键组件提供示例文案、占位图说明或数据格式，让搭建时有具体参考。

输出格式为结构化的 Markdown，层级清晰，便于直接用于后续页面搭建。
</扩写要求>`;

export async function expandRequirementWithSubAgent(
  runtime: LowCodeDesignerRuntime,
  toolContext: ToolExecutionContext,
): Promise<{ expanded: string }> {
  const parentAgent = toolContext.getAgent();
  const { message } = toolContext.getUserMessage();

  const subAgent = parentAgent.createFork({
    tools: [],
    system: SYSTEM_PROMPT,
    retry: false,
  });

  let result = "";
  const unsubscribe = subAgent.events.on("llm:content", ({ content }) => {
    result = content || "";
    toolContext.emitProgress({ content: result });
  });

  try {
    const stableContext = buildLowCodeStableContext(runtime);
    await subAgent.requestAI({
      message: [
        "请将以下一句话需求扩写成详细的页面搭建需求文档。",
        "",
        "<一句话需求>",
        message,
        "</一句话需求>",
        "",
        "<低代码项目上下文>",
        stableContext,
        "</低代码项目上下文>",
      ].join("\n"),
    });
  } finally {
    unsubscribe();
  }

  const turns = subAgent.getTurns();
  const lastTurn = turns[turns.length - 1];
  const lastLLMIter = lastTurn?.iterations?.slice().reverse().find((iter: any) => !("type" in iter));
  const expanded = (lastLLMIter as any)?.content || result;

  if (!expanded) {
    throw new Error("lowcode_expand_requirement subAgent did not generate any content.");
  }

  return { expanded };
}
