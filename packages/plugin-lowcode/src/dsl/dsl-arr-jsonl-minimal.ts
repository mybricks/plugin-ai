/**
 * DSL: arr-jsonl-minimal
 *
 * 在 arr-jsonl 基础上的压缩版本：
 * - configs 数组提升为第 5 个位置参数，展开为 flat object，style 用 $ 前缀区分
 * - action type 缩写：setLayout→layout, doConfig→cfg, addChild→add, delete→del
 * - addChild meta 字段缩写：title→t, comId(新组件)→cid
 * - 新组件 uuid 缩短为 3 位
 *
 * 格式：[comId, target, type, params, configs?]
 *
 * 示例输出：
 * ["_root_", ":root", "layout", {"width": 1024, "height": 800}]
 * ["_root_", ":root", "cfg", {"path": "root/布局", "value": {"display": "flex"}}]
 * ["_root_", ":root", "cfg", {"path": "root/样式", "style": {"background": "#fff"}}]
 * ["_root_", "_rootSlot_", "add", {"t": "布局", "ns": "vibe.layout", "cid": "nb5"}, {"方向": "row", "$banner样式": {"background": "red"}}]
 * ["o21", ":root", "del"]
 */
import { jsonrepair } from "jsonrepair";
import type { ActionDSL, CanonicalAction } from "./types";
import { EXAMPLES } from "./examples";
import { isStyleValue } from "./style-detect";

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

function canonicalToWire(action: CanonicalAction): any[] {
  const wt = CANONICAL_TO_WIRE_TYPE[action.type] ?? action.type;

  if (action.type === "delete") {
    return [action.comId, action.target, wt];
  }
  if (action.type === "setLayout") {
    const { type, comId, target, ...params } = action;
    return [comId, target, wt, params];
  }
  if (action.type === "doConfig") {
    const { type, comId, target, ...params } = action;
    return [comId, target, wt, params];
  }
  if (action.type === "addChild") {
    const { type, comId: _comId, target, cfg, sty, newComId, title, ...rest } = action as any;
    const meta: Record<string, any> = { t: title, ...rest, cid: newComId };

    const hasConfigs = (cfg && Object.keys(cfg).length) || (sty && Object.keys(sty).length);
    if (!hasConfigs) return [action.comId, target, wt, meta];

    const configs: Record<string, any> = {};
    if (cfg) {
      for (const [path, value] of Object.entries(cfg)) configs[path] = value;
    }
    if (sty) {
      for (const [path, style] of Object.entries(sty as Record<string, any>)) configs[path] = style;
    }
    return [action.comId, target, wt, meta, configs];
  }
  return [action.comId, (action as any).target, wt];
}

function serializeAction(action: CanonicalAction): string {
  return JSON.stringify(canonicalToWire(action));
}

function parseJsonValue(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return JSON.parse(jsonrepair(value));
  }
}

/**
 * 模型偶尔会省略 add action 的第 5 个 configs 参数，并将配置直接平铺进
 * 第 4 个 meta 参数。解析时将约定的组件元信息取出，其余字段按 configs
 * 处理，兼容这种紧凑但非标准的输出。
 */
function splitAddParams(params: any, configs: any): {
  newComId?: string;
  title?: string;
  meta: Record<string, any>;
  configs: Record<string, any>;
} {
  const {
    cid: newComId,
    t: title,
    ns,
    layout,
    ignore,
    enhance,
    ...inlineConfigs
  } = params ?? {};

  const meta = {
    ...(ns !== undefined ? { ns } : {}),
    ...(layout !== undefined ? { layout } : {}),
    ...(ignore !== undefined ? { ignore } : {}),
    ...(enhance !== undefined ? { enhance } : {}),
  };

  // 标准格式优先使用第 5 个位置参数；只有它缺失时才将 params 中多出的字段
  // 当作配置，避免改变已有扩展 meta 字段的语义。
  const resolvedConfigs = configs && typeof configs === "object" && !Array.isArray(configs)
    ? configs
    : inlineConfigs;

  return { newComId, title, meta, configs: resolvedConfigs };
}

function wireToCanonical(raw: any): CanonicalAction {
  if (!Array.isArray(raw)) return raw as unknown as CanonicalAction;

  const [comId, target, wireType, params, configs] = raw;
  const type = WIRE_TO_CANONICAL_TYPE[wireType] ?? wireType;

  if (type === "delete") return { type: "delete", comId, target };
  if (type === "setLayout") return { type: "setLayout", comId, target, ...params };
  if (type === "doConfig") return { type: "doConfig", comId, target, ...params };

  if (type === "addChild") {
    const { newComId, title, meta, configs: addConfigs } = splitAddParams(params, configs);
    const cfg: Record<string, any> = {};
    const sty: Record<string, Record<string, any>> = {};

    if (addConfigs) {
      for (const [key, val] of Object.entries(addConfigs)) {
        if (isStyleValue(key, val)) {
          sty[key] = val as Record<string, any>;
        } else {
          cfg[key] = val;
        }
      }
    }

    return {
      type: "addChild",
      comId,
      target,
      newComId,
      title,
      ...meta,
      ...(Object.keys(cfg).length ? { cfg } : {}),
      ...(Object.keys(sty).length ? { sty } : {}),
    };
  }

  return raw as unknown as CanonicalAction;
}

function extractActionsContent(content: string): string {
  const blocks = Array.from(content.matchAll(/```(?:actions\.json|json)?\s*\n([\s\S]*?)```/g));
  if (!blocks.length) return content;
  return blocks[blocks.length - 1]?.[1] ?? content;
}

export const dslArrJsonlMinimal: ActionDSL = {
  id: "arr-jsonl-minimal",
  fileTag: "actions.json",

  formatDescription: `每个 action 是一个 JSON 数组，结构为 [comId, target, type, params, configs?]：
    - comId：要操作的目标组件 id
    - target：组件整体或某个部分的选择器；当 type=add 时，target 为插槽 id
    - type：动作类型缩写，包括 layout（setLayout）、cfg（doConfig）、add（addChild）、del（delete）
    - params：对应 type 的参数对象（del 无 params）
    - configs（仅 add）：组件属性配置，flat object，key 为配置路径，value 为配置值`,

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
      - 格式为 [comId, target, "add", meta, configs?]，其中：
        - meta 包含组件元信息，格式如下：

      \`\`\`typescript
      type add_meta = {
        t: string // 被添加组件的标题
        ns: string // 在 <允许添加的组件 /> 中声明的UI组件namespace
        cid: string // 新添加的组件3位uuid，禁止重复，在所有UI组件中唯一
        layout?: setLayout_flex_params | setLayout_fixed_params | setLayout_absolute_params // 可选，添加组件时可以指定位置和尺寸信息
        ignore?: boolean // 可选，是否添加ignore标记
        enhance?: boolean // 可选，是否添加enhance标记
      }
      \`\`\`

        - configs（可选）是第5个位置参数，flat object，key 为配置路径，value 为配置值

      \`\`\`typescript
      type add_configs = {
        [path: string]: any
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
