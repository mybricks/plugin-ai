/**
 * 向后兼容导出：从 shared.tsx 重新导出所有共享组件和工具函数。
 * 新代码请直接从 ./shared 或 ./built-ins/* 引用。
 */
export type { ToolRecord } from "./index";
export {
  DefaultToolRenderer,
  StatusIcon,
  Duration,
  Label,
  CodeCard,
  PendingCodeCard,
  StreamingCodeCard,
  BatchItem,
  BatchGroup,
  DiffView,
  computeDiff,
  basename,
  shortPath,
  detectLang,
} from "./shared";
