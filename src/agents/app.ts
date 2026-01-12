import { context } from './../context';
import { MYBRICKS_TOOLS } from "./../tools"

import { WorkSpace } from './workspace/workspace'
import { FocusOutlineInfoManager, FocusInfo } from './workspace/outline-focus'

export const requestGeneratePageAgent = (pageId: string, pageTitle: string, params: any) => {

  const prompts = context.prompts

  const focusInfo: FocusInfo = {
    pageId,
    comId: undefined,
    title: pageTitle,
    type: 'page'
  };

  const outlineInfoManager = new FocusOutlineInfoManager({
    api: context.api,
    focusInfo
  })

  const componentIdToTitleMap = outlineInfoManager.getComponentIdToTitleMap(pageId);

  const workspace = new WorkSpace({ currentFocus: focusInfo } as any, {
    getAllPageInfo() {
      return []
    },
    getComponentDoc(namespace: string) {
      return (context.api?.global?.api?.getComEditorPrompts || context.api?.uiCom?.api?.getComEditorPrompts)?.(namespace)
    }
  } as any, outlineInfoManager)

  params?.onProgress?.('start')

  context.rxai.requestAI({
    ...params,
    extension: {
      mentions: [focusInfo]
    },
    message: params?.message,
    key: pageId,
    emits: {
      write: () => { },
      complete: () => {
        params?.onProgress?.("complete");
      },
      error: () => {
        params?.onProgress?.("error");
      },
      cancel: () => {
        // params?.onProgress?.("complete");
      },
    },
    planList: [`${MYBRICKS_TOOLS.GetComponentsDocAndPrd.toolName} -mode generate`, MYBRICKS_TOOLS.GeneratePage.toolName],
    tools: [
      MYBRICKS_TOOLS.GetComponentsDocAndPrd({
        allowComponents: context.api?.global?.api?.getAllComDefPrompts?.(),
        examples: prompts.prdExamplesPrompts,
        onComponentDocOpen: (namespace) => {
          workspace.openComponentDoc(namespace)
        },
        appendPrompt: prompts.systemAppendPrompts,
        shouldUseExpert: true,
        deviceType: context.deviceType,
      }),
      MYBRICKS_TOOLS.GeneratePage({
        getRootComponentDoc: () => context.api?.page?.api?.getPageContainerPrompts?.(pageId) as string,
        getTargetId: () => pageId as string,
        getRootIdByPageId(pageId: string) {
          return outlineInfoManager.getPageMetaInfo(pageId)?.rootId
        },
        componentIdToTitleMap,
        appendPrompt: prompts.systemAppendPrompts,
        examples: prompts.generatePageActionExamplesPrompts,
        onActions: (actions, status) => {
          return context.api?.page?.api?.updatePage?.(pageId, actions, status)
        },
        onClearPage: () => {
          context.api?.page?.api?.clearPageContent?.(pageId)
        }
      }),
      MYBRICKS_TOOLS.BuildProcess({
        getPageId: () => focusInfo.pageId,
        getPageOutlineInfo: () => {
          workspace.openDocument(focusInfo.pageId!);
          return context.api?.page?.api?.getOutlineInfo(focusInfo.pageId)
        },
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
          // console.log("[updatePage]", args)
          return context.api?.page?.api?.updatePage?.(focusInfo.pageId, ...args)
        },
        updateCom: (...args: any) => {
          // console.log("[updateCom]", args)
          return context.api?.logicCom?.api?.updateCom?.(...args)
        },
      }),,
    ],
    // presetMessages: () => [
    //   {
    //     role: 'user',
    //     content: workspace.getComponentsDocs()
    //   }
    // ],
    presetMessages: () => {
      const projectStruct = `# 工作空间 \n 当前为空项目`;;
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
    }
    // presetMessages: [
    //   {
    //     role: 'user',
    //     content: `检测到聚焦位置发生变化`
    //   },
    //   {
    //     role: 'assistant',
    //     content: `当前已聚焦到${`页面(title=${pageTitle},id=${pageId})`}中，后续用户的提问，关于”这个“、“此”，甚至不提主语，都是指代此元素。
    // <当前聚焦元素的内容简介>
    //   内容为空
    // </当前聚焦元素的内容简介>
    //                 `
    //   }
    // ]
  });
}

async function createCanvasByAICanvas(canvasId: string, aiCanvas: any) {

  function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // TOOD，之前不去掉设计器会有报错
  await sleep(1000)

  const pageArray = [];

  for (let index = 0; index < aiCanvas.pages.length; index++) {
    const page = aiCanvas.pages[index];

    const pageRef = await context.api.page?.api?.createPage?.(canvasId, page.title, context.createTemplates?.page?.({ title: page.title }))
    pageArray.push({ page, pageRef })
  }

  pageArray.forEach(async ({ page, pageRef }) => {
    await requestGeneratePageAgent(pageRef.id, page.title, {
      message: `帮忙实现项目「${aiCanvas.title}」的其中一个页面，页面为${page.title}。
<可供参考的需求>
${page.prd}
</可供参考的需求>

<样式风格>
${aiCanvas.style}
</样式风格>
`,
      onProgress: pageRef.onProgress,
      id: pageRef.id,
    })
  })
}

export const requestGenerateCanvasAgent = (params: any) => {
  return new Promise((resolve, reject) => {
    params?.onProgress?.('start');


    const createTargetContainer = () => {
      if (!context.isMutiCanvas) {
        return { id: '_root_' };
      }
      return context.api.page?.api?.createCanvas?.();
    };

    (params.rxai || context.rxai).requestAI({
      ...params,
      message: params?.message,
      key: params.id,
      emits: {
        write: () => { },
        complete: () => {
          params?.onProgress?.("complete");
        },
        error: () => {
          reject('error')
          params?.onProgress?.("error");
        },
        cancel: () => {
          params?.onProgress?.("complete");
        },
      },
      planList: [MYBRICKS_TOOLS.AnalyzeAndExpandPrd.toolName],
      tools: [
        MYBRICKS_TOOLS.AnalyzeAndExpandPrd({
          onProjectCreate: (projectJson) => {
            if (!projectJson || !projectJson.title) {
              return resolve("complete");
              // return reject('不合法的项目文件')
            }
            let canvasId
            try {
              const canvas = createTargetContainer()
              canvasId = canvas?.id
            } catch (error) {
              return reject(error)
            }
            resolve('complete')
            if (canvasId) {
              params?.onProgress?.('ing');
              createCanvasByAICanvas(canvasId, projectJson);
            }
          },
          deviceType: context.deviceType
        })
      ],
    });
  })
}