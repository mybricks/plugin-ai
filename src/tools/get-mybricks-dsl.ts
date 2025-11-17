import { fileFormat } from '@mybricks/rxai'

interface GetMybricksDslToolParams {
  getContext: (
    id: string,
  ) => string;
}

export default function getMybricksDsl(config: GetMybricksDslToolParams ): Tool {
  return {
    name: 'get-mybricks-dsl',
    description: `获取当前聚焦元素（页面/组件）的完整上下文信息，包括搭建的DSL结构、组件层级、配置信息等。
参数：有效的元素ID；
返回值：页面的完整上下文信息，包括搭建的DSL结构、组件id、层级、配置信息等；
`,
    getPrompts: () => {
        return `<工具总览>
你是一个上下文分析工具，作为MyBricks低代码平台（以下简称MyBricks平台或MyBricks）的资深页面分析助手，拥有专业的技术分析能力。
你的任务是根据提供的id，获取并分析整个元素的搭建DSL，详细展示页面内部组件的搭建情况、层级结构、配置信息等，并生成结构化的页面上下文文档。
</工具总览>
 
<任务流程>
  根据「用户需求」，选中需要返回上下文的「页面id」：
    ${fileFormat({ content: '{ "id": "u_s1213" }', fileName: '需要返回上下文的页面ID.json' })}
    - 注意：要严格按照JSON格式返回，注意不要出现语法错误；
</任务流程>
`
      },
    execute({ files, content }) {
      let selectPageFile : File | undefined = undefined;
      Object.keys(files).forEach((fileKey) => {
        const file: File = files[fileKey] as File;
        if (file.extension === 'json') {
          selectPageFile = file
        }
      })
      const contextDoc = config.getContext(selectPageFile?.id);
        return `<元素${selectPageFile?.id}的上下文信息>
${contextDoc}
</元素${selectPageFile?.id}的上下文信息>`
    },
  }
}