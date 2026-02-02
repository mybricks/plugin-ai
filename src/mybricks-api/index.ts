import { createActionsParser, ComIdTransform } from '../tools/utils';
import { ComponentsManager } from '../agents/workspace/components-manager';
import { OutlineInfoManager } from '../agents/workspace/outline-info';
import { PageTreeGenerator } from '../agents/workspace/page-tree-generator';

class UITree {
  nodeMap = new Map();
  comIdToNamespace = new Map();
  comIdTransform = new ComIdTransform([]);
  varIdTransform = new ComIdTransform([]);

  getComId(comId: string) {
    return this.comIdTransform.getComId(comId);
  }

  addNode(node: any) {
    const { id, parent } = node;
    const namespace = this.comIdToNamespace.get(parent.id);
    let scope = false
    if (namespace) {
      const component = ComponentsManager.getAiComponent(namespace);
      if (component?.all?.slots?.find((slot: any) => slot.id === parent.slotId)?.type === "scope") {
        scope = true;
      }
    }
    this.nodeMap.set(id, {
      id,
      parent: {
        ...parent,
        scope
      }
    });
  }

  getScope(nodeId: any) {
    let node = this.nodeMap.get(nodeId);
    while (node) {
      if (node.parent.id === "_root_") {
        return node.parent;
      }
      if (node.parent.scope) {
        return node.parent;
      }

      node = this.nodeMap.get(node.parent.id);
    }
  }

  setNamespace(comId: string, namespace: string) {
    this.comIdToNamespace.set(comId, namespace);
  }
}

interface MyBricksAiAPI {
  global: {
    title: string;
    api: {
      getAllPageInfo: () => {pageAry: any[]}[];
      getAllComDefPrompts: () => string;
      getComEditorPrompts: (...params: any) => string;
    }
  };
  page: {
    title: string;
    api: {
      updatePage: (...params: any) => void;
      getPageDSLPrompts: (...params: any) => string;
      getPageContainerPrompts: (...params: any) => string;
      clearPageContent: (pageId: string) => void
      getOutlineInfo: (...params: any) => any
      createCanvas: () => { id: string; title: string; }
      createPage: (id: string, title: string, config?: any) => { id: string; onProgress: Function; }
      getPageOnProcess: (...params: any) => any;
    }
  };
  uiCom: {
    title: string;
    api: {
      updateCom: (...params: any) => void;
      getComPrompts: (...params: any) => string;
      getComDSLPrompts: (...params: any) => string;
      /** @deprecated 废弃 */
      getComEditorPrompts: (...params: any) => string;
      getOutlineInfo: (...params: any) => any
      getComOnProcess: (...params: any) => any;
    }
  }
  diagram: {
    title: string;
    api: {
      createDiagram: (...args: any) => { id: string; title: string }
      updateDiagram: (...args: any) => void;
      getDiagramInfo: (...args: any) => any;
      getDiagramInfoByVarId: (...args: any) => any;
      getDiagramInfoByListenerInfo: (...args: any) => any;
    }
  },
  logicCom: {
    title: string;
    api: {
      getOutlineInfo: (...params: any) => any;
      updateCom: (...params: any) => any;
    }
  }
}

interface MyBricksAPIConfig {
  api: MyBricksAiAPI;
}

interface OperatorContext {
  pageId: string;
  parser: any;
  uiTree: UITree;
}

export class MyBricksAPI {
  private api: MyBricksAiAPI;
  private outlineInfoManager: OutlineInfoManager;
  private operatorMap = new Map<string, OperatorContext>();

  constructor(config: MyBricksAPIConfig) {
    this.api = config.api;
    this.outlineInfoManager = new OutlineInfoManager({ api: this.api });
  }

  createPageOperator = async (pageId: string) => {
    const parser = createActionsParser({ enabledActionTags: true });
    const uiTree = new UITree();

    await this.api.page.api.updatePage(pageId, [], "start");

    this.operatorMap.set(pageId, { pageId, parser, uiTree });
  }

  updatePageOperator = async (pageId: string, actionsStr: string) => {
    const context = this.operatorMap.get(pageId);
    if (!context) return;

    const { parser, uiTree } = context;
    const actions = parser(actionsStr);

    actions.forEach((action: any) => {
      if (action.type === "addChild") {
        const childComId = action.params.comId;
        action.params.comId = uiTree.comIdTransform.addComId(childComId);
        uiTree.setNamespace(action.params.comId, action.params.namespace);

        const parentComId = action.comId;

        if (parentComId !== "_root_") {
          action.comId = uiTree.getComId(parentComId);
        }

        uiTree.addNode({
          id: action.params.comId,
          parent: {
            id: action.comId,
            slotId: action.target,
          }
        })
      } else if (action.type === "doConfig") {
        const comId = action.comId;
        if (comId !== "_root_") {
          action.comId = uiTree.getComId(comId);
        }
      }
    })

    for (const action of actions) {
      await this.api.page.api.updatePage(pageId, [action], "ing");
    }
  }

  completePageOperator = async (pageId: string) => {
    const context = this.operatorMap.get(pageId);
    if (!context) return;

    await this.api.page.api.updatePage(pageId, [], "complete");
    this.operatorMap.delete(pageId);
  }

  getAllComDefPrompts = async () => {
    return this.api.global.api.getAllComDefPrompts();
  }

  getComEditorPrompts = async (namespace: string) =>{
    return this.api.global.api.getComEditorPrompts(namespace);
  }

  getPageContent = async (pageId: string) => {
    return this.outlineInfoManager.generateJSXByPageId(pageId);
  }

  getPagesInfo = async () => {
    const pagesInfo = this.api.global.api.getAllPageInfo();
    const pageTree = PageTreeGenerator.generate(pagesInfo);
    return pageTree;
  }
}
