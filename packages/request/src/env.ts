/**
 * 应用环境常量
 * APP_ENV 由 rollup replace 插件构建时注入
 */
export type AppEnv = "development" | "production";

const __APP_ENV__: AppEnv =
  typeof APP_ENV !== "undefined" ? APP_ENV : "development";

export const isProduction = (): boolean => false;
export const isDevelopment = (): boolean => __APP_ENV__ === "development";
