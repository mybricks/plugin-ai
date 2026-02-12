/**
 * 应用环境常量
 *
 * - 构建时：rollup replace 会把全局 APP_ENV 替换成字面量（见 rollup.config.mjs）
 * - 直接引用源码时：全局未定义，此处用 typeof 兜底，默认为 development
 *
 * 使用方式：
 * - 业务代码统一从本文件 import，不要直接使用全局 APP_ENV
 * - 构建：npm run build（production）| npm run build:dev（development）
 */

export type AppEnv = "development" | "production";

const __APP_ENV__: AppEnv =
  typeof APP_ENV !== "undefined" ? APP_ENV : "development";

export const isProduction = (): boolean => __APP_ENV__ === "production";
export const isDevelopment = (): boolean => __APP_ENV__ === "development";
