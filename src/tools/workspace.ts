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
  title: string;
  type: 'page' | 'uiCom' | 'section';
}

interface OutlineNode {
  id: string;
  title: string;
  def?: {
    namespace?: string;
  };
  data?: any;
  style?: any;
  slots?: SlotInfo[];
  _hasCollapsedChildren?: boolean;
}

interface SlotInfo {
  id: string;
  title?: string;
  layout?: any;
  components?: OutlineNode[];
}

interface ComponentsResult {
  jsx: string;
  namespaces: string[];
}

interface WorkSpaceConfig {
  currentFocus: FocusInfo;
}

interface WorkSpaceAPI {
  getOutlineInfo(id: string, type: string): OutlineNode;
  getAllPageInfo(): PagesData | PagesData[];
  getComponentDoc(ns: string): string 
}

class WorkSpace {
  private openedDocuments: DocumentInfo[] = [];
 
  private api: WorkSpaceAPI;
  private currentFocus: FocusInfo;

  private openedComponentDocs: string[] = []

  constructor(config: WorkSpaceConfig, api: WorkSpaceAPI) {
    this.api = api;
    this.currentFocus = config.currentFocus ?? {};
  }

  /**
   * 获取页面大纲信息
   */
  getOutlineInfo(id: string, type: string): OutlineNode {
    return this.api.getOutlineInfo(id, type);
  }

  /**
   * 获取所有页面信息
   */
  getAllPageInfo(): PagesData | PagesData[] {
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
        if (pagesData.pageAry && Array.isArray(pagesData.pageAry)) {
          pages.push(...pagesData.pageAry);
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

    const isPage = !!this.findPageById(id);
    const type = isPage ? 'page' : 'uiCom';
    const typeDesc = isPage ? '页面' : '组件'

    const outlineInfo = this.getOutlineInfo(id, type);
    const componentsInfo = ComponentsInfoGenerator.generate(outlineInfo);

    // 将已经打开文档的组件配置文档拿出来
    componentsInfo.namespaces.forEach(ns => this.openComponentDoc(ns));

    this.openedDocuments.push({
      id,
      type: typeDesc,
      title: '',
      desc: '',
      content: componentsInfo.jsx
    });
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
      pageId: this.currentFocus.pageId
    });

    const focusDescription = FocusDescriptionGenerator.generate(this.currentFocus);

    const contentHierarchy = PageHierarchyGenerator.generate(
      this.getOutlineInfo(this.currentFocus.pageId, 'page'),
      this.currentFocus
    );

    const openedDocumentsList = this.generateOpenedDocumentsList();

    return `# 工作空间(Workspace)
工作空间包含整个项目的「页面索引」「聚焦的页面和组件」「已打开」，提供的永远都是最新的项目信息。

## 页面索引
${pageTree}

## 聚焦的页面及其最终聚焦组件
${contentHierarchy}

${focusDescription}

## 已打开的文档
${openedDocumentsList}
`;
  }

  openComponentDoc(namespace:string){
    // 检查是否已经打开
    if (this.openedComponentDocs.some(ns => ns === namespace)) {
      return;
    }

    this.openedComponentDocs.push(namespace)
  }

  closeComponentDoc(namespace:string){
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
        if (canvas.pageAry && Array.isArray(canvas.pageAry)) {
          allPages.push(...canvas.pageAry.map(page => ({
            id: page.id,
            title: page.title,
            type: page.type,
            componentType: page.componentType || undefined,
            children: page.children || []
          })));
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

    if (currentFocus.type === 'uiCom') {
      const filteredOutline = this.filterToFocusedComponent(outlineInfo, currentFocus.comId!);
      processedData = {
        id: currentFocus.pageId,
        title: '页面',
        slots: [{ id: 'root', components: [filteredOutline] }]
      };
    } else {
      processedData = {
        id: currentFocus.pageId,
        title: '页面',
        slots: [{ id: 'root', components: [outlineInfo] }]
      };
    }

    return this.generateTreeDescription(processedData, currentFocus);
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

  private static generateTreeDescription(data: OutlineNode | OutlineNode[], currentFocus: FocusInfo, level = 0): string {
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
        result += this.generateTreeDescription(item, currentFocus, level);
      });
      return result;
    }

    if (data.title) {
      const namespace = data.def?.namespace;
      const isFocused = (currentFocus.type === 'uiCom' && data.id === currentFocus.comId) ||
        (currentFocus.type === 'page' && data.id === currentFocus.pageId);
      const focusMarker = isFocused ? ' 【当前聚焦】' : '';
      const collapsedMarker = data._hasCollapsedChildren ? ' 【子组件已折叠】' : '';

      result += `${indent}- ${data.title}[id=${data.id}]${namespace ? `(${namespace})` : ''}${focusMarker}${collapsedMarker}\n`;
    }

    if (data.slots && Array.isArray(data.slots)) {
      data.slots.forEach(slot => {
        if (slot.components && Array.isArray(slot.components)) {
          slot.components.forEach(component => {
            result += this.generateTreeDescription(component, currentFocus, level + 1);
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

/**
 * 组件信息生成器
 */
class ComponentsInfoGenerator {
  private static namespacesSet = new Set<string>();

  static generate(outlineInfo: OutlineNode): ComponentsResult {
    this.namespacesSet.clear();
    const jsx = this.processData(outlineInfo);

    return {
      jsx,
      namespaces: Array.from(this.namespacesSet)
    };
  }

  private static extractLayout(style: any): Record<string, any> {
    if (!style) return {};

    const layout: Record<string, any> = {};

    // 基础尺寸属性
    ['width', 'height', 'margin', 'marginLeft', 'marginRight', 'marginTop', 'marginBottom']
      .forEach(prop => {
        if (style[prop] !== undefined) {
          layout[prop] = style[prop];
        }
      });

    // 布局属性
    if (style.layout !== undefined) {
      if (style.layout === 'flex-column' || style.layout === 'flex') {
        layout.display = 'flex';
        layout.flexDirection = 'column';
      }
      if (style.layout === 'flex-row') {
        layout.display = 'flex';
        layout.flexDirection = 'row';
      }
      if (style.alignItems) layout.alignItems = style.alignItems;
      if (style.justifyContent) layout.justifyContent = style.justifyContent;
    }

    return layout;
  }

  private static extractStyleArray(style: any): string[] {
    if (!style?.css || !Array.isArray(style.css)) return [];

    return style.css.map((cssItem: any) => {
      const selector = cssItem.selector || '';
      const cssProps = cssItem.css || {};

      const cssString = Object.entries(cssProps)
        .map(([key, value]) => `${key}: '${value}'`)
        .join(', ');

      return `${selector} : { ${cssString} }`;
    });
  }

  private static generateSlotsJSX(slots: SlotInfo[], indent = '  '): string {
    if (!slots || slots.length === 0) return '';

    let slotsJSX = '';
    slots.forEach(slot => {
      if (slot.id) {
        slotsJSX += `\n${indent}<slots.${slot.id}`;

        if (slot.title) {
          slotsJSX += ` title="${slot.title}"`;
        }

        if (slot.layout) {
          slotsJSX += ` layout={${JSON.stringify(this.extractLayout(slot.layout))}}`;
        }

        slotsJSX += '>';

        if (slot.components && Array.isArray(slot.components)) {
          slot.components.forEach(component => {
            const childJSX = this.generateComponentJSX(component, indent + '    ');
            if (childJSX) {
              slotsJSX += `\n${indent}  ${childJSX}`;
            }
          });
        }

        slotsJSX += `\n${indent}</slots.${slot.id}>`;
      }
    });

    return slotsJSX;
  }

  private static generateComponentJSX(node: OutlineNode, indent = ''): string {
    if (!node?.id) return '';

    const namespace = node.def?.namespace || 'content';
    this.namespacesSet.add(namespace);

    const dataStr = JSON.stringify(node.data || {});
    const layout = this.extractLayout(node.style);
    const styleArray = this.extractStyleArray(node.style);

    let jsx = `<${namespace} id="${node.id}" data={${dataStr}}`;

    if (Object.keys(layout).length > 0) {
      jsx += ` layout={${JSON.stringify(layout)}}`;
    }

    if (styleArray.length > 0) {
      jsx += ` styleAry={[${styleArray.map(style => `"${style}"`).join(', ')}]}`;
    }

    const slotsJSX = this.generateSlotsJSX(node.slots || [], indent + '  ');
    if (slotsJSX) {
      jsx += slotsJSX;
      jsx += `\n${indent}</${namespace}>`;
    } else {
      jsx += ' />';
    }

    return jsx;
  }

  private static processData(node: OutlineNode | OutlineNode[]): string {
    if (!node) return '';

    if (Array.isArray(node)) {
      return node.map(item => this.processData(item)).filter(Boolean).join('\n');
    }

    if (node.id) {
      return this.generateComponentJSX(node);
    }

    if (node.slots && Array.isArray(node.slots)) {
      return node.slots.map(slot => {
        if (slot.components && Array.isArray(slot.components)) {
          return this.processData(slot.components);
        }
        return '';
      }).filter(Boolean).join('');
    }

    return '';
  }
}

export { WorkSpace, type WorkSpaceConfig, type WorkSpaceAPI };