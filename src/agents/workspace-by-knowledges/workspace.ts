/**
 * Workspace 类（基于知识库架构重构 + Context）
 * 
 * 从 context 获取所有依赖，无需手动传入 api 和 focusInfo
 */

import { KnowledgeBase } from '../knowledges/knowledge-base';
import { WorkspaceConfig } from './types';
import { DynamicDocument } from '../knowledges/types';
import { 
  createProjectInfoProvider,
  createFocusInfoProvider,
  createComponentDocsProvider
} from './providers';
import { ComponentsManager } from './utils';

/**
 * Workspace 类
 * 继承自 KnowledgeBase，提供工作空间的知识库视图
 */
export class Workspace extends KnowledgeBase {
  private defaultFilesOpened: Promise<void>;

  constructor(config?: WorkspaceConfig) {
    super({
      name: config?.name || 'Workspace',
      description: config?.description || '工作空间包含项目信息、聚焦信息和组件配置文档'
    });

    // 初始化 providers
    this.initializeProviders();
    
    // 默认打开项目信息和聚焦信息（保存 Promise 以便外部可以等待）
    this.defaultFilesOpened = this.openDefaultFiles();
  }

  /**
   * 初始化所有 providers
   */
  private initializeProviders(): void {
    // 1. 项目信息 Provider（包含画布索引）
    this.registerProvider(createProjectInfoProvider());

    // 2. 聚焦信息 Provider（包含聚焦树结构和描述）
    this.registerProvider(createFocusInfoProvider());

    // 3. 组件配置文档 Provider（隐藏目录）
    this.registerProvider(createComponentDocsProvider());
  }

  /**
   * 默认打开项目信息和聚焦信息
   */
  private async openDefaultFiles(): Promise<void> {
    try {
      // 打开项目信息
      await this.openFile('项目信息.md');
      
      // 打开聚焦信息
      await this.openFile('聚焦信息.md');
    } catch (error) {
      console.warn('Failed to open default files:', error);
    }
  }

  /**
   * 等待默认文件打开完成
   */
  async waitForReady(): Promise<void> {
    await this.defaultFilesOpened;
  }

  /**
   * 打开组件文档（通过路径）
   * @example await workspace.openComponentDoc('组件配置文档/pc.button.md')
   */
  async openComponentDoc(path: string): Promise<void> {
    await this.defaultFilesOpened;  // 确保默认文件已打开
    await this.openFile(path);
    
    // 自动打开依赖组件
    const match = path.match(/组件配置文档\/(.+)\.md$/);
    if (match) {
      const abbreviation = match[1];
      const namespace = ComponentsManager.getFullNamespace(abbreviation);
      const requires = ComponentsManager.getRequireComponents(namespace);
      
      if (requires && requires.length > 0) {
        for (const requiredNs of requires) {
          const requiredAbbr = ComponentsManager.getAbbreviation(requiredNs);
          const requiredPath = `组件配置文档/${requiredAbbr}.md`;
          try {
            await this.openFile(requiredPath);
          } catch (error) {
            console.warn(`Failed to auto-open required component ${requiredPath}:`, error);
          }
        }
      }
    }
  }

  /**
   * 根据组件 namespace 打开组件文档
   */
  async openComponentDocByNamespace(namespace: string): Promise<void> {
    const abbreviation = ComponentsManager.getAbbreviation(namespace);
    const path = `组件配置文档/${abbreviation}.md`;
    await this.openComponentDoc(path);
  }

  /**
   * 打开文档（类似旧版 workspace 的 openDocument）
   * @param id 文档ID（页面ID或组件ID）
   * @param options 文档选项
   */
  async openDocument(id: string, options: {
    type: '画布' | '组件';
    content: string;
    title?: string;
    description?: string;
    /** 所属目录ID，如果不指定则使用默认动态文档目录 */
    directoryId?: string;
  }): Promise<void> {
    await this.defaultFilesOpened;  // 确保默认文件已打开
    
    const doc: DynamicDocument = {
      id,
      title: options.title || id,
      description: options.description,
      content: options.content,
      docType: options.type,
      extname: '.md',
      directoryId: options.directoryId
    };

    // 使用 KnowledgeBase 的底层动态文档功能
    await this.openDynamicDocument(doc);
  }

  /**
   * 关闭文档
   * @param id 文档ID
   * @param directoryId 目录ID（可选）
   */
  closeDocument(id: string, directoryId?: string): void {
    this.removeDynamicDocument(id, directoryId);
  }

  /**
   * 刷新工作空间（当 context.currentFocus 变化时调用）
   */
  async refresh(): Promise<void> {
    // 清空所有已打开的文件
    this.clearOpenedFiles();
    
    // 清空所有动态文档
    this.clearDynamicDocuments();
    
    // 重新初始化 providers
    this.initializeProviders();
    
    // 重新打开默认文件
    this.defaultFilesOpened = this.openDefaultFiles();
    await this.defaultFilesOpened;
  }
}
