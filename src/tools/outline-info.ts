export interface SlotInfo {
  id: string;
  title?: string;
  layout?: any;
  components?: OutlineNode[];
}

export interface OutlineNode {
  id: string;
  title: string;
  def?: {
    namespace?: string;
  };
  asRoot?: boolean;
  data?: any;
  style?: any;
  slots?: SlotInfo[];
  _hasCollapsedChildren?: boolean;
}

export interface ComponentsResult {
  id: string;
  jsx: string;
  namespaces: string[];
}

const ROOT_NAMESPACE = 'root';
const ROOT_ID = '_root_';
const ROOT_SLOT_ID = '_rootSlot_';

export class OutlineInfoManager {

  api: any;

  constructor({ api }: { api: any }) {
    this.api = api;
  }

  private getOutlineInfo(id: string, type: string) {
    if (type !== 'page') {
      return this.api?.uiCom?.api?.getOutlineInfo(id)
    } else {
      return this.api?.page?.api?.getOutlineInfo(id)
    }
  }

  getPageOutline(pageId: string) {
    return this.normalizePageOutline(this.getOutlineInfo(pageId, 'page'), pageId);
  }

  getUiComOutline(componentId: string) {
    return this.getOutlineInfo(componentId, 'uiCom');
  }

  private normalizePageOutline(outline: OutlineNode, pageId: string): OutlineNode {
    // 没有设置asRoot组件，兼容成asRoot组件结构
    if (outline?.id === pageId) {
      const normalized: OutlineNode = {
        ...outline,
        slots: [{
          id: ROOT_SLOT_ID,
          components: outline.components,
          layout: outline.layout
        }],
        def: {
          ...(outline.def || {}),
          namespace: ROOT_NAMESPACE
        },
        asRoot: true
      };
      
      return {
        id: pageId,
        title: outline.title,
        slots: [{ id: ROOT_ID, components: [normalized] }]
      };
    }

    return {
      id: pageId,
      title: outline.title,
      slots: [{ id: ROOT_ID, components: [outline] }]
    };
  }

  getComponentIdToTitleMap(pageId: string) {
    const outline = this.getPageOutline(pageId);
    const componentMap = new Map<string, string>();

    componentMap.set(ROOT_ID, outline.title ?? '页面根节点');

    function traverse(data: any) {
      if (!data) return;

      if (Array.isArray(data)) {
        data.forEach(item => traverse(item));
        return;
      }

      if (data.id && data.title) {
        componentMap.set(data.id, data.title);
      }

      if (data.slots && Array.isArray(data.slots)) {
        data.slots.forEach((slot: SlotInfo) => {
          if (slot.components && Array.isArray(slot.components)) {
            slot.components.forEach(component => traverse(component));
          }
        });
      }
    }

    traverse(outline);
    return componentMap;
  }

  generateJSXByPageId(pageId: string, targetComponentIds: string[] = []): ComponentsResult {
    const outline = this.getPageOutline(pageId);
    return this.generateJSXByOutline(outline, targetComponentIds);
  }

  generateJSXByOutline(outlineInfo: OutlineNode, targetComponentIds: string[] = []): ComponentsResult {
    return OutlineJSXGenerator.generate(outlineInfo, targetComponentIds);
  }

  findParentNodeByComId(pageOutlineInfo: OutlineNode, comId: string): OutlineNode | null {
    function helper(node: OutlineNode): OutlineNode | null {
      if (!node || !node.slots) return null;
      for (const slot of node.slots || []) {
        if (slot.components && Array.isArray(slot.components)) {
          for (const component of slot.components) {
            if (component.id === comId) {
              return node;
            }
            // 向下递归
            const found = helper(component);
            if (found) return found;
          }
        }
      }
      return null;
    }
    return helper(pageOutlineInfo);
  }
}

class OutlineJSXGenerator {
  private static namespacesSet = new Set<string>();

  static generate(outlineInfo: OutlineNode, targetComponentIds: string[] = []): ComponentsResult {
    this.namespacesSet.clear();

    if (targetComponentIds.length === 0) {
      const jsx = this.processData(outlineInfo);
      return {
        id: outlineInfo.id,
        jsx,
        namespaces: Array.from(this.namespacesSet)
      };
    }

    if (targetComponentIds.length === 1) {
      const targetNode = this.findNodeById(outlineInfo, targetComponentIds[0]);
      if (targetNode) {
        const jsx = this.processData(targetNode);
        return {
          id: targetNode.id,
          jsx,
          namespaces: Array.from(this.namespacesSet)
        };
      }
    }

    const ancestorNodes = this.findMinimalCommonAncestors(outlineInfo, targetComponentIds);
    const jsx = ancestorNodes.map(node => this.processData(node)).join('\n');

    return {
      id: ancestorNodes[0]?.id,
      jsx,
      namespaces: Array.from(this.namespacesSet)
    };
  }

  private static findMinimalCommonAncestors(root: OutlineNode, targetIds: string[]): OutlineNode[] {
    if (targetIds.length === 0) return [root];
    if (targetIds.length === 1) {
      const targetNode = this.findNodeById(root, targetIds[0]);
      return targetNode ? [targetNode] : [];
    }

    const paths: OutlineNode[][] = [];
    for (const targetId of targetIds) {
      const path = this.findPathToNode(root, targetId);
      if (path) {
        paths.push(path);
      }
    }

    if (paths.length === 0) {
      return [];
    }
    if (paths.length === 1) {
      return [paths[0][paths[0].length - 1]];
    }

    let commonAncestor: OutlineNode | null = null;
    const minLength = Math.min(...paths.map(path => path.length));

    for (let i = 0; i < minLength; i++) {
      const currentNodes = paths.map(path => path[i]);
      const firstNode = currentNodes[0];

      if (currentNodes.every(node => node.id === firstNode.id)) {
        commonAncestor = firstNode;
      } else {
        break;
      }
    }

    if (commonAncestor) {
      return [commonAncestor];
    }

    return [root];
  }

  private static findPathToNode(root: OutlineNode, targetId: string): OutlineNode[] | null {
    if (root.id === targetId) {
      return [root];
    }

    if (root.slots && Array.isArray(root.slots)) {
      for (const slot of root.slots) {
        if (slot.components && Array.isArray(slot.components)) {
          for (const component of slot.components) {
            const path = this.findPathToNode(component, targetId);
            if (path) {
              return [root, ...path];
            }
          }
        }
      }
    }

    return null;
  }

  private static findNodeById(root: OutlineNode, targetId: string): OutlineNode | null {
    if (root.id === targetId) {
      return root;
    }

    if (root.slots && Array.isArray(root.slots)) {
      for (const slot of root.slots) {
        if (slot.components && Array.isArray(slot.components)) {
          for (const component of slot.components) {
            const found = this.findNodeById(component, targetId);
            if (found) return found;
          }
        }
      }
    }

    return null;
  }

  private static extractLayout(style: any): Record<string, any> {
    if (!style) return {};

    const layout: Record<string, any> = {};

    ['width', 'height', 'margin', 'marginLeft', 'marginRight', 'marginTop', 'marginBottom']
      .forEach(prop => {
        if (style[prop] !== undefined) {
          layout[prop] = style[prop];
        }
      });

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

  private static processData(node: OutlineNode | OutlineNode[]): string {
    if (!node) return '';

    if (Array.isArray(node)) {
      return node.map(item => this.processData(item)).filter(Boolean).join('\n');
    }

    if (node.id && node.def?.namespace) {
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

  private static generateComponentJSX(node: OutlineNode, indent = ''): string {
    if (!node?.id) return '';

    const namespace = node.def?.namespace;
    if (namespace !== ROOT_NAMESPACE) {
      this.namespacesSet.add(namespace);
    }
    const layout = this.extractLayout(node.style);
    const styleArray = this.extractStyleArray(node.style);

    let jsx;

    if (node.asRoot) {
      jsx = `<${ROOT_NAMESPACE} id="${ROOT_ID}"` + (node.data ? ` data={${JSON.stringify(node.data || {})}}` : '');
    } else {
      jsx = `<${namespace} id="${node.id}"` + (node.data ? ` data={${JSON.stringify(node.data || {})}}` : '');
    }

    if (Object.keys(layout).length > 0) {
      jsx += ` layout={${JSON.stringify(layout)}}`;
    }

    if (styleArray.length > 0) {
      jsx += ` styleAry={[${styleArray.map(style => `"${style}"`).join(', ')}]}`;
    }

    jsx += ' >';

    const slotsJSX = this.generateSlotsJSX(node.slots || [], indent + '  ');
    if (slotsJSX) {
      jsx += slotsJSX;
      jsx += `\n${indent}</${namespace}>`;
    } else {
      jsx += ' />';
    }

    return jsx;
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
}
