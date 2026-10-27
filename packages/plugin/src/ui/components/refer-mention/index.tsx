import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import markdownit from "markdown-it";
import { referRegistry, type ReferData } from "../../../sandbox/refer-registry";
import css from "./index.less";

/**
 * 匹配 Markdown 链接语法 `[文字](scheme://id)`。统一约定：所有引用（包括提示词里
 * 要求 AI 写的格式）都是这个语法，不单独兼容裸 `scheme://id`。
 * scheme 必须已通过 `window._sandbox_.registerRefer` 注册，否则不处理（保留原文）。
 */
const MD_REFER_LINK_RE = /\[([^\]]+)\]\(([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^\s)"'<>]+)\)/g;

function useReferData(scheme: string, id: string) {
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; data?: ReferData }>({ status: "loading" });
  useEffect(() => {
    const resolver = referRegistry.get(scheme);
    if (!resolver) {
      setState({ status: "error" });
      return;
    }
    let alive = true;
    setState({ status: "loading" });
    resolver
      .resolve(id)
      .then((data) => alive && setState(data ? { status: "ready", data } : { status: "error" }))
      .catch(() => alive && setState({ status: "error" }));
    return () => {
      alive = false;
    };
  }, [scheme, id]);
  return state;
}

/**
 * 单个引用节点。plugin-ai 只负责按 scheme resolve 数据，渲染完全交给
 * 注册的 resolver.renderCard；hover / 弹层等交互由 renderCard 自己决定。
 * 未注册 scheme、解析中或解析失败时退回展示链接原文。
 */
export const ReferMention = ({ scheme, id, label }: { scheme: string; id: string; label: string }) => {
  const { status, data } = useReferData(scheme, id);
  const resolver = referRegistry.get(scheme);

  if (status === "ready" && data && resolver) {
    return <>{resolver.renderCard(data)}</>;
  }
  return <span className={css.referFallback}>{label}</span>;
};

/**
 * 扫描纯文本（如 ask_questions 的 question 文本）里的 `[文字](scheme://id)` 引用，
 * 命中已注册 scheme 时渲染为 ReferMention，否则原样展示文本。
 */
export const ReferText = ({ text }: { text: string }) => {
  const parts: React.ReactNode[] = [];
  const re = new RegExp(MD_REFER_LINK_RE.source, "g");
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text))) {
    const [full, label, scheme, id] = match;
    if (!referRegistry.get(scheme)) continue;
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(<ReferMention key={`refer-${key++}`} scheme={scheme} id={id} label={label} />);
    lastIndex = match.index + full.length;
  }

  if (!parts.length) return <>{text}</>;
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
};

/**
 * 用于 ask_questions 等只有一行文案的场景：解析行内 Markdown 后，再把已注册的
 * `scheme://` 链接替换为 ReferMention。使用 renderInline，避免 question 中的文本
 * 被渲染成 block 元素而破坏工具卡片的布局。
 */
export const ReferMarkdown = ({ text, className }: { text: string; className?: string }) => {
  const ref = React.useRef<HTMLSpanElement>(null);
  const md = React.useMemo(() => {
    const instance = markdownit({ linkify: true });
    // 避免把 TASKS.md 这类普通文本误判为 `.md` 域名，同时保留 https:// 自动链接。
    instance.linkify.set({ fuzzyLink: false, fuzzyEmail: false });
    return instance;
  }, []);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    unmountReferMentionsInContainer(container);
    container.innerHTML = md.renderInline(text);
    mountReferMentionsInContainer(container);

    return () => unmountReferMentionsInContainer(container);
  }, [text, md]);

  return <span ref={ref} className={className} />;
};

/**
 * 扫描容器内的 `a[href]`，href 匹配已注册 scheme 时，用 ReactDOM.render 原地
 * 替换为 ReferMention 挂载点。被 MarkdownMessage 在每次 innerHTML 更新后调用。
 */
export function mountReferMentionsInContainer(container: HTMLElement): void {
  const anchors = Array.from(container.querySelectorAll<HTMLAnchorElement>("a[href]"));
  for (const anchor of anchors) {
    const href = anchor.getAttribute("href") ?? "";
    const parsed = referRegistry.parse(href);
    if (!parsed || !referRegistry.get(parsed.scheme)) continue;

    const label = anchor.textContent?.trim() || href;
    const wrapper = document.createElement("span");
    wrapper.className = "refer-mention-wrapper";
    anchor.replaceWith(wrapper);
    ReactDOM.render(<ReferMention scheme={parsed.scheme} id={parsed.id} label={label} />, wrapper);
  }
}

/** 卸载 mountReferMentionsInContainer 挂载的 React 节点，容器被移除前调用以避免泄漏。 */
export function unmountReferMentionsInContainer(container: HTMLElement): void {
  const wrappers = Array.from(container.querySelectorAll<HTMLElement>(".refer-mention-wrapper"));
  for (const wrapper of wrappers) ReactDOM.unmountComponentAtNode(wrapper);
}
