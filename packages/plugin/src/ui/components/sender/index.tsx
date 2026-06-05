import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from "react"
import ReactDOM from "react-dom"
import classNames from "classnames";
import { message } from "antd";
import { Attachment, Loading, Send } from "../icons";
import { MentionTag } from "../mention";
import { AttachmentsList } from "../attachments";
import type { Attachment as AttachmentItem } from "../attachments";
import { Mention, Attachments } from "../types";
import { ChatMode, type ChatModeType } from "../chat-mode";
import type { QueueItem } from "../../context/queue";
import type { ModelSelection } from "../../../../../request/src/providers";
import type { SendToAgentParams } from "../../../sandbox";
import type { ChatChipDef, ChatChipInstance } from "../../../../../agent/src";
import css from "./index.less"

const MAX_IMAGE_SIZE_MB = 3.5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

const readFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (event) {
      if (event.target) {
        const base64 = event.target.result as string;
        resolve(base64);
      } else {
        reject(event);
      }
    };
    reader.onerror = function (event) {
      reject(event);
    };
    reader.readAsDataURL(file);
  })
}

const getImageSize = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };

    image.onerror = (event) => {
      URL.revokeObjectURL(url);
      reject(event);
    };

    image.src = url;
  })
}

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
                  {/* <span>对于</span> */}
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

interface ModelSelectorProps {
  modelSelector: NonNullable<SenderProps['modelSelector']>;
  disabled?: boolean;
}

const ModelSelector = ({ modelSelector, disabled }: ModelSelectorProps) => {
  const { models, selected: initialSelected, onSelect } = modelSelector;
  
  // 内部维护 selected 状态，实现响应式
  const [selected, setSelected] = useState<ModelSelection | null | undefined>(initialSelected);

  // 同步外部 initialSelected 的变化
  useEffect(() => {
    setSelected(initialSelected);
  }, [initialSelected]);

  return (
    <select
      className={css.modelSelect}
      disabled={disabled}
      value={selected ? `${selected.providerId}|${selected.modelId}` : ''}
      onChange={(e) => {
        const [providerId, modelId] = e.target.value.split('|');
        const newSelected = { providerId, modelId };
        setSelected(newSelected);
        onSelect(newSelected);
      }}
    >
      {models.map((m) => (
        <option key={`${m.providerId}|${m.modelId}`} value={`${m.providerId}|${m.modelId}`}>
          {m.modelName}
        </option>
      ))}
    </select>
  );
};

// ─── ChatChip ──────────────────────────────────────────────────────────────

/**
 * 渲染单个 chat chip 的 React 组件。
 * 通过 ReactDOM.render 挂载到 contentEditable 内的 DOM 节点上。
 */
const ChipRemoveBtn = ({ onRemove }: { onRemove: () => void }) => (
  <span
    className={css.chipRemove}
    onMouseDown={(e) => {
      // 用 mousedown + preventDefault 避免触发 contentEditable 失焦
      e.preventDefault();
      e.stopPropagation();
      onRemove();
    }}
  >
    <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor">
      <path d="M563.8 512l262.5-312.9c4.4-5.2.7-13.1-6.1-13.1h-79.8c-4.7 0-9.2 2.1-12.3 5.7L511.6 449.8 295.1 191.7c-3-3.6-7.5-5.7-12.3-5.7H203c-6.8 0-10.5 7.9-6.1 13.1L459.4 512 196.9 824.9A7.95 7.95 0 0 0 203 838h79.8c4.7 0 9.2-2.1 12.3-5.7l216.5-258.1 216.5 258.1c3 3.6 7.5 5.7 12.3 5.7h79.8c6.8 0 10.5-7.9 6.1-13.1L563.8 512z" />
    </svg>
  </span>
);

const ChatChipInner = ({ instance, chipDef, onRemove }: { instance: ChatChipInstance; chipDef?: ChatChipDef; onRemove: () => void }) => {
  if (chipDef?.render) {
    const rendered = chipDef.render(instance.data);
    // 判断是否为 { color?, content } 对象
    if (rendered && typeof rendered === 'object' && !React.isValidElement(rendered) && 'content' in rendered) {
      const chipData = rendered as { color?: string; content: string };
      return (
        <span
          className={classNames(css.chipDefault, { [css.hasCustomColor]: !!chipData.color })}
          style={chipData.color ? { color: chipData.color, borderColor: chipData.color, backgroundColor: `${chipData.color}18` } : undefined}
        >
          {chipData.content}
          <ChipRemoveBtn onRemove={onRemove} />
        </span>
      );
    }
    // JSX 直接返回时，外层包一个默认 chip 容器放删除按钮
    return (
      <span className={css.chipDefault}>
        {rendered}
        <ChipRemoveBtn onRemove={onRemove} />
      </span>
    );
  }
  // 无 render 时：使用默认 chip 样式（图标 + label）
  return (
    <span className={classNames(css.chip, { [css.domChip]: instance.type === "dom" })}>
      <span className={css.chipIcon} aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M5.5 5.5h5m-5 2.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </span>
      <span className={css.chipText}>{instance.label}</span>
      <ChipRemoveBtn onRemove={onRemove} />
    </span>
  );
};

// ─── SenderProps ─────────────────────────────────────────────────────────────

interface SenderProps {
  onSend: (message: {
    message: string;
    attachments: Attachments;
    mentions: Mention[];
    chips?: ChatChipInstance[];
    [key: string]: any;
  }) => void;
  onMentionClick?: (mention: Mention) => void;
  loading?: boolean;
  placeholder?: string;
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
  /** 在发送按钮左侧插入自定义操作（如「追加到对话」按钮），不影响发送按钮本身 */
  renderActionPrefix?: () => React.ReactNode;
  /** 自定义根元素类名，用于外部覆盖样式 */
  className?: string;
  /** 模型选择器配置 */
  modelSelector?: {
    models: Array<ModelSelection & { modelName: string }>;
    selected?: ModelSelection | null;
    onSelect: (selection: ModelSelection) => void;
  };
  /**
   * Chat chip 类型注册表（从 agent.getChipTypes() 获取）。
   * 用于在输入框中渲染 chip。
   */
  chipTypes?: ChatChipDef[];
}

interface SenderRef {
  focus: () => void;
  /**
   * 向输入框追加内容。
   * - string / SendToAgentParams：纯文本追加（兼容旧用法）
   * - { message, meta }：message 中可含 [[chip:id]] 占位符，
   *   meta.chips 提供对应实例，appendInput 内部会将占位符渲染成 chip span。
   */
  appendInput: (params: string | SendToAgentParams | { message: string; meta?: { chips?: ChatChipInstance[] } }) => void;
  // TODO: 目前仅展示聚焦组件且单个比较简单直接set即可，后续可通过输入框@唤起选择多个
  setMentions: (mentions: Mention[]) => void;
  /** 获取输入框当前草稿内容（文本 + 附件 + mentions + chips） */
  getInput: () => {
    /** 输入框当前文本（含 [[chip:id]] 占位符） */
    message: string;
    /** 当前附件列表（含上传中的占位项） */
    attachments: AttachmentItem[];
    /** 当前 @提及 / focus mentions */
    mentions: Mention[];
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
}

// ─── Chat chip 挂载容器工厂 ────────────────────────────────────────────────────────────────────

/** 卸载 chip 容器内的 React */
function unmountChipContainer(wrapper: HTMLSpanElement) {
  const inner = wrapper.firstChild as HTMLElement | null;
  if (inner) ReactDOM.unmountComponentAtNode(inner);
}

/**
 * 创建 chip 的 DOM 容器 span，并用 ReactDOM.render 挂载 ChatChipInner。
 * 返回的 span 可直接插入 contentEditable editor。
 */
function createChipContainer(
  instance: ChatChipInstance,
  chipDef: ChatChipDef | undefined,
  onRemove: () => void
): HTMLSpanElement {
  const wrapper = document.createElement('span');
  wrapper.contentEditable = 'false';
  wrapper.dataset.chipId = instance.id;
  wrapper.className = css.chipWrapper;
  const inner = document.createElement('span');
  wrapper.appendChild(inner);
  ReactDOM.render(<ChatChipInner instance={instance} chipDef={chipDef} onRemove={onRemove} />, inner);
  return wrapper;
}

// ─── 序列化 editor childNodes ─────────────────────────────────────────────────

function serializeEditorContent(editor: HTMLDivElement, chipMap: Map<string, ChatChipInstance>): { message: string; chips: ChatChipInstance[] } {
  const instances: ChatChipInstance[] = [];
  let msg = '';
  editor.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      msg += child.textContent ?? '';
    } else if (child instanceof HTMLElement && child.dataset.chipId) {
      const id = child.dataset.chipId;
      const inst = chipMap.get(id);
      if (inst) {
        instances.push(inst);
        msg += `[[chip:${id}]]`;
      }
    }
  });
  return { message: msg, chips: instances };
}

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

// ─── Sender ──────────────────────────────────────────────────────────────────

const Sender = forwardRef<SenderRef, SenderProps>((props, ref) => {
  const { loading, placeholder = "请输入", disabled, onMentionClick, onBlur, attachmentsPrompt, mode, chatMode, onChatModeChange, variant = 'compact', onUpload, onStop, pendingQueue, onRemoveFromQueue, renderFocus, renderActionPrefix, modelSelector, className, chipTypes = [] } = props;
  const isBubble = variant === 'bubble';
  const inputEditorRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [inputContent, setInputContent] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [vibeCoding, setVibeCoding] = useState(false);
  const [uploading, setUploading] = useState(false);

  /** chat chip 实例 Map：id → ChatChipInstance */
  const chipMapRef = useRef<Map<string, ChatChipInstance>>(new Map());

  /** chipTypes 的 Map 形式（type → def），方便查找 */
  const chipTypesMapRef = useRef<Map<string, ChatChipDef>>(new Map());
  useEffect(() => {
    chipTypesMapRef.current = new Map(chipTypes.map(def => [def.type, def]));
  }, [chipTypes]);

  /** 根据当前 editor DOM 同步 inputContent 状态 */
  const syncInputContent = useCallback(() => {
    if (!inputEditorRef.current) return;
    const { message } = serializeEditorContent(inputEditorRef.current, chipMapRef.current);
    setInputContent(message || null);
  }, []);

  const appendInput = (params: string | SendToAgentParams | { message: string; meta?: { chips?: ChatChipInstance[] } }) => {
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

    editor.focus();
    const selection = window.getSelection();

    // 始终追加到末尾
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);

    if (incomingChips.size > 0) {
      // 有 chip 实例：按 [[chip:id]] 分割，交替插入文本节点和 chip span
      const parts = content.split(/(\[\[chip:[^\]]+\]\])/);
      for (const part of parts) {
        const match = part.match(/^\[\[chip:([^\]]+)\]\]$/);
        if (match) {
          const instance = incomingChips.get(match[1]);
          if (instance) {
            chipMapRef.current.set(instance.id, instance);
            const def = chipTypesMapRef.current.get(instance.type);
            const onRemove = () => {
              const chipEl = editor.querySelector<HTMLSpanElement>(`[data-chip-id="${instance.id}"]`);
              if (chipEl) {
                unmountChipContainer(chipEl);
                chipEl.parentNode?.removeChild(chipEl);
              }
              chipMapRef.current.delete(instance.id);
              syncInputContent();
            };
            const chipEl = createChipContainer(instance, def, onRemove);
            range.insertNode(chipEl);
            range.setStartAfter(chipEl);
            range.setEndAfter(chipEl);
          }
        } else if (part) {
          const textNode = document.createTextNode(part);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
        }
      }
    } else {
      // 纯文本追加（兼容旧用法）
      const textNode = document.createTextNode(content);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
    }

    selection?.removeAllRanges();
    selection?.addRange(range);
    syncInputContent();
  }

  /** 在当前光标位置插入一个 chat chip */
  const insertChip = useCallback((instance: ChatChipInstance) => {
    const editor = inputEditorRef.current;
    if (!editor) return;

    // 存入 chipMap
    chipMapRef.current.set(instance.id, instance);

    const def = chipTypesMapRef.current.get(instance.type);

    // 点击删除按钮时：卸载 React、从 DOM 移除、清理 chipMap、同步内容
    const onRemove = () => {
      const chipEl = editor.querySelector<HTMLSpanElement>(`[data-chip-id="${instance.id}"]`);
      if (chipEl) {
        unmountChipContainer(chipEl);
        chipEl.parentNode?.removeChild(chipEl);
      }
      chipMapRef.current.delete(instance.id);
      syncInputContent();
    };

    const chipEl = createChipContainer(instance, def, onRemove);

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
    editor.focus();
  }, [syncInputContent]);

  useImperativeHandle(ref, () => {
    return {
      focus: () => {
        if (inputEditorRef.current) {
          focusEditorAtEnd(inputEditorRef.current);
        }
      },
      appendInput,
      setMentions: (mentions) => {
        setMentions(mentions)
        setVibeCoding(mentions[0]?.vibeCoding || false);
      },
      getInput: () => {
        const editor = inputEditorRef.current;
        if (!editor) {
          return { message: "", attachments: [...attachments], mentions: [...mentions], chips: [] };
        }
        const { message, chips } = serializeEditorContent(editor, chipMapRef.current);
        return {
          message,
          attachments: [...attachments],
          mentions: [...mentions],
          chips,
        };
      },
      clear: () => {
        if (inputEditorRef.current) {
          // 卸载所有 chip 的 React 实例
          inputEditorRef.current.querySelectorAll<HTMLSpanElement>(`[data-chip-id]`).forEach(unmountChipContainer);
          inputEditorRef.current.textContent = "";
        }
        chipMapRef.current.clear();
        setInputContent("");
        setAttachments([]);
      },
      insertChip,
    };
  }, [attachments, mentions, insertChip]);

  const send = () => {
    const editor = inputEditorRef.current!;
    const { message: serializedMessage, chips } = serializeEditorContent(editor, chipMapRef.current);
    const hasUploadingAttachment = attachments.some((a) => a.uploading);
    if (serializedMessage && !disabled && !uploading && !hasUploadingAttachment) {
      props.onSend({
        message: serializedMessage,
        attachments,
        mentions,
        ...(chips.length > 0 ? { chips } : {}),
      })

      // 清空输入框（卸载 chip React 实例后清空 DOM）
      editor.querySelectorAll<HTMLSpanElement>(`[data-chip-id]`).forEach(unmountChipContainer);
      editor.textContent = "";
      chipMapRef.current.clear();
      setAttachments([]);
      setInputContent("");
    }
  }

  const onInput = () => {
    syncInputContent();
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      if (isComposing) {
        return;
      }

      if (event.shiftKey) {

      } else {
        event.preventDefault();
        send();
      }
      return;
    }

    // ── 整体删除 chat chip ──────────────────────────────────────────────
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);

    if (event.key === 'Backspace') {
      // 光标紧贴 chip 右侧：当前节点是文本节点且 offset=0，prevSibling 是 chip
      const { startContainer, startOffset } = range;
      if (startOffset === 0) {
        const prev = startContainer.previousSibling as HTMLElement | null;
        if (prev && prev.dataset?.chipId) {
          event.preventDefault();
          const id = prev.dataset.chipId;
          unmountChipContainer(prev as HTMLSpanElement);
          prev.parentNode?.removeChild(prev);
          chipMapRef.current.delete(id);
          syncInputContent();
          return;
        }
      }
    }

    if (event.key === 'Delete') {
      // 光标紧贴 chip 左侧：nextSibling 是 chip
      const { endContainer, endOffset } = range;
      const textLen = endContainer.textContent?.length ?? 0;
      if (endOffset === textLen) {
        const next = endContainer.nextSibling as HTMLElement | null;
        if (next && next.dataset?.chipId) {
          event.preventDefault();
          const id = next.dataset.chipId;
          unmountChipContainer(next as HTMLSpanElement);
          next.parentNode?.removeChild(next);
          chipMapRef.current.delete(id);
          syncInputContent();
          return;
        }
      }
    }
  }

  const onCompositionStart = () => {
    setIsComposing(true);
  }

  const onCompositionEnd = () => {
    setIsComposing(false);
  }

  /** 检查附件数量是否超出限制，超出返回 true */
  const checkAttachmentsLimit = () => {
    if (attachments.length > 4) {
      message.info("当前最多只能上传五张图片");
      return true;
    }
    return false;
  }

  const updateAttachmentsByFile = async (file: File) => {
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      message.info(`当前文件大小 ${(file.size / 1024 / 1024).toFixed(2)}MB，超过了${MAX_IMAGE_SIZE_MB}MB，建议您截取页面中的某个区域作为附件`)
      return;
    }

    try {
      const { width, height } = await getImageSize(file);
      if (width > 8000 || height > 8000) {
        message.info(`当前图片尺寸 ${width}x${height}px，宽高任一不得大于8000px`);
        return;
      }
    } catch (event) {
      console.error("[@mybricks/plugin-ai - 读取图片尺寸失败]", event);
      message.error("读取图片尺寸失败，请重试");
      return;
    }

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
  }

  const uploadAttachment = () => {
    if (disabled || uploading) {
      return;
    }
    if (checkAttachmentsLimit()) {
      return;
    }
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';

    fileInput.addEventListener('change', function (e) {
      const target = e.target as HTMLInputElement;
      if (!target) {
        return;
      }
      const file = target.files?.[0];

      if (file) {
        if (!file.type.startsWith('image/')) {
          return;
        }

        updateAttachmentsByFile(file);
      }
    });

    fileInput.click();
  };

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

    const file = event.clipboardData.files[0];
    if (file?.type.startsWith('image/')) {
      if (checkAttachmentsLimit()) {
        return;
      }
      updateAttachmentsByFile(file);
    }
  }

  const onAttachmentsDelete = (index: number) => {
    setAttachments((attachments) => {
      attachments.splice(index, 1)
      return [...attachments]
    })
  }

  return (
    <div className={classNames(css.container, { [css.loose]: variant === 'loose', [css.bubble]: variant === 'bubble' }, className)}>
      {pendingQueue && pendingQueue.length > 0 && (
        <PendingQueue queue={pendingQueue} onRemove={onRemoveFromQueue} />
      )}
      <div className={classNames(css.editor, {
        [css.noMentions]: mode === "mention" && !mentions.length
      })}>
        {attachments.length ? (
          <div className={css.topArea}>
            <AttachmentsList attachments={attachments} onDelete={onAttachmentsDelete}/>
          </div>
        ) : null}
        {renderFocus ? (
          <div className={css.mentions}>
            {renderFocus()}
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
            {!inputContent && <div className={css.inputPlaceholder}>
              {placeholder}
            </div>}
          </div>
        </div>
        <div className={css.editorAction}>
          <div className={classNames(css.leftArea, {
            [css.disabled]: disabled || uploading
          })}>
            {!isBubble && (
              <div data-zone-type="ai-request" className={css.attachmentButton} onClick={uploadAttachment}>
                <Attachment />
              </div>
            )}
            {/* 模式切换，暂时去除 */}
            {/* {chatMode ? <ChatMode disabled={disabled} chatMode={chatMode} onChange={onChatModeChange} /> : null} */}
            {modelSelector && modelSelector.models.length > 0 && (
              <ModelSelector modelSelector={modelSelector} disabled={disabled || uploading || loading} />
            )}
          </div>
          <div className={css.rightArea}>
            {renderActionPrefix?.()}
            <div data-zone-type="ai-request" className={classNames(css.sendButtonContainer, {
              [css.disabled]: !loading && (disabled || !inputContent || uploading || attachments.some((a) => a.uploading))
            })} onClick={send}>
              <div
                data-zone-type="ai-request"
                className={classNames(css.sendButton, {
                  [css.loadingButton]: loading || uploading
                })}
                data-mybricks-tip={loading ? "停止" : ""}
                onClick={(e) => {
                  if (loading) {
                    e.stopPropagation();
                    onStop?.();
                  }
                }}
              >
                {(loading || uploading) ? <Loading /> : <Send />}
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
