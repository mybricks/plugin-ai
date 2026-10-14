/** 与线上 mybricks-config 对齐的公开运行时配置。 */
export const mybricksConfig = {
  aiComLib: {
    url: import.meta.env.VITE_MYBRICKS_AI_COMLIB_URL
  },
  designer: {
    version: import.meta.env.VITE_MYBRICKS_DESIGNER_VERSION
  }
} as const;
