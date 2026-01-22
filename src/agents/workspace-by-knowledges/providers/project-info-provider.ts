/**
 * 项目信息 Provider
 * 提供项目的画布索引信息
 */

import { DirectoryProvider, IKnowledgeNode, KnowledgeNodeType } from '../../knowledges/types';
import { context } from '../../../context';

/**
 * 页面信息
 */
interface PageInfo {
  id: string;
  title: string;
  type: string;
  componentType?: string;
  children?: PageInfo[];
}

/**
 * 画布数据
 */
interface PagesData {
  pageAry: PageInfo[];
}

/**
 * 获取所有页面信息
 */
function getAllPages(): PagesData | PagesData[] {
  const result = context.api?.global?.api?.getAllPageInfo?.();
  return result || [];
}

/**
 * 获取当前聚焦的页面ID
 */
function getFocusedPageId(): string | undefined {
  return context.currentFocus?.pageId;
}

/**
 * 处理原始数据
 */
function processRawData(rawData: PagesData | PagesData[]): PageInfo[] {
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

/**
 * 生成树形文本
 */
function generateTreeText(pages: PageInfo[], focusedPageId?: string, level = 0): string {
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
      result += generateTreeText(page.children, focusedPageId, level + 1);
    }
  });

  return result;
}

/**
 * 创建项目信息 Provider
 * 作为单个文件呈现，包含画布索引
 */
export function createProjectInfoProvider(): DirectoryProvider {
  const providerId = 'project-info';
  const providerName = '项目信息';
  
  return new DirectoryProvider({
    id: providerId,
    name: providerName,
    description: '包含项目的画布索引',
    weight: 100, // 高权重，排在最前面
    
    // 自定义根节点为文件而不是目录
    customRootNode: {
      id: providerId,
      name: providerName,
      type: KnowledgeNodeType.FILE,
      extname: '.md',
      description: '包含项目的画布索引',
      metadata: { providerId }
    },
    
    // 因为根节点是文件，所以没有子节点
    getChildren: async (parentId: string) => {
      return [];
    },
    
    // 读取文件内容
    readFile: async (fileId: string) => {
      if (fileId !== providerId) {
        throw new Error(`Invalid file ID: ${fileId}`);
      }

      const pagesInfo = getAllPages();
      const focusedPageId = getFocusedPageId();
      const processedPages = processRawData(pagesInfo);
      const pageTree = generateTreeText(processedPages, focusedPageId);

      return `## 画布索引
${pageTree}`;
    }
  });
}
