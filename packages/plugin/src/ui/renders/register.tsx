import React, { useEffect, useRef, useState } from "react";
import { ChatStartView, type ChatStartViewProps } from "../chat";
import { PrdRender, type PrdRenderProps } from "./prd-render";

// ─── Shadow DOM 样式注入高阶组件 ───────────────────────────────────────────────

function withShadowStyles<P extends object>(
  Component: React.ComponentType<P>,
  styleFlag: string
) {
  return (props: P) => {
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
      if (!(window as any)[styleFlag]) {
        document.head.querySelectorAll("style").forEach((style) => {
          if (style.textContent?.includes("--plugin-ai-comp-view")) {
            root.appendChild(style.cloneNode(true));
          }
        });
        (window as any)[styleFlag] = true;
      }
      setStyled(true);
    }, []);

    return (
      <div
        ref={containerRef}
        data-zone-type="ai-request"
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          visibility: styled ? "visible" : "hidden",
        }}
      >
        <Component {...props} />
      </div>
    );
  };
}

const ChatStartViewWithStyles = withShadowStyles<ChatStartViewProps>(
  ChatStartView,
  "__pluginAiStartViewStyleInjected__"
);

const PrdRenderWithStyles = withShadowStyles<PrdRenderProps>(
  PrdRender,
  "__pluginAiPrdStyleInjected__"
);

// ─── 全局 window API 声明 ─────────────────────────────────────────────────────

declare global {
  interface Window {
    _sandbox_renders_: {
      renderStartView: (props?: ChatStartViewProps) => React.ReactElement;
      renderPrdView: (props?: PrdRenderProps) => React.ReactElement;
    };
  }
}

// ─── 注册 ─────────────────────────────────────────────────────────────────────

window._sandbox_renders_ = {
  renderStartView: (props?: ChatStartViewProps): React.ReactElement =>
    React.createElement(ChatStartViewWithStyles, props ?? {}),

  renderPrdView: (props?: PrdRenderProps): React.ReactElement =>
    React.createElement(PrdRenderWithStyles, props ?? { content: "" }),
};
