import { fileFormat } from '@mybricks/rxai'
import { getFiles } from './utils'

interface GetMybricksDslToolParams {
  id: string
  getFocusContext: () => string;
}

export default function getMybricksDsl(config: GetMybricksDslToolParams): any {
  return {
    name: 'get-focus-mybricks-dsl-by-id',
    displayName: "获取当前搭建上下文",
    description: `获取聚焦（页面/组件）的完整当前搭建内容，特别是子组件内容，包括搭建的DSL、结构、组件层级、配置信息等。
返回值：聚焦元素的完整DSL结构，包括搭建的组件id、层级、配置信息等；

注意：信息不包含组件配置文档。
`,
    lastAppendMessage: '已提供上下文，请继续。',
    execute() {
      const contextDoc = config.getFocusContext();
      return `<元素${config.id}的上下文信息>
${contextDoc}
</元素${config.id}的上下文信息>`
    },
  }
}