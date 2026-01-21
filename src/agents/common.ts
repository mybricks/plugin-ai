import { context } from './../context';
import { MYBRICKS_TOOLS } from "./../tools"

import { WorkSpace } from './workspace/workspace'
import { FocusOutlineInfoManager, FocusInfo } from './workspace/outline-focus'

import { fileFormat } from '@mybricks/rxai'
import { ComponentsManager } from './workspace/components-manager'
import { getAgentConfigs } from './utils/config'

const getFocusInfo = (focus: any) => {
  const focusInfo: FocusInfo = {
    pageId: focus?.pageId,
    comId: focus?.comId,
    title: focus?.title,
    type: focus?.type,
    focusArea: focus?.focusArea
  };

  if (focus.type === "logicCom") {
    focusInfo.pageId = focus.rootFrameId;
    focusInfo.diagramId = focus.diagramId;
  }

  return focusInfo;
}

const getTargetId = (focus: FocusInfo) => {
  if (['uiCom', 'logicCom'].includes(focus.type!)) {
    return focus.comId
  }

  return focus.pageId;
}

export const requestCommonAgent = (params: any) => {

  return new Promise((resolve, reject) => {
    // 从 agents 配置中获取提示词配置，优先使用参数传入的，否则使用 context 中的
    const agents = params.agents || context.agents;
    const agentConfig = getAgentConfigs(agents, 'page');

    const currentFocus = params.focus || context.currentFocus;
    const focusInfo = getFocusInfo(currentFocus);

    const targetType = focusInfo.type;
    const targetId = getTargetId(focusInfo);
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
        return (context.api?.global?.api?.getComEditorPrompts || context.api?.uiCom?.api?.getComEditorPrompts)?.(namespace)
      }
    } as any, outlineInfoManager)

    let onProgress = params.onProgress;

    const historyFocusDesc = generateHistoryFocusDescription(focusInfo);
    const focusEleDesc = generateFocusTargetDescription(focusInfo);
    if (targetType === "uiCom") {
      onProgress = context.api.uiCom.api.getComOnProcess(targetId)?.onProgress
    } else if (targetType === "page") {
      onProgress = context.api.page.api.getPageOnProcess(targetId)?.onProgress
    }

    onProgress?.('start')

    const hasAttachment = typeof params?.message !== 'string';

    // workspace.openDocument('u_qLciw]')

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
    //   workspace.openDocument(targetPageId)

    //   return console.log(workspace.getProjectStruct())

    //   workspace.openComponentDoc('mybricks.normal-pc.antd5.form-container')
    //   return console.log(workspace.getComponentsDocs());
    // } catch (error) {
    //   console.error(error)
    // }
    // return


    context.rxai.requestAI({
      ...params,
      message: params?.message,
      blockId: targetId,
      // enableLog: true,
      emits: {
        write: () => { },
        complete: () => {
          resolve('complete')
          onProgress?.("complete");
        },
        error: () => {
          reject('error')
          onProgress?.("error");
        },
        cancel: () => {},
      },
      tools: [
        MYBRICKS_TOOLS.OpenDsl({
          onOpen(id) {
            workspace.openDocument(id)
          },
        }),
        MYBRICKS_TOOLS.AnalyzeRequirementAndComponents({
          allowComponents: context.designer?.getAllComDefPrompts?.() || "",
          ...agentConfig?.getToolParams(MYBRICKS_TOOLS.AnalyzeRequirementAndComponents.toolName),
          onComponentDocOpen: (namespace) => {
            workspace.openComponentDoc(namespace)
          },
          appendPrompt: agentConfig?.attentions,
          deviceType: context.deviceType,
        }),
        MYBRICKS_TOOLS.GenerateUiContent({
          getRootComponentDoc: () => context.api?.page?.api?.getPageContainerPrompts?.(targetPageId) as string,
          getTargetId: () => targetPageId as string,
          getRootIdByPageId(pageId: string) {
            return outlineInfoManager.getPageMetaInfo(pageId)?.rootId
          },
          componentIdToTitleMap,
          appendPrompt: agentConfig?.attentions,
          ...agentConfig?.getToolParams(MYBRICKS_TOOLS.GenerateUiContent.toolName),
          onActions: (actions, status) => {
            return context.designer?.updatePage?.(targetPageId, actions, status)
          },
          onClearPage: () => {
            context.api?.page?.api?.clearPageContent?.(targetPageId)
          },
        }),
//         MYBRICKS_TOOLS.GenerateUiContent({
//           getRootComponentDoc: () => context.api?.page?.api?.getPageContainerPrompts?.(targetPageId) as string,
//           getTargetId: () => targetPageId as string,
//           getRootIdByPageId(pageId: string) {
//             return outlineInfoManager.getPageMetaInfo(pageId)?.rootId
//           },
//           componentIdToTitleMap,
//           appendPrompt: `<对于当前搭建有以下特殊上下文>
//   <搭建画布信息>
//     当前正在搭建各类智能穿戴设备的表盘，画布的宽度和高度我们限制为466*466，所有内容必须使用*绝对定位*布局绘制到画布上。

//     注意：根组件的布局必须设置position=absolute（绝对定位）和具体的宽高。
//   </搭建画布信息>
// </对于当前搭建有以下特殊上下文>`,
//           examples: `<example>
//   <user_query>搭建一个科技风表盘</user_query>
//   <assistant_response>
//     好的，我们来实现一个科技风的表盘，搭建过程如下：
//     1. 首先，必须配置合理的表盘宽度和高度、标题、布局以及样式；
//     2. 其次搭建各类元素，将各类表盘元素放置到合适的位置；

//     ${fileFormat({
//     content: `["_root_",":root","setLayout",{"height": 466, "width": "466"}]
//     ["_root_",":root","doConfig",{"path":"root/标题","value":"科技风表盘"}]
//     ["_root_",":root","doConfig",{"path":"root/布局","value":{"position": "absolute"}}]
//     ["_root_",":root","doConfig",{"path":"root/样式","value":{"background":"linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 50%, #16213e 100%)"}}]
//     ["_root_","_rootSlot_","addChild",{"title":"电池图标显示","ns":"somelib.battery","comId":"u_digital_time","layout":{"position":"absolute","top":10,"left":300},"configs":[]}]
//     `,
//     fileName: '生成科技风表盘操作步骤.json'
//   })}

//     注意：
//     - 表盘所有元素必须由自由布局绘制而成
//   </assistant_response>
// </example>`,
//           onActions: (actions, status) => {
//             context.api?.page?.api?.updatePage?.(targetPageId, actions, status)
//           },
//           onClearPage: () => {
//             context.api?.page?.api?.clearPageContent?.(targetPageId)
//           }
//         }),
        MYBRICKS_TOOLS.RefactorUiContent({
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
                return context.designer?.updateUiCom?.(parentId, actions, status)
              }
            }

            return context.designer?.updatePage?.(targetPageId, actions, status)
          },
          componentIdToTitleMap,
          appendPrompt: agentConfig?.attentions,
          getRootComponentDoc: () => context.api?.page?.api?.getPageContainerPrompts?.(targetPageId) as string,
          getTargetId: () => targetPageId as string,
          getFocusElementHasChildren() {
            if (!['page', 'logicCom', 'section'].includes(currentFocus?.type) && targetId) {
              const json = outlineInfoManager.getUiComOutline(targetId)
              if (!json.slots || (Array.isArray(json.slots) && json.slots.length === 0)) {
                return false
              }
            }
            return true
          },
          getFocusElementAiRole() {
            if (focusInfo?.type === "uiCom") {
              const comInfo = context.api.uiCom.api.getOutlineInfo(focusInfo.comId);
              const aiComponent = ComponentsManager.getAiComponent(comInfo.def.namespace);
              return aiComponent?.prompts?.aiRole;
            }
            return null
          },
          getComIds() {
            const comIds: string[] = [];

            outlineInfoManager.getComponentIdToTitleMap(targetPageId).forEach((value, key) => {
              comIds.push(key);
            })

            return comIds;
          }
        }),
        MYBRICKS_TOOLS.Answer({}),
        MYBRICKS_TOOLS.BuildProcess({
          // getComId: () => focusInfo.comId,
          getPageId: () => focusInfo.pageId,
          getComponentOutlineInfo: () => {
            const { type, comId } = focusInfo
            if (type === "uiCom") {
              return {
                type,
                outlineInfo: context.api?.uiCom?.api?.getOutlineInfo(comId)
              }
            } else if (type === "logicCom") {
              return {
                type,
                outlineInfo: context.api?.logicCom?.api?.getOutlineInfo(comId)
              }
            }
          },
          getPageOutlineInfo: () => context.api?.page?.api?.getOutlineInfo(focusInfo.pageId),
          getAllPageInfo() {
            return context.api?.global?.api?.getAllPageInfo()
          },
          createDiagram: (...args: any) => {
            // console.log("[createDiagram - args]", args)
            return context.api.diagram.api.createDiagram(...args)
          },
          updateDiagram: (...args: any) => {
            // console.log("[updateDiagram - args]", args)
            return context.api.diagram.api.updateDiagram(...args)
          },
          getDiagramInfo: (...args: any) => {
            if (!args[0]) {
              if (focusInfo.diagramId) {
                return {
                  id: focusInfo.diagramId
                }
              }

              return null
            }
            return context.api.diagram.api.getDiagramInfo(...args)
          },
          updatePage: (...args: any) => {
            return context.designer?.updatePage?.(focusInfo.pageId, ...args)
          },
          updateCom: (...args: any) => {
            return context.designer?.updateLogicCom?.(...args)
          },
        }),
      ],
      planningCheck: (tools: any[]) => {
        const toolNames = tools.map(tool => tool[1]);
        const resultTools = [...tools];
        
        // 规则1: 如果 信息获取类 在最后一个，则添加一个 answer
        const infoToolNames = [MYBRICKS_TOOLS.OpenDsl.toolName, MYBRICKS_TOOLS.AnalyzeRequirementAndComponents.toolName];
        if (toolNames.length > 0 && infoToolNames.includes(toolNames[toolNames.length - 1])) {
          resultTools.push(['node', MYBRICKS_TOOLS.Answer.toolName]);
          return resultTools
        }
        
        // 规则2: 如果 生成页面 前面没有获取需求，则添加一个需求分析
        const generatePageIndex = toolNames.indexOf(MYBRICKS_TOOLS.GenerateUiContent.toolName);
        if (generatePageIndex > -1) {
          const requirementTools = [MYBRICKS_TOOLS.AnalyzeRequirementAndComponents.toolName, MYBRICKS_TOOLS.OpenDsl.toolName];
          const hasRequirement = toolNames.slice(0, generatePageIndex).some(name => requirementTools.includes(name));
          
          if (!hasRequirement) {
            resultTools.splice(generatePageIndex, 0, ['node', MYBRICKS_TOOLS.AnalyzeRequirementAndComponents.toolName]);
            return resultTools
          }
        }
        
        // 规则3: 如果 修改 前面没有 open-dsl-document，则添加一个
        const refactorIndex = toolNames.indexOf(MYBRICKS_TOOLS.RefactorUiContent.toolName);
        if (refactorIndex > -1) {
          const hasOpenDsl = toolNames.slice(0, refactorIndex).includes(MYBRICKS_TOOLS.OpenDsl.toolName);
          
          if (!hasOpenDsl) {
            resultTools.splice(refactorIndex, 0, ['node', MYBRICKS_TOOLS.OpenDsl.toolName, { ids: targetPageId }]);
            return resultTools
          }
        }

        const buildProcessIndex = toolNames.indexOf(MYBRICKS_TOOLS.BuildProcess.toolName);
        if (buildProcessIndex > -1) {
          // 搭建流程前需要需求分析和组件选型
          const requirementTools = [MYBRICKS_TOOLS.AnalyzeRequirementAndComponents.toolName];
          const hasRequirement = toolNames.slice(0, generatePageIndex).some(name => requirementTools.includes(name));
          
          if (!hasRequirement) {
            resultTools.splice(generatePageIndex, 0, ['node', MYBRICKS_TOOLS.AnalyzeRequirementAndComponents.toolName, {mode: "refactor"}]);
            return resultTools
          }
        }

        return resultTools
      },
      formatUserMessage: (text: string) => {
        let prefix = "";

        if (focusInfo.type === "uiCom") {
          const comInfo = context.api.uiCom.api.getOutlineInfo(focusInfo.comId);
          const aiComponent = ComponentsManager.getAiComponent(comInfo.def.namespace);
          if (aiComponent.prompts.injectUserMessage) {
            prefix = "<聚焦特殊元素特别说明>" +
            `\n${aiComponent.prompts.usage}` +
            // `\n${context.api.global.api.getComEditorPrompts(comInfo.def.namespace)}` +
            "\n</聚焦特殊元素特别说明>"
          }
        }

        return `对于聚焦元素${focusEleDesc}，用户提出的消息为：
${prefix}
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
        const hasComponentsDocs = workspace.hasComponentsDocs();
        
        // 合并内容
        let projectInfo = projectStruct;
        if (hasComponentsDocs) {
          projectInfo = `${projectStruct}\n\n${componentsDocs}`;
        }
        
        return [
          {
            role: 'user',
            content: `<当前项目信息>\n${projectInfo}\n</当前项目信息>`
          },
          {
            role: 'assistant',
            content: hasComponentsDocs 
              ? '收到，谢谢你提供的项目信息和组件文档，我会根据这些信息完成任务～'
              : '收到，谢谢你提供的项目信息，我会根据这些信息完成任务～'
          },
        ]
      },
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
    focusDesc = `画布(title=${title},画布id=${pageId})`;
  } else if (type === 'section') {
    focusDesc = `画布(title=${title},画布id=${pageId})`;
  } else if (type === "logicCom") {
    focusDesc = `计算组件(title=${title},组件id=${comId})`;
  }
  
  return `对于${focusDesc}`;
}

function generateFocusTargetDescription(currentFocus: Partial<FocusInfo> = {}) {
  const { pageId, comId, title, type, focusArea } = currentFocus ?? {}
  
  // 定义聚焦元素的描述部分
  let focusDesc = '';
  
  // 判断当前聚焦元素类型
  if (type === 'uiCom') {
    focusDesc = `组件(title=${title},组件id=${comId},选中区域=${focusArea ? focusArea.selector : ":root"})`;
  } else if (type === 'page') {
    focusDesc = `画布(title=${title},画布id=${pageId})`;
  } else if (type === 'section') {
    focusDesc = `画布(title=${title},画布id=${pageId})`;
  } else if (type === "logicCom") {
    focusDesc = `计算组件(title=${title},组件id=${comId})`;
  }
  
  return focusDesc;
}