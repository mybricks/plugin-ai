import { context } from './../context';
import { MYBRICKS_TOOLS } from "./../tools"

window.plugin_ai_context = context

export const requestGeneratePageAgent = (pageId: string, pageTitle: string, params: any) => {

  const prompts = context.prompts

  params?.onProgress?.('start')

  context.rxai.requestAI({
    ...params,
    message: params?.message,
    key: pageId,
    emits: {
      write: () => { },
      complete: () => {
        // params?.onProgress?.("complete");
      },
      error: () => {
        params?.onProgress?.("error");
      },
      cancel: () => {
        // params?.onProgress?.("complete");
      },
    },
    planList: ["generate-page-prd-and-require-component", "generate-page"],
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

          if (status === 'complete') {
            params?.onProgress?.("complete");
          }
        },
        onClearPage: () => {
          context.api?.page?.api?.clearPageContent?.(pageId)
        }
      }),
    ],
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

    const pageRef = await context.api.page?.api?.createPage?.(canvasId, page.title, {
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
    pageArray.push({ page, pageRef })
  }

  pageArray.forEach(async ({ page, pageRef }) => {
    await requestGeneratePageAgent(pageRef.id, page.title, {
      message: `标题：${page.title}
<需求>
${page.prd}
</需求>

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
          reject('error')
          params?.onProgress?.("error");
        },
        cancel: () => {
          params?.onProgress?.("complete");
        },
      },
      planList: ["analyze-and-expand-prd"],
      tools: [
        MYBRICKS_TOOLS.AnalyzeAndExpandPrd({
          onProjectCreate: (projectJson) => {
            if (!projectJson || !projectJson.title) {
              return reject('不合法的项目文件')
            }
            let canvasId
            try {
              const { id, title } = context.api.page?.api?.createCanvas?.()
              canvasId = id
            } catch (error) {
              reject(error)
            }
            resolve('complete')
            if (canvasId) {
              createCanvasByAICanvas(canvasId, projectJson);
            }
          }
        })
      ],
    });
  })
}