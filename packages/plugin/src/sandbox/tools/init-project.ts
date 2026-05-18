import type { Tool, Sandbox } from "../../../../agent/src";
import type { Agent } from "../../../../agent/src";
import type { ToolExecutionContext } from "../../../../agent/src/agent";

/**
 * init-project 工具名称常量
 */
export const INIT_PROJECT_TOOL_NAME = "init-project";

/**
 * 解析 LLM 输出的带文件路径代码块，提取文件路径和内容。
 *
 * 支持格式：
 * ```filepath
 * ...content...
 * ```
 *
 * 或：
 * ```language filepath
 * ...content...
 * ```
 */
function parseFileBlocks(content: string): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];
  const blockRegex = /```(?:\w+\s+)?(\S+\.[\w]+)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(content)) !== null) {
    files.push({ path: match[1].trim(), content: match[2] });
  }
  return files;
}

/**
 * 从流式 LLM 输出中解析文件列表。
 * 支持部分代码块（流式中途），最后一个未闭合的块标记为 "writing"。
 *
 * 格式：
 * ```filepath
 * ...content...
 * ```
 * 或：
 * ```language filepath
 * ...content...
 * ```
 */
function parseFilesFromStreamingContent(content: string): Array<{
  path: string;
  lineCount: number;
  status: "writing" | "complete" | "success" | "error";
}> {
  const files: Array<{ path: string; lineCount: number; status: "writing" | "complete" | "success" | "error" }> = [];

  // 正则：匹配 ```filepath 或 ```language filepath
  const blockRegex = /```(?:\w+\s+)?(\S+\.[\w]+)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  // 提取所有完整的代码块
  while ((match = blockRegex.exec(content)) !== null) {
    const path = match[1].trim();
    const fileContent = match[2];
    const lineCount = fileContent.split("\n").length;
    files.push({ path, lineCount, status: "complete" });
    lastIndex = blockRegex.lastIndex;
  }

  // 检查最后是否有未闭合的代码块（正在写入中）
  const remaining = content.slice(lastIndex);
  const openBlockMatch = remaining.match(/```(?:\w+\s+)?(\S+\.[\w]+)\n([\s\S]*)$/);
  if (openBlockMatch) {
    const path = openBlockMatch[1].trim();
    const fileContent = openBlockMatch[2];
    const lineCount = fileContent.split("\n").length;
    files.push({ path, lineCount, status: "writing" });
  }

  return files;
}

/**
 * SubAgent 的系统 prompt
 */
const SUB_AGENT_SYSTEM_PROMPT = `你是一个是一名资深的前端开发专家、架构师，技术资深、逻辑严谨、实事求是，同时具备专业的审美和设计能力。
根据用户的需求，输出所有需要重新写入的文件。

<输出规则>
1. 每个文件必须用带文件路径的代码块格式输出，格式如下：
\`\`\`文件路径
[文件内容]
\`\`\`
</输出规则>

<example>
\`\`\`index.jsx
import React from 'react';
// ...
\`\`\`

\`\`\`index.less
\`\`\`

\`\`\`pages/HomePage/index.jsx
import React from 'react';
// ...
\`\`\`

</example>

注意事项：
1. 所有文件内容中禁止使用emoji、特殊字符、表情符号；
2. 代码要完整可运行，输出所有必要的代码文件，包括入口文件、组件文件、样式等；
3. 你要完成的是中文场景下的开发任务，请仔细斟酌文案、用语，在各类文案表达中尽量使用中文，但是对于代码、技术术语等，可以使用英文；
4. 不要调用任何工具，只输出文件代码块。
`;

/**
 * SubAgent 的 execute 逻辑
 */
async function executeSubAgent(
  subAgent: Agent,
  prompt: string,
  ctx: { emitProgress: (data: any) => void; getUserMessage: () => { message: string; attachments?: any[] } },
  sandbox: Sandbox,
  expectedFiles: string[],
  requirement?: string
) {
  // 获取父 Agent 当前轮的用户消息（包含附件）
  const parentUserMessage = ctx.getUserMessage();

  const realRequirement = parentUserMessage.message;

  // 拼接完整消息
  const fullPrompt = `<用户原始需求>
${parentUserMessage.message}
</用户原始需求>

<需要你生成写入的文件>
${prompt}
</需要你生成写入的文件>`;

  // 进度状态
  const progressState = {
    requirement: realRequirement,
    content: "",
    thinkingContent: "",
    files: [] as Array<{
      path: string;
      lineCount: number;
      status: "writing" | "complete" | "success" | "error";
    }>,
  };

  // 记录已写入的文件路径，避免重复写入
  const writtenFiles = new Set<string>();

  // 节流 emitProgress，800ms 内最多触发一次（leading + trailing）
  let _emitTimer: ReturnType<typeof setTimeout> | null = null;
  let _emitLastTime = 0;
  let _emitLastArg: any = null;
  const throttledEmitProgress = (data: any) => {
    _emitLastArg = data;
    const remaining = 800 - (Date.now() - _emitLastTime);
    if (remaining <= 0) {
      if (_emitTimer) { clearTimeout(_emitTimer); _emitTimer = null; }
      _emitLastTime = Date.now();
      ctx.emitProgress(data);
    } else if (!_emitTimer) {
      _emitTimer = setTimeout(() => {
        _emitTimer = null;
        _emitLastTime = Date.now();
        ctx.emitProgress(_emitLastArg);
      }, remaining);
    }
  };
  const flushEmitProgress = () => {
    if (_emitTimer) { clearTimeout(_emitTimer); _emitTimer = null; }
    if (_emitLastArg) { ctx.emitProgress(_emitLastArg); }
  };

  // 监听 llm:content 事件
  const unsubscribe = subAgent.events.on("llm:content", async ({ content, thinkingContent }) => {
    progressState.content = content || "";
    if (thinkingContent !== undefined) {
      progressState.thinkingContent = thinkingContent;
    }

    // 解析文件列表
    const parsedFiles = parseFilesFromStreamingContent(content || "");

    // 检测新完成的文件并立即写入
    for (const file of parsedFiles) {
      if (file.status === "complete" && !writtenFiles.has(file.path)) {
        // 解析文件内容
        const fileBlocks = parseFileBlocks(content || "");
        const fileData = fileBlocks.find((f) => f.path === file.path);

        if (fileData) {
          writtenFiles.add(file.path);

          try {
            // 立即写入文件
            await sandbox.updateFiles([fileData]);

            // 更新状态为 success
            const fileIndex = parsedFiles.findIndex((f) => f.path === file.path);
            if (fileIndex !== -1) {
              parsedFiles[fileIndex] = { ...parsedFiles[fileIndex], status: "success" };
            }
          } catch (err) {
            // 写入失败，标记为 error
            const fileIndex = parsedFiles.findIndex((f) => f.path === file.path);
            if (fileIndex !== -1) {
              parsedFiles[fileIndex] = { ...parsedFiles[fileIndex], status: "error" };
            }
          }
        }
      }
    }

    progressState.files = parsedFiles;
    throttledEmitProgress({ ...progressState });
  });

  // llm:complete 时 flush，确保最终状态立即上报
  const unsubFlush = subAgent.events.on("llm:complete", () => {
    flushEmitProgress();
  });

  try {
    // 传递完整消息和附件
    await subAgent.requestAI({
      message: fullPrompt,
      attachments: parentUserMessage.attachments,
    });
  } finally {
    unsubscribe();
    unsubFlush();
  }

  // 处理输出
  const turns = subAgent.getTurns();
  const lastTurn = turns[turns.length - 1];
  const lastLLMIter = lastTurn?.iterations?.slice().reverse().find(iter => !("type" in iter));
  const content = (lastLLMIter as any)?.content ?? "";

  const allFiles = parseFileBlocks(content);
  const files = allFiles;

  if (files.length === 0) {
    return {
      output: "未解析到任何文件，请检查输出格式是否正确。",
      metadata: { requirement: realRequirement, files: [] },
    };
  }

  // 统计成功/失败的文件数（从 progressState.files 中获取状态）
  const successPaths = new Set<string>();
  const failedPaths = new Set<string>();

  for (const file of progressState.files) {
    if (file.status === "success") {
      successPaths.add(file.path);
    } else if (file.status === "error") {
      failedPaths.add(file.path);
    }
  }

  // 处理未写入的文件（可能是最后一个正在写入的文件）
  for (const file of files) {
    if (!successPaths.has(file.path) && !failedPaths.has(file.path)) {
      try {
        await sandbox.updateFiles([file]);
        successPaths.add(file.path);
      } catch {
        failedPaths.add(file.path);
      }
    }
  }

  const filesWritten = successPaths.size;
  const filesFailed = failedPaths.size;

  // 检查是否所有期望的文件都已生成
  const expectedFilesSet = new Set(expectedFiles);
  const missingFiles = expectedFiles.filter((file) => !successPaths.has(file));
  const extraFiles = Array.from(successPaths).filter((file) => !expectedFilesSet.has(file));

  // 构建带内容的文件列表
  const successFilesWithContent = files
    .filter((f) => successPaths.has(f.path))
    .map((f) => {
      const ext = f.path.split(".").pop() || "";
      return `- ${f.path}\n\`\`\`${ext}\n${f.content}\n\`\`\``;
    })
    .join("\n\n");

  let output = `写入完成：成功 ${filesWritten} 个文件`;
  if (filesFailed > 0) {
    output += `，失败 ${filesFailed} 个文件（${Array.from(failedPaths).join(", ")}）`;
  }
  if (successFilesWithContent) {
    output += `\n\n已写入文件：\n${successFilesWithContent}`;
  }

  // 提示缺失和额外的文件
  if (missingFiles.length > 0) {
    output += `\n\n缺少以下文件：\n${missingFiles.map((f) => `- ${f}`).join("\n")}`;
  }
  if (extraFiles.length > 0) {
    output += `\n\n额外生成的文件：\n${extraFiles.map((f) => `- ${f}`).join("\n")}`;
  }

  // 根据写入情况补充提示
  if (filesFailed === 0 && missingFiles.length === 0) {
    output += `\n\n已完成需求所有代码文件的生成和写入，如果不是有严重的需求不满足情况，请勿进行重复进行优化，接下来注意检查错误情况以及同步文档。`;
  } else if (missingFiles.length > 0) {
    output += `\n\n部分文件未生成，请继续。`;
  } else {
    output += `\n\n只完成了需求所需部分文件的写入，请继续生成。`;
  }

  // metadata.files 包含完整文件信息（path, lineCount, status）
  const filesMetadata = files.map((f) => ({
    path: f.path,
    lineCount: f.content.split("\n").length,
    status: successPaths.has(f.path) ? ("success" as const) : ("error" as const),
  }));

  return {
    output,
    metadata: {
      requirement,
      files: filesMetadata,
    },
  };
}

/**
 * 创建"初始化项目"工具。
 *
 * 该工具作为独立工具直接被 LLM 调用，内部使用 SubAgent 实现逻辑。
 */
export function createInitProjectTool(sandbox: Sandbox): Tool {
  return {
    name: INIT_PROJECT_TOOL_NAME,
    title: "生成项目文件",
    description:
      "对空项目进行快速开发，根据需求生成并写入所需的所有文件",
    parameters: {
      type: "object",
      properties: {
//         requirement: {
//           type: "string",
//           description: `分析的用户需求，不超过50字，比如：
// - 比如：开发一个售卖韩国美妆产品的电商网站，尽量对用户的需求进行拓展；
// - 比如：高保真还原附件图片中的界面设计，对图片进行1:1还原；`,
//         },
        filesToGenerate: {
          type: "array",
          items: {
            type: "string",
          },
          description: "要生成的文件路径列表",
        },
      },
      required: ["filesToGenerate"],
    },
    async execute(params: { requirement?: string, filesToGenerate: string[] }, toolContext: ToolExecutionContext) {
      const { requirement = '',filesToGenerate } = params;

      // 拼接 prompt 传递给 subAgent
      const fileList = filesToGenerate.map((file) => `${file}`).join("\n");
      const prompt = `\n要生成的文件列表(遵循路径)：\n${fileList}`;

      // 从 toolContext 获取父 Agent
      const parentAgent = toolContext.getAgent();

      // 检查用户消息是否有图片附件，有则注入 aiRole
      const { attachments } = toolContext.getUserMessage();
      const hasImage = attachments?.some((a: any) => a.type === "image");

      // 创建 SubAgent (使用 createFork)
      const subAgent = parentAgent.createFork({
        tools: [],
        system: SUB_AGENT_SYSTEM_PROMPT,
        aiRole: hasImage ? "image" : undefined,
      });

      // 执行 SubAgent 逻辑
      return executeSubAgent(
        subAgent,
        prompt,
        {
          emitProgress: toolContext.emitProgress,
          getUserMessage: toolContext.getUserMessage,
        },
        sandbox,
        filesToGenerate,
        requirement
      );
    },
  };
}
