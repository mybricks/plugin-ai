// 统一出口，re-export packages/plugin 的所有公开 API
export { default } from "./packages/plugin/src/index";
export * from "./packages/plugin/src/index";

// re-export packages/agent
export * from "./packages/agent/src/index";

// re-export packages/request
export * from "./packages/request/src/index";

/**
 * @deprecated 兼容
 */
export function fileFormat () {};