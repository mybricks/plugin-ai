import { context } from '../context';
import { MYBRICKS_TOOLS } from "../tools"
import GenerateUiPreferAiCom from '../tools/generate-ui-prefer-ai-com'

import { WorkSpace } from './workspace/workspace'
import { FocusOutlineInfoManager, FocusInfo } from './workspace/outline-focus'

import { getAgentConfigs } from './utils/config'

import { requestVibeCodingAgent } from './custom'

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

export const requestAssistantWithAiComAgent = (params: any) => {

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

    const codingManager = new CodingManager({
      pageId: targetPageId,
      attachments: params.attachments,
      getJsxById: (id: string) => workspace.getJsxById(id),
    });

    window.codingManager = codingManager;

    let onProgress = params.onProgress;

    const historyFocusDesc = generateHistoryFocusDescription(focusInfo);
    const focusEleDesc = generateFocusTargetDescription(focusInfo);
    if (targetType === "uiCom") {
      onProgress = context.api.uiCom.api.getComOnProcess(targetId)?.onProgress
    } else if (targetType === "page") {
      onProgress = context.api.page.api.getPageOnProcess(targetId)?.onProgress
    }

    onProgress?.('start')

    workspace.openComponentDoc('mybricks.basic-comlib.ai-mix')

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
        GenerateUiPreferAiCom({
          getRootComponentDoc: () => context.api?.page?.api?.getPageContainerPrompts?.(targetPageId) as string,
          getTargetId: () => targetPageId as string,
          getRootIdByPageId(pageId: string) {
            return outlineInfoManager.getPageMetaInfo(pageId)?.rootId
          },
          componentIdToTitleMap,
          appendPrompt: agentConfig?.attentions,
          ...agentConfig?.getToolParams(GenerateUiPreferAiCom.toolName),
          onActions: (actions, status) => {
            return context.designer?.updatePage?.(targetPageId, actions, status)
          },
          onClearPage: () => {
            context.api?.page?.api?.clearPageContent?.(targetPageId)
          },
          onAddCodingBlock(com) {
            codingManager.addCodingCom(com);
          },
        }),
      ],
      planningCheck: (tools: any[]) => {
        const toolNames = tools.map(tool => tool[1]);
        const resultTools = [...tools];

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


interface CodingCom {
  pageId: string;
  comId: string;
  title: string;
  requirement: string,
}

class CodingManager {
  attachments: any;
  getJsxById: (id: string) => string;
  pageId: string;
  waitForCoding: CodingCom[] = [];

  constructor(params: {
    pageId: string;
    attachments: any[];
    getJsxById: (id: string) => string;
  }) {
    this.pageId = params.pageId;
    this.attachments = params.attachments;
    this.getJsxById = params.getJsxById;
  }

  addCodingCom(com: CodingCom) {
    if (this.waitForCoding.some(c => c.comId === com.comId)) {
      return;
    }
    this.waitForCoding.push(com);
  }

  async batchCoding(limit = 5) {
    let codings = [...this.waitForCoding];
    limit = Math.min(limit, codings.length);  

    let message = `# 批量组件代码还原任务

## 当前页面结构
${this.getJsxById(this.pageId)}

## 任务说明
需要按顺序还原以下 ${codings.length} 个组件，请根据图片严格还原设计效果。

## 待还原组件

${codings.map((coding, index) => `### 组件 ${index + 1}: ${coding.comId}
**需求描述：**
${coding.requirement}`).join('\n\n')}
`;
    return await requestVibeCodingAgent({
      key: `vibe_coding_${this.pageId}_${Math.random().toString(36).substring(2, 15)}`,
      message,
      attachments: this.attachments,
      onDevelopModule: ({ files }, updateComponent) => {
        // 传递进来的files为 [{ fileName: 'model@uuid.json', content: '' }]
        console.log('onDevelopModule', files)
        // 按uuid分组文件
        const filesByUuid = files.reduce((acc, file) => {
          // 从fileName中提取uuid，格式为 "fileName@uuid.ext"
          const match = file.fileName.match(/^(.+)@([^.]+)(\..+)$/);
          if (match) {
            const [, name, uuid, ext] = match;
            if (!acc[uuid]) {
              acc[uuid] = [];
            }
            // 去除uuid，还原原始fileName
            acc[uuid].push({
              fileName: `${name}${ext}`,
              content: file.content
            });
          }
          return acc;
        }, {} as Record<string, Array<{ fileName: string; content: string }>>);
        
        console.log('filesByUuid', filesByUuid)

        // 对每个uuid调用一次updateComponent
        Object.entries(filesByUuid).forEach(([uuid, componentFiles]) => {
          updateComponent(uuid, componentFiles);
        });
      }
    }, {
      pageId: this.pageId,
    })
  }

  // async batchCoding(limit = 2) {
  //   let codings = [...this.waitForCoding];
  //   limit = Math.min(limit, codings.length);  
  //   const results: string[] = [];

  //   while (codings.length > 0) {
  //     const batch = codings.slice(0, limit);
  //     const results = await Promise.all(batch.map(coding => requestVibeCodingAgent({
  //       message: coding.requirement,
  //       attachments: this.attachments,
  //     }, {
  //       pageId: this.pageId,
  //       comId: coding.comId
  //     })));
  //     results.push(...results);
  //     codings = codings.slice(limit);
  //   }

  //   return results;
  // }
}