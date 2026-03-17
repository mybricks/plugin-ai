import React, { useEffect, useRef } from "react";
import { CompView, type CompViewProps } from "./index";

// 包裹组件定义提到模块顶层，避免每次调用重新创建组件类型（否则 React 每次都会 unmount/remount）
interface WrapperProps extends CompViewProps {}

const CompViewWithShadowStyles = (props: WrapperProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const injectedRef = useRef(false);

  useEffect(() => {
    if (injectedRef.current) return;

    // 检测是否处于 Shadow DOM 内
    const root = containerRef.current?.getRootNode();
    if (!(root instanceof ShadowRoot)) return;

    injectedRef.current = true;

    // 消费方打包后，plugin-ai 所有样式会合并成一个 <style> 标签注入到 document.head。
    // 通过 compView/index.less 里埋入的锚点 CSS 变量 "--plugin-ai-comp-view" 精确定位该标签，克隆到 shadowRoot。
    document.head.querySelectorAll('style').forEach((style) => {
      if (style.textContent?.includes('--plugin-ai-comp-view')) {
        root.appendChild(style.cloneNode(true));
      }
    });
  }, []);

  return (
    <div ref={containerRef} data-zone-type="ai-request" style={{ height: '100%', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <CompView {...props} />
    </div>
  );
};

declare global {
  interface Window {
    /**
     * 返回一个包裹了 Shadow DOM 样式注入逻辑的 React 元素。
     * 直接放入 JSX 即可渲染：{window._render_comp_start_view_?.({ mentions: [...] })}
     *
     * @example
     * // 渲染到 Shadow DOM 容器
     * ReactDOM.createRoot(shadowRoot).render(window._render_comp_start_view_({ mentions: [...] }));
     *
     * // 或内联使用
     * return <div>{window._render_comp_start_view_?.({ mentions: [...] })}</div>
     */
    _render_comp_start_view_: (props?: CompViewProps) => React.ReactElement;
  }
}

window._render_comp_start_view_ = (props?: CompViewProps): React.ReactElement => {
  return React.createElement(CompViewWithShadowStyles, props ?? {});
};
