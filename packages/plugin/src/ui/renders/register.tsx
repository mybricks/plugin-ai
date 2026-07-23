import React, { useEffect, useRef, useState } from "react";
import { LoadingView, type LoadingViewProps } from "../chat/chat-start-view";
import { ChatStartView, type ChatStartViewProps, ComChatStartView, type ComChatStartViewProps } from "../chat/chat-start-view";
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
          if (style.textContent?.includes("plugin-ai-comp-view-anchor")) {
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

export const LoadingViewWithStyles = withShadowStyles<LoadingViewProps>(
  LoadingView,
  "__pluginAiStartViewStyleInjected__"
);

export const ChatStartViewWithStyles = withShadowStyles<ChatStartViewProps>(
  ChatStartView,
  "__pluginAiStartViewStyleInjected__"
);

export const ComChatStartViewWithStyles = withShadowStyles<ComChatStartViewProps>(
  ComChatStartView,
  "__pluginAiStartViewStyleInjected__"
);

export const PrdRenderWithStyles = withShadowStyles<PrdRenderProps>(
  PrdRender,
  "__pluginAiPrdStyleInjected__"
);

export type { LoadingViewProps, ChatStartViewProps, ComChatStartViewProps, PrdRenderProps };
