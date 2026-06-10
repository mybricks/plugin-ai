import React, { useState, useMemo } from "react";
import classNames from "classnames";
import { Modal } from "../../../components/modal";
import css from "./plan-card.less";
import markdownCss from "../index.less";

// ─── SVG Icons ────────────────────────────────────────────────────────────────

/** 放大图标：点击弹出弹窗查看完整内容 */
const ExpandIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1.5 1.5h3.25v1H2.5v2.25h-1V1.5Z" fill="currentColor" />
    <path d="M7.25 1.5h3.25v3.25h-1V2.5H7.25v-1Z" fill="currentColor" />
    <path d="M1.5 7.25h1v2.25h2.25v1H1.5V7.25Z" fill="currentColor" />
    <path d="M9.5 7.25h1V10.5H7.25v-1H9.5V7.25Z" fill="currentColor" />
  </svg>
);

// ─── Frontmatter 解析 ─────────────────────────────────────────────────────────

function parsePlanContent(content: string): { title: string | null; body: string } {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { title: null, body: content };
  const fmText = m[1]!;
  const body = m[2]!.trimStart();
  const titleMatch = fmText.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  const title = titleMatch ? titleMatch[1]!.trim() : null;
  return { title, body };
}

// ─── PlanFileCard ──────────────────────────────────────────────────────────────

export const PlanFileCard = ({
  path,
  onExecute,
  canExecute,
  onAbandon,
  abandoned = false,
  children,
}: {
  path: string;
  onExecute?: () => void;
  canExecute: boolean;
  onAbandon?: () => void;
  abandoned?: boolean;
  children: React.ReactNode;
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const executeDisabled = abandoned || !canExecute || !onExecute;

  const modalFooter = (
    <div className={css["plan-card-footer-inner"]}>
      {!abandoned && onAbandon && (
        <div
          className={css["plan-card-abandon-button"]}
          title="废弃此方案"
          onClick={() => {
            setModalOpen(false);
            onAbandon();
          }}
        >
          废弃此方案
        </div>
      )}
      <div
        className={classNames(css["plan-card-execute-button"], { [css["plan-card-execute-button-disabled"]]: executeDisabled })}
        title={abandoned ? "方案已废弃" : executeDisabled ? "当前无法执行方案" : "按当前方案进入执行模式"}
        onClick={() => {
          if (executeDisabled) return;
          setModalOpen(false);
          onExecute?.();
        }}
      >
        执行此方案
      </div>
    </div>
  );

  const modalTitle = (
    <>
      <span className={css["plan-card-modal-title-text"]}>方案</span>
      <span className={css["plan-card-modal-path"]} title={path}>{path}</span>
      {abandoned && <span className={css["plan-card-abandoned-badge"]}>已废弃</span>}
    </>
  );

  return (
    <>
      <div className={classNames(css["plan-card"], { [css["plan-card-abandoned"]]: abandoned })}>
        <div className={css["plan-card-header"]}>
          <div className={css["plan-card-title"]}>
            <span className={css["plan-card-title-text"]}>方案</span>
            <span className={css["plan-card-path"]}>{path}</span>
            {abandoned && <span className={css["plan-card-abandoned-badge"]}>已废弃</span>}
          </div>
          <div
            className={css["plan-card-icon-button"]}
            onClick={() => setModalOpen(true)}
            title="查看完整方案"
          >
            <ExpandIcon />
          </div>
        </div>
        <div className={css["plan-card-body"]}>
          {children}
        </div>
        <div className={css["plan-card-footer"]}>
          {!abandoned && onAbandon && (
            <div
              className={css["plan-card-abandon-button"]}
              title="废弃此方案"
              onClick={onAbandon}
            >
              废弃此方案
            </div>
          )}
          <div
            className={classNames(css["plan-card-execute-button"], { [css["plan-card-execute-button-disabled"]]: executeDisabled })}
            title={abandoned ? "方案已废弃" : executeDisabled ? "当前无法执行方案" : "按当前方案进入执行模式"}
            onClick={() => { if (!executeDisabled) onExecute?.(); }}
          >
            执行此方案
          </div>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        footer={modalFooter}
        width={720}
      >
        <div className={classNames(css["plan-card-modal-body"], markdownCss["markdown-body"])}>
          {children}
        </div>
      </Modal>
    </>
  );
};

// ─── PlanFileCardWithContent ───────────────────────────────────────────────────
// 带有自动解析 frontmatter 能力的版本，供 index.tsx 直接使用

export const PlanFileCardWithContent = ({
  path,
  content,
  onExecute,
  canExecute,
  onAbandon,
  abandoned = false,
  renderContent,
}: {
  path: string;
  content: string;
  onExecute?: () => void;
  canExecute: boolean;
  onAbandon?: () => void;
  abandoned?: boolean;
  renderContent: (body: string) => React.ReactNode;
}) => {
  const { title, body } = useMemo(() => parsePlanContent(content), [content]);
  const [modalOpen, setModalOpen] = useState(false);
  const executeDisabled = abandoned || !canExecute || !onExecute;

  const displayTitle = title ?? path;

  const modalTitle = (
    <>
      <span className={css["plan-card-modal-title-text"]}>方案</span>
      <span className={css["plan-card-modal-path"]} title={path}>{displayTitle}</span>
      {abandoned && <span className={css["plan-card-abandoned-badge"]}>已废弃</span>}
    </>
  );

  const modalFooter = (
    <div className={css["plan-card-footer-inner"]}>
      {!abandoned && onAbandon && (
        <div
          className={css["plan-card-abandon-button"]}
          title="废弃此方案"
          onClick={() => {
            setModalOpen(false);
            onAbandon();
          }}
        >
          废弃此方案
        </div>
      )}
      <div
        className={classNames(css["plan-card-execute-button"], { [css["plan-card-execute-button-disabled"]]: executeDisabled })}
        title={abandoned ? "方案已废弃" : executeDisabled ? "当前无法执行方案" : "按当前方案进入执行模式"}
        onClick={() => {
          if (executeDisabled) return;
          setModalOpen(false);
          onExecute?.();
        }}
      >
        执行此方案
      </div>
    </div>
  );

  return (
    <>
      <div className={classNames(css["plan-card"], { [css["plan-card-abandoned"]]: abandoned })}>
        <div className={css["plan-card-header"]}>
          <div className={css["plan-card-title"]}>
            <span className={css["plan-card-title-text"]}>方案</span>
            <span className={css["plan-card-path"]} title={path}>{displayTitle}</span>
            {abandoned && <span className={css["plan-card-abandoned-badge"]}>已废弃</span>}
          </div>
          <div
            className={css["plan-card-icon-button"]}
            onClick={() => setModalOpen(true)}
            title="查看完整方案"
          >
            <ExpandIcon />
          </div>
        </div>
        <div className={css["plan-card-body"]}>
          {renderContent(body)}
        </div>
        <div className={css["plan-card-footer"]}>
          {!abandoned && onAbandon && (
            <div
              className={css["plan-card-abandon-button"]}
              title="废弃此方案"
              onClick={onAbandon}
            >
              废弃此方案
            </div>
          )}
          <div
            className={classNames(css["plan-card-execute-button"], { [css["plan-card-execute-button-disabled"]]: executeDisabled })}
            title={abandoned ? "方案已废弃" : executeDisabled ? "当前无法执行方案" : "按当前方案进入执行模式"}
            onClick={() => { if (!executeDisabled) onExecute?.(); }}
          >
            执行此方案
          </div>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        footer={modalFooter}
        width={720}
      >
        <div className={classNames(css["plan-card-modal-body"], markdownCss["markdown-body"])}>
          {renderContent(body)}
        </div>
      </Modal>
    </>
  );
};
