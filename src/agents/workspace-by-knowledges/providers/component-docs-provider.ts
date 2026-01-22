/**
 * 组件配置文档 Provider
 * 提供所有组件的详细配置文档（隐藏目录）
 */

import { DirectoryProvider, IKnowledgeNode, KnowledgeNodeType } from '../../knowledges/types';
import { ComponentsManager } from '../utils/components-manager';
import { context } from '../../../context';

/**
 * 从 context 获取组件文档
 */
function getComponentDoc(namespace: string): string {
  return (context.api?.global?.api?.getComEditorPrompts || 
          context.api?.uiCom?.api?.getComEditorPrompts)?.(namespace) || '';
}

/**
 * 从 ComponentsManager 获取组件依赖
 */
function getComponentRequires(namespace: string): string[] {
  return ComponentsManager.getRequireComponents(namespace) || [];
}

/**
 * 获取所有组件列表（从 ComponentsManager 获取）
 */
function getAllComponents(): Array<{ namespace: string; name: string; abbreviation: string; description: string }> {
  return ComponentsManager.getAllComponents();
}

/**
 * 创建组件配置文档 Provider
 * 提供一个隐藏的目录，包含所有组件的详细文档
 */
export function createComponentDocsProvider(): DirectoryProvider {
  const providerId = 'component-docs';
  const providerName = '组件配置文档';
  
  return new DirectoryProvider({
    id: providerId,
    name: providerName,
    description: '所有组件的详细配置文档',
    weight: 0, // 小权重
    hidden: true, // 隐藏，不在目录树中显示
    
    // 获取所有组件文档文件
    getChildren: async (parentId: string) => {
      if (parentId !== providerId) {
        return [];
      }

      const components = getAllComponents();

      return components.map(comp => {
        // 使用缩写作为文件名
        const fileName = comp.abbreviation || comp.namespace;
        
        // 获取依赖组件的文件ID列表，用于关联打开
        const requires = getComponentRequires(comp.namespace);
        const requireFileIds = requires.map(ns => `component-doc-${ns}`);
        
        return {
          id: `component-doc-${comp.namespace}`,
          name: fileName,
          type: KnowledgeNodeType.FILE,
          extname: '.md',
          hidden: true, // 文件也是隐藏的
          description: comp.description || comp.name,
          metadata: {
            providerId,
            namespace: comp.namespace,
            abbreviation: comp.abbreviation,
            fullName: comp.name,
            requires: requireFileIds // 添加依赖文件ID，用于关联打开
          }
        };
      });
    },
    
    // 读取组件文档内容
    readFile: async (fileId: string) => {
      const match = fileId.match(/^component-doc-(.+)$/);
      if (!match) {
        throw new Error(`Invalid file ID: ${fileId}`);
      }

      const namespace = match[1];
      return getComponentDoc(namespace);
    }
  });
}
