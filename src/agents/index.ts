import { requestGenerateCanvasAgent } from './app'
import { requestCommonAgent } from './common'
import { requestVibeCodingAgent } from './custom'
import { getAgentInstance } from './utils/config'
import { context } from '../context'

/**
 * 统一的 agent 请求入口
 * 根据 focus 类型自动选择使用自定义 agent 或默认的 requestCommonAgent
 */
export const requestAgent = (params: any) => {
  const type = context.currentFocus?.type;

  if (params?.vibeCoding) {
    return requestVibeCodingAgent({
      ...params,
      key: `${context.pluginParams.key}_${context.currentFocus!.pageId}_${context.currentFocus!.comId}`,
    }, {...context.currentFocus});
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