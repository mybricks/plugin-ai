import { context } from './../context';
import { MYBRICKS_TOOLS } from "./../tools"

export const requestGeneratePageAgent = (pageId: string, pageTitle: string, params: any, prompts: any) => {

  params?.onProgress?.('start')

  context.rxai.requestAI({
    ...params,
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
        params?.onProgress?.("complete");
      },
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
        getFocusRootComponentDoc: () => context.api?.page?.api?.getPageContainerPrompts?.(pageId) as string,
        getTargetId: () => pageId as string,
        appendPrompt: prompts.systemAppendPrompts,
        examples: prompts.generatePageActionExamplesPrompts,
        onActions: (actions, status) => {
          context.api?.page?.api?.updatePage?.(pageId, actions, status)
        },
        onClearPage: () => {
          context.api?.page?.api?.clearPageContent?.(pageId)
        }
      }),
    ],
    presetMessages: [
      {
        role: 'user',
        content: `聚焦位置发生变化，当前聚焦在哪里？`
      },
      {
        role: 'assistant',
        content: `当前已聚焦到${`页面(title=${pageTitle},id=${pageId})`}中，后续用户的提问，关于”这个“、“此”，甚至不提主语，都是指代此元素。
    <当前聚焦元素的内容简介>
      内容为空
    </当前聚焦元素的内容简介>
                    `
      }
    ]
  });
}

async function createCanvasByAICanvas (aiCanvas: any, prompts: any) {
  const { id, title } = context.api.page?.api?.createCanvas?.()

  aiCanvas.pages.forEach(async page => {

    const pageRef = await context.api.page?.api?.createPage?.(id, page.title, {
      type: "normal",
      title: page.title,
      template: {
        namespace: 'mybricks.harmony.systemPage',
        deletable: false,
        asRoot: true,
        data: {
          useTabBar: false,
        },
      },
      inputs: [
        {
          id: "open",
          title: "打开",
          schema: {
            type: "object",
          },
        },
      ],
    })

    await requestGeneratePageAgent(pageRef.id, page.title, {
      message: page.prd,
      onProgress: pageRef.onProgress,
      id: pageRef.id,
    }, prompts)
  })


  return {

  }
}

export const createRequestGenerateCanvasAgent = (prompts: any) => (params: any) => {
  params?.onProgress?.('start')

  context.rxai.requestAI({
    ...params,
    message: params?.message,
    key: params.id,
    emits: {
      write: () => { },
      complete: () => {
        params?.onProgress?.("complete");
      },
      error: () => {
        params?.onProgress?.("error");
      },
      cancel: () => {
        params?.onProgress?.("complete");
      },
    },
    tools: [
      MYBRICKS_TOOLS.AnalyzeAndExpandPrd({
        onProjectCreate: (projectJson) => {
          createCanvasByAICanvas(projectJson, prompts)
        }
      })
    ],
  });
}