import React, { useEffect, useRef, useState } from "react";
import { CompView, type CompViewProps } from "./index";
import { PrdRender, type PrdRenderProps } from "./prdRender";

// 包裹组件定义提到模块顶层，避免每次调用重新创建组件类型（否则 React 每次都会 unmount/remount）
interface WrapperProps extends CompViewProps {}

const CompViewWithShadowStyles = (props: WrapperProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const injectedRef = useRef(false);
  // 非 Shadow DOM 环境直接可见；Shadow DOM 环境等样式注入完成后再显示
  const [styled, setStyled] = useState(false);

  useEffect(() => {
    if (injectedRef.current) return;

    // 检测是否处于 Shadow DOM 内
    const root = containerRef.current?.getRootNode();
    if (!(root instanceof ShadowRoot)) {
      // 普通 DOM，无需注入样式，直接显示
      setStyled(true);
      return;
    }

    injectedRef.current = true;

    // 同一个 ShadowRoot 只需注入一次，window 上打标记防止多实例重复注入
    if (!(window as any).__pluginAiStyleInjected__) {
      document.head.querySelectorAll('style').forEach((style) => {
        if (style.textContent?.includes('--plugin-ai-comp-view')) {
          root.appendChild(style.cloneNode(true));
        }
      });
      (window as any).__pluginAiStyleInjected__ = true;
    }

    // 样式注入完成，显示内容
    setStyled(true);
  }, []);

  return (
    <div
      ref={containerRef}
      data-zone-type="ai-request"
      style={{ height: '100%', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', visibility: styled ? 'visible' : 'hidden' }}
    >
      <CompView {...props} />
    </div>
  );
};

// PrdRender 包裹组件（同样处理 Shadow DOM 样式注入）
interface PrdRenderWrapperProps extends PrdRenderProps {}

const PrdRenderWithShadowStyles = (props: PrdRenderWrapperProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const injectedRef = useRef(false);
  const [styled, setStyled] = useState(false);

  useEffect(() => {
    if (injectedRef.current) return;

    const root = containerRef.current?.getRootNode();
    if (!(root instanceof ShadowRoot)) {
      setStyled(true);
      return;
    }

    injectedRef.current = true;

    if (!(window as any).__pluginAiPrdStyleInjected__) {
      document.head.querySelectorAll('style').forEach((style) => {
        if (style.textContent?.includes('--plugin-ai-comp-view')) {
          root.appendChild(style.cloneNode(true));
        }
      });
      (window as any).__pluginAiPrdStyleInjected__ = true;
    }

    setStyled(true);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', visibility: styled ? 'visible' : 'hidden' }}
    >
      <PrdRender {...props} />
    </div>
  );
};

declare global {
  interface Window {
    /**
     * 返回一个包裹了 Shadow DOM 样式注入逻辑的 React 元素。
     * 直接放入 JSX 即可渲染：{window._render_comp_start_view_?.({ user, copilot, comId: 'xxx' })}
     *
     * @param props.user    用户信息（透传给 Messages）
     * @param props.copilot Copilot 信息（透传给 Messages）
     * @param props.comId   当前聚焦的组件 ID，用于触发聚焦事件及初始化独立消息记录
     *
     * @example
     * // 渲染到 Shadow DOM 容器
     * ReactDOM.createRoot(shadowRoot).render(
     *   window._render_comp_start_view_({ user, copilot, comId: 'xxx' })
     * );
     *
     * // 或内联使用
     * return <div>{window._render_comp_start_view_?.({ user, copilot, comId: 'xxx' })}</div>
     */
    _render_comp_start_view_: (props?: { user?: any; copilot?: any; comId?: string }) => React.ReactElement;
    /**
     * 渲染 PrdRender（Markdown 需求文档渲染器）组件。
     * @example
     * window._render_comp_prd?.({ content: markdownStr, showTitle: true, title: 'PRD' })
     */
    _render_comp_prd: (props?: PrdRenderProps) => React.ReactElement;
  }
}

window._render_comp_start_view_ = (props?: { user?: any; copilot?: any; comId?: string }): React.ReactElement => {
  return React.createElement(CompViewWithShadowStyles, props ?? {});
};

window._render_comp_prd = (props?: PrdRenderProps): React.ReactElement => {
  return React.createElement(PrdRenderWithShadowStyles, props ?? { content: '' });
};
