import { context } from "../../context";
import { chipRegistry } from "../../sandbox/setup";
import { ensureAIPanelOpen, ensureFocusComId } from "../../utils/ensure-ai-panel-open";

export interface DiagramResult {
  title: string;
  desc: string;
  mermaid: string;
}

/** 通过可视化解读技能分析项目，并返回标题、摘要和 Mermaid 源码。 */
export async function requestDiagram(params: AiServiceRequestParams): Promise<DiagramResult> {
  const focus = context.currentFocus;
  const comId = focus?.comId ?? focus?.pageId;
  if (!comId) throw new Error("当前没有可用的聚焦对象");
  const agent = context.agentMap.get(context.getAgentKey(comId));
  if (!agent) throw new Error("当前聚焦对象没有可用的 Agent");
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
        const model = params.model;
        const providerId = params.providerId ?? (typeof model === "object" ? model?.providerId : undefined);
        const modelId = params.modelId ?? (typeof model === "string" ? model : model?.modelId);
        await agent.requestAI(chipRegistry.formatRequestParams({
          message: `请先通过 use_skill 加载 understand-any 可视化解读技能，按照技能要求分析并生成图。\n\n${params.message}`,
          turnId,
          attachments: params.attachments ?? [],
          ...(params.meta ? { meta: params.meta } : {}),
          ...(providerId ? { providerId } : {}),
          ...(modelId ? { modelId } : {}),
        }));
        const turn = agent.getTurns().find((item: any) => item.id === turnId);
        if (!turn || turn.status !== "success") throw new Error(turn?.error || "可视化分析未完成");
        const content = [...turn.iterations].reverse().find((item: any) => typeof item.content === "string" && item.content.trim())?.content ?? "";
        const json = content.match(/```json\s*\r?\n([\s\S]*?)```/i)?.[1] ?? content.trim();
        let result: DiagramResult;
        try { result = JSON.parse(json); } catch { throw new Error("可视化分析结果不是有效的 JSON"); }
        if (!result || typeof result.title !== "string" || typeof result.desc !== "string" || typeof result.mermaid !== "string" || !result.mermaid.trim()) {
          throw new Error("可视化分析结果缺少标题、摘要或 Mermaid 代码");
        }
        resolve(result);
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
