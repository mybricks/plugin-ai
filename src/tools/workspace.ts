import { OutlineNode, SlotInfo, OutlineInfoManager } from './outline-info'

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

interface FocusInfo {
  pageId: string;
  comId?: string;
  title?: string;
  type?: 'page' | 'uiCom' | 'section';
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
  private outlineInfoManager: OutlineInfoManager;
  private openedComponentDocs: string[] = []

  /** 当前聚焦页面的大纲 */
  focusPageOutlineInfo: OutlineNode

  constructor(config: WorkSpaceConfig, api: WorkSpaceAPI, outlineInfo: OutlineInfoManager) {
    this.api = api;
    this.focusInfo = { ...(config.currentFocus ?? {}) };
    this.outlineInfoManager = outlineInfo;
    
    this.focusPageOutlineInfo = this.outlineInfoManager.getPageOutline(this.focusInfo?.pageId);
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

  /**
   * 打开文档
   */
  openDocument(id: string): void {

    // 检查是否已经打开
    if (this.openedDocuments.some(doc => doc.id === id)) {
      return;
    }

    const isPage = this.focusInfo.pageId === id || !!this.findPageById(id);
    const typeDesc = isPage ? '页面' : '组件'

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
   * 获取项目结构描述
   */
  getProjectStruct(): string {
    const pageTree = PageTreeGenerator.generate(this.getAllPageInfo(), {
      pageId: this.focusInfo.pageId
    });

    const focusDescription = FocusDescriptionGenerator.generate(this.focusInfo);

    const contentHierarchy = PageHierarchyGenerator.generate(
      this.focusPageOutlineInfo,
      this.focusInfo
    );

    const openedDocumentsList = this.generateOpenedDocumentsList();

    return `# 工作空间(Workspace)
工作空间包含整个项目的「页面索引」「聚焦信息」「已打开的文档」，提供的始终都是最新的项目信息。

WARNING: 如果「历史记录」的信息和工作空间冲突，始终以工作空间的信息为准，因为「历史记录」的操作很有可能没保存，且不是最新的。

## 页面索引
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
    // 检查是否已经打开
    if (this.openedComponentDocs.some(ns => ns === namespace)) {
      return;
    }

    this.openedComponentDocs.push(namespace)
  }

  closeComponentDoc(namespace: string) {
    this.openedComponentDocs = this.openedComponentDocs.filter(ns => ns !== namespace)
  }

  hasComponentsDocs(): boolean {
    return this.openedComponentDocs.length > 0
  }

  /**
   * 获取组件文档
   */
  getComponentsDocs(): string {
    return `# 组件使用文档
${this.openedComponentDocs.map(namespace => {
      return this.api.getComponentDoc(namespace).replace('<component>', `<${namespace}文档>`).replace('</component>', `</${namespace}文档>`)
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

/**
 * 页面树生成器
 */
class PageTreeGenerator {
  static generate(pagesInfo: PagesData, options: { pageId?: string } = {}): string {
    const { pageId: focusedPageId } = options;

    const processedPages = this.processRawData(pagesInfo);
    return this.generateTreeText(processedPages, focusedPageId);
  }

  private static processRawData(rawData: PagesData): PageInfo[] {
    // 如果 rawData 是数组
    if (Array.isArray(rawData)) {
      const allPages: PageInfo[] = [];
      rawData.forEach(canvas => {
        if (canvas.pageAry && Array.isArray(canvas.pageAry)) { // 多画布
          allPages.push(...canvas.pageAry.map(page => ({
            id: page.id,
            title: page.title,
            type: page.type,
            componentType: page.componentType || undefined,
            children: page.children || []
          })));
        } else if (canvas.id) {
          allPages.push({ ...canvas })
        }
      });
      return allPages;
    }

    // 如果不是数组
    if (!rawData?.pageAry) {
      return [];
    }

    return rawData.pageAry.map(page => ({
      id: page.id,
      title: page.title,
      type: page.type,
      componentType: page.componentType || undefined,
      children: page.children || []
    }));
  }

  private static generateTreeText(pages: PageInfo[], focusedPageId?: string, level = 0): string {
    let result = '';
    const indent = '  '.repeat(level);

    pages.forEach(page => {
      let line = `${indent}- ${page.title}[id=${page.id}]`;

      if (page.componentType) {
        line += `(${page.componentType})`;
      }

      if (focusedPageId && page.id === focusedPageId) {
        line += ' 【当前聚焦】';
      }

      result += line + '\n';

      if (page.children && page.children.length > 0) {
        result += this.generateTreeText(page.children, focusedPageId, level + 1);
      }
    });

    return result;
  }
}

/**
 * 页面层级生成器
 */
class PageHierarchyGenerator {
  static generate(outlineInfo: OutlineNode, currentFocus: FocusInfo): string {
    let processedData: OutlineNode;

    const focusPageId = currentFocus.pageId;
    const focusComID = currentFocus.comId;

    if (currentFocus.type === 'uiCom') {
      const filteredOutline = this.filterToFocusedComponent(outlineInfo, focusComID!);
      processedData = filteredOutline as OutlineNode
    } else {
      processedData = outlineInfo
    }

    return this.generateTreeDescription(processedData, { pageId: focusPageId, comId: focusComID });
  }

  private static containsComponent(data: OutlineNode, targetId: string): boolean {
    if (!data) return false;
    if (data.id === targetId) return true;

    if (data.slots && Array.isArray(data.slots)) {
      return data.slots.some(slot => {
        if (slot.components && Array.isArray(slot.components)) {
          return slot.components.some(component => this.containsComponent(component, targetId));
        }
        return false;
      });
    }
    return false;
  }

  private static hasChildren(data: OutlineNode): boolean {
    if (!data?.slots || !Array.isArray(data.slots)) {
      return false;
    }
    return data.slots.some(slot => {
      return slot.components && Array.isArray(slot.components) && slot.components.length > 0;
    });
  }

  private static filterToFocusedComponent(data: OutlineNode, targetId: string): OutlineNode | null {
    if (!data) return null;

    if (data.id === targetId) {
      return data;
    }

    if (data.slots && Array.isArray(data.slots)) {
      const filteredSlots = data.slots.map(slot => {
        if (slot.components && Array.isArray(slot.components)) {
          const filteredComponents = slot.components.map(component => {
            if (this.containsComponent(component, targetId)) {
              return this.filterToFocusedComponent(component, targetId);
            } else {
              const hasChildComponents = this.hasChildren(component);
              return {
                ...component,
                slots: undefined, // 移除子组件
                _hasCollapsedChildren: hasChildComponents
              };
            }
          }).filter(Boolean) as OutlineNode[];

          return filteredComponents.length > 0 ? { ...slot, components: filteredComponents } : null;
        }
        return null;
      }).filter(Boolean) as SlotInfo[];

      if (filteredSlots.length > 0) {
        return { ...data, slots: filteredSlots };
      }
    }
    return null;
  }

  private static generateTreeDescription(data: OutlineNode | OutlineNode[], focusInfo: FocusInfo, level = 0): string {
    const indent = '  '.repeat(level);
    let result = '';

    if (!data) {
      return '无内容，代表内容为空';
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return '无内容，代表内容为空';
      }
      data.forEach(item => {
        result += this.generateTreeDescription(item, focusInfo, level);
      });
      return result;
    }

    // 跳过不展示asRoot组件
    if (data.asRoot) {
      if (Array.isArray(data.slots?.[0]?.components)) {
        data.slots?.[0]?.components.forEach(component => {
          result += this.generateTreeDescription(component, focusInfo, level);
        });
        return result;
      }
    }

    if (data.title) {
      const namespace = data.def?.namespace;
      const isFocused = data.id === focusInfo.comId ||
        data.id === focusInfo.pageId;
      const focusMarker = isFocused ? ' 【当前聚焦】' : '';
      const collapsedMarker = data._hasCollapsedChildren ? ' 【子组件已折叠】' : '';

      result += `${indent}- ${data.title}[id=${data.id}]${namespace ? `(${namespace})` : ''}${focusMarker}${collapsedMarker}\n`;
    }

    if (data.slots && Array.isArray(data.slots)) {
      data.slots.forEach(slot => {
        if (slot.components && Array.isArray(slot.components)) {
          slot.components.forEach(component => {
            result += this.generateTreeDescription(component, focusInfo, level + 1);
          });
        }
      });
    }

    return result;
  }
}

/**
 * 聚焦描述生成器
 */
class FocusDescriptionGenerator {
  static generate(currentFocus: FocusInfo): string {
    const { pageId, comId, title, type } = currentFocus;

    if (!currentFocus || (!currentFocus.pageId && !currentFocus.comId)) {
      return '当前没有聚焦到任何页面或组件。';
    }

    let focusDesc = '';

    switch (type) {
      case 'uiCom':
        focusDesc = `组件(title=${title},组件id=${comId})`;
        break;
      case 'page':
      case 'section':
        focusDesc = `页面(title=${title},页面id=${pageId})`;
        break;
      default:
        focusDesc = `未知类型(title=${title})`;
    }

    return `当前已聚焦到${focusDesc}中，后续用户的提问，关于"这个"、"此"、"整体"，甚至不提主语，都是指代此元素及其子组件内容。`;
  }
}


export { WorkSpace, type WorkSpaceConfig, type WorkSpaceAPI };