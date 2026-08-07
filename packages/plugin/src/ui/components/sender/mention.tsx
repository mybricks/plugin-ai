import React from "react";
import classNames from "classnames";
import { AtSign, Attachment, ChevronLeft, ChevronRight } from "../icons";
import type { MentionMenuItem, MentionProvider } from "../types";
import { fileChipDef } from "./chip";
import css from "./index.less";

export type MentionMenuEntry = MentionMenuItem & {
  provider: MentionProvider;
};

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
    label: "文件与图片",
    keywords: ["file", "image", "附件", "上传", "文件", "图片"],
    provider: {
      id: "__files__",
      label: "文件与图片",
      chip: fileChipDef,
    },
  };
}

export async function buildRootMentionEntries(mentionProviders: MentionProvider[]): Promise<MentionMenuEntry[]> {
  const entries: MentionMenuEntry[] = [createFileMentionEntry()];

  for (const provider of mentionProviders) {
    const items = await resolveMentionMenuItems(provider, provider.menu);
    if (items.length === 0) continue;
    if (items.length === 1 && !provider.menu) {
      entries.push(...toMentionEntries(provider, items));
    } else {
      entries.push({
        id: provider.id,
        label: provider.label,
        icon: provider.icon,
        children: items,
        provider,
      });
    }
  }

  return entries;
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

export interface MentionMenuProps {
  title: string;
  entries: MentionMenuEntry[];
  loading: boolean;
  canBack: boolean;
  highlightedIndex: number;
  onBack: () => void;
  onHighlight: (index: number) => void;
  onSelect: (entry: MentionMenuEntry) => void;
}

export const MentionMenu = ({
  title,
  entries,
  loading,
  canBack,
  highlightedIndex,
  onBack,
  onHighlight,
  onSelect,
}: MentionMenuProps) => {
  return (
    <div
      className={css.mentionMenu}
      onMouseDown={(event) => {
        if ((event.target as HTMLElement).closest(`.${css.fileMenuLabel}`)) return;
        event.preventDefault();
      }}
    >
      <div className={css.mentionMenuHeader}>
        {canBack ? (
          <button
            type="button"
            className={css.mentionMenuBack}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onBack();
            }}
          >
            <ChevronLeft />
          </button>
        ) : null}
        <span className={css.mentionMenuTitle}>{title}</span>
      </div>
      <div className={css.mentionMenuList}>
        {loading ? (
          <div className={css.mentionMenuEmpty}>加载中...</div>
        ) : entries.length > 0 ? (
          entries.map((entry, index) => {
            const hasChildren = !!entry.children;
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
                <span className={css.mentionMenuIcon}>
                  {entry.icon ?? entry.provider.icon ?? <AtSign />}
                </span>
                <span className={css.mentionMenuText}>
                  <span className={css.mentionMenuLabel}>{entry.label}</span>
                  {entry.description ? <span className={css.mentionMenuDesc}>{entry.description}</span> : null}
                </span>
                {hasChildren ? <span className={css.mentionMenuArrow}><ChevronRight /></span> : null}
              </button>
            );
          })
        ) : (
          <div className={css.mentionMenuEmpty}>暂无可用项</div>
        )}
      </div>
    </div>
  );
};
