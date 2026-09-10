/**
 * 安全地序列化可能混入 UI 运行时数据的对象。
 *
 * DOM 节点在 React 环境中可能携带 Fiber 循环引用，且离开当前页面后无法复用；
 * 重复对象、函数和 Symbol 同样不属于 JSON 数据。导出历史与远程请求都应在
 * 边界使用此函数，避免一项临时 UI 数据导致整个操作失败。
 */
export function jsonStringifySafe(value: unknown): string {
  const seen = new WeakSet<object>();

  return JSON.stringify(value, (_key, item: unknown) => {
    if (typeof item === "bigint") return item.toString();
    if (typeof item === "function" || typeof item === "symbol" || item === undefined) return undefined;
    if (item === null || typeof item !== "object") return item;

    if (typeof Node !== "undefined" && item instanceof Node) return undefined;
    if (seen.has(item)) return undefined;

    seen.add(item);
    return item;
  });
}
