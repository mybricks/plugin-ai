import { requestGenerateCanvasAgent } from './app'
import { requestCommonAgent } from './common'
import { requestCommonByCodingAgent } from './common-by-coding'
import { requestVibeCodingAgent } from './custom'
import { getAgentInstance } from './utils/config'
import { context } from '../context'

/** 内置 agent 类型：vibe | common-by-coding，不传或其它为 common */
export type BuiltinAgentType = 'vibe' | 'common' | 'common-by-coding'

/**
 * 统一的 agent 请求入口
 * @param type 内置类型，作为第一个参数：'vibe' | 'common-by-coding'，不传或 'common' 走默认 common
 * @param params 请求参数
 */
export const requestAgent = (type: BuiltinAgentType | undefined, params: any) => {
  const customType = context.currentFocus?.type

  // 1. 内置类型：vibe
  if (type === 'vibe') {
    return requestVibeCodingAgent(
      {
        ...params,
        key: `${context.pluginParams.key}_${context.currentFocus!.pageId}_${context.currentFocus!.comId}`,
      },
      { ...context.currentFocus }
    )
  }

  // 2. 内置类型：coding 流程测试版
  if (context.codingMode) {
    return requestCommonByCodingAgent(params)
  }

  // 3. 自定义类型命中（非内置时按 focus.type 找自定义 agent）
  const customAgent = customType ? getAgentInstance(context.agents, customType) : null
  if (customAgent) {
    return customAgent.request(params)
  }

  // 4. 默认：common，注入 guidePrompt
  const guidePrompt = context.pluginParams?.guidePrompt
  return requestCommonAgent(guidePrompt != null ? { ...params, guidePrompt } : params)
}

export const Agents = {
  requestGenerateCanvasAgent,
  requestAgent,
}
