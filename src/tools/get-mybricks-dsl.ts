import { fileFormat } from '@mybricks/rxai'
import { getFiles } from './utils'

interface GetMybricksDslToolParams {
  getContext: (
    id: string,
    type: 'com' | 'page'
  ) => string;
}

export default function getMybricksDsl(config: GetMybricksDslToolParams): Tool {
  return {
    name: 'get-mybricks-dsl-by-id',
    description: `根据ID获取（页面/组件）的完整上下文信息，包括搭建的DSL结构、组件层级、配置信息等。
参数：元素ID（页面ID或者组件ID）；
返回值：页面的完整上下文信息，包括搭建的DSL结构、组件id、层级、配置信息等；
`,
    getPrompts: () => {
      return `<工具总览>
你是一个上下文分析工具，作为MyBricks低代码平台（以下简称MyBricks平台或MyBricks）的资深页面分析助手，拥有专业的技术分析能力。
你的任务是选择需要获取上下文的「元素ID」，系统会自动根据ID返回页面的完整上下文信息。
</工具总览>
 
<任务流程>
  选中需要获取上下文的「元素ID」：
    ${fileFormat({ content: '{ "id": "u_s1213"， "type": "com" }', fileName: '选择的元素.json' })}
    - 注意：要严格按照此格式返回，注意不要出现语法错误；
</任务流程>

<关于返回值>
  只能按照「任务流程」设计，返回选择的「元素ID」和「类型」。
  注意：
  type：固定为 "com" 或 "page"，表示组件或页面；
</关于返回值>

<examples>
  <example>
    <user_query>解释一下组件u_s1213的搭建结构</user_query>
    <assistant_response>
    解释搭建结构，需要先获取组件u_s1213的搭建DSL，才能开始分析。
    ${fileFormat({ content: '{ "id": "u_s1213", "type": "com" }', fileName: '选择的元素.json' })}
    </assistant_response>
  </example>
  <example>
    <user_query>我聚焦的页面是有什么内容</user_query>
    <assistant_response>
    解释内容，需要先获取页面u_pju67的搭建DSL，才能开始分析。
    ${fileFormat({ content: '{ "id": "u_pju67", "type": "page" }', fileName: '选择的元素.json' })}
    </assistant_response>
  </example>
</examples>
`
    },
    execute({ files, content }) {
      const selectFile = getFiles(files, { extName: 'json' })

      let selectDom
      try {
        selectDom = JSON.parse(selectFile?.content)
      } catch (error) {}

      if (!selectDom?.id) {
        return '未获取到元素ID，请重新选择'
      }
   
      const contextDoc = config.getContext(selectDom?.id, selectDom?.type);
      return `<元素${selectDom?.id}的上下文信息>
${contextDoc}
</元素${selectDom?.id}的上下文信息>`
    },
  }
}