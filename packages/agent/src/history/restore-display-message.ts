/**
 * 把服务端会话里存储的"组装后用户消息"还原为展示格式。
 *
 * 背景:发送侧 ChipRegistry.formatRequestParams 会把带 chip 的消息组装为
 * `<user_query>正文(@label 引用)</user_query>` + 引用块(`<referenced-dom-nodes>` /
 * `<referenced-nodes>` / 文件内容尾巴)后再发给模型,服务端会话只保存组装结果。
 * 刷新页面从会话消息接口重建历史时,需反向还原出 `[[chip:id]]` 占位符与
 * meta.chips(仅 id/label,供 UI 渲染),才能与实时消息的 chip 展示保持一致。
 *
 * 还原策略:
 * 1. 提取 `<user_query>` 内部正文;无该标签视为普通消息,原样返回。
 * 2. 从 `<referenced-dom-nodes>` 块的 `- @label：` 条目精确收集 dom chip label
 *    (长 label 优先替换,避免前缀误伤)。
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
/** `<referenced-dom-nodes>` 块内条目行:`- @label：`(全角冒号结尾) */
const DOM_CHIP_LABEL_PATTERN = /^- @(.+?)[：:]\s*$/gm;
/** 行内 zone chip 引用:@ 前须为空白/行首,避免误伤 someone@example.com 等内联文本 */
const INLINE_CHIP_TOKEN_PATTERN = /(^|\s)@([A-Za-z_][A-Za-z0-9_.-]{0,63})/g;

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
  const replaceToken = (label: string) => {
    const token = `@${label}`;
    if (!body.includes(token)) return;
    const chip: RestoredDisplayChip = { id: `h${chips.length + 1}`, type: "restored", label };
    chips.push(chip);
    body = body.split(token).join(`[[chip:${chip.id}]]`);
  };

  // 1. 精确 label:来自 <referenced-dom-nodes> 块条目,长 label 优先替换
  const labels = new Set<string>();
  for (const block of text.matchAll(REFERENCED_DOM_NODES_PATTERN)) {
    for (const entry of block[1].matchAll(DOM_CHIP_LABEL_PATTERN)) {
      labels.add(entry[1]);
    }
  }
  Array.from(labels)
    .sort((a, b) => b.length - a.length)
    .forEach(replaceToken);

  // 2. 启发式 label:zone chip 引用(引用块不携带 label),按标识符形态识别
  body = body.replace(INLINE_CHIP_TOKEN_PATTERN, (_match, lead: string, label: string) => {
    const chip: RestoredDisplayChip = { id: `h${chips.length + 1}`, type: "restored", label };
    chips.push(chip);
    return `${lead}[[chip:${chip.id}]]`;
  });

  return chips.length > 0 ? { userText: body, chips } : { userText: body };
}
