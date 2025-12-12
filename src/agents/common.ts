import { context } from './../context';
import { MYBRICKS_TOOLS } from "./../tools"

import { WorkSpace } from './../tools/workspace'


export const requestCommonAgent = (params: any) => {

  return new Promise((resolve, reject) => {
    const prompts = context.prompts;

    const targetType = context.currentFocus?.type
    const targetId = targetType === 'uiCom' ? context.currentFocus?.comId : context.currentFocus?.pageId
    const targetPageId = context.currentFocus?.pageId

    const getOutlineInfo = () => {
      if (targetType !== 'page') {
        return context.api?.uiCom?.api?.getOutlineInfo(targetId)
      } else {
        return context.api?.page?.api?.getOutlineInfo(targetId)
      }
    }

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
    const historyFocusDesc = generateHistoryFocusDescription(context.currentFocus);
    const focusEleDesc = generateFocusTargetDescription(context.currentFocus);

    const hasAttachment = typeof params?.message !== 'string';

    // workspace.openDocument('u_YZ0su')

    // workspace.openDocument('u_ADKKC')

    // workspace.openDocument('u_ZJ_bn')

    // workspace.openDocument('u_ADKKC')
    // workspace.openDocument('u_XZL9q')

    // workspace.openDocument('u_k_1dW')
    // workspace.openDocument('u_ADKKC')

    // // 页面
    // workspace.openDocument('u_yjFHf')

    // // 页面 + 组件
    // workspace.openDocument('u_yjFHf')
    // workspace.openDocument('u_ADKKC')

    // return console.log(workspace.getProjectStruct())

    // try {
    //   workspace.openDocument(targetPageId)
    //   return console.log(workspace.getProjectStruct())
    // } catch (error) {
    //   console.error(error)
    // }
    // return
    

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
          getRootComponentDoc: () => context.api?.page?.api?.getPageContainerPrompts?.(targetPageId) as string,
          getTargetId: () => targetPageId as string,
          getPageJson() {
            return context.api?.page?.api?.getOutlineInfo(targetPageId)
          },
          appendPrompt: prompts.systemAppendPrompts,
          examples: prompts.generatePageActionExamplesPrompts,
          onActions: (actions, status) => {
            context.api?.page?.api?.updatePage?.(targetPageId, actions, status)
          },
          onClearPage: () => {
            context.api?.page?.api?.clearPageContent?.(targetPageId)
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
          onActions: (actions, status, type) => {
            if (!status) {
              return 
            }
            if (type === "page") {
              context.api?.page?.api?.updatePage?.(targetPageId, actions, status)
            } else if (type === 'uiCom') {
              context.api?.uiCom?.api?.updateCom?.(targetId, actions, status)
            }
          },
          getPageJson() {
            return context.api?.page?.api?.getOutlineInfo(targetPageId)
          },
          getRootComponentDoc: () => context.api?.page?.api?.getPageContainerPrompts?.(targetPageId) as string,
          getTargetId: () => targetPageId as string,
          getFocusElementHasChildren() {
            if (context.currentFocus?.type !== 'page') {
              const json = getOutlineInfo()
              if (!json.slots || (Array.isArray(json.slots) && json.slots.length === 0)) {
                return false
              }
            }
            return true
          }
        }),
        MYBRICKS_TOOLS.Answer({}),
      ],
      planningCheck: (tools: any[]) => {
        const toolNames = tools.map(tool => tool[1]);
        const resultTools = [...tools];
        
        // 规则1: 如果 信息获取类 在最后一个，则添加一个 answer
        const infoToolNames = [MYBRICKS_TOOLS.OpenDsl.toolName, MYBRICKS_TOOLS.GetComponentsDocAndPrd.toolName];
        if (toolNames.length > 0 && infoToolNames.includes(toolNames[toolNames.length - 1])) {
          resultTools.push(['node', MYBRICKS_TOOLS.Answer.toolName]);
          return resultTools
        }
        
        // 规则2: 如果 生成页面 前面没有获取需求，则添加一个需求分析
        const generatePageIndex = toolNames.indexOf(MYBRICKS_TOOLS.GeneratePage.toolName);
        if (generatePageIndex > -1) {
          const requirementTools = [MYBRICKS_TOOLS.GetComponentsDocAndPrd.toolName, MYBRICKS_TOOLS.OpenDsl.toolName];
          const hasRequirement = toolNames.slice(0, generatePageIndex).some(name => requirementTools.includes(name));
          
          if (!hasRequirement) {
            resultTools.splice(generatePageIndex, 0, ['node', MYBRICKS_TOOLS.GetComponentsDocAndPrd.toolName]);
            return resultTools
          }
        }
        
        // 规则3: 如果 修改 前面没有 open-dsl-document，则添加一个
        const refactorIndex = toolNames.indexOf(MYBRICKS_TOOLS.RefactorComponent.toolName);
        if (refactorIndex > -1) {
          const hasOpenDsl = toolNames.slice(0, refactorIndex).includes(MYBRICKS_TOOLS.OpenDsl.toolName);
          
          if (!hasOpenDsl) {
            resultTools.splice(refactorIndex, 0, ['node', MYBRICKS_TOOLS.OpenDsl.toolName, { ids: targetPageId }]);
            return resultTools
          }
        }
        
        return resultTools
      },
      formatUserMessage: (text: string) => {
        return `对于聚焦元素${focusEleDesc}，用户提出的消息为：
<用户消息>
${text}
</用户消息>`
      },
      presetHistoryMessages: [
        {
          role: 'assistant',
          content: historyFocusDesc
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
            role: 'assistant',
            content: '收到，谢谢你提供的项目信息～'
          },
          ...(workspace.hasComponentsDocs() ? [
            {
              role: 'user',
              content: componentsDocs
            },
            {
              role: 'assistant',
              content: '收到，我会根据组件配置完成任务～'
            },
        ] : [null]),
          // {
          //   role: 'user',
          //   content: focusDesc
          // }
        ].filter(Boolean)
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

function generateHistoryFocusDescription(currentFocus = {}) {
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
  
  return `对于${focusDesc}`;
}

function generateFocusTargetDescription(currentFocus = {}) {
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
  
  return focusDesc;
}