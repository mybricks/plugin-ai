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
        onComponentDocOpen: (namespace) => {
          workspace.openComponentDoc(namespace)
        },
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

<组件使用规则>
**核心原则：**
如果一个区域展示的内容是由多个相同或相似的子项组成（例如：列表、网格等），并且这些子项的结构是相同且固定的，使用支持**遍历渲染**（Loop Rendering）的组件。

**目的：**
通过变量绑定和循环，动态生成这些子项，而不是在页面中直接写死每个子项的配置/内容。

**优势：**
1. **节省页面体积**：无论有多少子项，父组件的核心逻辑（渲染规则）是固定的，不会随子项数量增加而变大。
2. **提升渲染性能/便于维护**：避免了大量重复组件的创建和维护，浏览器渲染更高效，且更易于优化和调整。

**反面模式（应避免）：**
不要在页面中直接使用多个相同结构的组件。
例如：
<Item title="项1" />
<Item title="项2" />
<Item title="项3" />
...

**正面模式（应优先）：**
使用循环或列表渲染机制。

**总结：**
**只要数据是动态的、列表状的，就应优先考虑使用支持遍历渲染的组件。**
</组件使用规则>

<事件流程>
必须分析/搭建的流程：
1. 基于可跳转页面，深度分析页面间的关联性和逻辑关系，构建合理的页面跳转流程。
    - 关联性分析要求：
      1. **功能关联分析**：识别页面间的功能依赖关系和业务逻辑连接
      2. **用户路径分析**：梳理用户在页面间的自然跳转流程和跳转需求
      3. **信息层级分析**：判断页面间的信息深度关系（概览→详情→操作）
      4. **交互触发点识别**：精准定位可触发跳转的组件和交互元素
  
    - 页面关联性判断维度：
      - 信息承接关系：上级页面信息如何延续到下级页面
      - 操作逻辑关系：用户完成某操作后的自然跳转路径
      - 数据传递关系：页面间需要传递的参数和状态信息
      - 返回路径关系：用户如何回到上一级或相关页面

    - 跳转流程构建原则：
      - 只能包含页面跳转逻辑，禁止其他业务逻辑节点
      - 基于真实用户操作习惯设计跳转路径
      - 确保每个跳转都有明确的触发组件和目标页面
      - 构建完整的正向和反向导航路径

2. 变量绑定。
  **规则**：
  - 带作用域插槽的遍历渲染UI组件，对于**具备作用域插槽能力，且支持批量遍历渲染**的UI组件，若该组件提供了对应的数据/状态配置项（支持变量绑定功能），则**必须强制进行变量绑定**，同时需为绑定的变量声明合理、符合业务场景的默认值（默认值需匹配变量数据类型，如数组类型默认值可为空数组，对象类型默认值可为空对象等）。
  - 动态数据渲染的UI组件，对于**依赖动态数据实现内容渲染**的UI组件或多个UI组件的集合（例如：详情展示、用户信息展示、动态列表、数据统计等），必须先**主动创建对应的数据变量**，再将变量与UI组件进行绑定，同时必须为该变量设置合适的默认值，确保组件初始化时的渲染稳定性，最终实现以变量状态变化驱动UI自动更新的目标。

  **核心要求**：
  所有动态内容渲染的UI组件，都必须通过「变量绑定」的方式实现，禁止直接写入静态数据；通过变量的定义、绑定与状态更新，形成「变量驱动UI更新」的完整链路，保障UI渲染的灵活性与可维护性。

注意：
1. 只允许使用mock数据，目前应用的生成不包含接口，使用接口调用会报错。
2. 除上述“必须分析/搭建的流程”所述的内容外，禁止一切其它形式的事件流程和变量。
3. 事件流程需求分析必须包含页面跳转和变量绑定
</事件流程>
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