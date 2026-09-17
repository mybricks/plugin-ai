import React from "react";
import classNames from "classnames";
import { AtSign, Attachment } from "../icons";
import type { MentionMenuItem, MentionProvider } from "../types";
import { fileChipDef } from "./chip";
import css from "./index.less";

export type MentionMenuEntry = MentionMenuItem & {
  provider: MentionProvider;
};

/** 每个分类下最多展示的条目数；超出部分直接截断，不做二级下钻。 */
export const MENTION_SECTION_MAX_ENTRIES = 5;

/** 一个分类：可选标题 + 该分类下的扁平条目列表（已按上限截断）。 */
export interface MentionMenuSection {
  key: string;
  title?: string;
  entries: MentionMenuEntry[];
}

export async function resolveMentionMenuItems(
  provider: MentionProvider,
  source: MentionProvider["menu"]
): Promise<MentionMenuItem[]> {
  if (!source) {
    return [{
      id: provider.id,
      type: provider.chip.type,
      label: provider.label,
      icon: provider.icon,
    }];
  }
  return typeof source === "function" ? await source() : source;
}

export function toMentionEntries(provider: MentionProvider, items: MentionMenuItem[]): MentionMenuEntry[] {
  return items.map((item) => ({ ...item, provider }));
}

export function createFileMentionEntry(): MentionMenuEntry {
  return {
    id: "__files__",
    label: "添加文件和图片",
    keywords: ["file", "image", "附件", "上传", "文件", "图片"],
    provider: {
      id: "__files__",
      label: "添加文件和图片",
      chip: fileChipDef,
    },
  };
}

function toSection(key: string, title: string | undefined, entries: MentionMenuEntry[]): MentionMenuSection {
  return { key, title, entries: entries.slice(0, MENTION_SECTION_MAX_ENTRIES) };
}

/**
 * 构建根菜单分类：未声明多个 menu 项的 provider 铺平进无标题的首个分类，
 * 声明了多个 menu 项的 provider 各自成为一个"标题 + 列表"分类，不再支持二级下钻。
 */
export async function buildRootMentionSections(mentionProviders: MentionProvider[]): Promise<MentionMenuSection[]> {
  const rootEntries: MentionMenuEntry[] = [createFileMentionEntry()];
  const sections: MentionMenuSection[] = [];

  for (const provider of mentionProviders) {
    const items = await resolveMentionMenuItems(provider, provider.menu);
    if (items.length === 0) continue;
    if (items.length === 1 && !provider.menu) {
      rootEntries.push(...toMentionEntries(provider, items));
    } else {
      sections.push(toSection(provider.id, provider.label, toMentionEntries(provider, items)));
    }
  }

  return [toSection("__root__", undefined, rootEntries), ...sections];
}

export async function flattenMentionItems(provider: MentionProvider): Promise<MentionMenuItem[]> {
  const rootItems = await resolveMentionMenuItems(provider, provider.menu);
  const result: MentionMenuItem[] = [];
  for (const item of rootItems) {
    const children = item.children
      ? typeof item.children === "function" ? await item.children() : item.children
      : undefined;
    if (children?.length) {
      result.push(...children);
    } else {
      result.push(item);
    }
  }
  return result;
}

/** 展开分类为扁平条目数组，用于键盘导航与索引对齐（顺序与渲染顺序一致）。 */
export function flattenMentionSections(sections: MentionMenuSection[]): MentionMenuEntry[] {
  return sections.flatMap((section) => section.entries);
}

export interface MentionMenuProps {
  title: string;
  sections: MentionMenuSection[];
  loading: boolean;
  highlightedIndex: number;
  onHighlight: (index: number) => void;
  onSelect: (entry: MentionMenuEntry) => void;
  /** 菜单宽度上限（px）；不传时使用 CSS 默认值（180px）。 */
  maxWidth?: number;
}

export const MentionMenu = ({
  title,
  sections,
  loading,
  highlightedIndex,
  onHighlight,
  onSelect,
  maxWidth,
}: MentionMenuProps) => {
  const hasEntries = sections.some((section) => section.entries.length > 0);
  let flatIndex = -1;

  return (
    <div
      className={css.mentionMenu}
      style={maxWidth ? { maxWidth } : undefined}
      onMouseDown={(event) => {
        if ((event.target as HTMLElement).closest(`.${css.fileMenuLabel}`)) return;
        event.preventDefault();
      }}
    >
      <div className={css.mentionMenuHeader}>
        <span className={css.mentionMenuTitle}>{title}</span>
      </div>
      <div className={css.mentionMenuList}>
        {loading ? (
          <div className={css.mentionMenuEmpty}>加载中...</div>
        ) : hasEntries ? (
          sections.map((section) => {
            if (section.entries.length === 0) return null;
            return (
              <div key={section.key} className={css.mentionMenuSection}>
                {section.title ? (
                  <div className={css.mentionMenuSectionTitle}>{section.title}</div>
                ) : null}
                {section.entries.map((entry) => {
                  flatIndex += 1;
                  const index = flatIndex;
                  const highlighted = index === highlightedIndex;

                  if (entry.id === "__files__") {
                    return (
                      <button
                        key={`${entry.provider.id}:${entry.id}`}
                        type="button"
                        className={classNames(css.mentionMenuItem, css.fileMenuLabel, { [css.highlighted]: highlighted })}
                        onMouseMove={() => onHighlight(index)}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onSelect(entry);
                        }}
                      >
                        <span className={css.mentionMenuIcon}>
                          <Attachment />
                        </span>
                        <span className={css.mentionMenuText}>
                          <span className={css.mentionMenuLabel}>{entry.label}</span>
                          {entry.description ? <span className={css.mentionMenuDesc}>{entry.description}</span> : null}
                        </span>
                      </button>
                    );
                  }

                  const resolvedIcon = entry.icon ?? entry.provider.icon;
                  const showIcon = resolvedIcon !== "";
                  return (
                    <button
                      key={`${entry.provider.id}:${entry.id}`}
                      type="button"
                      className={classNames(css.mentionMenuItem, { [css.highlighted]: highlighted })}
                      onMouseMove={() => onHighlight(index)}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onSelect(entry);
                      }}
                    >
                      {showIcon ? (
                        <span className={css.mentionMenuIcon}>
                          {resolvedIcon ?? <AtSign />}
                        </span>
                      ) : null}
                      <span className={css.mentionMenuText}>
                        <span className={css.mentionMenuLabel}>{entry.label}</span>
                        {entry.description ? <span className={css.mentionMenuDesc}>{entry.description}</span> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })
        ) : (
          <div className={css.mentionMenuEmpty}>暂无可用项</div>
        )}
      </div>
    </div>
  );
};
