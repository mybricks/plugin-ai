import { fileFormat } from '@mybricks/rxai'
import { getFiles } from './utils'

interface GetComponentInfoParams {
  getComInfo: (id: string) => string
}

export default function getComponentsInfoByIds(config: GetComponentInfoParams, ): any {
  return {
    name: 'get-components-info-by-ids',
    displayName: "获取组件配置文档",
    description: `通过现有的组件ID获取当前组件的配置文档和当前组件搭建配置。
参数：组件ID；
作用：获取组件的配置文档和当前搭建信息，用于后续修改组件；
返回值：相关组件的配置文档和搭建配置；
`,
    getPrompts: () => {
        return `<工具总览>
你是一个可以获取组件配置文档和搭建信息工具，你作为MyBricks低代码平台（以下简称MyBricks平台或MyBricks）的资深页面搭建助手，可以选中组件的ID，返回组件的各类上下文。
</工具总览>
 
<任务流程>
  按照以下格式返回所要获取上下文的所有组件：
    ${fileFormat({ content: '[{ "id": "u_23ver" }, { "id": "u_9sdi2" }]', fileName: '需要获取上下文的组件ID列表.json' })}
    - 注意：文件内容注意不要出现语法错误，文件声明要保持一致；
</任务流程>`
      },
    lastAppendMessage: '已提供组件文档和搭建配置，请继续。',
    execute({ files, content }) {
      const idsFile = getFiles(files, { extName: 'json' });
      let ids = [];
      try {
        ids = JSON.parse(idsFile?.content);
      } catch (error) {}

      const docs = ids.reduce((acc, cur) => {
        return acc + '\n' + config.getComInfo(cur.id)
      }, '')

      return `<组件配置文档和搭建情况>
${docs}
</组件搭建文档和搭建情况>`
    },
  }
}