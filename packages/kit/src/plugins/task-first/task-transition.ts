import type { AgentSandbox, ToolCallRecord } from "../../../../agent/src";
import { ASK_QUESTIONS_TOOL_NAME } from "../../../../agent/src/tools/ask-questions";

function isConfirmOption(label: string): boolean {
  return label.trim() === "符合预期";
}

type TaskStatus = "处理中" | "待验证" | "待交接" | "已完成";

function parseTaskStatus(raw: string | undefined): TaskStatus | undefined {
  const s = raw?.replace(/[*_`\s]/g, "");
  if (s === "处理中" || s === "待验证" || s === "待交接" || s === "已完成") return s;
  return undefined;
}

function extractTaskHandoverTo(section: string): string | undefined {
  const m = section.match(/^\s*-\s*\*{1,2}\s*交接给\s*\*{0,2}\s*[：:]\s*([^\n]+)/m);
  return m?.[1]?.replace(/[*_`\s]/g, "") || undefined;
}

export function applyTaskTransition(content: string, taskId: string, targetStatus: TaskStatus): string {
  const sections = content.split(/(?=^##\s+)/m);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  let changed = false;
  const result = sections.map(section => {
    if (!/^##\s+/.test(section)) return section;
    const titleLine = section.split("\n", 1)[0] ?? "";
    const id = titleLine.replace(/^##\s+/, "").trim().match(/^(T-\d+)\b/)?.[1];
    if (id !== taskId) return section;

    let updated = section.replace(
      /^(\s*-\s*\*{1,2}\s*状态\s*\*{0,2}\s*[：:]\s*)(.+)$/m,
      `$1${targetStatus}`
    );
    if (!/^\s*-\s*\*{1,2}\s*更新时间\s*\*{0,2}\s*[：:]/m.test(updated)) {
      const lines = updated.split("\n");
      lines.splice(1, 0, `- **更新时间**：${timestamp}`);
      updated = lines.join("\n");
    } else {
      updated = updated.replace(
        /^(\s*-\s*\*{1,2}\s*更新时间\s*\*{0,2}\s*[：:]\s*)(.+)$/m,
        `$1${timestamp}`
      );
    }
    changed = true;
    return updated;
  }).join("");

  return changed ? result : content;
}

function parseAskQuestionsTransition(toolCall: Readonly<ToolCallRecord>): Array<{ taskId: string; target: TaskStatus }> {
  if (toolCall.name !== ASK_QUESTIONS_TOOL_NAME) return [];
  if (toolCall.status !== "success" || !toolCall.result) return [];

  const answers = (toolCall.result.metadata as any)?.answers;
  if (!answers || typeof answers !== "object") return [];

  const result: Array<{ taskId: string; target: TaskStatus }> = [];

  for (const [question, answer] of Object.entries(answers)) {
    const taskId = question.match(/task:\/\/(T-\d+)/)?.[1];
    if (!taskId) continue;

    const optionLabels: string[] = Array.isArray(answer) ? answer : [answer as string];
    if (!optionLabels.length) continue;

    const allConfirm = optionLabels.every(label => isConfirmOption(String(label)));
    if (!allConfirm) continue;

    result.push({ taskId, target: "已完成" });
  }

  return result;
}

export function createTaskTransitionHook({ sandbox, taskPath }: { sandbox: AgentSandbox; taskPath: string }) {
  return {
    async afterToolCall(toolCall: Readonly<ToolCallRecord>) {
      const transitions = parseAskQuestionsTransition(toolCall);
      if (!transitions.length) return;

      let content: string;
      try {
        content = (await sandbox.files.read(taskPath))?.content ?? "";
      } catch (error) {
        console.warn(`[task-first] afterToolCall 读取 ${taskPath} 失败:`, error);
        return;
      }

      const resolved: string[] = [];
      let updated = content;
      for (const { taskId } of transitions) {
        const section = updated.split(/(?=^##\s+)/m).find(s => {
          const title = s.split("\n", 1)[0]?.replace(/^##\s+/, "").trim() ?? "";
          return title.match(/^(T-\d+)\b/)?.[1] === taskId;
        });
        if (!section) continue;

        const status = parseTaskStatus(section.match(/^\s*-\s*\*{1,2}\s*状态\s*\*{0,2}\s*[：:]\s*([^\n]+)/m)?.[1]);
        if (status !== "待验证") continue;

        const handoverTo = extractTaskHandoverTo(section);
        const target: TaskStatus = handoverTo ? "待交接" : "已完成";
        const next = applyTaskTransition(updated, taskId, target);
        if (next !== updated) {
          updated = next;
          resolved.push(`${taskId} → ${target}`);
        }
      }

      if (updated === content) return;

      try {
        await sandbox.files.write({ path: taskPath, content: updated });
      } catch (error) {
        console.warn(`[task-first] afterToolCall 写回 ${taskPath} 失败:`, error);
        return;
      }

      if (!toolCall.result) return;
      const statusLines = resolved.map(r => {
        const [id, target] = r.split(" → ");
        const targetMap: Record<string, string> = { "已完成": "Completed", "待交接": "Pending Handoff" };
        return `- User confirmed ${id} as ${targetMap[target] ?? target}`;
      }).join("\n");
      const note = `\n\n[${statusLines}\nTASKS.md has been updated automatically.]`;
      return {
        status: "success" as const,
        result: {
          output: toolCall.result.output + note,
          ...(toolCall.result.metadata ? { metadata: toolCall.result.metadata } : {}),
          ...(toolCall.result.attachments ? { attachments: toolCall.result.attachments } : {}),
        },
      };
    },
  };
}
