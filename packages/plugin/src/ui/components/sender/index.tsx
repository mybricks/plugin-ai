import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from "react"
import classNames from "classnames";
import { message } from "antd";
import { Loading, Plus, Send } from "../icons";
import { Popup } from "../popup";
import { AttachmentsList } from "../attachments";
import type { Attachment as AttachmentItem } from "../attachments";
import type { Attachments, MentionProvider } from "../types";
import { ChatMode, type ChatModeType } from "../chat-mode";
import { ModelSelector } from "../model-selector";
import type { ModelSelectorProps } from "../model-selector";
import type { QueueItem } from "../../../context/queue";
import type { ModelSelection } from "../../../../../request/src/providers";
import type { SendToAgentParams } from "../../../sandbox";
import { triggerChipRemove } from "../../../sandbox/chip-remove";
import type { AgentMode, ChatChipDef, ChatChipInstance } from "../../../../../agent/src";
import { removeLeadingPlaceholderBreakBeforeChip } from "./utils";
import {
  unmountChipContainer,
  createChipContainer,
  updateChipContainer,
  updateChipWrapperSpacing,
  serializeEditorContent,
  measureEditorContent,
  getAdjacentChipAtCaret,
  removeChipFromEditor,
  fileChipDef,
} from "./chip";
import {
  isSupportedImageFile,
  readFileToBase64,
  getImageSize,
  resolveFileRoute,
  FILE_CHIP_TYPE,
  toFileChipData,
  MAX_IMAGE_SIZE_MB,
  MAX_IMAGE_SIZE_BYTES,
  SUPPORTED_FILE_ACCEPT,
  SUPPORTED_IMAGE_LABEL,
} from "./upload";
import {
  applyFileProcessors,
  processFileDefault,
  processFileInSandbox,
} from "./attach-processor";
import {
  MentionMenu,
  buildRootMentionEntries,
  createFileMentionEntry,
  flattenMentionItems,
  toMentionEntries,
  type MentionMenuEntry,
} from "./mention";
import type { AttachProcessor, FileContent } from "../../../content-limits";
import { CodeAgent } from "../../../../../agent/src";
import css from "./index.less"

// ─── 全局鼠标位置追踪（模块级单例，供飞行动画读取起点）────────────────────────────

let _lastMouseX = -1;
let _lastMouseY = -1;
if (typeof window !== 'undefined') {
  window.addEventListener('mousemove', (e) => {
    _lastMouseX = e.clientX;
    _lastMouseY = e.clientY;
  }, { passive: true });
}

/**
 * 从鼠标最后落点发射一个幽灵胶囊飞向目标 DOM 元素，模拟"加入购物车"的抛物线动画。
 * onLanded 在动画结束时回调。
 */
function flyToTarget(targetEl: HTMLElement, label: string, onLanded: () => void) {
  const startX = _lastMouseX;
  const startY = _lastMouseY;

  // 鼠标位置未捕获时（-1）退化为直接回调，不播放飞行动画
  if (startX < 0 || startY < 0) {
    onLanded();
    return;
  }

  const targetRect = targetEl.getBoundingClientRect();
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + 12;

  // ── 外层 wrapper 控制 X 轴匀速平移 ──
  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    'z-index:99999',
    'pointer-events:none',
    `transform:translate3d(${startX}px,${startY}px,0)`,
    'transition:transform 0.55s linear',
    'will-change:transform',
  ].join(';');

  // ── 内层 chip 控制 Y 轴抛物线 + 缩放 + 透明度 ──
  const chip = document.createElement('div');
  const displayLabel = label.length > 12 ? `${label.slice(0, 12)}…` : label;
  chip.textContent = `+ ${displayLabel}`;
  chip.style.cssText = [
    'padding:3px 10px',
    'background:var(--mybricks-color-primary,#FA6400)',
    'color:#fff',
    'border-radius:999px',
    'font-size:11px',
    'line-height:18px',
    'white-space:nowrap',
    'box-shadow:0 3px 10px rgba(250,100,0,0.35)',
    'transform:translate3d(0,0,0) scale(1)',
    'opacity:1',
    // Y 轴用 ease-in（先慢后快，模拟重力加速落地）
    'transition:transform 0.55s cubic-bezier(0.4,0,1,1),opacity 0.55s ease-in',
    'will-change:transform,opacity',
  ].join(';');

  wrapper.appendChild(chip);
  document.body.appendChild(wrapper);

  // 强制重绘，保证初始状态被浏览器记录
  wrapper.getBoundingClientRect();

  // 设置终点：X 轴 wrapper 平移到目标，Y 轴 chip 内部平移
  const deltaX = targetX - startX;
  const deltaY = targetY - startY;

  wrapper.style.transform = `translate3d(${startX + deltaX}px,${startY}px,0)`;
  chip.style.transform = `translate3d(0,${deltaY}px,0) scale(0.3)`;
  chip.style.opacity = '0';

  const DURATION = 560;
  setTimeout(() => {
    try { document.body.removeChild(wrapper); } catch (_) {}
    onLanded();
  }, DURATION);
}

// ─── PendingQueue ─────────────────────────────────────────────────────────────

const PendingQueue = ({ queue, onRemove }: { queue: QueueItem[]; onRemove?: (id: string) => void }) => {
  const [expanded, setExpanded] = useState(true);
  if (!queue.length) return null;
  return (
    <div className={css.pendingQueue}>
      <div className={css.pendingQueueHeader} onClick={() => setExpanded(v => !v)}>
        <span className={css.pendingQueueArrow}>{expanded ? <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="12" height="12" style={{ transform: 'rotate(0deg)', display: 'block' }}><path d="M512 714.666667c-8.533333 0-17.066667-2.133333-23.466667-8.533334l-341.333333-341.333333c-12.8-12.8-12.8-32 0-44.8 12.8-12.8 32-12.8 44.8 0l320 317.866667 317.866667-320c12.8-12.8 32-12.8 44.8 0 12.8 12.8 12.8 32 0 44.8L533.333333 704c-4.266667 8.533333-12.8 10.666667-21.333333 10.666667z" fill="currentColor"/></svg> : <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="12" height="12" style={{ transform: 'rotate(-90deg)', display: 'block' }}><path d="M512 714.666667c-8.533333 0-17.066667-2.133333-23.466667-8.533334l-341.333333-341.333333c-12.8-12.8-12.8-32 0-44.8 12.8-12.8 32-12.8 44.8 0l320 317.866667 317.866667-320c12.8-12.8 32-12.8 44.8 0 12.8 12.8 12.8 32 0 44.8L533.333333 704c-4.266667 8.533333-12.8 10.666667-21.333333 10.666667z" fill="currentColor"/></svg>}</span>
        <span>{queue.length} 个待发送问题</span>
      </div>
      {expanded && (
        <div className={css.pendingQueueList}>
          {queue.map((item, index) => (
            <div key={item.id} className={css.pendingQueueItem}>
              <span className={css.pendingQueueDot} />
              {item.params?.focus && (item.params.focus.focusArea || item.params.focus.title) && (
                <span className={css.pendingQueueFocus}>
                  <span className={css.pendingQueueFocusArea}>
                    {item.params.focus.focusArea?.title || item.params.focus.title}
                  </span>
                </span>
              )}
              <span className={css.pendingQueueMsg}>{item.message || `消息 ${index + 1}`}</span>
              {item.attachments && item.attachments.length > 0 && (
                <span className={css.pendingQueueBadge}>{item.attachments.length} 个附件</span>
              )}
              <button className={css.pendingQueueDel} onClick={() => onRemove?.(item.id)}>
                <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" fill="none"><path d="M874.666667 241.066667h-202.666667V170.666667c0-40.533333-34.133333-74.666667-74.666667-74.666667h-170.666666c-40.533333 0-74.666667 34.133333-74.666667 74.666667v70.4H149.333333c-17.066667 0-32 14.933333-32 32s14.933333 32 32 32h53.333334V853.333333c0 40.533333 34.133333 74.666667 74.666666 74.666667h469.333334c40.533333 0 74.666667-34.133333 74.666666-74.666667V305.066667H874.666667c17.066667 0 32-14.933333 32-32s-14.933333-32-32-32zM416 170.666667c0-6.4 4.266667-10.666667 10.666667-10.666667h170.666666c6.4 0 10.666667 4.266667 10.666667 10.666667v70.4h-192V170.666667z m341.333333 682.666666c0 6.4-4.266667 10.666667-10.666666 10.666667H277.333333c-6.4 0-10.666667-4.266667-10.666666-10.666667V309.333333h490.666666V853.333333z" fill="currentColor"/><path d="M426.666667 736c17.066667 0 32-14.933333 32-32V490.666667c0-17.066667-14.933333-32-32-32s-32 14.933333-32 32v213.333333c0 17.066667 14.933333 32 32 32zM597.333333 736c17.066667 0 32-14.933333 32-32V490.666667c0-17.066667-14.933333-32-32-32s-32 14.933333-32 32v213.333333c0 17.066667 14.933333 32 32 32z" fill="currentColor"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── 剪贴板文本提取 ──────────────────────────────────────────────────────────

function getClipboardText(data: DataTransfer): string {
  const plain = data.getData('text/plain');
  if (plain) return plain;

  const html = data.getData('text/html');
  if (!html) return '';

  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.innerText || doc.body.textContent || '';
}

function focusEditorAtEnd(editor: HTMLDivElement) {
  editor.focus();

  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

// ─── SenderProps ─────────────────────────────────────────────────────────────

export interface SenderAbovePanel {
  key: string;
  content: React.ReactNode;
}

type SenderAppendInputParams = string | SendToAgentParams | { message: string; meta?: { chips?: ChatChipInstance[] }; animation?: boolean };

interface SenderSerializedInput {
  /** 输入框当前文本（含 [[chip:id]] 占位符） */
  message: string;
  /** 当前 chat chip 实例列表 */
  chips: ChatChipInstance[];
}

interface SenderActionPrefixRenderContext {
  /** 当前输入框是否有文本/chip 内容 */
  hasInput: boolean;
  /** 当前输入框文本（默认 focus 内容串匹配时为 null） */
  inputContent: string | null;
  /** Sender 是否处于不可发送状态 */
  disabled: boolean;
}

interface SenderProps {
  onSend: (message: {
    message: string;
    attachments: Attachments;
    chips?: ChatChipInstance[];
    mode?: AgentMode;
    [key: string]: any;
  }) => void;
  loading?: boolean;
  placeholder?: string;
  /** 命中默认 focus 内容串时展示的 placeholder，不传则复用普通 placeholder。 */
  defaultFocusPlaceholder?: string;
  attachmentsPrompt?: string;
  disabled?: boolean;
  onBlur?: () => void;
  mode?: "mention"
  chatMode?: ChatModeType;
  onChatModeChange?: (chatMode: ChatModeType) => void;
  /** 输入框风格：compact（紧凑，默认）| loose（松散，padding 更大）| bubble（悬浮气泡，最紧凑，无附件按钮）*/
  variant?: 'compact' | 'loose' | 'bubble';
  /** 自定义图片上传函数，返回 CDN URL；不传则使用 base64 */
  onUpload?: (file: File) => Promise<string>;
  onStop?: () => void;
  pendingQueue?: QueueItem[];
  onRemoveFromQueue?: (id: string) => void;
  /** 输入框上方的 focus 信息渲染（mention 区域展示） */
  renderFocus?: () => React.ReactNode;
  /** 在 Sender 顶部渲染一组 panel，Sender 负责统一外壳与分割线 */
  abovePanels?: SenderAbovePanel[];
  /** 在发送按钮左侧插入自定义操作（如「追加到对话」按钮），不影响发送按钮本身 */
  renderActionPrefix?: (context: SenderActionPrefixRenderContext) => React.ReactNode;
  /**
   * ⚠️ 试验性 API，后续版本将移除。
   * 在附件上传按钮之后插入自定义渲染内容。
   */
  renderAttachmentSuffix?: () => React.ReactNode;
  /** 自定义根元素类名，用于外部覆盖样式 */
  className?: string;
  /** 模型选择器配置 */
  modelSelector?: {
    models: Array<ModelSelection & { modelName: string; description?: string }>;
    selected?: ModelSelection | null;
    onSelect: (selection: ModelSelection) => void;
  };
  /**
   * Chat chip 类型注册表（从 agent.getChipTypes() 获取）。
   * 用于在输入框中渲染 chip。
   */
  chipTypes?: ChatChipDef[];
  /**
   * 自定义 mention 注册源。
   * - 点击 + 号时展示 provider/menu
   * - 输入 @ 时搜索 provider items
   * - 选中后插入 ChatChipInstance，发送前由对应 ChatChipDef.format 转为模型上下文
   */
  mentions?: MentionProvider[];
  /**
   * 判断当前输入是否是默认 focus 内容串。
   * Sender 不理解具体 prefix/chip 结构，只根据返回值决定 placeholder 是否后移展示。
   */
  matchDefaultFocusContent?: (input: SenderSerializedInput) => boolean;
  /**
   * 是否将模式选择器和模型选择器渲染在 renderFocus / 附件区域下方、输入框上方。
   * 默认 false（渲染在底部 editorAction 左区）。
   */
  selectorRenderInTop?: boolean;
  /**
   * 附件前置处理器列表。
   * 按顺序匹配，命中第一个即执行，不继续匹配后续处理器。
   * - type: "file"  → match 测文件名，process 接收 File，返回转换后的 File / FileContent / FileReference
   *   File / FileContent 会在发送前进入内置主处理；FileReference 会直接作为最终引用。
   * - type: "link"  → match 测完整 URL，process 接收 LinkAttachment，返回转换后的 LinkAttachment
   * 图片（image/*）始终走 attachment 流程，不受此配置影响。
   */
  attachProcessors?: AttachProcessor[];
  /**
   * 当前 agent 实例（由 ChatPanel 传入）。
   * Sender 内部用于判断是否为 CodeAgent，以决定走 processFileInSandbox 还是 processFileDefault。
   */
  agent?: import("../../../../../agent/src").CodeAgent;
}

interface SenderRef {
  focus: () => void;
  /** 当前输入框是否可以被外部自动追加内容 */
  canAppendInput: () => boolean;
  /**
   * 向输入框追加内容。
   * - string / SendToAgentParams：纯文本追加（兼容旧用法）
   * - { message, meta }：message 中可含 [[chip:id]] 占位符，
   *   meta.chips 提供对应实例，appendInput 内部会将占位符渲染成 chip span。
   */
  appendInput: (params: SenderAppendInputParams) => void;
  /** 获取输入框当前草稿内容（文本 + 附件 + chips） */
  getInput: () => {
    /** 输入框当前文本（含 [[chip:id]] 占位符） */
    message: string;
    /** 当前附件列表（含上传中的占位项） */
    attachments: AttachmentItem[];
    /** 当前 chat chip 实例列表 */
    chips: ChatChipInstance[];
  };
  /** 清空输入框内容和附件 */
  clear: () => void;
  /**
   * 在当前光标位置插入一个 chat chip。
   * chipTypes prop 中必须有对应 type 的注册，否则只展示 label。
   */
  insertChip: (instance: ChatChipInstance) => void;
  /** 替换当前输入框内容为新的默认 focus 内容串，不清空附件。 */
  replaceFocusContent: (params: Exclude<SenderAppendInputParams, string>) => void;
  /** 清空当前输入框文本/chip，不清空附件。 */
  clearFocusContent: () => void;
}

// ─── Sender ───────────────────────────────────────────────────────────────────

const Sender = forwardRef<SenderRef, SenderProps>((props, ref) => {
  const {
    loading, placeholder = "请输入", defaultFocusPlaceholder, disabled,
    onBlur, attachmentsPrompt, mode, chatMode, onChatModeChange,
    variant = 'compact', onUpload, onStop, pendingQueue, onRemoveFromQueue,
    renderFocus, abovePanels, renderActionPrefix, renderAttachmentSuffix,
    modelSelector, className, chipTypes = [], matchDefaultFocusContent,
    selectorRenderInTop = false,
    attachProcessors,
    agent,
    mentions: mentionProviders = [],
  } = props;

  const isBubble = variant === 'bubble';
  const inputEditorRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [inputContent, setInputContent] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
  const [mentionMenuTitle, setMentionMenuTitle] = useState("添加");
  const [mentionMenuEntries, setMentionMenuEntries] = useState<MentionMenuEntry[]>([]);
  const [mentionMenuLoading, setMentionMenuLoading] = useState(false);
  const [mentionMenuCanBack, setMentionMenuCanBack] = useState(false);
  const [mentionMenuMode, setMentionMenuMode] = useState<"plus" | "trigger">("plus");
  const [mentionAnchorRect, setMentionAnchorRect] = useState<DOMRect | null>(null);
  const [mentionHighlightIndex, setMentionHighlightIndex] = useState(0);
  /** 防止 dragLeave 在子元素之间移动时误触发，通过计数器追踪真正的进出 */
  const dragCounterRef = useRef(0);
  const processingSendRef = useRef(false);

  /** chat chip 实例 Map：id → ChatChipInstance */
  const chipMapRef = useRef<Map<string, ChatChipInstance>>(new Map());
  /** chip 容器 wrapper DOM 引用：id → HTMLSpanElement（直接持有，无需 DOM 搜索） */
  const chipWrapperMapRef = useRef<Map<string, HTMLSpanElement>>(new Map());
  /** 当前正在 applyFileProcessors 处理中的 chip id 集合 */
  const loadingChipIdsRef = useRef<Set<string>>(new Set());
  const [hasLoadingChips, setHasLoadingChips] = useState(false);
  const pendingFileMapRef = useRef<Map<string, File | FileContent>>(new Map());
  const mentionTriggerRangeRef = useRef<Range | null>(null);
  const mentionMenuRequestRef = useRef(0);
  const selectMentionEntryRef = useRef<(entry: MentionMenuEntry) => void | Promise<void>>(() => {});
  const mentionFileInputRef = useRef<HTMLInputElement>(null);

  /** 默认 focus 内容串的整体尺寸，用于把 placeholder 推到内容串后面。 */
  const [defaultFocusContentSize, setDefaultFocusContentSize] = useState<{ width: number; height: number } | null>(null);
  const [isDefaultFocusContent, setIsDefaultFocusContent] = useState(false);
  const currentPlaceholder = isDefaultFocusContent
    ? (defaultFocusPlaceholder ?? placeholder)
    : placeholder;

  /**
   * 内置 fileChipDef 合并到 chipTypes 里，确保 sender 内部能正确渲染文件 chip。
   * 外部传入相同 type 的 def 时，外部优先（放后面 Map 会覆盖）。
   */
  const allChipTypes = [fileChipDef, ...chipTypes, ...mentionProviders.map((provider) => provider.chip)];
  const notifyChipRemove = useCallback((chip: ChatChipInstance | undefined) => {
    if (!chip || !agent?.key) return;
    triggerChipRemove(agent.key, chip);
  }, [agent?.key]);

  /** chipTypes 的 Map 形式（type → def），方便查找 */
  const chipTypesMapRef = useRef<Map<string, ChatChipDef>>(new Map());
  useEffect(() => {
    chipTypesMapRef.current = new Map(allChipTypes.map(def => [def.type, def]));
  }, [chipTypes, mentionProviders]);

  /** 根据当前 editor DOM 同步 inputContent 状态 */
  const syncInputContent = useCallback(() => {
    if (!inputEditorRef.current) return;
    const editor = inputEditorRef.current;
    removeLeadingPlaceholderBreakBeforeChip(editor);
    updateChipWrapperSpacing(editor);
    const { message, chips } = serializeEditorContent(editor, chipMapRef.current);
    const nextIsDefaultFocusContent = !!message && !!matchDefaultFocusContent?.({ message, chips });
    setIsDefaultFocusContent(nextIsDefaultFocusContent);
    setInputContent(nextIsDefaultFocusContent ? null : message || null);

    if (!nextIsDefaultFocusContent) {
      setDefaultFocusContentSize(null);
      return;
    }

    const measuredNow = measureEditorContent(editor);
    setDefaultFocusContentSize((prev) => measuredNow ?? prev);

    requestAnimationFrame(() => {
      if (!inputEditorRef.current) return;
      const nextInput = serializeEditorContent(inputEditorRef.current, chipMapRef.current);
      if (!nextInput.message || !matchDefaultFocusContent?.(nextInput)) {
        setIsDefaultFocusContent(false);
        setDefaultFocusContentSize(null);
        return;
      }
      const next = measureEditorContent(inputEditorRef.current);
      setDefaultFocusContentSize(next ?? measuredNow);
    });
  }, [matchDefaultFocusContent]);

  const triggerReceiveAnimation = useCallback((label?: string) => {
    const editorEl = inputEditorRef.current;
    if (!editorEl) return;
    const editorWrapper = editorEl.closest(`.${css.editor}`) as HTMLElement | null;
    const target = editorWrapper ?? editorEl.parentElement;
    if (!target) return;

    const doLand = () => {
      // 飞行落地后：弹起 + 流光边框
      target.classList.add(css.receivingBounce);
      target.classList.add(css.receivingGlow);
      setTimeout(() => target.classList.remove(css.receivingBounce), 450);
      setTimeout(() => target.classList.remove(css.receivingGlow), 1400);
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    flyToTarget(target, label ?? '内容', doLand);
  }, []);

  const appendInput = useCallback((params: SenderAppendInputParams) => {
    const content = typeof params === "string" ? params : params.message;
    const nextAttachments = typeof params === "string"
      ? undefined
      : (params as SendToAgentParams).attachments?.filter((attachment) => attachment.type === "image").map((attachment) => ({
          type: "image" as const,
          content: attachment.content,
        }));
    // chip 实例表：从 meta.chips 构建，供解析占位符时使用
    const incomingChips: Map<string, ChatChipInstance> = new Map(
      ((params as any)?.meta?.chips as ChatChipInstance[] | undefined)?.map((c) => [c.id, c]) ?? []
    );

    if (nextAttachments?.length) {
      setAttachments((prev) => [...prev, ...nextAttachments]);
    }

    if (!content) {
      return;
    }

    const editor = inputEditorRef.current;
    if (!editor) {
      return;
    }

    // 记录当前是否已聚焦，后续仅在已聚焦时才更新光标，避免隐式 focus
    const isEditorFocused = document.activeElement === editor;

    // 若 editor 当前为空（只有 <br> 占位），先清掉，防止插入后产生多余换行
    if (!editor.textContent?.trim() && !editor.querySelector('[data-chip-id]')) {
      editor.querySelectorAll('br').forEach((br: HTMLBRElement) => br.remove());
      // 清掉残留空文本节点
      Array.from(editor.childNodes as NodeListOf<ChildNode>).forEach((n: ChildNode) => {
        if (n.nodeType === Node.TEXT_NODE && !(n.textContent ?? '').trim()) editor.removeChild(n);
      });
    }

    if (incomingChips.size > 0) {
      // 有 chip 实例：按 [[chip:id]] 分割，交替插入文本节点和 chip span，直接 appendChild 不碰 selection
      const parts = content.split(/(\[\[chip:[^\]]+\]\])/);
      for (const part of parts) {
        const match = part.match(/^\[\[chip:([^\]]+)\]\]$/);
        if (match) {
          const instance = incomingChips.get(match[1]);
          if (instance) {
            chipMapRef.current.set(instance.id, instance);
            const def = chipTypesMapRef.current.get(instance.type);
            const onRemove = () => {
              notifyChipRemove(instance);
              const w = chipWrapperMapRef.current.get(instance.id);
              if (w) {
                unmountChipContainer(w);
                w.parentNode?.removeChild(w);
                editor.normalize();
                chipWrapperMapRef.current.delete(instance.id);
              }
              chipMapRef.current.delete(instance.id);
              loadingChipIdsRef.current.delete(instance.id);
              if (loadingChipIdsRef.current.size === 0) setHasLoadingChips(false);
              syncInputContent();
            };
            const chipEl = createChipContainer(instance, def, onRemove);
            chipWrapperMapRef.current.set(instance.id, chipEl);
            editor.appendChild(chipEl);
          }
        } else if (part) {
          editor.appendChild(document.createTextNode(part));
        }
      }
    } else {
      // 纯文本追加（兼容旧用法）
      editor.appendChild(document.createTextNode(content));
    }

    // 仅在 editor 本身已聚焦时才把光标移到末尾，不主动抢焦点
    if (isEditorFocused) {
      focusEditorAtEnd(editor);
    }
    syncInputContent();

    // 触发注入动画（仅 animation: true 时）
    const shouldAnimate = typeof params !== 'string' && (params as any).animation === true;
    if (shouldAnimate) {
      // 优先取第一个 chip 的 label，其次取文本前12字，作为飞行胶囊的标签
      const firstChip = (params as any)?.meta?.chips?.[0] as ChatChipInstance | undefined;
      const animLabel = firstChip?.label ?? (content?.slice(0, 12) ?? '内容');
      triggerReceiveAnimation(animLabel);
    }
  }, [syncInputContent, triggerReceiveAnimation, notifyChipRemove]);

  /** 在当前光标位置插入一个 chat chip */
  const insertChip = useCallback((instance: ChatChipInstance, loading = false) => {
    const editor = inputEditorRef.current;
    if (!editor) return;

    // 存入 chipMap
    chipMapRef.current.set(instance.id, instance);

    const def = chipTypesMapRef.current.get(instance.type);

    // 点击删除按钮时：卸载 React、从 DOM 移除、清理 chipMap、同步内容
    const onRemove = () => {
      notifyChipRemove(instance);
      const wrapper = chipWrapperMapRef.current.get(instance.id);
      if (wrapper) {
        unmountChipContainer(wrapper);
        wrapper.parentNode?.removeChild(wrapper);
        editor.normalize();
      }
      chipMapRef.current.delete(instance.id);
      chipWrapperMapRef.current.delete(instance.id);
      pendingFileMapRef.current.delete(instance.id);
      loadingChipIdsRef.current.delete(instance.id);
      if (loadingChipIdsRef.current.size === 0) setHasLoadingChips(false);
      syncInputContent();
    };

    const chipEl = createChipContainer(instance, def, onRemove, loading);

    // 持有 wrapper 引用
    chipWrapperMapRef.current.set(instance.id, chipEl);

    // 插入到当前光标位置
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      // 确保光标在 editor 内
      if (editor.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(chipEl);
        // 把光标移到 chip 之后
        range.setStartAfter(chipEl);
        range.setEndAfter(chipEl);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        editor.appendChild(chipEl);
      }
    } else {
      // 无选区：追加到末尾
      editor.appendChild(chipEl);
    }

    syncInputContent();
  }, [syncInputContent, notifyChipRemove]);

  const openRootMentionMenu = useCallback(async (nextMode: "plus" | "trigger") => {
    if (disabled || uploading) return;
    const requestId = ++mentionMenuRequestRef.current;
    if (nextMode === "plus") {
      mentionTriggerRangeRef.current = null;
      setMentionAnchorRect(null);
    }
    setMentionMenuMode(nextMode);
    setMentionMenuTitle(nextMode === "plus" ? "添加" : "@");
    setMentionMenuCanBack(false);
    setMentionMenuOpen(true);
    setMentionMenuLoading(true);

    const entries = await buildRootMentionEntries(mentionProviders);

    if (requestId !== mentionMenuRequestRef.current) return;
    setMentionMenuEntries(entries);
    setMentionHighlightIndex(0);
    setMentionMenuLoading(false);
  }, [disabled, mentionProviders, uploading]);

  const openPlusMentionMenu = useCallback(async () => {
    await openRootMentionMenu("plus");
  }, [openRootMentionMenu]);

  const openTriggerMentionMenu = useCallback(async (query: string) => {
    if (disabled) return;
    const requestId = ++mentionMenuRequestRef.current;
    setMentionMenuMode("trigger");
    setMentionMenuTitle(query ? `@${query}` : "@");
    setMentionMenuCanBack(false);
    setMentionMenuOpen(true);
    setMentionMenuLoading(true);

    const normalizedQuery = query.trim().toLowerCase();
    const entries: MentionMenuEntry[] = normalizedQuery
      ? []
      : await buildRootMentionEntries(mentionProviders);

    if (normalizedQuery) {
      const fileEntry = createFileMentionEntry();
      const fileText = [fileEntry.label, ...(fileEntry.keywords ?? [])].join(" ").toLowerCase();
      if (fileText.includes(normalizedQuery)) {
        entries.push(fileEntry);
      }

      for (const provider of mentionProviders) {
        const items = provider.search
          ? await provider.search(query)
          : (await flattenMentionItems(provider)).filter((item) => {
              const text = [item.label, item.description, ...(item.keywords ?? [])].filter(Boolean).join(" ").toLowerCase();
              return text.includes(normalizedQuery);
            });
        entries.push(...toMentionEntries(provider, items));
      }
    }

    if (requestId !== mentionMenuRequestRef.current) return;
    setMentionMenuEntries(entries);
    setMentionHighlightIndex(0);
    setMentionMenuLoading(false);
  }, [disabled, mentionProviders]);

  const closeMentionMenu = useCallback(() => {
    mentionMenuRequestRef.current += 1;
    mentionTriggerRangeRef.current = null;
    setMentionAnchorRect(null);
    setMentionMenuOpen(false);
    setMentionMenuLoading(false);
    setMentionMenuCanBack(false);
    setMentionHighlightIndex(0);
  }, []);

  const measureRangeRect = useCallback((range: Range): DOMRect | null => {
    const rect = range.getBoundingClientRect();
    if (rect.width || rect.height) return rect;

    const marker = document.createElement("span");
    marker.textContent = "\u200b";
    marker.style.display = "inline-block";
    marker.style.width = "0";
    marker.style.height = "1em";

    const clonedRange = range.cloneRange();
    clonedRange.collapse(false);
    clonedRange.insertNode(marker);
    const markerRect = marker.getBoundingClientRect();
    marker.parentNode?.removeChild(marker);
    inputEditorRef.current?.normalize();
    return markerRect.width || markerRect.height ? markerRect : null;
  }, []);

  const detectMentionTrigger = useCallback(() => {
    const editor = inputEditorRef.current;
    if (!editor || mentionProviders.length === 0 || disabled) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
      closeMentionMenu();
      return;
    }
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) {
      closeMentionMenu();
      return;
    }
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) {
      closeMentionMenu();
      return;
    }
    const text = node.textContent ?? "";
    const beforeCaret = text.slice(0, range.startOffset);
    const match = beforeCaret.match(/(^|\s)@([^\s@]*)$/);
    if (!match) {
      closeMentionMenu();
      return;
    }

    const query = match[2] ?? "";
    const start = range.startOffset - query.length - 1;
    const triggerRange = document.createRange();
    triggerRange.setStart(node, start);
    triggerRange.setEnd(node, range.startOffset);
    mentionTriggerRangeRef.current = triggerRange;
    setMentionAnchorRect(measureRangeRect(triggerRange));
    void openTriggerMentionMenu(query);
  }, [closeMentionMenu, disabled, measureRangeRect, mentionProviders.length, openTriggerMentionMenu]);

  const insertMentionChip = useCallback((chip: ChatChipInstance, replaceRange?: Range | null) => {
    const editor = inputEditorRef.current;
    if (!editor) return;

    if (replaceRange) {
      replaceRange.deleteContents();
      const selection = window.getSelection();
      replaceRange.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(replaceRange);
    } else if (document.activeElement !== editor) {
      focusEditorAtEnd(editor);
    }

    insertChip(chip);
    const selection = window.getSelection();
    if (selection?.rangeCount) {
      const range = selection.getRangeAt(0);
      const space = document.createTextNode(" ");
      range.insertNode(space);
      range.setStartAfter(space);
      range.setEndAfter(space);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    syncInputContent();
  }, [insertChip, syncInputContent]);

  const backToRootMentionMenu = useCallback(() => {
    void openRootMentionMenu(mentionMenuMode);
  }, [mentionMenuMode, openRootMentionMenu]);

  const clearEditorContent = useCallback(() => {
    const editor = inputEditorRef.current;
    if (!editor) return;
    editor.querySelectorAll<HTMLSpanElement>(`[data-chip-id]`).forEach(unmountChipContainer);
    editor.textContent = "";
    chipMapRef.current.clear();
    chipWrapperMapRef.current.clear();
    loadingChipIdsRef.current.clear();
    setHasLoadingChips(false);
    setInputContent("");
    setIsDefaultFocusContent(false);
    setDefaultFocusContentSize(null);
  }, []);

  const replaceFocusContent = useCallback((params: Exclude<SenderAppendInputParams, string>) => {
    clearEditorContent();
    appendInput(params);
  }, [appendInput, clearEditorContent]);

  useImperativeHandle(ref, () => {
    return {
      focus: () => {
        if (inputEditorRef.current) {
          focusEditorAtEnd(inputEditorRef.current);
        }
      },
      canAppendInput: () => {
        const editor = inputEditorRef.current;
        return !!(!disabled && editor?.isConnected && editor.getClientRects().length > 0);
      },
      appendInput,
      getInput: () => {
        const editor = inputEditorRef.current;
        if (!editor) {
          return { message: "", attachments: [...attachments], chips: [] };
        }
        updateChipWrapperSpacing(editor);
        const { message, chips } = serializeEditorContent(editor, chipMapRef.current);
        return {
          message,
          attachments: [...attachments],
          chips,
        };
      },
      clear: () => {
        clearEditorContent();
        setAttachments([]);
      },
      insertChip,
      replaceFocusContent,
      clearFocusContent: clearEditorContent,
    };
  }, [appendInput, attachments, insertChip, disabled, clearEditorContent, replaceFocusContent]);

  const resolvePendingFileChips = async (chips: ChatChipInstance[]): Promise<ChatChipInstance[] | null> => {
    const sandbox = agent instanceof CodeAgent ? agent.getSandbox() : undefined;
    const nextChips: ChatChipInstance[] = [];

    for (const chip of chips) {
      const pending = pendingFileMapRef.current.get(chip.id);
      if (chip.type !== FILE_CHIP_TYPE || !pending) {
        nextChips.push(chip);
        continue;
      }

      const file = pending instanceof File ? pending : new File(
        [pending.content],
        pending.fileName,
        { type: "text/plain" }
      );
      try {
        const result = sandbox
          ? await processFileInSandbox(file, sandbox)
          : await processFileDefault(file);
        const chipData = toFileChipData(file, result);
        if (chipData === null) {
          return null;
        }
        nextChips.push({
          ...chip,
          label: chipData.fileName,
          data: chipData,
        });
      } catch (err) {
        console.error("[@mybricks/plugin-ai - 处理文件失败]", err);
        message.error(`处理「${file.name}」失败，已取消发送`);
        return null;
      }
    }

    return nextChips;
  };

  const send = async () => {
    const editor = inputEditorRef.current!;
    const { message: serializedMessage, chips } = serializeEditorContent(editor, chipMapRef.current);
    const hasUploadingAttachment = attachments.some((a) => a.uploading);
    if (serializedMessage && !disabled && !uploading && !hasLoadingChips && !hasUploadingAttachment && !processingSendRef.current) {
      processingSendRef.current = true;
      let resolvedChips: ChatChipInstance[] | null = null;
      try {
        setUploading(true);
        resolvedChips = await resolvePendingFileChips(chips);
      } finally {
        setUploading(false);
        processingSendRef.current = false;
      }
      if (resolvedChips === null) return;

      props.onSend({
        message: serializedMessage,
        attachments,
        ...(chatMode ? { mode: chatMode } : {}),
        ...(resolvedChips.length > 0 ? { chips: resolvedChips } : {}),
      })

      // 清空输入框（卸载 chip React 实例后清空 DOM）
      editor.querySelectorAll<HTMLSpanElement>(`[data-chip-id]`).forEach(unmountChipContainer);
      editor.textContent = "";
      chipMapRef.current.clear();
      chipWrapperMapRef.current.clear();
      loadingChipIdsRef.current.clear();
      setHasLoadingChips(false);
      pendingFileMapRef.current.clear();
      setIsDefaultFocusContent(false);
      setDefaultFocusContentSize(null);
      setAttachments([]);
      setInputContent("");
    }
  }

  const onSendButtonClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    void send();
  };

  const onInput = () => {
    syncInputContent();
    setTimeout(detectMentionTrigger, 0);
  }

  const notifySelectedChipRemove = useCallback((editor: HTMLDivElement, range: Range) => {
    if (range.collapsed) return false;

    const selectedChipIds: string[] = [];
    editor.querySelectorAll<HTMLSpanElement>(`[data-chip-id]`).forEach((chipEl) => {
      if (range.intersectsNode(chipEl)) {
        const chipId = chipEl.dataset.chipId;
        if (chipId) selectedChipIds.push(chipId);
      }
    });

    if (!selectedChipIds.length) return false;

    selectedChipIds.forEach((chipId) => {
      notifyChipRemove(chipMapRef.current.get(chipId));
      pendingFileMapRef.current.delete(chipId);
      const wrapper = chipWrapperMapRef.current.get(chipId);
      if (wrapper) unmountChipContainer(wrapper);
      chipMapRef.current.delete(chipId);
      chipWrapperMapRef.current.delete(chipId);
      loadingChipIdsRef.current.delete(chipId);
    });
    if (loadingChipIdsRef.current.size === 0) setHasLoadingChips(false);
    return true;
  }, [notifyChipRemove]);

  const handleMentionMenuKeyDown = useCallback((event: Pick<KeyboardEvent | React.KeyboardEvent, "key" | "preventDefault">): boolean => {
    if (!mentionMenuOpen) return false;

    if (event.key === "Escape") {
      event.preventDefault();
      closeMentionMenu();
      return true;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (mentionMenuEntries.length > 0) {
        const step = event.key === "ArrowDown" ? 1 : -1;
        setMentionHighlightIndex((prev) => (prev + step + mentionMenuEntries.length) % mentionMenuEntries.length);
      }
      return true;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      const entry = mentionMenuEntries[mentionHighlightIndex];
      if (entry) void selectMentionEntryRef.current(entry);
      return true;
    }

    if (event.key === "ArrowRight") {
      const entry = mentionMenuEntries[mentionHighlightIndex];
      if (entry?.children) {
        event.preventDefault();
        void selectMentionEntryRef.current(entry);
      }
      return true;
    }

    if ((event.key === "ArrowLeft" || event.key === "Backspace") && mentionMenuCanBack) {
      event.preventDefault();
      backToRootMentionMenu();
      return true;
    }

    return false;
  }, [backToRootMentionMenu, closeMentionMenu, mentionHighlightIndex, mentionMenuCanBack, mentionMenuEntries, mentionMenuOpen]);

  useEffect(() => {
    if (!mentionMenuOpen) return;
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      const editor = inputEditorRef.current;
      if (editor?.contains(event.target as Node)) return;
      handleMentionMenuKeyDown(event);
    };
    document.addEventListener("keydown", onDocumentKeyDown, true);
    return () => document.removeEventListener("keydown", onDocumentKeyDown, true);
  }, [handleMentionMenuKeyDown, mentionMenuOpen]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (handleMentionMenuKeyDown(event)) {
      return;
    }

    if (event.key === "Enter") {
      if (isComposing) {
        return;
      }

      if (event.shiftKey) {

      } else {
        event.preventDefault();
        void send();
      }
      return;
    }

    // ── 整体删除 chat chip ──────────────────────────────────────────────
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const editor = inputEditorRef.current;

    if ((event.key === 'Backspace' || event.key === 'Delete') && editor && !range.collapsed) {
      const hasRemovedChips = notifySelectedChipRemove(editor, range);
      if (hasRemovedChips) {
        requestAnimationFrame(() => syncInputContent());
      }
      return;
    }

    if (event.key === 'Backspace') {
      const chipEl = editor ? getAdjacentChipAtCaret(editor, range, "backward") : null;
      if (editor && chipEl) {
        event.preventDefault();
        const chipId = chipEl.dataset.chipId ?? "";
        notifyChipRemove(chipMapRef.current.get(chipId));
        pendingFileMapRef.current.delete(chipId);
        removeChipFromEditor(editor, chipEl, chipMapRef.current);
        syncInputContent();
        return;
      }
    }

    if (event.key === 'Delete') {
      const chipEl = editor ? getAdjacentChipAtCaret(editor, range, "forward") : null;
      if (editor && chipEl) {
        event.preventDefault();
        const chipId = chipEl.dataset.chipId ?? "";
        notifyChipRemove(chipMapRef.current.get(chipId));
        pendingFileMapRef.current.delete(chipId);
        removeChipFromEditor(editor, chipEl, chipMapRef.current);
        syncInputContent();
        return;
      }
    }
  }

  const onCompositionStart = () => {
    setIsComposing(true);
  }

  const onCompositionEnd = () => {
    setIsComposing(false);
  }

  // ─── 文件处理：统一分流入口 ───────────────────────────────────────────────

  /**
   * 统一处理多文件入口（拖拽、点击、粘贴）。
   * 根据文件类型分流：图片 → attachment，其他 → file chip。
   * file chip 路径：先走 attachProcessors 前置处理；processFileInSandbox / processFileDefault 延迟到发送前。
   */
  const processFiles = useCallback(async (rawFiles: File[]) => {
    const imageFiles: File[] = [];
    const nonImageFiles: File[] = [];

    for (const file of rawFiles) {
      const route = resolveFileRoute(file);
      if (route.target === "image") {
        imageFiles.push(file);
      } else if (route.target === "chip") {
        nonImageFiles.push(file);
      }
    }

    // 图片走 attachment 流程
    if (imageFiles.length > 0) {
      await updateAttachmentsByFiles(imageFiles);
    }

    // 非图片走 chip 流程：前置处理后暂存 File / FileContent，发送前再主处理。
    // FileReference 已经是最终引用文本，可立即生成 chip 数据。
    const processors = attachProcessors ?? [];

    for (const rawFile of nonImageFiles) {
      const id = Math.random().toString(36).slice(2, 7);
      const placeholderInstance: ChatChipInstance = {
        id,
        type: FILE_CHIP_TYPE,
        label: rawFile.name,
        data: {
          kind: "content" as const,
          fileName: rawFile.name,
          content: "",
          language: "",
          truncated: false,
          originalSize: rawFile.size,
        },
      };

      // 1. 先插入 loading 态 chip，让用户立即看到反馈
      loadingChipIdsRef.current.add(id);
      setHasLoadingChips(true);
      insertChip(placeholderInstance, true);

      try {
        // 2. 前置处理（first-match transform）—— 可能耗时
        const transformed = await applyFileProcessors(rawFile, processors);
        if (!chipWrapperMapRef.current.has(id)) {
          continue;
        }
        if (transformed === null) {
          // 处理器内部已弹提示，移除 loading chip
          const wrapper = chipWrapperMapRef.current.get(id);
          if (wrapper) {
            unmountChipContainer(wrapper);
            wrapper.parentNode?.removeChild(wrapper);
            inputEditorRef.current?.normalize();
            chipWrapperMapRef.current.delete(id);
          }
          chipMapRef.current.delete(id);
          loadingChipIdsRef.current.delete(id);
          if (loadingChipIdsRef.current.size === 0) setHasLoadingChips(false);
          syncInputContent();
          continue;
        }

        const chipData = !(transformed instanceof File) && transformed.type === "reference"
          ? toFileChipData(rawFile, transformed)
          : null;
        if (!(transformed instanceof File) && transformed.type === "reference" && chipData === null) {
          // 同上，移除
          const wrapper = chipWrapperMapRef.current.get(id);
          if (wrapper) {
            unmountChipContainer(wrapper);
            wrapper.parentNode?.removeChild(wrapper);
            inputEditorRef.current?.normalize();
            chipWrapperMapRef.current.delete(id);
          }
          chipMapRef.current.delete(id);
          loadingChipIdsRef.current.delete(id);
          if (loadingChipIdsRef.current.size === 0) setHasLoadingChips(false);
          syncInputContent();
          continue;
        }

        const pendingFile = transformed instanceof File ? transformed : undefined;
        const pendingContent = !(transformed instanceof File) && transformed.type === "content" ? transformed : undefined;
        const label = chipData?.fileName ?? pendingFile?.name ?? pendingContent?.fileName ?? rawFile.name;
        if (!chipData) {
          pendingFileMapRef.current.set(id, pendingFile ?? pendingContent!);
        }

        // 3. 处理完毕：更新 chip 为正常态（直接用持有的 wrapper 引用）
        const finalInstance: ChatChipInstance = {
          id,
          type: FILE_CHIP_TYPE,
          label,
          data: chipData ?? {
            kind: "content" as const,
            fileName: label,
            content: "",
            language: pendingContent?.language ?? "",
            truncated: false,
            originalSize: pendingFile?.size ?? rawFile.size,
          },
        };
        chipMapRef.current.set(id, finalInstance);
        loadingChipIdsRef.current.delete(id);
        if (loadingChipIdsRef.current.size === 0) setHasLoadingChips(false);

        const wrapper = chipWrapperMapRef.current.get(id);
        if (wrapper) {
          const def = chipTypesMapRef.current.get(FILE_CHIP_TYPE);
          const onRemove = () => {
            notifyChipRemove(chipMapRef.current.get(id));
            const w = chipWrapperMapRef.current.get(id);
            if (w) {
              unmountChipContainer(w);
              w.parentNode?.removeChild(w);
              inputEditorRef.current?.normalize();
              chipWrapperMapRef.current.delete(id);
            }
            chipMapRef.current.delete(id);
            pendingFileMapRef.current.delete(id);
            loadingChipIdsRef.current.delete(id);
            if (loadingChipIdsRef.current.size === 0) setHasLoadingChips(false);
            syncInputContent();
          };
          updateChipContainer(wrapper, finalInstance, def, onRemove, false);
        }
        syncInputContent();
      } catch (err) {
        console.error("[@mybricks/plugin-ai - 读取文件失败]", err);
        message.error(`读取「${rawFile.name}」失败，已跳过`);
        const wrapper = chipWrapperMapRef.current.get(id);
        if (wrapper) {
          unmountChipContainer(wrapper);
          wrapper.parentNode?.removeChild(wrapper);
          inputEditorRef.current?.normalize();
          chipWrapperMapRef.current.delete(id);
        }
        chipMapRef.current.delete(id);
        loadingChipIdsRef.current.delete(id);
        if (loadingChipIdsRef.current.size === 0) setHasLoadingChips(false);
        syncInputContent();
      }
    }
  }, [attachProcessors, insertChip, notifyChipRemove]);

  // ─── 图片 attachment 处理 ─────────────────────────────────────────────────

  /**
   * 统一的多图片附件处理入口。
   */
  const updateAttachmentsByFiles = async (rawFiles: File[]) => {
    // Step 1：格式过滤
    const validFiles: File[] = [];
    const invalidFiles: File[] = [];
    for (const file of rawFiles) {
      if (isSupportedImageFile(file)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file);
      }
    }

    if (invalidFiles.length > 0 && validFiles.length === 0) {
      message.info(`当前仅支持上传${SUPPORTED_IMAGE_LABEL}格式的图片`);
      return;
    }
    if (invalidFiles.length > 0) {
      message.info(`${invalidFiles.length} 个文件格式不支持（仅支持${SUPPORTED_IMAGE_LABEL}）已跳过`);
    }

    if (validFiles.length === 0) return;

    // Step 2：数量上限截断
    const slots = 5 - attachments.length;
    if (slots <= 0) {
      message.info("当前最多只能上传五张图片");
      return;
    }
    const toUpload = validFiles.slice(0, slots);
    if (validFiles.length > slots) {
      message.info(`已上传 ${slots} 张，超出上限的 ${validFiles.length - slots} 张已忽略`);
    }

    // Step 3：逐个校验并上传
    for (const file of toUpload) {
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        message.info(`文件「${file.name}」大小 ${(file.size / 1024 / 1024).toFixed(2)}MB，超过了${MAX_IMAGE_SIZE_MB}MB，已跳过`);
        continue;
      }

      try {
        const { width, height } = await getImageSize(file);
        if (width > 8000 || height > 8000) {
          message.info(`文件「${file.name}」尺寸 ${width}x${height}px，宽高任一不得大于8000px，已跳过`);
          continue;
        }
      } catch (event) {
        console.error("[@mybricks/plugin-ai - 读取图片尺寸失败]", event);
        message.error(`读取「${file.name}」尺寸失败，已跳过`);
        continue;
      }

      await uploadSingleFile(file);
    }
  };

  /** 上传单张已通过校验的文件，内部抽取避免重复逻辑 */
  const uploadSingleFile = async (file: File) => {
    if (onUpload) {
      // 先插入占位，上传完成后替换为真实 URL
      const localUrl = URL.createObjectURL(file);
      const placeholder: AttachmentItem = { type: "image", content: localUrl, uploading: true };
      setAttachments((prev) => [...prev, placeholder]);
      setUploading(true);
      onUpload(file)
        .then((url) => {
          URL.revokeObjectURL(localUrl);
          setAttachments((prev) => {
            const next = [...prev];
            const idx = next.findIndex((a) => a === placeholder);
            if (idx !== -1) next[idx] = { type: "image", content: url };
            return next;
          });
          if (!inputContent && attachmentsPrompt) {
            setInputContent(attachmentsPrompt);
            const selection = window.getSelection();
            if (!selection?.rangeCount) return;
            const range = selection.getRangeAt(0);
            const textNode = document.createTextNode(attachmentsPrompt);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
          }
        })
        .catch((event) => {
          URL.revokeObjectURL(localUrl);
          setAttachments((prev) => prev.filter((a) => a !== placeholder));
          console.error("[@mybricks/plugin-ai - 图片上传CDN失败]", event);
          message.error("图片上传失败，请重试");
        })
        .finally(() => {
          setUploading(false);
        });
    } else {
      // 无 onUpload，走 base64
      readFileToBase64(file)
        .then((base64) => {
          setAttachments((attachments) => {
            return [...attachments, { type: "image", content: base64 }]
          })
          if (!inputContent && attachmentsPrompt) {
            setInputContent(attachmentsPrompt);
            const selection = window.getSelection();

            if (!selection?.rangeCount) {
              return;
            }

            const range = selection.getRangeAt(0);
            const textNode = document.createTextNode(attachmentsPrompt);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
          }
        })
        .catch((event) => {
          console.error("[@mybricks/plugin-ai - 上传附件失败]", event);
          message.error("[@mybricks/plugin-ai - 上传附件失败]");
        })
    }
  };

  const uploadAttachment = () => {
    if (disabled || uploading) {
      return;
    }
    if (mentionFileInputRef.current) {
      mentionFileInputRef.current.value = "";
      mentionFileInputRef.current.click();
      return;
    }
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = SUPPORTED_FILE_ACCEPT;
    fileInput.multiple = true;

    fileInput.addEventListener('change', function (e) {
      const target = e.target as HTMLInputElement;
      if (!target?.files?.length) {
        return;
      }
      processFiles(Array.from(target.files));
    });

    fileInput.click();
  };

  const handleMentionFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const target = event.target;
    if (!target.files?.length) return;
    if (mentionMenuMode === "trigger" && mentionTriggerRangeRef.current) {
      mentionTriggerRangeRef.current.deleteContents();
      syncInputContent();
    }
    closeMentionMenu();
    processFiles(Array.from(target.files));
    target.value = "";
  };

  const selectMentionEntry = useCallback(async (entry: MentionMenuEntry) => {
    if (entry.id === "__files__") {
      if (mentionMenuMode === "trigger" && mentionTriggerRangeRef.current) {
        mentionTriggerRangeRef.current.deleteContents();
        syncInputContent();
      }
      uploadAttachment();
      return;
    }

    const children = entry.children
      ? typeof entry.children === "function" ? await entry.children() : entry.children
      : undefined;
    if (children?.length) {
      setMentionMenuTitle(entry.label);
      setMentionMenuCanBack(true);
      setMentionMenuEntries(toMentionEntries(entry.provider, children));
      setMentionHighlightIndex(0);
      return;
    }

    const chip = entry.toChip
      ? await entry.toChip(entry)
      : {
          id: `${entry.provider.id}_${Math.random().toString(36).slice(2, 9)}`,
          type: entry.type ?? entry.provider.chip.type,
          label: entry.label,
          data: { ...(entry.data ?? {}), label: entry.label },
        };

    insertMentionChip(chip, mentionMenuMode === "trigger" ? mentionTriggerRangeRef.current : null);
    closeMentionMenu();
  }, [closeMentionMenu, insertMentionChip, mentionMenuMode, syncInputContent, toMentionEntries]);
  selectMentionEntryRef.current = selectMentionEntry;

  const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled || uploading) {
      return;
    }

    const content = getClipboardText(event.clipboardData);
    if (content) {
      const selection = window.getSelection();

      if (!selection?.rangeCount) {
        return;
      }

      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(content);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);

      syncInputContent();
      return;
    }

    const files = event.clipboardData.files;
    if (files?.length) {
      processFiles(Array.from(files));
    }
  }

  const onAttachmentsDelete = (index: number) => {
    setAttachments((attachments) => {
      attachments.splice(index, 1)
      return [...attachments]
    })
  }

  const onDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current += 1;
    if (disabled || uploading) return;
    // 仅当拖拽内容包含文件时才高亮
    if (Array.from(event.dataTransfer.types).includes('Files')) {
      setIsDraggingOver(true);
    }
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    // 告诉浏览器允许 drop（必须，否则 drop 不触发）
    event.dataTransfer.dropEffect = 'copy';
  };

  const onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDraggingOver(false);
    }
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);
    if (disabled || uploading) return;
    const files = event.dataTransfer.files;
    if (files?.length) {
      processFiles(Array.from(files));
    }
  };

  const mentionMenuNode = mentionMenuOpen ? (
    <MentionMenu
      title={mentionMenuTitle}
      entries={mentionMenuEntries}
      loading={mentionMenuLoading}
      canBack={mentionMenuCanBack}
      highlightedIndex={mentionHighlightIndex}
      fileInputRef={mentionFileInputRef}
      onBack={backToRootMentionMenu}
      onHighlight={setMentionHighlightIndex}
      onSelect={(entry) => {
        void selectMentionEntry(entry);
      }}
      onFileInputChange={handleMentionFileInputChange}
    />
  ) : null;

  return (
    <div className={classNames(css.container, { [css.loose]: variant === 'loose', [css.bubble]: variant === 'bubble' }, className)}>
      {abovePanels && abovePanels.length > 0 ? (
        <div className={css.senderAbove}>
          {abovePanels.map((panel) => (
            <div key={panel.key} className={css.senderAboveItem}>
              {panel.content}
            </div>
          ))}
        </div>
      ) : null}
      {pendingQueue && pendingQueue.length > 0 && (
        <PendingQueue queue={pendingQueue} onRemove={onRemoveFromQueue} />
      )}
      <div className={classNames(css.editor, {
        [css.noMentions]: mode === "mention" && !renderFocus,
        [css.dragging]: isDraggingOver,
      })}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {attachments.length ? (
          <div className={css.topArea}>
            <AttachmentsList attachments={attachments} onDelete={onAttachmentsDelete}/>
          </div>
        ) : null}
        {isDraggingOver && (
          <div className={css.dragOverlay}>
            <span className={css.dragOverlayTitle}>拖放文件至此</span>
            <span className={css.dragOverlayHint}>支持图片及常见文件，视频/压缩包等会跳过，图片最大 {MAX_IMAGE_SIZE_MB}MB</span>
          </div>
        )}
        {renderFocus ? (
          <div className={css.mentions}>
            {renderFocus()}
          </div>
        ) : null}
        {selectorRenderInTop && (chatMode || (modelSelector && modelSelector.models.length > 0)) ? (
          <div className={css.selectorsAboveInput}>
            {chatMode ? <ChatMode disabled={disabled || loading} chatMode={chatMode} onChange={onChatModeChange} /> : null}
            {modelSelector && modelSelector.models.length > 0 && (
              <ModelSelector modelSelector={modelSelector} disabled={disabled || uploading || loading} />
            )}
          </div>
        ) : null}
        <div className={css.input}>
          <div className={css.inputEditorContainer}>
            <div
              data-zone-type="ai-request"
              ref={inputEditorRef}
              className={css.inputEditor}
              contentEditable={disabled ? false : true}
              onKeyDown={onKeyDown}
              onCompositionStart={onCompositionStart}
              onCompositionEnd={onCompositionEnd}
              onInput={onInput}
              onPaste={onPaste}
              onBlur={onBlur}
            ></div>
            {!inputContent && (!isDefaultFocusContent || defaultFocusContentSize) && (
              <div className={css.inputPlaceholder}>
                {defaultFocusContentSize ? (
                  <>
                    <span
                      className={css.placeholderFocusContentGhost}
                      style={{ width: defaultFocusContentSize.width, height: defaultFocusContentSize.height }}
                      aria-hidden="true"
                    />
                    <span className={css.placeholderText}>{currentPlaceholder}</span>
                  </>
                ) : (
                  <span className={css.placeholderText}>{currentPlaceholder}</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className={css.editorAction}>
          <div className={classNames(css.leftArea, {
            [css.disabled]: disabled || uploading
          })}>
            <Popup
              open={mentionMenuOpen}
              onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                  closeMentionMenu();
                  return;
                }
                void openPlusMentionMenu();
              }}
              placement="top-start"
              offset={8}
              disabled={disabled || uploading}
              anchorRect={mentionMenuMode === "trigger" ? mentionAnchorRect : null}
              className={classNames(css.mentionPopupTrigger, { [css.bubbleMentionAnchor]: isBubble })}
              overlayClassName={css.mentionPopup}
              trigger={(
                <div
                  data-zone-type="ai-request"
                  className={classNames(css.attachmentButton, css.plusButton, { [css.open]: mentionMenuOpen })}
                >
                  <Plus />
                </div>
              )}
            >
              {mentionMenuNode}
            </Popup>
            {renderAttachmentSuffix?.()}
            {!selectorRenderInTop && chatMode ? <ChatMode disabled={disabled || loading} chatMode={chatMode} onChange={onChatModeChange} /> : null}
          </div>
          <div className={css.rightArea}>
            {renderActionPrefix?.({
              hasInput: !!inputContent?.trim(),
              inputContent,
              disabled: !!disabled,
            })}
            {!selectorRenderInTop && modelSelector && modelSelector.models.length > 0 && (
              <ModelSelector modelSelector={modelSelector} disabled={disabled || uploading || loading} />
            )}
            <div data-zone-type="ai-request" className={classNames(css.sendButtonContainer, {
              [css.disabled]: !loading && (disabled || !inputContent || uploading || hasLoadingChips || attachments.some((a) => a.uploading))
            })} onClick={onSendButtonClick}>
              <div
                data-zone-type="ai-request"
                className={classNames(css.sendButton, {
                  [css.loadingButton]: loading || uploading || hasLoadingChips
                })}
                data-mybricks-tip={loading ? "停止" : ""}
                onClick={(e) => {
                  if (loading) {
                    e.stopPropagation();
                    onStop?.();
                  }
                }}
              >
                {(loading || uploading || hasLoadingChips) ? <Loading /> : <Send />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export { Sender }
export type { SenderRef, SenderProps }
