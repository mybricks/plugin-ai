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
    planList: [`${MYBRICKS_TOOLS.GetComponentsDocAndPrd.toolName} -mode generate`, MYBRICKS_TOOLS.GeneratePage.toolName, MYBRICKS_TOOLS.BuildProcess.toolName],
    tools: [
      MYBRICKS_TOOLS.GetComponentsDocAndPrd({
        allowComponents: context.api?.global?.api?.getAllComDefPrompts?.(),
        examples: prompts.prdExamplesPrompts,
        canvasWidth: prompts.canvasWidth,
        onComponentDocOpen: (namespace) => {
          workspace.openComponentDoc(namespace)
        },
        shouldUseExpert: true,
        deviceType: context.deviceType,
      }),
      MYBRICKS_TOOLS.GeneratePage({
        getRootComponentDoc: () => context.api?.page?.api?.getPageContainerPrompts?.(pageId) as string,
        getTargetId: () => pageId as string,
        getPageJson() {
          return context.api?.page?.api?.getOutlineInfo(pageId)
        },
        componentIdToTitleMap,
        appendPrompt: prompts.systemAppendPrompts,
        examples: prompts.generatePageActionExamplesPrompts,
        onActions: (actions, status) => {
          context.api?.page?.api?.updatePage?.(pageId, actions, status)
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
        getAllComDefPrompts: () => context.api?.global?.api?.getAllComDefPrompts?.(),
        getAllPageInfo: context.api?.global?.api?.getAllPageInfo,
        createDiagram: context.api.diagram.api.createDiagram,
        updateDiagram: context.api.diagram.api.updateDiagram
      }),
    ],
    // presetMessages: () => [
    //   {
    //     role: 'user',
    //     content: workspace.getComponentsDocs()
    //   }
    // ],
    presetMessages: () => {
      return [
        ...(workspace.checkDocumentStatus(focusInfo.pageId!) ? [{
          role: 'user',
          content: workspace.getProjectStruct()
        },
        {
          role: 'assistant',
          content: '收到，谢谢你提供的项目信息～'
        }] : [null]),
        ...(workspace.hasComponentsDocs() ? [
          {
            role: 'user',
            content: workspace.getComponentsDocs()
          },
          {
            role: 'assistant',
            content: '收到，我会根据组件配置完成任务～'
          },
      ] : [null]),
      ].filter(Boolean)
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

<事件流程搭建>
基于可跳转页面/场景，深度分析页面间的关联性和逻辑关系，构建合理的场景/页面跳转流程。

关联性分析要求：
1. **功能关联分析**：识别页面间的功能依赖关系和业务逻辑连接
2. **用户路径分析**：梳理用户在页面间的自然跳转流程和跳转需求
3. **信息层级分析**：判断页面间的信息深度关系（概览→详情→操作）
4. **交互触发点识别**：精准定位可触发跳转的组件和交互元素

页面关联性判断维度：
- 信息承接关系：上级页面信息如何延续到下级页面
- 操作逻辑关系：用户完成某操作后的自然跳转路径
- 数据传递关系：页面间需要传递的参数和状态信息
- 返回路径关系：用户如何回到上一级或相关页面

跳转流程构建原则：
- 只能包含页面/场景跳转逻辑，禁止其他业务逻辑节点
- 基于真实用户操作习惯设计跳转路径
- 确保每个跳转都有明确的触发组件和目标页面
- 构建完整的正向和反向导航路径

注意：只允许使用和分析跳转逻辑，禁止使用变量
</事件流程搭建>
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