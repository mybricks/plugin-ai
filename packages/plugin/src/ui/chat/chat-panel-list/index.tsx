import React, { useCallback, useEffect, useRef, useState } from "react";
import classNames from "classnames";
import { context } from "../../../context";
import { ChatPanel } from "../chat-panel";
import type { ChatPanelProps, ChatPanelRef } from "../chat-panel";
import type { SendToAgentParams } from "../../../sandbox";
import type { ChatChipInstance } from "../../../../../agent/src";
import { createDomChip, DOM_CHIP_TYPE, matchDefaultDomFocusContent } from "../../../utils/dom-info";
import { useAIPanelReady } from "../../../utils/ensure-ai-panel-open";
import { usePluginDisabled } from "../../../utils/use-plugin-disabled";
import css from "../chat-panel/index.less";

interface User {
  name?: string;
  avatar?: string;
}

export interface ChatPanelListProps {
  user?: User;
  copilot?: User;
  /** 上传文件回调，不传时回退到 context.pluginParams.onUpload */
  onUpload?: (file: File) => Promise<string>;
  /** Header 标题，不传时读 context.name */
  title?: string;
  /** 面板尺寸，透传给内部 ChatPanel */
  size?: ChatPanelProps["size"];
  /** 自定义根元素类名，用于覆盖 ChatPanel CSS 变量 */
  className?: string;
  /** 自定义根元素样式，可直接传入 CSS 变量做局部调节 */
  style?: React.CSSProperties;
}

interface ComInstance {
  comId: string;
  focusSnapshot: any;
}

function isLastSegmentSameDomChip(message: string, chips: ChatChipInstance[] | undefined, ele: HTMLElement): boolean {
  const lastChip = chips?.[chips.length - 1];
  return !!(
    lastChip?.type === DOM_CHIP_TYPE &&
    lastChip.data?.ele === ele &&
    message.trim().endsWith(`[[chip:${lastChip.id}]]`)
  );
}

// ─── ChatPanelList ────────────────────────────────────────────────────────────
//
// 监听 focus 事件，每个 comId 对应一个独立 ChatPanel 实例（display:none 切换）。
// 各 ChatPanel 持有独立的 useSession，agent 事件 re-render 完全隔离。

const ChatPanelList = ({ user, copilot, onUpload, title, size = "small", className, style }: ChatPanelListProps) => {
  useAIPanelReady();

  const [currentComId, setCurrentComId] = useState<string | undefined>(undefined);
  const [instances, setInstances] = useState<ComInstance[]>([]);
  const contextDisabled = usePluginDisabled();
  const panelRefs = useRef(new Map<string, ChatPanelRef | null>());
  const currentComIdRef = useRef<string | undefined>(undefined);
  const appendFocusChipTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    currentComIdRef.current = currentComId;
  }, [currentComId]);

  const handleFocus = useCallback((focus: any) => {
    if (!focus) {
      setCurrentComId(undefined);
      return;
    }

    const comId: string = focus.comId ?? focus.pageId ?? "global";
    setCurrentComId(comId);
    setInstances((prev) => {
      const existing = prev.find((inst) => inst.comId === comId);
      if (existing) {
        // 更新 focusSnapshot（新 reference 触发 ChatPanel 内部 useEffect 重新注入 mention）
        return prev.map((inst) =>
          inst.comId === comId ? { ...inst, focusSnapshot: { ...focus } } : inst
        );
      }
      return [...prev, { comId, focusSnapshot: { ...focus } }];
    });
  }, []);

  const ensureInstance = useCallback((comId: string, focus?: any) => {
    const focusSnapshot = focus ?? { comId };
    setCurrentComId(comId);
    setInstances((prev) => {
      const existing = prev.find((inst) => inst.comId === comId);
      if (existing) {
        return prev.map((inst) =>
          inst.comId === comId ? { ...inst, focusSnapshot: { ...inst.focusSnapshot, ...focusSnapshot } } : inst
        );
      }
      return [...prev, { comId, focusSnapshot }];
    });
  }, []);

  const appendFocusChipIfNeeded = useCallback((focus: AiServiceFocusParams) => {
    const comId = focus.comId ?? focus.pageId ?? currentComIdRef.current;
    const ele = focus.focusArea?.ele;
    if (!comId) return;

    if (appendFocusChipTimerRef.current) {
      clearTimeout(appendFocusChipTimerRef.current);
    }

    appendFocusChipTimerRef.current = setTimeout(() => {
      const panel = panelRefs.current.get(comId);
      if (!panel?.canAppendInput()) return;

      const input = panel?.getInput();
      const message = input?.message ?? "";

      // editor 无内容，或命中默认 focus 内容串：替换成新的 focus 内容串。
      const canReplace = !message.trim() || matchDefaultDomFocusContent({
        message,
        chips: input?.chips ?? [],
      });

      if (!ele) {
        if (canReplace) {
          panel.clearFocusContent();
        }
        return;
      }

      if (canReplace) {
        const chip = createDomChip(focus);
        panel.replaceFocusContent({
          message: `对于[[chip:${chip.id}]]`,
          meta: { chips: [chip] },
        });
        return;
      }

      // editor 有内容：走原有逻辑，追加普通 dom chip（不重复追加相同元素）
      if (isLastSegmentSameDomChip(message, input?.chips, ele)) return;
      const chip = createDomChip(focus);
      panel.appendInput({
        message: `[[chip:${chip.id}]]`,
        meta: { chips: [chip] },
      });
    }, 120);
  }, []);

  useEffect(() => {
    if (context.currentFocus) {
      handleFocus(context.currentFocus);
      appendFocusChipIfNeeded(context.currentFocus);
    } else {
      const fallbackComId = context.getFallbackAgentComId();
      if (fallbackComId) {
        ensureInstance(fallbackComId, { comId: fallbackComId, title: "页面" });
      }
    }

    const unFocus = context.events.on("focus", (focus: AiServiceFocusParams) => {
      handleFocus(focus);
      appendFocusChipIfNeeded(focus);
    });
    const unAgentComId = context.events.on("agentComId", (comId: string) => {
      if (!context.currentFocus && !currentComIdRef.current) {
        ensureInstance(comId, { comId, title: "页面" });
      }
    });
    const unDisplay = context.events.on("aiViewDisplay", () => {
      if (!currentComIdRef.current) {
        const fallbackComId = context.getFallbackAgentComId();
        if (fallbackComId) {
          ensureInstance(fallbackComId, { comId: fallbackComId, title: "页面" });
        }
      }
    });
    const unAppendInput = context.events.on("appendInput", ({ comId, input }: { comId: string; input: Parameters<typeof context.appendInput>[1] }) => {
      if (!comId) return;
      ensureInstance(comId);
      setTimeout(() => {
        const panel = panelRefs.current.get(comId);
        if (!panel) return;

        const currentInput = panel.getInput();
        if (matchDefaultDomFocusContent({
          message: currentInput.message,
          chips: currentInput.chips,
        })) {
          panel.clearFocusContent();
        }

        panel.appendInput(input as any);
      });
    });
    // 注册 inputGetter，供 context.getInput() 调用（与 appendInput 同构，反向读取）
    context.registerInputGetter((comId?: string) => {
      const targetComId = comId ?? currentComIdRef.current;
      if (!targetComId) return undefined;
      return panelRefs.current.get(targetComId)?.getInput();
    });

    return () => {
      unFocus();
      unAgentComId();
      unDisplay();
      unAppendInput();
      if (appendFocusChipTimerRef.current) {
        clearTimeout(appendFocusChipTimerRef.current);
      }
      context.registerInputGetter(undefined);
    };
  }, [handleFocus, appendFocusChipIfNeeded, ensureInstance]);

  return (
    <div className={classNames(css["chat-panel-list"], css[`size-${size}`], className)} style={style}>
      {/* 每个 comId 对应一个独立 ChatPanel 实例 */}
      {instances.map(({ comId, focusSnapshot }) => {
        const agentKey = context.getAgentKey(comId);
        const agent = context.agentMap.get(agentKey);
        return (
          <div
            key={comId}
            style={{ display: comId === currentComId ? "contents" : "none", height: "100%" }}
          >
            <ChatPanel
              ref={(ref) => {
                panelRefs.current.set(comId, ref);
              }}
              agent={agent}
              user={user}
              copilot={copilot}
              onUpload={onUpload}
              title={title}
              disabled={contextDisabled}
              size={size}
              matchDefaultFocusContent={matchDefaultDomFocusContent}
              defaultFocusPlaceholder="您可以描述对于此区域的需求"
              renderAttachmentSuffix={context.pluginParams.renderAttachmentSuffix}
              mentions={context.pluginParams.mentions}
            />
          </div>
        );
      })}
    </div>
  );
};

export { ChatPanelList };
