export type { ActionDSL, CanonicalAction, LayoutParams } from "./types";
export { EXAMPLES } from "./examples";
export { dslArrJsonl } from "./dsl-arr-jsonl";
export { dslArrJsonlMinimal } from "./dsl-arr-jsonl-minimal";
export { isStyleValue, flatConfigsToArray } from "./style-detect";

import { dslArrJsonl } from "./dsl-arr-jsonl";
import { dslArrJsonlMinimal } from "./dsl-arr-jsonl-minimal";
import type { ActionDSL, CanonicalAction } from "./types";

/**
 * 注册所有可用 DSL。
 * 新增 DSL 时在此处添加，key 为 DSL 的 id。
 */
export const DSL_REGISTRY: Record<string, ActionDSL> = {
  [dslArrJsonl.id]: dslArrJsonl,
  [dslArrJsonlMinimal.id]: dslArrJsonlMinimal,
};

/**
 * 当前激活的 DSL。
 * 修改此处即可全局切换 prompt 示例格式和 LLM 输出解析方式。
 */
export const activeDSL: ActionDSL = dslArrJsonlMinimal;

export function canonicalToExecutionAction(action: CanonicalAction): { comId: string; target: string; type: string; params?: any } {
  const { type, comId, target } = action;
  if (type === "delete") return { comId, target, type };
  if (type === "setLayout") {
    const { type: _, comId: _c, target: _t, ...params } = action as any;
    return { comId, target, type, params };
  }
  if (type === "doConfig") {
    const { type: _, comId: _c, target: _t, ...params } = action as any;
    return { comId, target, type, params };
  }
  if (type === "addChild") {
    const { type: _, comId: _c, target: _t, cfg, sty, newComId, ...rest } = action as any;
    const configs: any[] = [];
    if (cfg) {
      for (const [path, value] of Object.entries(cfg)) configs.push({ path, value });
    }
    if (sty) {
      for (const [path, style] of Object.entries(sty as Record<string, any>)) configs.push({ path, style });
    }
    return { comId, target, type, params: configs.length ? { ...rest, comId: newComId, configs } : { ...rest, comId: newComId } };
  }
  return { comId, target, type };
}
