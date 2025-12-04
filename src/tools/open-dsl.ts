import { fileFormat } from '@mybricks/rxai'

interface FocusElementToolParams {
 
}

export default function openDsl(config: FocusElementToolParams, ): any {
  return {
    name: 'open-dsl-document',
    description: `打开并获取工作空间中需求所关联的DSL文档，用于后续完成需求使用。
参数(ids)：页面ID/组件ID列表，支持批量，批量ID用英文逗号分隔；

DSL文档的选取策略：
  1. 遵循最小够用原则
    - 比如需求是简单地修改单个组件时，获取组件的上层DSL即可；
    - 比如需求是参考A组件修改B，则获取组件A和B的上层DSL；
  2. 保证不重复，组件是在页面中的，如果我们已经获取了页面DSL，里面的组件不需要获取；
`,
    getPrompts: () => {
        return `<工具总览>
你是一个可以聚焦页面/组件的工具，你作为MyBricks低代码平台（以下简称MyBricks平台或MyBricks）的资深页面搭建助手，可以根据需求聚焦元素用于下一步的搭建。
</工具总览>
 
<任务流程>
  按照以下格式返回所要聚焦的元素：
    ${fileFormat({ content: '{ "id": "u_1sd23" }', fileName: '聚焦元素ID.json' })}
    - 注意：文件要严格按照JSON格式返回，注意不要出现语法错误；
</任务流程>`
      },
    execute({ files, content }) {
      let selectFile: File | undefined = undefined;
      Object.keys(files).forEach((fileKey) => {
        const file: File = files[fileKey] as File;
        if (file.extension === 'json') {
          selectFile = file
        }

      })

      let selectFileId = {};
      try {
        selectFileId = JSON.parse(selectFile?.content);
      } catch (error) {}

      return `<当前选中元素情况>
ID: ${selectFileId.id}
类型：页面
</当前选中元素情况>`
    },
  }
}