/**
 * Markdown 皮肤统一导出
 *
 * 三套皮肤对应三种使用场景：
 *  - messageSkin  → AI 流式输出消息（字号紧凑，h1-h6 锁定 12px）
 *  - planSkin     → 计划卡片 body（与消息皮肤同基础，独立演进）
 *  - prdSkin      → PRD 需求文档阅读（h1-h6 有层级，间距宽松）
 *
 * 使用方式：
 *   import messageSkin from '@/ui/markdown/skin-message.less';
 *   // 然后 className={messageSkin['markdown-skin-message']}
 *
 * 或直接按需 import：
 *   import css from '../../markdown/skin-message.less';
 */

export { default as messageSkin } from './skin-message.less';
export { default as planSkin } from './skin-plan.less';
export { default as prdSkin } from './skin-prd.less';
export { renderMermaidInContainer } from './mermaid';
