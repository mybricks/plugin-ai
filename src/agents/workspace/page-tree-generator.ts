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


/**
 * 页面树生成器
 */
export class PageTreeGenerator {
  static generate(pagesInfo: PagesData | PagesData[], options: { pageId?: string } = {}): string {
    const { pageId: focusedPageId } = options;

    const processedPages = this.processRawData(pagesInfo);
    return this.generateTreeText(processedPages, focusedPageId);
  }

  private static processRawData(rawData: PagesData | PagesData[]): PageInfo[] {
    // 如果 rawData 是数组
    if (Array.isArray(rawData)) {
      const allPages: PageInfo[] = [];
      rawData.forEach((canvas: any) => {
        if (canvas.pageAry && Array.isArray(canvas.pageAry)) { // 多画布
          allPages.push(...canvas.pageAry.map((page: any) => ({
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

    return rawData.pageAry.map((page: PageInfo) => ({
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