const REACT_ELEMENT_TYPES = new Set([
  Symbol.for("react.element"),
  Symbol.for("react.transitional.element"),
  Symbol.for("react.portal"),
]);
const INVALID = Symbol("invalid IndexedDB value");

/** Remove values that IndexedDB cannot clone, without changing the original data. */
export function sanitizeForIndexedDB(value: unknown): unknown {
  const seen = new WeakMap<object, object>();

  function discard(path: string, input: unknown): typeof INVALID {
    console.warn("[showcase] 过滤无法保存的数据", path, input);
    return INVALID;
  }

  function visit(input: unknown, path: string): unknown | typeof INVALID {
    if (typeof input === "function" || typeof input === "symbol") return discard(path, input);
    if (!input || typeof input !== "object") return input;
    if (REACT_ELEMENT_TYPES.has((input as { $$typeof?: symbol }).$$typeof as symbol)) return discard(path, input);
    if (typeof Node !== "undefined" && input instanceof Node) return discard(path, input);
    if (typeof SharedArrayBuffer !== "undefined" && (input instanceof SharedArrayBuffer || (ArrayBuffer.isView(input) && input.buffer instanceof SharedArrayBuffer))) return discard(path, input);

    const existing = seen.get(input);
    if (existing) return existing;

    if (Array.isArray(input)) {
      const result = new Array(input.length);
      seen.set(input, result);
      input.forEach((item, index) => {
        const filtered = visit(item, `${path}[${index}]`);
        result[index] = filtered === INVALID ? null : filtered;
      });
      return result;
    }

    if (input instanceof Map) {
      const result = new Map();
      seen.set(input, result);
      let index = 0;
      input.forEach((item, key) => {
        const filteredKey = visit(key, `${path}.<map-key:${index}>`);
        const filteredValue = visit(item, `${path}.<map-value:${index}>`);
        if (filteredKey !== INVALID && filteredValue !== INVALID) result.set(filteredKey, filteredValue);
        index++;
      });
      return result;
    }

    if (input instanceof Set) {
      const result = new Set();
      seen.set(input, result);
      let index = 0;
      input.forEach((item) => {
        const filtered = visit(item, `${path}.<set:${index++}>`);
        if (filtered !== INVALID) result.add(filtered);
      });
      return result;
    }

    if (Object.prototype.toString.call(input) !== "[object Object]") {
      try {
        structuredClone(input);
        return input;
      } catch {
        return discard(path, input);
      }
    }

    const result: Record<string, unknown> = Object.create(Object.getPrototypeOf(input) === null ? null : Object.prototype);
    seen.set(input, result);
    for (const key of Reflect.ownKeys(input)) {
      if (!Object.prototype.propertyIsEnumerable.call(input, key)) continue;
      if (typeof key === "symbol") {
        discard(`${path}[${String(key)}]`, (input as Record<symbol, unknown>)[key]);
        continue;
      }
      const filtered = visit((input as Record<string, unknown>)[key], `${path}[${JSON.stringify(key)}]`);
      if (filtered !== INVALID) {
        Object.defineProperty(result, key, { value: filtered, enumerable: true, writable: true, configurable: true });
      }
    }
    return result;
  }

  const result = visit(value, "$dump");
  return result === INVALID ? undefined : result;
}
