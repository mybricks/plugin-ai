import React from "react";
import ReactDOM from "react-dom";
import classNames from "classnames";
import type { ChatChipDef, ChatChipInstance } from "../../../../../agent/src";
import { FILE_CHIP_TYPE, type FileChipData } from "./upload";
import css from "./index.less";

// ─── ChipRemoveBtn ────────────────────────────────────────────────────────────

export const ChipRemoveBtn = ({ onRemove }: { onRemove: () => void }) => (
  <span
    className={css.chipRemove}
    onMouseDown={(e) => {
      // mousedown + preventDefault 避免触发 contentEditable 失焦
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

// ─── ChatChipInner ────────────────────────────────────────────────────────────

/**
 * 渲染单个 chat chip 的 React 组件。
 * 通过 ReactDOM.render 挂载到 contentEditable 内的 DOM 节点上。
 */
export const ChatChipInner = ({
  instance,
  chipDef,
  onRemove,
}: {
  instance: ChatChipInstance;
  chipDef?: ChatChipDef;
  onRemove: () => void;
}) => {
  if (chipDef?.render) {
    const rendered = chipDef.render(instance.data);
    // 判断是否为 { color?, content } 对象
    if (rendered && typeof rendered === "object" && !React.isValidElement(rendered) && "content" in rendered) {
      const chipData = rendered as { color?: string; content: string };
      return (
        <span
          className={classNames(css.chipDefault, { [css.hasCustomColor]: !!chipData.color })}
          style={
            chipData.color
              ? { color: chipData.color, borderColor: chipData.color, backgroundColor: `${chipData.color}18` }
              : undefined
          }
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
  // 无 render 时：使用默认 chip 样式
  return (
    <span className={classNames(css.chip, { [css.domChip]: instance.type === "dom" })}>
      <span className={css.chipText}>{instance.label}</span>
      <ChipRemoveBtn onRemove={onRemove} />
    </span>
  );
};

// ─── chip DOM 容器工厂 ────────────────────────────────────────────────────────

/** 卸载 chip 容器内的 React */
export function unmountChipContainer(wrapper: HTMLSpanElement) {
  const inner = wrapper.firstChild as HTMLElement | null;
  if (inner) ReactDOM.unmountComponentAtNode(inner);
}

/**
 * 创建 chip 的 DOM 容器 span，并用 ReactDOM.render 挂载 ChatChipInner。
 * 返回的 span 可直接插入 contentEditable editor。
 */
export function createChipContainer(
  instance: ChatChipInstance,
  chipDef: ChatChipDef | undefined,
  onRemove: () => void
): HTMLSpanElement {
  const wrapper = document.createElement("span");
  wrapper.contentEditable = "false";
  wrapper.dataset.chipId = instance.id;
  wrapper.className = css.chipWrapper;
  const inner = document.createElement("span");
  wrapper.appendChild(inner);
  ReactDOM.render(<ChatChipInner instance={instance} chipDef={chipDef} onRemove={onRemove} />, inner);
  return wrapper;
}

export function updateChipWrapperSpacing(editor: HTMLDivElement) {
  let previousSignificantNodeIsChip = false;
  editor.childNodes.forEach((child) => {
    if (child instanceof HTMLElement && child.dataset.chipId) {
      child.classList.toggle(css.chipWrapperTightLeft, previousSignificantNodeIsChip);
      previousSignificantNodeIsChip = true;
      return;
    }

    if (child.nodeType === Node.TEXT_NODE) {
      if ((child.textContent ?? "").length > 0) {
        previousSignificantNodeIsChip = false;
      }
      return;
    }

    previousSignificantNodeIsChip = false;
  });
}

// ─── 序列化 editor childNodes ─────────────────────────────────────────────────

export function serializeEditorContent(
  editor: HTMLDivElement,
  chipMap: Map<string, ChatChipInstance>
): { message: string; chips: ChatChipInstance[] } {
  const instances: ChatChipInstance[] = [];
  let msg = "";
  editor.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      msg += child.textContent ?? "";
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

export function measureEditorContent(editor: HTMLDivElement): { width: number; height: number } | null {
  if (!editor.childNodes.length) return null;

  const range = document.createRange();
  range.selectNodeContents(editor);
  const rect = range.getBoundingClientRect();
  range.detach();

  if (!rect.width && !rect.height) return null;
  return { width: rect.width, height: rect.height };
}

export function getAdjacentChipAtCaret(
  editor: HTMLDivElement,
  range: Range,
  direction: "backward" | "forward"
): HTMLSpanElement | null {
  if (!range.collapsed) return null;

  const container = direction === "backward" ? range.startContainer : range.endContainer;
  const offset = direction === "backward" ? range.startOffset : range.endOffset;
  let target: ChildNode | null = null;

  if (container === editor) {
    target =
      direction === "backward" ? editor.childNodes[offset - 1] ?? null : editor.childNodes[offset] ?? null;
  } else if (container.nodeType === Node.TEXT_NODE && container.parentNode === editor) {
    const textLength = container.textContent?.length ?? 0;
    if (direction === "backward" && offset === 0) {
      target = container.previousSibling;
    }
    if (direction === "forward" && offset === textLength) {
      target = container.nextSibling;
    }
  }

  return target instanceof HTMLSpanElement && target.dataset.chipId ? target : null;
}

export function removeChipFromEditor(
  editor: HTMLDivElement,
  chipEl: HTMLSpanElement,
  chipMap: Map<string, ChatChipInstance>
) {
  const id = chipEl.dataset.chipId;
  unmountChipContainer(chipEl);
  chipEl.parentNode?.removeChild(chipEl);
  editor.normalize();
  if (id) chipMap.delete(id);
}

// ─── 内置 file chip 定义 ──────────────────────────────────────────────────────

/**
 * 内置的文件 chip 类型定义。
 * format 模式：行内占位符替换为简短引用（「文件名」），详细文件内容追加到消息末尾。
 * 与 dom chip 保持一致，避免大段内容打断消息主体。
 */
export const fileChipDef: ChatChipDef = {
  type: FILE_CHIP_TYPE,
  format({ message, chips }) {
    // Step 1：行内占位符替换为简短引用
    let resolved = message;
    const fileBlocks: string[] = [];

    for (const chip of chips) {
      const data = chip.data as FileChipData | undefined;
      if (!data) continue;

      const nameAttr = data.filePath ?? data.fileName;
      // 行内用「临时文件 文件名」自然引用，可嵌入句子任意位置
      resolved = resolved.replace(`[[chip:${chip.id}]]`, `「临时文件 ${data.fileName}」`);
      // Step 2：收集详细内容，追加到消息末尾
      const lineCount = data.content.split("\n").length;
      const truncatedNote = data.truncated ? `（内容已截断，仅展示前 ${lineCount} 行）` : "";
      const langFence = data.language ? `\`\`\`${data.language}` : "```";
      fileBlocks.push(
        `<file name="${nameAttr}" lines="${lineCount}"${data.truncated ? ' truncated="true"' : ""}>${truncatedNote}\n` +
        `${langFence}\n${data.content}\n\`\`\`\n` +
        `</file>`
      );
    }

    // Step 3：有文件内容时追加到消息末尾
    if (fileBlocks.length > 0) {
      resolved = `${resolved}\n\n文件内容（以下均为用户临时上传的文件，不属于工作区，无法被读取或修改，仅供内容参考）：\n${fileBlocks.join("\n\n")}`;
    }

    return resolved;
  },
};
