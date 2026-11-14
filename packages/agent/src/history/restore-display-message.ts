/**
 * 把服务端会话里存储的"组装后用户消息"还原为展示格式。
 *
 * 背景:发送侧 ChipRegistry.formatRequestParams 会把带 chip 的消息组装为
 * `<user_query>正文(@Dom节点N 引用)</user_query>` + 引用块(`<referenced-dom-nodes>` /
 * `<referenced-nodes>` / 文件内容尾巴)后再发给模型,服务端会话只保存组装结果。
 * 刷新页面从会话消息接口重建历史时,需反向还原出 `[[chip:id]]` 占位符与
 * meta.chips(仅 id/label,供 UI 渲染),才能与实时消息的 chip 展示保持一致。
 *
 * 还原策略:
 * 1. 提取 `<user_query>` 内部正文;无该标签视为普通消息,原样返回。
 * 2. 从 `<referenced-dom-nodes>` 块收集 dom chip 引用(长 label 优先替换,避免前缀误伤):
 *    - 本仓库格式:`- @label：` 条目 + `节点展示名` 行;
 *    - 宿主(设计器)格式:`Dom节点N: p class: ...` 条目,展示名取首行 class 列表中
 *      最具体的类名(如 `.a .b .brand` → brand),取不到时回退条目标签。
 * 3. 剩余 `@token`(zone chip 引用,其引用块不携带 label)按 ASCII 标识符形态
 *    启发式还原;仅影响展示样式,不影响语义。
 */

/** 还原出的展示 chip:仅供 UI 渲染占位符使用,无业务数据。 */
export interface RestoredDisplayChip {
  id: string;
  type: "restored";
  label: string;
}

export interface RestoredDisplayMessage {
  userText: string;
  chips?: RestoredDisplayChip[];
}

const USER_QUERY_PATTERN = /<user_query>\r?\n?([\s\S]*?)\r?\n?<\/user_query>/;
const REFERENCED_DOM_NODES_PATTERN = /<referenced-dom-nodes[^>]*>([\s\S]*?)<\/referenced-dom-nodes>/g;
/** 本仓库格式条目行:`- @label：`（冒号结尾，旧版）；v3.0 起首行冒号后可携带摘要文本（`- @label：taro-text-core class: ...`），label 取行内第一个冒号前的内容 */
const DOM_CHIP_LABEL_PATTERN = /^- @(.+?)[：:]/;
/** 条目内的展示名行:` - 节点展示名： brand` */
const DOM_CHIP_DISPLAY_NAME_PATTERN = /^\s*-\s*节点展示名[：:]\s*(.+?)\s*$/;
/** 宿主（设计器）格式条目行:`Dom节点1: p class: ...`(半角冒号 + 节点描述) */
const HOST_DOM_ENTRY_PATTERN = /^(Dom节点\d+)[：:]\s/;
/** 宿主条目首行的 class 列表:取最具体(最后一个)类名作为展示名,如 `.a .b .loginSubtitle` → loginSubtitle */
const HOST_ENTRY_CLASS_PATTERN = /class:\s*((?:\.[\w-]+\s*)+)/;
/** 行内 zone chip 引用:@ 前须为空白/行首,避免误伤 someone@example.com 等内联文本 */
const INLINE_CHIP_TOKEN_PATTERN = /(^|\s)@([A-Za-z_][A-Za-z0-9_.-]{0,63})/g;

/** `<referenced-dom-nodes>` 块内单个条目:行内 @引用标签 + 可选展示名。 */
interface DomChipEntry {
  label: string;
  displayName?: string;
}

/** 从宿主条目首行提取最具体的类名作为展示名;无 class 信息时返回 undefined。 */
function parseHostEntryDisplayName(line: string): string | undefined {
  const classMatch = line.match(HOST_ENTRY_CLASS_PATTERN);
  if (!classMatch) return undefined;
  const segments = classMatch[1].trim().split(/\s+/).filter(Boolean);
  const last = segments[segments.length - 1];
  return last ? last.replace(/^\./, "") : undefined;
}

function collectDomEntries(text: string): DomChipEntry[] {
  const entries: DomChipEntry[] = [];
  for (const block of text.matchAll(REFERENCED_DOM_NODES_PATTERN)) {
    let current: DomChipEntry | undefined;
    for (const line of block[1].split(/\r?\n/)) {
      const entryMatch = line.match(DOM_CHIP_LABEL_PATTERN);
      if (entryMatch) {
        current = { label: entryMatch[1] };
        entries.push(current);
        continue;
      }
      // 宿主格式条目:展示名从首行 class 列表推导(如 .a .b .brand → brand)。
      const hostMatch = line.match(HOST_DOM_ENTRY_PATTERN);
      if (hostMatch) {
        current = {
          label: hostMatch[1],
          ...(parseHostEntryDisplayName(line) ? { displayName: parseHostEntryDisplayName(line) } : {}),
        };
        entries.push(current);
        continue;
      }
      const nameMatch = line.match(DOM_CHIP_DISPLAY_NAME_PATTERN);
      // 仅归属其上方最近的条目;首行生效,后续重复行忽略。
      if (nameMatch && current && current.displayName === undefined) {
        current.displayName = nameMatch[1];
      }
    }
  }
  return entries;
}

export function restoreDisplayUserMessage(text: string): RestoredDisplayMessage {
  const queryMatch = text.match(USER_QUERY_PATTERN);
  if (!queryMatch) {
    return { userText: text };
  }

  let body = queryMatch[1].trim();
  if (!body) {
    return { userText: body };
  }

  const chips: RestoredDisplayChip[] = [];
  const replaceToken = (label: string, displayName?: string) => {
    const token = `@${label}`;
    if (!body.includes(token)) return;
    const chip: RestoredDisplayChip = { id: `h${chips.length + 1}`, type: "restored", label: displayName ?? label };
    chips.push(chip);
    body = body.split(token).join(`[[chip:${chip.id}]]`);
  };

  // 1. 精确 label:来自 <referenced-dom-nodes> 块条目,长 label 优先替换;
  //    展示文案取条目「节点展示名」行。
  collectDomEntries(text)
    .slice()
    .sort((a, b) => b.label.length - a.label.length)
    .forEach((entry) => replaceToken(entry.label, entry.displayName));

  // 2. 启发式 label:zone chip 引用(引用块不携带 label),按标识符形态识别
  body = body.replace(INLINE_CHIP_TOKEN_PATTERN, (_match, lead: string, label: string) => {
    const chip: RestoredDisplayChip = { id: `h${chips.length + 1}`, type: "restored", label };
    chips.push(chip);
    return `${lead}[[chip:${chip.id}]]`;
  });

  return chips.length > 0 ? { userText: body, chips } : { userText: body };
}
