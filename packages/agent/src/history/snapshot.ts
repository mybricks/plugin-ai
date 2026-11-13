/** Serialize persisted history without retaining browser-only objects or cycles. */
export function historySnapshot<T>(value: T): T {
  const ancestors: object[] = [];
  const json = JSON.stringify(value, function (_key, item: unknown) {
    if (typeof item === "bigint") return item.toString();
    if (typeof item === "function" || typeof item === "symbol") return undefined;
    if (!item || typeof item !== "object") return item;

    const candidate = item as { nodeType?: unknown; ownerDocument?: Document | null; defaultView?: Window | null; $$typeof?: symbol };
    const view = candidate.ownerDocument?.defaultView ?? candidate.defaultView;
    const nodeType = (view as (Window & typeof globalThis) | null | undefined)?.Node;
    if ((typeof Node !== "undefined" && item instanceof Node) || (typeof nodeType === "function" && item instanceof nodeType)) return undefined;
    if (candidate.$$typeof === Symbol.for("react.element") || candidate.$$typeof === Symbol.for("react.transitional.element") || candidate.$$typeof === Symbol.for("react.portal")) return undefined;

    while (ancestors.length && ancestors[ancestors.length - 1] !== this) ancestors.pop();
    if (ancestors.includes(item)) return undefined;
    ancestors.push(item);
    return item;
  });
  if (json === undefined) throw new TypeError("History value cannot be serialized");
  return JSON.parse(json) as T;
}

/** Prefer structured clones for non-JSON History implementations; fall back for UI values. */
export function cloneHistoryValue<T>(value: T): T {
  try { return structuredClone(value); }
  catch { return historySnapshot(value); }
}
