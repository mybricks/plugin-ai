import { context } from './../context';
import { MYBRICKS_TOOLS } from "./../tools"

import { WorkSpace } from './workspace/workspace'
import { FocusOutlineInfoManager, FocusInfo } from './workspace/outline-focus'

export const requestCommonAgent = (params: any) => {

  return new Promise((resolve, reject) => {
    const prompts = context.prompts;

    const focusInfo: FocusInfo = {
      pageId: (context.currentFocus as any)?.pageId,
      comId: (context.currentFocus as any)?.comId,
      title: context.currentFocus?.title,
      type: (context.currentFocus as any)?.type
    };

    const targetType = focusInfo.type;
    const targetId = targetType === 'uiCom' ? focusInfo.comId : focusInfo.pageId;
    const targetPageId = focusInfo.pageId;

    if (!targetPageId) {
      return reject('缺少聚焦页面id')
    }

    const outlineInfoManager = new FocusOutlineInfoManager({
      api: context.api,
      focusInfo
    });

    const componentIdToTitleMap = targetPageId
      ? outlineInfoManager.getComponentIdToTitleMap(targetPageId)
      : new Map<string, string>();

    const workspace = new WorkSpace({ currentFocus: focusInfo } as any, {
      getAllPageInfo() {
        return (context.api.global.api as any).getAllPageInfo()
      },
      getComponentDoc(namespace: string) {
        return context.api?.uiCom?.api?.getComEditorPrompts?.(namespace)
      }
    } as any, outlineInfoManager)

    params?.onProgress?.('start')

    const historyFocusDesc = generateHistoryFocusDescription(focusInfo);
    const focusEleDesc = generateFocusTargetDescription(focusInfo);

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
    // workspace.openDocument('u_tycgh')

    // // 页面 + 组件
    // workspace.openDocument('u_yjFHf')
    // workspace.openDocument('u_ADKKC')

    // return console.log(workspace.getProjectStruct())

    // try {
    //   workspace.openDocument('u_K_8oe')
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
          componentIdToTitleMap,
          appendPrompt: prompts.systemAppendPrompts,
          examples: prompts.generatePageActionExamplesPrompts,
          onActions: (actions, status) => {
            context.api?.page?.api?.updatePage?.(targetPageId, actions, status)
          },
          onClearPage: () => {
            context.api?.page?.api?.clearPageContent?.(targetPageId)
          }
        }),
        MYBRICKS_TOOLS.RefactorComponent({
          onActions: (actions, status, type) => {
            if (!status) {
              return 
            }

            // 只有聚焦到组件上，且第一个操作ID是组件ID，且父组件不为页面ID，才会触发组件级更新
            if (targetType === 'uiCom' && targetId && type === 'uiCom') {
              const parentId = workspace.focusPageOutlineInfo
                ? outlineInfoManager.findParentNodeByComId(
                  workspace.focusPageOutlineInfo,
                  targetId as string
                )?.id
                : undefined;

              if (parentId && parentId !== targetPageId) {
                context.api?.uiCom?.api?.updateCom?.(parentId, actions, status)
                return
              }
            }

            context.api?.page?.api?.updatePage?.(targetPageId, actions, status)
          },
          componentIdToTitleMap,
          getRootComponentDoc: () => context.api?.page?.api?.getPageContainerPrompts?.(targetPageId) as string,
          getTargetId: () => targetPageId as string,
          getFocusElementHasChildren() {
            if (context.currentFocus?.type !== 'page' && targetId) {
              const json = outlineInfoManager.getUiComOutline(targetId)
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


function generateHistoryFocusDescription(currentFocus: Partial<FocusInfo> = {}) {
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

function generateFocusTargetDescription(currentFocus: Partial<FocusInfo> = {}) {
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