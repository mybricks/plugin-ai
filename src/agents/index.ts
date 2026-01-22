import { requestGenerateCanvasAgent } from './app'
import { requestCommonAgent } from './common'
import { getAgentInstance } from './utils/config'
import { context } from '../context'
import { AbstractAgent } from "./utils/config"

/**
 * 统一的 agent 请求入口
 * 根据 focus 类型自动选择使用自定义 agent 或默认的 requestCommonAgent
 */
export const requestAgent = (params: any) => {
  const type = context.currentFocus?.type;

  if (context.currentFocus?.vibeCoding) {
    const agent = context.agents!.find((agent) => agent instanceof AbstractAgent && agent.type === "vibeCoding");
    if (agent) {
      return (agent as AbstractAgent).request({
        key: `${context.pluginParams.key}_${context.currentFocus!.pageId}_${context.currentFocus!.comId}`,
        params,
        focus: { ...context.currentFocus }
      })
    }
  }

  // 检查是否有匹配的自定义 agent
  const customAgent = type ? getAgentInstance(context.agents, type) : null;

  if (customAgent) {
    // 如果找到匹配的自定义 agent，调用其 request 方法
    return customAgent.request(params);
  } else {
    // 否则使用默认的 requestCommonAgent
    return requestCommonAgent(params);
  }
}

export const Agents = {
  requestGenerateCanvasAgent,
  requestCommonAgent,
  requestAgent
}