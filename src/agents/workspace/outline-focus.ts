import { OutlineInfoManager, type OutlineNode, type SlotInfo } from './outline-info';

export interface FocusInfo {
  pageId?: string;
  comId?: string;
  title?: string;
  type?: 'page' | 'uiCom' | 'section';
  focusArea?: {
    selector: string;
    title: string;
  }
}

class PageHierarchyGenerator {
  static generate(outlineInfo: OutlineNode, currentFocus: FocusInfo): string {
    const processedData = currentFocus.type === 'uiCom'
      ? this.filterToFocusedComponent(outlineInfo, currentFocus.comId!)
      : outlineInfo;

    return this.generateTreeDescription(processedData as OutlineNode, {
      pageId: currentFocus.pageId,
      comId: currentFocus.comId,
    });
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
                slots: undefined,
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

class FocusDescriptionGenerator {
  static generate(currentFocus: FocusInfo): string {
    const { pageId, comId, title, type } = currentFocus ?? {};

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

export class FocusOutlineInfoManager extends OutlineInfoManager {
  private focusInfo: FocusInfo;
  private focusPageOutlineInfo: OutlineNode | null;

  constructor({ api, focusInfo }: { api: any, focusInfo: FocusInfo }) {
    super({ api });
    this.focusInfo = { ...focusInfo };
    this.focusPageOutlineInfo = focusInfo?.pageId ? this.getPageOutline(focusInfo.pageId) : null;
  }

  getFocusPageOutline(): OutlineNode | null {
    return this.focusPageOutlineInfo;
  }

  generateFocusHierarchy(): string {
    if (!this.focusPageOutlineInfo || !this.focusInfo?.pageId) {
      return '无内容，代表内容为空';
    }
    return PageHierarchyGenerator.generate(this.focusPageOutlineInfo, this.focusInfo);
  }

  generateFocusDescription(): string {
    return FocusDescriptionGenerator.generate(this.focusInfo);
  }
}
