import { fileFormat } from '@mybricks/rxai'

interface ToolParams {
  onOpen?: (id: string) => void
}

export default function openDsl(config: ToolParams, ): any {
  return {
    name: 'open-dsl-document',
    displayName: "读取上下文",
    description: `打开并获取工作空间中需求所关联的DSL文档，用于后续完成需求使用。
参数(ids)：页面ID/组件ID列表，支持批量，批量ID用英文逗号分隔；

DSL文档的选取策略：
  1. 遵循最小够用原则
    - 比如需求是简单地修改单个组件时，获取组件的上层DSL即可；
    - 比如需求是参考A组件修改B，则获取组件A和B的上层DSL；
  2. 保证不重复，组件是在页面中的，如果我们已经获取了页面DSL，里面的组件不需要获取；

注意：被打开的文件仅限本轮使用，如需使用历史对话中打开的，需要重新打开。
IMPORTANT: 任何工具调用前都必须调用。
`,
    lastAppendMessage: '打开的文档有更新，请继续完成用户需求。',
    execute({ params }) {
      const ids = params.ids
      if (ids && ids.split(',')) {
        ids.split(',').forEach(id => {
          config.onOpen?.(id)
        })
      }
      return '调用完成'
    },
  }
}