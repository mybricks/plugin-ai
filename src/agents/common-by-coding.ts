import { context } from './../context';
import { MYBRICKS_TOOLS } from "./../tools"

import { WorkSpace } from './workspace/workspace'
import { FocusOutlineInfoManager, FocusInfo } from './workspace/outline-focus'

import { ComponentsManager } from './workspace/components-manager'
import { getAgentConfigs } from './utils/config'

import { CodingManager } from './workspace/coding-manager'

import AnalyzeRequirementAndSplit from '../tools/analyze-requirement-and-split'

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

/** common 的 fork，后续可在此单独扩展 */
export const requestCommonByCodingAgent = (params: any) => {

  return new Promise((resolve, reject) => {
    const agentConfig = getAgentConfigs(context.agents, 'page');

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
        return (context.api?.global?.api?.getComEditorPrompts ?? context.api?.uiCom?.api?.getComEditorPrompts)?.(namespace)
      }
    } as any, outlineInfoManager)

    const codingManager = new CodingManager({
      pageId: targetPageId,
      attachments: params.attachments,
      getJsxById: (id: string) => workspace.getJsxById(id),
    });

    let onProgress = params.onProgress;

    const historyFocusDesc = generateHistoryFocusDescription(focusInfo);
    const focusEleDesc = generateFocusTargetDescription(focusInfo);
    if (targetType === "uiCom") {
      onProgress = context.api.uiCom.api.getComOnProcess(targetId)?.onProgress
    } else if (targetType === "page") {
      onProgress = context.api.page.api.getPageOnProcess(targetId)?.onProgress
    }

    onProgress?.('start')

    workspace.openComponentDoc('mybricks.normal-pc-lite.custom-container');
    workspace.openComponentDoc('mybricks.basic-comlib.ai-mix');

    const hasAttachment = typeof params?.message !== 'string';

    context.rxai.requestAI({
      ...params,
      message: params?.message,
      blockId: targetId,
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
        AnalyzeRequirementAndSplit({
          getRootComponentDoc: () => context.api?.page?.api?.getPageContainerPrompts?.(targetPageId) as string,
          getTargetId: () => targetPageId as string,
          getRootIdByPageId(pageId: string) {
            return outlineInfoManager.getPageMetaInfo(pageId)?.rootId
          },
          componentIdToTitleMap,
          appendPrompt: agentConfig?.attentions,
          ...agentConfig?.getToolParams(MYBRICKS_TOOLS.GenerateUiContent.toolName),
          onActions: (actions, status) => {
            if (status === 'complete') {
              return
            }
            return context.designer?.updatePage?.(targetPageId, actions, status)
          },
          onClearPage: () => {
            context.api?.page?.api?.clearPageContent?.(targetPageId)
          },
          onAddCodingBlock(com) {
            codingManager.addCodingCom(com);
          },
        }),
        MYBRICKS_TOOLS.Answer({}),
        MYBRICKS_TOOLS.CodingSubagentAsTool({
          codingManager,
          onStart: () => {
            context.designer?.updatePage?.(targetPageId, [], 'start')
          },
          onComplete: () => {
            context.designer?.updatePage?.(targetPageId, [], 'complete')
          },
          onError: () => {
            context.designer?.updatePage?.(targetPageId, [], 'complete')
          },  
        })
      ],
      planningCheck: (tools: any[]) => {
        const toolNames = tools.map(tool => tool[1]);
        const resultTools = [...tools];

        // 规则: 若计划中有「分析需求并拆分」，则其后需有「代码开发」步骤
        const splitIndex = toolNames.indexOf(AnalyzeRequirementAndSplit.toolName);
        if (splitIndex > -1) {
          const hasCodingSubagent = resultTools.some((t: any) => t[1] === MYBRICKS_TOOLS.CodingSubagentAsTool.toolName);
          if (!hasCodingSubagent) {
            const insertIndex = resultTools.findIndex((t: any) => t[1] === AnalyzeRequirementAndSplit.toolName) + 1;
            resultTools.splice(insertIndex, 0, ['node', MYBRICKS_TOOLS.CodingSubagentAsTool.toolName]);
          }
        }

        return resultTools;
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
        const hasComponentsDocs = workspace.hasComponentsDocs();

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
      guidePrompt: `划分AI区域时以语义化/UI明显区分的模块作为划分，容器只需要做布局和AI区域间的间距使用，最大划分数量不建议超过12个。
绝对禁止拆分过细的AI区域组件，比如一个文本作为一个AI区域。`,
    });
  })
}


function generateHistoryFocusDescription(currentFocus: Partial<FocusInfo> = {}) {
  const { pageId, comId, title, type } = currentFocus ?? {}
  let focusDesc = '';
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
  let focusDesc = '';
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
