/**
 * DSL: arr-jsonl
 *
 * LLM 输出格式：每行一个 JSON 数组，结构为 [comId, target, type, params]
 * 代码块标签：actions.json
 *
 * 示例输出：
 * ["_root_", ":root", "layout", {"width": 1024, "height": 800}]
 * ["_root_", ":root", "cfg", {"path": "root/布局", "value": {"display": "flex", "flexDirection": "column"}}]
 * ["_root_", ":root", "cfg", {"path": "root/样式", "style": {"background": "#fff"}}]
 * ["_root_", "_rootSlot_", "add", {"t": "布局", "ns": "vibe.layout", "cid": "nb5", "configs": [{"path": "方向", "value": "row"}]}]
 * ["u_o21rs", ":root", "del"]
 */
import { jsonrepair } from "jsonrepair";
import type { ActionDSL, CanonicalAction } from "./types";
import { EXAMPLES } from "./examples";

const CANONICAL_TO_WIRE_TYPE: Record<string, string> = {
  setLayout: "layout",
  doConfig: "cfg",
  addChild: "add",
  delete: "del",
};

const WIRE_TO_CANONICAL_TYPE: Record<string, string> = {
  layout: "setLayout",
  cfg: "doConfig",
  add: "addChild",
  del: "delete",
};

function canonicalToWireParams(action: CanonicalAction): any {
  if (action.type === "setLayout") {
    const { type, comId, target, ...params } = action;
    return params;
  }
  if (action.type === "doConfig") {
    const { type, comId, target, ...params } = action;
    return params;
  }
  if (action.type === "delete") {
    return undefined;
  }
  if (action.type === "addChild") {
    const { type, comId: _comId, target, cfg, sty, newComId, title, ...rest } = action as any;
    const configs: any[] = [];

    if (cfg) {
      for (const [path, value] of Object.entries(cfg)) configs.push({ path, value });
    }
    if (sty) {
      for (const [path, style] of Object.entries(sty as Record<string, any>)) configs.push({ path, style });
    }

    return configs.length
      ? { t: title, ...rest, cid: newComId, configs }
      : { t: title, ...rest, cid: newComId };
  }
}

function serializeAction(action: CanonicalAction): string {
  const wt = CANONICAL_TO_WIRE_TYPE[action.type] ?? action.type;
  const params = canonicalToWireParams(action);
  const wire = params != null
    ? [action.comId, action.target, wt, params]
    : [action.comId, action.target, wt];
  return JSON.stringify(wire);
}

function parseJsonValue(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return JSON.parse(jsonrepair(value));
  }
}

function wireToCanonical(raw: any): CanonicalAction {
  if (Array.isArray(raw)) {
    const [comId, target, wireType, params] = raw;
    const type = WIRE_TO_CANONICAL_TYPE[wireType] ?? wireType;

    if (type === "delete") return { type: "delete", comId, target };
    if (type === "setLayout") return { type: "setLayout", comId, target, ...params };
    if (type === "doConfig") return { type: "doConfig", comId, target, ...params };
    if (type === "addChild") {
      const { configs, cid: newComId, t: title, ...rest } = params ?? {};
      const cfg: Record<string, any> = {};
      const sty: Record<string, Record<string, any>> = {};

      for (const entry of configs ?? []) {
        if ("style" in entry) {
          sty[entry.path] = entry.style;
        } else {
          cfg[entry.path] = entry.value;
        }
      }

      return {
        type: "addChild",
        comId,
        target,
        newComId,
        title,
        ...rest,
        ...(Object.keys(cfg).length ? { cfg } : {}),
        ...(Object.keys(sty).length ? { sty } : {}),
      };
    }
    return raw as unknown as CanonicalAction;
  }
  return raw as unknown as CanonicalAction;
}

function extractActionsContent(content: string): string {
  const blocks = Array.from(content.matchAll(/```(?:actions\.json|json)?\s*\n([\s\S]*?)```/g));
  if (!blocks.length) return content;
  return blocks[blocks.length - 1]?.[1] ?? content;
}

export const dslArrJsonl: ActionDSL = {
  id: "current",
  fileTag: "actions.json",

  formatDescription: `每个 action 是一个 JSON 数组，结构为 [comId, target, type, params]：
    - comId：要操作的目标组件 id
    - target：组件整体或某个部分的选择器；当 type=add 时，target 为插槽 id
    - type：动作类型缩写，包括 layout（setLayout）、cfg（doConfig）、add（addChild）、del（delete）
    - params：对应 type 的参数对象（del 无 params）`,

  serializeAction,

  serializeActions(actions) {
    return actions.map(serializeAction).join("\n");
  },

  exampleBlock(actions) {
    const body = actions.map(serializeAction).join("\n");
    return `\`\`\`actions.json\n${body}\n\`\`\``;
  },

  addChildDescription(ex) {
    return `<add>
      - add 代表向目标组件的插槽中添加内容，需要满足两个条件:
        1. 目标组件中目前有定义插槽，且已知插槽的id是什么；
        2. 被添加的组件只能使用 <允许添加的组件/> 中声明的*UI组件*；
      - params的格式以Typescript的形式说明如下：

      \`\`\`typescript
      type add_params = {
        t: string // 被添加组件的标题
        ns: string // 在 <允许添加的组件 /> 中声明的UI组件namespace
        cid: string // 新添加的组件3位uuid，禁止重复，在所有UI组件中唯一
        layout?: setLayout_flex_params | setLayout_fixed_params | setLayout_absolute_params // 可选，添加组件时可以指定位置和尺寸信息
        configs?: Array<configStyle_params | configProperty_params> // 添加组件可以配置的信息
        ignore?: boolean // 可选，是否添加ignore标记
        enhance?: boolean // 可选，是否添加enhance标记
      }
      \`\`\`

      例如：
      ${ex(EXAMPLES.addChildText)}

      ${ex(EXAMPLES.addChildWithConfig)}

      ${ex(EXAMPLES.addChildWithIgnore)}

      注意:
        - 新添加的组件 cid 必须使用3位唯一的字母数字组合，禁止重复，在所有UI组件中唯一；
        - 要充分考虑被添加的组件与其他组件之间的间距以及位置关系，确保添加的组件的美观度的同时、且不会与其他组件重叠或冲突；
    </add>`;
  },

  parseContent(content) {
    const raw = extractActionsContent(content).trim();
    if (!raw) return [];

    try {
      const parsed = parseJsonValue(raw);
      if (Array.isArray(parsed)) {
        const items = Array.isArray(parsed[0]) ? parsed : [parsed];
        return items.map(wireToCanonical);
      }
    } catch {}

    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => wireToCanonical(parseJsonValue(line)));
  },

  parseStreamingContent(content) {
    const fenceMatch = content.match(/```(?:actions\.json|json)?\s*\n/);
    if (!fenceMatch || fenceMatch.index === undefined) return [];

    const start = fenceMatch.index + fenceMatch[0].length;
    const rest = content.slice(start);
    const closeIndex = rest.indexOf("```");
    const text = closeIndex >= 0 ? rest.slice(0, closeIndex) : rest;
    const lines = text.split(/\r?\n/);
    const completeLines = closeIndex >= 0 ? lines : lines.slice(0, -1);

    const actions: CanonicalAction[] = [];
    for (const line of completeLines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) continue;
      try {
        actions.push(wireToCanonical(JSON.parse(trimmed)));
      } catch {}
    }
    return actions;
  },
};
