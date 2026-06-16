import React, { useState, useMemo } from "react";
import classNames from "classnames";
import { Modal } from "../../../components/modal";
import { parsePlanContent, PlanActions } from "../../../components/plan";
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

// ─── PlanToolCard ──────────────────────────────────────────────────────────────
// tool-render 层使用：只读，无操作按钮，流式/完成两态

export const PlanToolCard = ({
  path,
  content,
  pending = false,
  verb = "方案制定",
  renderContent,
}: {
  path: string;
  content?: string;
  pending?: boolean;
  verb?: string;
  renderContent?: (body: string) => React.ReactNode;
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const { title, body } = useMemo(() => parsePlanContent(content ?? ""), [content]);
  const displayTitle = title ?? path;

  const modalTitle = (
    <>
      <span className={css["plan-card-modal-title-text"]}>{verb}</span>
      <span className={css["plan-card-modal-path"]} title={path}>{displayTitle}</span>
    </>
  );

  return (
    <>
      <div className={css["plan-card"]}>
        <div className={css["plan-card-header"]}>
          <div className={css["plan-card-title"]}>
            <span className={css["plan-card-title-text"]}>{verb}</span>
            <span className={css["plan-card-path"]} title={path}>{displayTitle}</span>
          </div>
          {!pending && content && (
            <div
              className={css["plan-card-icon-button"]}
              onClick={() => setModalOpen(true)}
              title="查看完整方案"
            >
              <ExpandIcon />
            </div>
          )}
        </div>
        {content && (
          <div className={css["plan-card-body"]}>
            {renderContent ? renderContent(body) : <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>{body}</pre>}
          </div>
        )}
      </div>

      {!pending && content && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={modalTitle}
          width={720}
        >
          <div className={classNames(css["plan-card-modal-body"], markdownCss["markdown-body"])}>
            {renderContent ? renderContent(body) : <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>{body}</pre>}
          </div>
        </Modal>
      )}
    </>
  );
};

// ─── PlanFileCard ──────────────────────────────────────────────────────────────
// 完整版，带执行/废弃按钮，供 MessageBubble 层（RelatedPlanBanner）使用

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
// RelatedPlanBanner 样式：横向单行 banner，标题+状态+右侧操作按钮，点击展开弹窗
// 执行/废弃后不消失，只更新状态 badge

export const PlanFileCardWithContent = ({
  path,
  content,
  onExecute,
  canExecute,
  onAbandon,
  renderContent,
}: {
  path: string;
  content: string;
  onExecute?: () => void;
  canExecute: boolean;
  onAbandon?: () => void;
  renderContent: (body: string) => React.ReactNode;
}) => {
  const { title, desc, body } = useMemo(() => parsePlanContent(content), [content]);
  const [modalOpen, setModalOpen] = useState(false);
  const hasActions = Boolean(onExecute || onAbandon);

  const displayTitle = title ?? path;

  const modalTitle = (
    <>
      <span className={css["plan-card-modal-title-text"]}>方案</span>
      <span className={css["plan-card-modal-path"]} title={path}>{displayTitle}</span>
    </>
  );

  const modalFooter = hasActions ? (
    <PlanActions
      canExecute={canExecute}
      onAbandon={onAbandon ? () => {
        setModalOpen(false);
        onAbandon();
      } : undefined}
      onExecute={onExecute ? () => {
        setModalOpen(false);
        onExecute();
      } : undefined}
      abandonLabel="废弃此方案"
      executeLabel="执行此方案"
      classes={{
        root: css["plan-card-footer-inner"],
        abandon: css["plan-card-abandon-button"],
        execute: css["plan-card-execute-button"],
        executeDisabled: css["plan-card-execute-button-disabled"],
      }}
    />
  ) : undefined;

  return (
    <>
      {/* RelatedPlanBanner：两行卡片 */}
      <div className={css["plan-banner"]}>
        {/* 第一行：方案标题 + 打开预览 */}
        <div className={css["plan-banner-row1"]}>
          <div className={css["plan-banner-left"]}>
            <span className={css["plan-banner-label"]}>方案：</span>
            <span className={css["plan-banner-title"]} title={displayTitle}>{displayTitle}</span>
          </div>
          <div
            className={css["plan-banner-open-btn"]}
            onClick={() => setModalOpen(true)}
            title="打开预览"
          >
            打开预览
          </div>
        </div>
        {/* 第二行：desc + 废弃/执行（执行/废弃后只展示 desc） */}
        <div className={css["plan-banner-row2"]}>
          <span className={css["plan-banner-desc"]} title={desc ?? ""}>{desc ?? ""}</span>
          {hasActions && (
            <PlanActions
              canExecute={canExecute}
              onExecute={onExecute}
              onAbandon={onAbandon}
              classes={{
                root: css["plan-banner-actions"],
                abandon: css["plan-card-abandon-button"],
                execute: css["plan-card-execute-button"],
                executeDisabled: css["plan-card-execute-button-disabled"],
              }}
            />
          )}
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
