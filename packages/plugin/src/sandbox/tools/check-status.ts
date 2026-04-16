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
    description: `查看当前项目渲染情况，包含所处环境（设计态/运行态）、渲染页面和弹窗情况、报错信息（如果有）。
常常用在本轮所有代码修改后，本轮工作结束前，检查渲染情况是否正常。`,
    parameters: { type: "object", properties: {} },
    async execute(_params: any, toolContext: ToolExecutionContext) {

      toolContext.setAiRole('default')

      const designer = designerRef.current;
      if (!designer) {
        return { title: "查看当前状态", output: "（设计器状态不可用）" };
      }
      // 等待 1s，让渲染层完成本轮更新
      await new Promise((r) => setTimeout(r, 1000));
      const [designerStatus] = await Promise.all([
        designer.exportDesignerToMessage(),
      ]);
      return {
        title: "查看当前状态",
        output: designerStatus,
      };
    },
  };
}
