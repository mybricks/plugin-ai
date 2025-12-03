import { context } from './../context';
import { MYBRICKS_TOOLS, getPageHierarchy } from "./../tools"


export const requestCommonAgent = (params: any) => {

  return new Promise((resolve, reject) => {
    const prompts = context.prompts;

    if (!context.currentFocus) {
      window?.antd?.message?.warn?.('当前暂不支持全局使用AI，请聚焦到页面或者组件上')
      return reject('当前暂不支持全局使用AI，请聚焦到页面或者组件上')
    }

    const targetType = context.currentFocus?.type
    const targetId = targetType === 'uiCom' ? context.currentFocus?.comId : context.currentFocus?.pageId
    

    params?.onProgress?.('start')

    context.rxai.requestAI({
      ...params,
      message: params?.message,
      key: targetId,
      // enableLog: true,
      emits: {
        write: () => { },
        complete: () => {
          resolve('complete')
          params?.onProgress?.("complete");
        },
        error: () => {
          reject('error')
          params?.onProgress?.("error");
        },
        cancel: () => {},
      },
      tools: [
        MYBRICKS_TOOLS.GetComponentsDocAndPrd({
          allowComponents: context.api?.global?.api?.getAllComDefPrompts?.(),
          examples: prompts.prdExamplesPrompts,
          canvasWidth: prompts.canvasWidth,
          queryComponentsDocsByNamespaces: (namespaces) => {
            return namespaces.reduce((acc, cur) => {
              return acc + '\n' + context.api?.uiCom?.api?.getComEditorPrompts?.(cur.namespace)
            }, '')
          }
        }),
        MYBRICKS_TOOLS.GeneratePage({
          getFocusRootComponentDoc: () => context.api?.page?.api?.getPageContainerPrompts?.(targetId) as string,
          getTargetId: () => targetId as string,
          appendPrompt: prompts.systemAppendPrompts,
          examples: prompts.generatePageActionExamplesPrompts,
          onActions: (actions, status) => {
            context.api?.page?.api?.updatePage?.(targetId, actions, status)
          },
          onClearPage: () => {
            context.api?.page?.api?.clearPageContent?.(targetId)
          }
        }),
        MYBRICKS_TOOLS.GetComponentsInfoByIds({
          id: targetId as string,
          getPageJson(id) {
            return context.api?.page?.api?.getOutlineInfo(id)
          },
          getComInfo(namespace) {
            return context.api?.uiCom?.api?.getComEditorPrompts?.(namespace)
          },
          getComJson(id) {
            return context.api?.uiCom?.api?.getOutlineInfo(id)
          },
          getFocusElementHasChildren() {
            if (context.currentFocus?.type !== 'page') {
              const json = context.api?.uiCom?.api?.getOutlineInfo(targetId)
              if (!json.slots || (Array.isArray(json.slots) && json.slots.length === 0)) {
                return false
              }
            }
            return true
          }
        }),
        MYBRICKS_TOOLS.RefactorComponent({
          onActions: (actions, status) => {
            if (targetType === "page") {
              context.api?.page?.api?.updatePage?.(targetId, actions, status)
            } else if (targetType === 'uiCom') {
              context.api?.uiCom?.api?.updateCom?.(targetId, actions, status)
            } else {
              console.warn('doActions，没有合适的目标')
            }
          },
          getFocusElementHasChildren() {
            if (context.currentFocus?.type !== 'page') {
              const json = context.api?.uiCom?.api?.getOutlineInfo(targetId)
              if (!json.slots || (Array.isArray(json.slots) && json.slots.length === 0)) {
                return false
              }
            }
            return true
          }
        })
      ],
      presetHistoryMessages: [
        {
          role: 'assistant',
          content: generateFocusDescription(context.currentFocus)
        }
      ],
      presetMessages: [
        {
          role: 'assistant',
          content: `<当前聚焦元素上下文>
  ${generateFocusDescription(context.currentFocus)}
  <页面结构简述>
  以下是当前所属的页面结构简述，包含父子关系、层级和顺序。
  如果后续需要获取更加详细的搭建信息（比如插槽、配置、样式、已折叠子组件等信息），请使用「获取组件配置」工具获取更多信息。

  ${getPageHierarchy(context)}

  > 如果缩进内容不为空，代表元素通过插槽放置有子组件，如果缩进内容为空，则代表此元素没有任何子组件；
  >【当前聚焦】标记表示用户当前选中的元素；
  >【子组件已折叠】标记表示该组件有子组件但被折叠未显示；
  </页面结构简述>
</当前聚焦元素上下文>
`
        }
      ]
    });
  })
}

function generateFocusDescription(currentFocus = {}) {
  const { pageId, comId, title, type } = currentFocus ?? {}
  
  // 定义聚焦元素的描述部分
  let focusDesc = '';
  
  // 判断当前聚焦元素类型
  if (type === 'uiCom') {
    focusDesc = `组件(title=${title},组件id=${comId})`;
  } else if (type === 'page') {
    focusDesc = `页面(title=${title},页面id=${pageId})`;
  } else if (type === 'section') {
    focusDesc = `页面(title=${title},页面id=${pageId})`;
  }
  
  return `当前已聚焦到${focusDesc}中，后续用户的提问，关于"这个"、"此"、"整体"，甚至不提主语，都是指代此元素及其子组件内容。`;
}