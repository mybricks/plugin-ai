import { context } from './../context';
import { MYBRICKS_TOOLS, MyBricksHelper } from "./../tools"


export const requestCommonAgent = (params: any) => {

  return new Promise((resolve, reject) => {
    const prompts = context.prompts;

    const targetId = context.currentFocus?.type === 'uiCom' ? context.currentFocus?.comId : context.currentFocus?.pageId

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
        // MYBRICKS_TOOLS.GetMybricksDSL({
        //   getContext: (id, type) => {
        //     if (type === 'page') {
        //       return api?.page?.api?.getPageDSLPrompts?.(id)?.toDSL?.()?.replaceAll(`slots.${id}`, 'canvas') as string
        //     }
        //     return api?.uiCom?.api?.getComDSLPrompts?.(id) as string
        //   },
        // }),
        MYBRICKS_TOOLS.GetFocusMybricksDSL({
          id: targetId as string,
          getFocusContext() {
            if (context.currentFocus?.type === 'page') {
              return context.api?.page?.api?.getPageDSLPrompts?.(targetId)?.toDSL?.()?.replaceAll(`slots.${targetId}`, 'canvas') as string
            }
            return context.api?.uiCom?.api?.getComDSLPrompts?.(targetId) as string
          },
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
        // MYBRICKS_TOOLS.GetComponentInfo({
        //   getComInfo(id) {
        //     return context.api?.uiCom?.api?.getComPrompts?.(id)?.replace(/当前组件的情况/g, `组件${id}的信息`) as string
        //   },
        // }),
        // MYBRICKS_TOOLS.ModifyComponent({
        //   onActions: (id, actions) => {
        //     context.api?.uiCom?.api?.updateCom?.(id, actions)
        //   }
        // }),
        MYBRICKS_TOOLS.RefactorComponent({
          onActions: (actions, status) => {
            context.api?.uiCom?.api?.updateCom?.(targetId, actions, status)
          }
        })
      ],
      presetMessages: [
        {
          role: 'user',
          content: `检测到聚焦位置发生变化`
        },
        {
          role: 'assistant',
          content: `当前已聚焦到${context.currentFocus?.type === 'uiCom' ? `组件(id=${context.currentFocus?.comId})` : `页面(title=${context.currentFocus?.title},id=${context.currentFocus?.pageId})`}中，后续用户的提问，关于”这个“、“此”、“整体”，甚至不提主语，都是指代此元素及其子组件内容。
    <当前聚焦元素的内容简介>
    ${MyBricksHelper.getTreeDescriptionByJson(context.currentFocus?.type === 'uiCom' ? context.api?.uiCom?.api?.getOutlineInfo(context.currentFocus?.comId) : context.api?.page?.api?.getOutlineInfo(context.currentFocus?.pageId))}
    
      > 如果内容不为空，代表组件通过插槽放置有子组件，如果内容为空，则代表此组件没有任何子组件。
    </当前聚焦元素的内容简介>
                    `
        }
      ]
    });
  })

}