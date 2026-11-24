import { context } from "../../context";
import { getFrontmatterString, splitFrontmatter } from "../../../../agent/src/utils/frontmatter";
import { chipRegistry } from "../../sandbox/setup";
import { ensureAIPanelOpen, ensureFocusComId } from "../../utils/ensure-ai-panel-open";

export interface DiagramResult {
  id: string;
  title: string;
  desc: string;
  mermaid: string;
}

/** 通过可视化解读技能分析项目，并返回标题、摘要和 Mermaid 源码。 */
export async function requestDiagram(params: AiServiceRequestParams, configDirName: string): Promise<DiagramResult> {
  const focus = context.currentFocus;
  const comId = focus?.comId ?? focus?.pageId;
  if (!comId) throw new Error("当前没有可用的聚焦对象");
  const agentKey = context.getAgentKey(comId);
  const agent = context.agentMap.get(agentKey);
  const sandbox = context.sandboxMap.get(agentKey);
  if (!agent) throw new Error("当前聚焦对象没有可用的 Agent");
  if (!sandbox) throw new Error("当前聚焦对象没有可用的文件系统");
  if (context.aiQueue.blockIfDisabled(agent)) throw new Error("当前没有 AI 请求权限");

  await ensureAIPanelOpen(comId);
  return new Promise<DiagramResult>((resolve, reject) => {
    let started = false;
    let unsubscribe: (() => void) | undefined;
    const queueParams = { message: params.message, attachments: params.attachments ?? [], focus };
    context.aiQueue.send(agent, async () => {
      started = true;
      unsubscribe?.();
      try {
        if (context.aiQueue.blockIfDisabled(agent)) throw new Error("当前没有 AI 请求权限");
        await ensureFocusComId(comId);
        const turnId = `diagram-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const diagramId = `u_${Math.random().toString(36).slice(2, 9)}`;
        const model = params.model;
        const providerId = params.providerId ?? (typeof model === "object" ? model?.providerId : undefined);
        const modelId = params.modelId ?? (typeof model === "string" ? model : model?.modelId);
        await agent.requestAI(chipRegistry.formatRequestParams({
          message: `请先通过 use_skill 加载 understand-any 可视化解读技能，按照技能要求分析并生成图。\n\n${params.message}\n\n引用的图区域 ID：${diagramId}`,
          turnId,
          attachments: params.attachments ?? [],
          ...(params.meta ? { meta: params.meta } : {}),
          ...(providerId ? { providerId } : {}),
          ...(modelId ? { modelId } : {}),
        }));
        const turn = agent.getTurns().find((item: any) => item.id === turnId);
        if (!turn || turn.status !== "success") throw new Error(turn?.error || "可视化分析未完成");
        if (agent.kind === "http") await agent.files.syncChanges();
        const docsDir = `${configDirName}/docs`;
        const entries = await sandbox.files.list(docsDir, { recursive: true });
        const paths = entries.filter((entry: any) => entry.type !== "directory" && /\.md$/i.test(entry.path)).map((entry: any) => entry.path);
        const files = await sandbox.files.readFiles(paths);
        for (const file of files) {
          const { fmText, body } = splitFrontmatter(file.content);
          if (getFrontmatterString(fmText, "bindingTo") !== diagramId) continue;
          const title = getFrontmatterString(fmText, "title");
          const desc = getFrontmatterString(fmText, "summary");
          const mermaid = body.match(/^[ \t]*```mermaid[ \t]*\r?\n([\s\S]*?)^[ \t]*```[ \t]*$/im)?.[1]?.trim();
          if (!title || !desc || !mermaid) {
            throw new Error("可视化文档缺少标题、摘要或 Mermaid 代码");
          }
          resolve({ id: diagramId, title, desc, mermaid });
          return;
        }
        throw new Error("未找到与本次请求绑定的可视化文档");
      } catch (error) {
        reject(error);
      }
    }, queueParams);
    if (!started) {
      unsubscribe = context.aiQueue.subscribe(agent, (state) => {
        if (state.queue.some((item) => item.params === queueParams)) return;
        // 队列取出任务后会先通知再启动；等启动动作完成后再判断是否被移除。
        Promise.resolve().then(() => {
          if (started) return;
          unsubscribe?.();
          reject(new Error("可视化分析请求未发送或已从队列中移除"));
        });
      });
    }
  });
}
