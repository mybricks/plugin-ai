import { fileFormat, RetryError } from '@mybricks/rxai'

interface ToolParams {
  onOpen?: (id: string) => void
}

const NAME = 'open-dsl-document'
openDsl.toolName = NAME

export default function openDsl(config: ToolParams, ): any {
  return {
    name: NAME,
    displayName: "读取上下文",
    description: `打开并获取工作空间中需求所关联的DSL文档（包含当前页面/组件DSL及其所有子组件DSL），用于后续完成需求使用。
参数(ids)：页面ID/组件ID列表，支持批量，批量ID用英文逗号分隔；

何时使用：任何时候和搭建有关的提问，都应该先获取DSL文档看看，有可能需要参考页面级DSL（比如页面DSL）来理解当前需求。

聚焦信息里给出了简略的文档信息，如果没发现建议搜索更上层的范围去查找。

**DSL 文档选取策略：**
1. 优先获取最近共同祖先 DSL（关键原则）：由于包含所有子组件DSL，所以获取共同祖先是最简单的方式，比如
 1.1 需求是“参考组件 A 修改组件 B”，则应获取 A 与 B 的最近共同祖先 DSL；
 1.2 当传入多个组件 ID 时，应优先查找并返回它们最近的最近共同祖先 DSL 文档；
2. 避免重复加载：若已加载某页面的完整 DSL，则无需再单独加载该页面内的组件 DSL;
3. 完整包含：要修改的目标可能不在聚焦的组件内，也需要获取其DSL;

**重要说明：**  
- 避免过度加载无关层级或冗余内容。
- 所有通过本操作打开的 DSL 文件仅在当前轮次有效。  
- 若需使用历史对话中曾打开过的文件，必须在本轮重新调用打开操作。  

> ⚠️ 注意：在调用任何工具前，必须先执行本指令以确保获取正确的上下文 DSL。
`,
    execute({ params }) {
      let ids = params.ids

      // 兼容key使用错误的情况
      if (!ids && Object.keys(params).length) {
        ids = params[Object.keys(params)[0]]
      }

      if (ids && ids.split(',')) {
        const idsAry = ids.split(',')

        if (idsAry.length === 0) {
          throw new RetryError('未获取到有效信息')
        }

        idsAry.forEach(id => {
          try {
            config.onOpen?.(id)
          } catch (error) {
            console.warn(error)
            throw new RetryError(`获取${id}的信息失败，${error?.message}`)
          }
        })
      } else {
        throw new RetryError('获取信息失败')
      }
      return '已打开'
    },
  }
}