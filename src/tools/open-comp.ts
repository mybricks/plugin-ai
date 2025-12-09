import { fileFormat } from '@mybricks/rxai'

interface ToolParams {
  onOpen?: (id: string) => void
}

const NAME = 'open-comp-document'
openComponentDoc.toolName = NAME

export default function openComponentDoc(config: ToolParams,): any {
  return {
    name: NAME,
    description: `选择并打开组件使用文档，用于后续完成需求使用。
「获取DSL」会将DSL涉及的组件文档添加进来；
「需求分析」会将可能涉及的组件文档添加进来；

工具仅适用于以下情况：
1. 添加一个组件使用文档没有的组件；
2. 重构修改组件时，使用了一个使用文档没有的组件；

组件使用文档的选取策略：
  1. 遵循最小够用原则
  2. 保证不重复；
`,
    getPrompts: () => {
      return `<工具总览>
你是一个可以获取组件配置文档的工具，你作为MyBricks低代码平台（以下简称MyBricks平台或MyBricks）的资深页面搭建助手。可以通过namespace
</工具总览>
 
<任务流程>
  根据用户需求，确定要获取上下文的元素ID以及提供选择理由，对于这个ID的选择：
  - 1. 需求明确提及了需要指定的组件，则选择指定元素；
  - 2. 需求未明确提及指定的组件，而是泛指一类组件，则选择这一类组件上层的元素，确保覆盖了这一类的所有组件；
  - 3. 需求未明确提及指定的组件，也没泛指，则选择聚焦的元素；
  额外需要注意的是：
  - type为 *page* 或 *com* ；
  - 注意：文件内容注意不要出现语法错误，文件声明要保持一致；

  按照以下格式返回所要获取上下文的元素：
  ${fileFormat({ content: '{ "id": "u_23ver", "type": "com" }', fileName: '需要获取上下文的组件ID.json' })}
  选择理由：u_23ver是目标元素的父组件，能获取到更多有效信息。
</任务流程>`
    },
    // lastAppendMessage: '打开的文档有更新，请继续完成用户需求。',
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