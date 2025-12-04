import { context } from './../context';
import { MYBRICKS_TOOLS, getPageHierarchy } from "./../tools"

import { WorkSpace } from './../tools/workspace'


export const requestCommonAgent = (params: any) => {

  return new Promise((resolve, reject) => {
    const prompts = context.prompts;

    const targetType = context.currentFocus?.type
    const targetId = targetType === 'uiCom' ? context.currentFocus?.comId : context.currentFocus?.pageId

    const getOutlineInfo = () => {
      if (targetType !== 'page') {
        return context.api?.uiCom?.api?.getOutlineInfo(targetId)
      } else {
        return context.api?.page?.api?.getOutlineInfo(targetId)
      }
    }

    console.log('context.currentFocus', context.currentFocus)

    const workspace = new WorkSpace({ currentFocus: context.currentFocus } as any, {
      getAllPageInfo() {
        return context.api.global.api.getAllPageInfo()
      },
      getOutlineInfo(id, type) {
        if (type !== 'page') {
          return context.api?.uiCom?.api?.getOutlineInfo(id)
        } else {
          return context.api?.page?.api?.getOutlineInfo(id)
        }
      },
      getComponentDoc(namespace: string) {
        return context.api?.uiCom?.api?.getComEditorPrompts?.(namespace)
      }
    } as any)

    params?.onProgress?.('start')

    const focusDesc = generateFocusDescription(context.currentFocus);

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
        MYBRICKS_TOOLS.OpenDsl({
          onOpen(id) {
            workspace.openDocument(id)
          },
        }),
        MYBRICKS_TOOLS.GetComponentsDocAndPrd({
          allowComponents: context.api?.global?.api?.getAllComDefPrompts?.(),
          examples: prompts.prdExamplesPrompts,
          canvasWidth: prompts.canvasWidth,
          onComponentDocOpen: (namespace) => {
            workspace.openComponentDoc(namespace)
          }
        }),
        MYBRICKS_TOOLS.GeneratePage({
          getFocusRootComponentDoc: () => context.api?.page?.api?.getPageContainerPrompts?.(targetId) as string,
          getTargetId: () => targetId as string,
          getPageJson() {
            return context.api?.page?.api?.getOutlineInfo(context.currentFocus?.pageId)
          },
          appendPrompt: prompts.systemAppendPrompts,
          examples: prompts.generatePageActionExamplesPrompts,
          onActions: (actions, status) => {
            context.api?.page?.api?.updatePage?.(targetId, actions, status)
          },
          onClearPage: () => {
            context.api?.page?.api?.clearPageContent?.(targetId)
          }
        }),
        // MYBRICKS_TOOLS.GetComponentsInfoByIds({
        //   id: targetId as string,
        //   getPageJson(id) {
        //     return context.api?.page?.api?.getOutlineInfo(id)
        //   },
        //   getComInfo(namespace) {
        //     return context.api?.uiCom?.api?.getComEditorPrompts?.(namespace)
        //   },
        //   getComJson(id) {
        //     return context.api?.uiCom?.api?.getOutlineInfo(id)
        //   },
        //   getFocusElementHasChildren() {
        //     if (context.currentFocus?.type !== 'page') {
        //       const json = getOutlineInfo()
        //       if (!json.slots || (Array.isArray(json.slots) && json.slots.length === 0)) {
        //         return false
        //       }
        //     }
        //     return true
        //   }
        // }),
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
          getPageJson() {
            return context.api?.page?.api?.getOutlineInfo(context.currentFocus?.pageId)
          },
          getFocusElementHasChildren() {
            if (context.currentFocus?.type !== 'page') {
              const json = getOutlineInfo()
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
          content: focusDesc
        }
      ],
      presetMessages: () => {
        const projectStruct = workspace.getProjectStruct();
        const componentsDocs = workspace.getComponentsDocs();
        return [
          {
            role: 'user',
            content: projectStruct
          },
          {
            role: 'user',
            content: componentsDocs
          },
          {
            role: 'user',
            content: focusDesc
          }
        ]
      }
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