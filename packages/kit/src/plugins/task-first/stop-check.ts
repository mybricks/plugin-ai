import type { AgentSandbox, ToolCallRecord, TurnRecord } from "../../../../agent/src";

const MUTATION_TOOLS = new Set([
  "write_file", "multi_write", "edit_file", "multi_edit", "delete_file", "init-project",
]);

/** 只有明确的业务源码改动才要求回写任务文档，文档、配置和日志不计入。 */
const BUSINESS_SOURCE_FILE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "vue", "svelte",
  "css", "less", "scss", "sass",
  "html", "htm",
  "py", "go", "java", "kt", "kts", "rb", "php", "cs", "c", "h", "cpp", "cxx", "hpp", "rs", "swift",
]);

const normalizePath = (path: string) => path.replace(/\\/g, "/").replace(/^\.\/+/, "");

const isCurrentTaskPath = (path: string, taskPath: string) => {
  const normalized = normalizePath(path);
  return normalized === taskPath || normalized.endsWith(`/${taskPath}`);
};

const isProjectSourcePath = (path: string, configDirName: string) => {
  const normalized = normalizePath(path);
  const relative = normalized.replace(/^\/+/, "");
  const configPath = configDirName.replace(/^\/+|\/+$/g, "");
  const isInsideConfig = relative === configPath || relative.startsWith(`${configPath}/`)
    || relative.includes(`/${configPath}/`);
  if (isInsideConfig || relative.split("/").includes(".git")) return false;

  const fileName = relative.split("/").at(-1) ?? "";
  const extension = fileName.split(".").at(-1)?.toLowerCase();
  return !!extension && BUSINESS_SOURCE_FILE_EXTENSIONS.has(extension);
};

/**
 * TASKS.md 中「待验证」是需要用户确认的状态。以标题加同名序号作为任务标识，
 * 既能识别新建任务，也能识别已有任务从其他状态流转到待验证。
 */
function collectPendingVerificationTaskIds(content: string): Set<string> {
  const taskIds = new Set<string>();
  const titleOccurrences = new Map<string, number>();
  const sections = content.split(/(?=^##\s+)/m).filter((section) => /^##\s+/.test(section));

  for (const section of sections) {
    const title = section.split("\n", 1)[0]?.replace(/^##\s+/, "").trim();
    if (!title) continue;

    const occurrence = titleOccurrences.get(title) ?? 0;
    titleOccurrences.set(title, occurrence + 1);
    const status = section.match(/^\s*-\s*\*{1,2}\s*状态\s*\*{0,2}\s*[：:]\s*([^\n]+)/m)?.[1]
      ?.replace(/[\s*_`]/g, "");
    if (status === "待验证") taskIds.add(`${title}\u0000${occurrence}`);
  }

  return taskIds;
}

function hasNewPendingVerificationTask(previousTasks: ReadonlySet<string>, after: string): boolean {
  return [...collectPendingVerificationTaskIds(after)].some((taskId) => !previousTasks.has(taskId));
}

function collectMutationPathsForCall(call: ToolCallRecord): string[] {
  const paths = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && value.trim()) paths.add(normalizePath(value.trim()));
  };

  if (call.status !== "success" || !MUTATION_TOOLS.has(call.name)) return [];
  const metadata = call.result?.metadata;
  switch (call.name) {
    case "write_file":
    case "edit_file":
      add(metadata?.path ?? call.args?.path);
      break;
    case "multi_write":
    case "init-project":
      for (const file of metadata?.files ?? []) {
        if (file?.status !== "error") add(file?.path);
      }
      break;
    case "multi_edit":
      for (const edit of metadata?.edits ?? []) {
        if (!edit?.error) add(edit?.path);
      }
      break;
    case "delete_file":
      for (const path of metadata?.deletedPaths ?? []) add(path);
      break;
  }
  return [...paths];
}

function collectMutationPaths(turn: TurnRecord): string[] {
  const paths = new Set<string>();
  for (const iteration of turn.iterations) {
    if ("type" in iteration) continue;
    for (const call of iteration.toolCalls) {
      for (const path of collectMutationPathsForCall(call)) paths.add(path);
    }
  }
  return [...paths];
}

function hasAskQuestionsAfterTaskDocumentUpdate(turn: TurnRecord, taskPath: string): boolean {
  let taskDocumentUpdated = false;
  let askedAfterLatestTaskDocumentUpdate = false;

  for (const iteration of turn.iterations) {
    if ("type" in iteration) continue;
    for (const call of iteration.toolCalls) {
      if (collectMutationPathsForCall(call).some((path) => isCurrentTaskPath(path, taskPath))) {
        taskDocumentUpdated = true;
        askedAfterLatestTaskDocumentUpdate = false;
        continue;
      }
      if (taskDocumentUpdated && call.name === "ask_questions" && call.status === "success") {
        askedAfterLatestTaskDocumentUpdate = true;
      }
    }
  }

  return askedAfterLatestTaskDocumentUpdate;
}

type TaskFirstStopCheckOptions = {
  sandbox: AgentSandbox;
  configDirName: string;
  taskPath: string;
};

/** 管理 stop 阶段的任务文档回写和待验证提问提醒。 */
export function createTaskFirstStopCheck({ sandbox, configDirName, taskPath }: TaskFirstStopCheckOptions) {
  const taskDocumentPromptedTurnIds = new Set<string>();
  const verificationPromptedTurnIds = new Set<string>();
  let pendingVerificationTaskIdsAtTurnStart: Set<string> | undefined;

  return {
    async beforeTurn() {
      pendingVerificationTaskIdsAtTurnStart = undefined;
      try {
        const content = (await sandbox.files.read(taskPath))?.content ?? "";
        pendingVerificationTaskIdsAtTurnStart = collectPendingVerificationTaskIds(content);
      } catch (error) {
        console.warn(`[task-first] 读取 ${taskPath} 以检查待验证任务失败:`, error);
      }
    },
    async beforeTurnStop(turn: TurnRecord, currentTaskPath: string | undefined) {
      if (!currentTaskPath) return;

      const mutationPaths = collectMutationPaths(turn);
      const taskDocumentUpdated = mutationPaths.some((path) => isCurrentTaskPath(path, currentTaskPath));

      // 注释原因：按「本轮改了源码就必须回写任务文档」的检查过于绝对，
      // 会把「同一问题反复调试、尚未收敛」的中间轮次也当作必须回写的信号，
      // 产生没有信息增量的流水账提醒。待验证任务的检查（下方）仍然保留，
      // 因为那是任务状态真正发生变化时才触发的信号，更明确可靠。
      // const sourceUpdated = mutationPaths.some((path) => isProjectSourcePath(path, configDirName));
      // if (sourceUpdated && !taskDocumentUpdated && !taskDocumentPromptedTurnIds.has(turn.id)) {
      //   taskDocumentPromptedTurnIds.add(turn.id);
      //   return {
      //     additionalMessages: [{
      //       role: "user" as const,
      //       content: `本轮修改了项目源码，但尚未更新当前任务文档 \`${currentTaskPath}\`。若回写后新增了待验证任务，请记得调用 \`ask_questions\` 邀请用户验证，再结束。`,
      //     }],
      //   };
      // }

      if (
        !taskDocumentUpdated
        || verificationPromptedTurnIds.has(turn.id)
        || pendingVerificationTaskIdsAtTurnStart === undefined
        || hasAskQuestionsAfterTaskDocumentUpdate(turn, currentTaskPath)
      ) return;

      let currentTaskDocument: string;
      try {
        currentTaskDocument = (await sandbox.files.read(currentTaskPath))?.content ?? "";
      } catch (error) {
        console.warn(`[task-first] 读取 ${currentTaskPath} 以检查待验证任务失败:`, error);
        return;
      }
      if (!hasNewPendingVerificationTask(pendingVerificationTaskIdsAtTurnStart, currentTaskDocument)) return;

      verificationPromptedTurnIds.add(turn.id);
      return {
        additionalMessages: [{
          role: "user" as const,
          content: "A task pending verification was added in this turn. Based on the complexity of the changes and the verification progress, decide whether to call `ask_questions` to invite the user to verify it. If needed, use the tool to explain the verification steps and observation points, then ask the user to confirm whether verification passed before ending the turn.",
        }],
      };
    },
    afterTurn(turn: TurnRecord) {
      taskDocumentPromptedTurnIds.delete(turn.id);
      verificationPromptedTurnIds.delete(turn.id);
      pendingVerificationTaskIdsAtTurnStart = undefined;
    },
  };
}
