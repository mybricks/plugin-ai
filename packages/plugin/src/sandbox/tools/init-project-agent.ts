import type { SubAgentConfig } from "../../../../agent/src";
import type { Agent } from "../../../../agent/src";
import type { Sandbox } from "../../../../agent/src";

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
 * 创建"初始化项目" SubAgent 配置。
 *
 * 该子 Agent 根据用户描述输出带文件路径的代码块，
 * execute 方法解析后批量写入沙箱，并返回写入摘要作为 LLM 上下文。
 */
export function createInitProjectSubAgent(sandbox: Sandbox): SubAgentConfig {
  return {
    type: "init-project",
    description: "对空项目进行快速初始化开发，生成所需的所有代码文件（不包括md文档），给我的消息内容包含需求内容（不要超过100字）和项目文件结构，从零开始完成项目开发",
    system: `你是一个专业的前端项目初始化助手。
用户会描述他们想要的项目，你需要输出完整的项目文件代码。

!IMPORTANT: 生成内容中不允许包含md文档文件（非代码文件），这个应该由后续步骤写入。

输出规则：
1. 每个文件必须用带文件路径的代码块格式输出，格式如下：
\`\`\`文件路径
[文件内容]
\`\`\`

<example>
\`\`\`src/index.tsx
import React from 'react';
// ...
\`\`\`

</example>

注意事项：
1. 所有文件内容中禁止使用emoji、特殊字符、表情符号；
2. 输出所有必要的代码文件，包括入口文件、组件文件、样式等；
3. 代码要完整可运行；
4. 不要调用任何工具，只输出文件代码块。
`,

    execute: async (subAgent: Agent, prompt: string, ctx: { emitProgress: (data: any) => void; getUserMessage: () => { message: string; attachments?: any[] } }) => {
      // 获取父 Agent 当前轮的用户消息（包含附件）
      const parentUserMessage = ctx.getUserMessage();

      // 拼接完整消息
      const fullPrompt = `<用户原始需求>
${parentUserMessage.message}
</用户原始需求>
<当前任务>
${prompt}
</当前任务>`;

      // 进度状态
      const progressState = {
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
        ctx.emitProgress({ ...progressState });
      });

      try {
        // 传递完整消息和附件
        await subAgent.requestAI({
          message: fullPrompt,
          attachments: parentUserMessage.attachments
        });
      } finally {
        unsubscribe();
      }

      // 处理输出
      const turns = subAgent.getTurns();
      const content = turns[turns.length - 1]?.content ?? "";

      const files = parseFileBlocks(content);

      if (files.length === 0) {
        return {
          output: "未解析到任何文件，请检查输出格式是否正确。",
          metadata: { filesWritten: 0, filesFailed: 0, files: [] },
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

      const successList = Array.from(successPaths)
        .map((path) => `- ${path}`)
        .join("\n");

      let output = `写入完成：成功 ${filesWritten} 个文件`;
      if (filesFailed > 0) {
        output += `，失败 ${filesFailed} 个文件（${Array.from(failedPaths).join(", ")}）`;
      }
      if (successList) {
        output += `\n\n已写入文件：\n${successList}`;
      }

      // 根据写入情况补充提示
      if (filesFailed === 0) {
        output += `\n\n已完成需求所需代码文件的写入，请继续。`;
      } else {
        output += `\n\n已完成需求所需部分文件的写入，请继续。`;
      }

      // metadata.files 包含完整文件信息（path, lineCount, status）
      const filesMetadata = files.map((f) => ({
        path: f.path,
        lineCount: f.content.split("\n").length,
        status: successPaths.has(f.path) ? ("success" as const) : ("error" as const),
      }));

      return {
        output,
        metadata: { filesWritten, filesFailed, files: filesMetadata, failedPaths: Array.from(failedPaths) },
      };
    },
  };
}
