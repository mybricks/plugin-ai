import { ToolExecutionContext } from "../../../../agent/src/agent";
import type { Tool } from "../../../../agent/src";
import type { Designer } from "../types";

/**
 * 创建 check-status 工具。
 * 通过 designerRef（延迟绑定）读取 designer 实例，
 * 使得工具可以在 designer 尚未初始化时注册，在运行时再拿最新值。
 */
export const CHECK_STATUS_TOOL_NAME = "check-status";

export function createCheckStatusTool(designerRef: { current: Designer | undefined }): Tool {
  return {
    name: CHECK_STATUS_TOOL_NAME,
    description: `查看实时项目状态，包含环境信息、运行情况、编译和校验情况等。
环境信息：设计态/运行态；
运行情况：渲染页面、弹窗情况、运行报错；
编译和校验情况：编译信息、eslint信息等；

常常用在本轮所有文件修改后，工作结束前，检查渲染情况以及文件校验情况。`,
    parameters: { type: "object", properties: {} },
    async execute(_params: any, toolContext: ToolExecutionContext) {

      toolContext.setAiRole('default')

      const designer = designerRef.current;
      if (!designer) {
        return { output: "（设计器状态不可用）" };
      }
      // 等待 1s，让渲染层完成本轮更新
      await new Promise((r) => setTimeout(r, 1000));
      const [designerStatus] = await Promise.all([
        designer.exportDesignerToMessage(),
      ]);
      return {
        output: designerStatus,
      };
    },
  };
}
