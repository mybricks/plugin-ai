/**
 * 聚焦信息 Provider
 * 提供当前聚焦组件的树结构和描述信息
 */

import { DirectoryProvider, IKnowledgeNode, KnowledgeNodeType } from '../../knowledges/types';
import { context } from '../../../context';
import { FocusOutlineInfoManager } from '../utils';

/**
 * 聚焦信息
 */
interface FocusInfo {
  pageId?: string;
  comId?: string;
  title?: string;
  type?: 'page' | 'uiCom' | 'section' | 'logicCom';
  focusArea?: {
    selector: string;
    title: string;
  };
  diagramId?: string;
}

/**
 * 获取聚焦信息
 */
function getFocusInfo(): FocusInfo {
  return (context.currentFocus || {}) as FocusInfo;
}

/**
 * 创建聚焦信息 Provider
 * 将当前聚焦的页面和组件信息作为单个文件呈现
 */
export function createFocusInfoProvider(): DirectoryProvider {
  const providerId = 'focus-info';
  const providerName = '聚焦信息';
  let outlineInfoManager: FocusOutlineInfoManager | null = null;

  /**
   * 初始化 outline info manager
   */
  function initializeManager(): void {
    if (outlineInfoManager) {
      return;
    }

    const focusInfo = getFocusInfo();
    if (focusInfo?.pageId) {
      outlineInfoManager = new FocusOutlineInfoManager({ 
        api: context.api, 
        focusInfo 
      });
    }
  }

  /**
   * 获取聚焦描述
   */
  function getFocusDescription(): string {
    initializeManager();
    
    if (!outlineInfoManager) {
      return '当前没有聚焦到任何页面或组件。';
    }
    
    return outlineInfoManager.generateFocusDescription();
  }

  /**
   * 获取聚焦层级结构
   */
  function getFocusHierarchy(): string {
    initializeManager();
    
    if (!outlineInfoManager) {
      return '';
    }
    
    return outlineInfoManager.generateFocusHierarchy();
  }

  return new DirectoryProvider({
    id: providerId,
    name: providerName,
    description: '当前聚焦组件的树结构和描述',
    weight: 90, // 高权重，排在项目信息之后
    
    // 自定义根节点为文件而不是目录
    customRootNode: {
      id: providerId,
      name: providerName,
      type: KnowledgeNodeType.FILE,
      extname: '.md',
      description: '当前聚焦组件的树结构和描述',
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

      const focusInfo = getFocusInfo();
      
      // 如果没有聚焦信息
      if (!focusInfo.pageId && !focusInfo.comId) {
        return '当前未聚焦任何页面或组件';
      }

      // 获取聚焦的层级结构和描述
      const contentHierarchy = getFocusHierarchy();
      const focusDescription = getFocusDescription();

      return `## 聚焦信息
以下是当前聚焦组件的简略树结构，展示了聚焦元素的父级、兄弟、子级元素的关系。
注意：此树结构并不完整，折叠了无关元素信息，如需详细信息请打开DSL文档获取。

${contentHierarchy}

${focusDescription}`;
    }
  });
}
