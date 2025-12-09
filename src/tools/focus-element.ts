import { fileFormat } from '@mybricks/rxai'

interface FocusElementToolParams {
 
}

const NAME = 'focus-element'
focusElement.toolName = NAME

export default function focusElement(config: FocusElementToolParams, ): any {
  return {
    name: NAME,
    description: `通过id聚焦到任何可聚焦的页面 / 组件。
参数：页面ID或者组件ID；
作用：聚焦到某个可搭建的元素上，获取元素元信息，用于后续搭建；
返回值：聚焦元素的元信息，格式是包含id、type（component / page）、namespace（可能存在）字段的对象；
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