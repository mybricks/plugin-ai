/**
 * Workspace 类型定义
 */

import { KnowledgeBaseConfig } from '../knowledges/types';

/**
 * 页面信息
 */
export interface PageInfo {
  id: string;
  title: string;
  type: string;
  componentType?: string;
  children?: PageInfo[];
}

/**
 * 画布数据
 */
export interface PagesData {
  pageAry: PageInfo[];
}

/**
 * 聚焦信息
 */
export interface FocusInfo {
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
 * 组件信息
 */
export interface ComponentInfo {
  namespace: string;
  name: string;
  abbreviation: string;
  description?: string;
}

/**
 * Workspace 配置（简化版，从 context 获取所有依赖）
 */
export interface WorkspaceConfig extends KnowledgeBaseConfig {
  // 所有依赖从 context 获取，无需传入
}

