import type { Tool } from "../../../agent/src";
import { createLowCodeClearPageTool } from "./clear-page";
import { createLowCodeGrepTool } from "./grep";
import { createLowCodeReadTool } from "./read";
import { createLowCodeGeneratePageTool } from "./update-page";
import type { LowCodeToolOptions } from "./types";

/** 只组合各工具目录中的定义；不在此处声明具体工具。 */
export function createLowCodeTools(options: LowCodeToolOptions): Tool[] {
  const { runtime } = options;
  return [
    createLowCodeGrepTool(runtime),
    createLowCodeReadTool(runtime),
    createLowCodeGeneratePageTool(options),
    createLowCodeClearPageTool(runtime),
  ];
}

export * from "./constants";
export * from "./types";
export { createLowCodeClearPageTool } from "./clear-page";
export { createLowCodeComponentDocTool } from "./component-doc";
export { createLowCodeGeneratePageTool } from "./update-page";
export { createLowCodeGrepTool } from "./grep";
export { createLowCodeReadTool } from "./read";
