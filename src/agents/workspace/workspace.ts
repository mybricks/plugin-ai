import { OutlineNode } from './outline-info'
import { FocusOutlineInfoManager, FocusInfo } from './outline-focus'
import { ComponentsManager } from './components-manager'
import { PageTreeGenerator } from './page-tree-generator';

// 类型定义
interface DocumentInfo {
  id: string;
  type: string;
  title: string;
  desc: string;
  content: string;
}

interface PageInfo {
  id: string;
  title: string;
  type: string;
  componentType?: string;
  children?: PageInfo[];
}

interface PagesData {
  pageAry: PageInfo[];
}

interface WorkSpaceConfig {
  currentFocus: FocusInfo;
}

interface WorkSpaceAPI {
  getAllPageInfo(): PagesData | PagesData[];
  getComponentDoc(ns: string): string
}

class WorkSpace {
  private openedDocuments: DocumentInfo[] = [];

  private api: WorkSpaceAPI;
  private focusInfo: FocusInfo;
  private outlineInfoManager: FocusOutlineInfoManager;
  private openedComponentDocs: string[] = []

  /** 当前聚焦页面的大纲 */
  focusPageOutlineInfo: OutlineNode

  constructor(config: WorkSpaceConfig, api: WorkSpaceAPI, outlineInfo: FocusOutlineInfoManager) {
    this.api = api;
    this.focusInfo = { ...(config.currentFocus ?? {}) };
    this.outlineInfoManager = outlineInfo;

    this.focusPageOutlineInfo = this.outlineInfoManager.getFocusPageOutline();
  }


  /**
   * 获取所有页面信息
   */
  private getAllPageInfo(): PagesData | PagesData[] {
    return this.api.getAllPageInfo();
  }

  /**
   * 根据ID查找页面信息
   */
  private findPageById(id: string): PageInfo | null {
    const allPageInfo = this.getAllPageInfo();
    let pages: PageInfo[] = [];

    // 兼容两种返回类型
    if (Array.isArray(allPageInfo)) {
      // 如果是 PagesData[] 类型
      allPageInfo.forEach(pagesData => {
        if (pagesData.pageAry && Array.isArray(pagesData.pageAry)) { // 多画布
          pages.push(...pagesData.pageAry);
        } else {
          pages.push({ ...pagesData } as any as PageInfo) // 单画布
        }
      });
    } else {
      // 如果是 PagesData 类型
      pages = allPageInfo.pageAry || [];
    }

    return this.searchPageInArray(id, pages);
  }

  /**
   * 在页面数组中递归查找页面
   */
  private searchPageInArray(id: string, pages: PageInfo[]): PageInfo | null {
    for (const page of pages) {
      if (page.id === id) {
        return page;
      }
      if (page.children) {
        const found = this.searchPageInArray(id, page.children);
        if (found) return found;
      }
    }
    return null;
  }

  getJsxById = (id: string): string => {
    const isPage = this.focusInfo.pageId === id || !!this.findPageById(id);
    if (isPage) {
      return this.outlineInfoManager.generateJSXByPageId(id)?.jsx ?? '';
    } else {
      return this.outlineInfoManager.generateJSXByOutline(this.focusPageOutlineInfo, [id])?.jsx ?? '';
    }
  }

  /**
   * 打开文档
   */
  openDocument(id: string): void {

    // 检查是否已经打开
    if (this.openedDocuments.some(doc => doc.id === id)) {
      return;
    }

    const isPage = this.focusInfo.pageId === id || !!this.findPageById(id);
    const typeDesc = isPage ? '画布' : '组件'

    let outlineInfo: OutlineNode;
    let targetComponentIds: string[] = [];

    if (isPage) {
      // 如果是页面，直接获取页面信息
      outlineInfo = this.outlineInfoManager.getPageOutline(id);
      targetComponentIds = [];
    } else {
      // 如果是组件，需要获取包含该组件的页面信息
      outlineInfo = this.focusPageOutlineInfo;

      // 获取所有已打开的组件ID（排除页面ID）
      const openedComponentIds = this.openedDocuments
        .filter(doc => doc.type === '组件')
        .map(doc => doc.id);

      // 添加当前要打开的组件ID
      targetComponentIds = [...openedComponentIds, id];
    }

    const componentsInfo = this.outlineInfoManager.generateJSXByOutline(outlineInfo, targetComponentIds);

    // 将已经打开文档的组件配置文档拿出来
    componentsInfo.namespaces.forEach(ns => this.openComponentDoc(ns));

    if (isPage) {
      // 页面类型：直接添加新文档
      this.openedDocuments.push({
        id,
        type: typeDesc,
        title: '',
        desc: '',
        content: componentsInfo.jsx
      });
    } else {
      // 组件类型：检查是否需要更新现有文档或创建新文档
      const existingComponentDocs = this.openedDocuments.filter(doc => doc.type === '组件');

      if (existingComponentDocs.length > 0) {
        // 如果已经有组件文档，更新第一个组件文档的内容
        existingComponentDocs[0].content = componentsInfo.jsx;
        existingComponentDocs[0].id = componentsInfo.id;
        // 可以选择更新ID为组合ID，比如：
        // existingComponentDocs[0].id = targetComponentIds.join(',');
      } else {
        // 如果没有组件文档，创建新的
        this.openedDocuments.push({
          id: componentsInfo.id,
          type: typeDesc,
          title: '',
          desc: '',
          content: componentsInfo.jsx
        });
      }
    }
  }

  /**
   * 关闭文档
   */
  closeDocument(id: string): void {
    this.openedDocuments = this.openedDocuments.filter(doc => doc.id !== id);
  }

  /**
   * 检查文档状态
   */
  checkDocumentStatus(id: string) {
    if (this.openedDocuments.some(doc => doc.id === id)) {
      return true;
    }
    return false;
  }

  /**
   * 获取项目结构描述
   */
  getProjectStruct(): string {
    const pageTree = PageTreeGenerator.generate(this.getAllPageInfo(), {
      pageId: this.focusInfo.pageId
    });

    const focusDescription = this.outlineInfoManager.generateFocusDescription();

    const contentHierarchy = this.outlineInfoManager.generateFocusHierarchy();

    const openedDocumentsList = this.generateOpenedDocumentsList();

    return `# 工作空间(Workspace)
工作空间包含整个项目的「画布索引」「聚焦信息」「已打开的文档」，提供的始终都是最新的项目信息。

WARNING: 如果「历史记录」的信息和工作空间冲突，始终以工作空间的信息为准，因为「历史记录」的操作很有可能没保存，且不是最新的。

## 画布索引
${pageTree}

## 聚焦信息
以下是当前聚焦组件的简略树结构，展示了聚焦元素的父级、兄弟、子级元素的关系。
注意：此树结构并不完整，折叠了无关元素信息，如需详细信息请打开DSL文档获取。

${contentHierarchy}

${focusDescription}

## 已打开的文档
${openedDocumentsList}
`;
  }

  openComponentDoc(namespace: string) {
    // 校验，保证传入的是完整namespace
    const fullNamespace = ComponentsManager.getFullNamespace(namespace)

    // 检查是否已经打开
    if (this.openedComponentDocs.some(ns => ns === fullNamespace)) {
      return;
    }

    this.openedComponentDocs.push(fullNamespace)

    // 加载依赖
    const requires = ComponentsManager.getRequireComponents(fullNamespace)
    if (Array.isArray(requires) && requires.length) {
      requires.forEach(ns => this.openComponentDoc(ns))
    }
  }

  closeComponentDoc(namespace: string) {
    // 校验，保证传入的是完整namespace
    const fullNamespace = ComponentsManager.getFullNamespace(namespace)
    this.openedComponentDocs = this.openedComponentDocs.filter(ns => ns !== fullNamespace)
  }

  hasComponentsDocs(): boolean {
    return this.openedComponentDocs.length > 0
  }

  /**
   * 获取组件文档
   */
  getComponentsDocs(): string {
    const layoutComponentsNs = ComponentsManager.getLayoutComponentsAbbreviationNs()
    return `# 组件使用文档
${layoutComponentsNs.length ? `在以下所有组件中，特别的，${layoutComponentsNs.map(ns => ns).join('、')} 是用于基础布局的组件，辅助标记也仅可以用于这些组件` : ''}

${this.openedComponentDocs.map(namespace => {
  // 校验，保证传入的是完整namespace
  const fullNamespace = ComponentsManager.getFullNamespace(namespace)

  const abbreviationNs = ComponentsManager.getAbbreviation(fullNamespace);
  const componentInfo = ComponentsManager.getAiComponent(fullNamespace)
  const componentAll = componentInfo?.all ?? {}
  const inputs = componentAll?.inputs?.reduce?.((pre: string, { id, title, schema }: any) => {
    let schemaStr = "";
    try {
      schemaStr = `    - schema: ${JSON.stringify(schema)}\n`
    } catch {}
    return pre + `  - ${title} → inputId: \`${id}\`\n` + 
    schemaStr
  }, "")
  const isUI = !componentAll.rtType;
  const slots = componentAll?.slots?.reduce?.((pre: string, { id, title, type, description, inputs }: any) => {
    const isScope = type === "scope" && inputs?.length;
    return pre + `  - ${id}（${title}${description ? ` - ${description}` : ""}）${type === "scope" ? "- 作用域插槽" : ""}\n` + 
    (isScope ? inputs.reduce((pre: string, { id, title, desc }: any) => {
      return pre + `    - ${id}（${title}）${desc ? ` - ${desc}` : ""}\n`
    }, ""): "")
  }, "")

  return this.api.getComponentDoc(fullNamespace)
  .replace("</type>", '</type>' + (isUI ? `\n<slots>
${slots || "无\n"}</slots>\n\n` : ""))
  .replace("</type>", '</type>' + (isUI ? `\n<inputs>
${inputs || "无\n"}</inputs>\n\n` : ""))
  .replace('<component>', `<${abbreviationNs}文档>`).replace('</component>', `</${abbreviationNs}文档>`).replace(new RegExp(`${fullNamespace}`, 'g'), abbreviationNs)
}).join('')}
`
  }

  /**
   * 生成已打开文档列表
   */
  private generateOpenedDocumentsList(): string {
    if (this.openedDocuments.length === 0) {
      return '暂无打开的文档';
    }

    return this.openedDocuments.map(doc =>
      `- ${doc.title}[id=${doc.id}](${doc.type})\n  描述：${doc.desc}\n  内容：${doc.content}`
    ).join('\n\n');
  }
}

export { WorkSpace, type WorkSpaceConfig, type WorkSpaceAPI };
