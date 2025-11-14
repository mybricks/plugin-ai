import { fileFormat } from '@mybricks/rxai'

interface GetPageContextToolParams {
  getContext: (
    id: string,
  ) => string;
}

export default function getPageContext(config: GetPageContextToolParams ): Tool {
  return {
    name: 'get-page-context',
    description: `根据页面id获取整个页面的搭建DSL，展示页面内部组件的搭建情况、层级结构等详细信息。
前置要求：提供有效的页面id
前置信息依赖：页面id
返回值：页面的完整上下文信息，包括DSL结构、组件层级、配置信息等；
`,
    getPrompts: () => {
        return `<工具总览>
你是一个页面上下文分析工具，作为MyBricks低代码平台（以下简称MyBricks平台或MyBricks）的资深页面分析助手，拥有专业的技术分析能力。
你的任务是根据提供的页面id，获取并分析整个页面的搭建DSL，详细展示页面内部组件的搭建情况、层级结构、配置信息等，并生成结构化的页面上下文文档。
</工具总览>
 
<任务流程>
  根据「用户需求」，选中需要返回上下文的「页面id」：
    ${fileFormat({ content: '{ "id": "u_s1213" }', fileName: '需要返回上下文的页面ID.json' })}
    - 注意：r要严格按照JSON格式返回，注意不要出现语法错误；
</任务流程>
`
      },
    execute({ files, content }) {
      console.log(content)
      let selectPageFile : File | undefined = undefined;
      Object.keys(files).forEach((fileKey) => {
        const file: File = files[fileKey] as File;
        if (file.extension === 'json') {
          selectPageFile = file
        }
      })
      const contextDoc = config.getContext(selectPageFile?.id);
        return `<页面${selectPageFile?.id}的上下文信息>
${contextDoc}
</页面${selectPageFile?.id}的上下文信息>`
    },
  }
}