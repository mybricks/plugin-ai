/**
 * 内置工具渲染器共享组件和工具函数。
 * 供 built-ins/ 下各渲染文件引用。
 */
import React, { useState } from "react";
import { Success, Loading, ErrorIcon } from "../../../components/icons";
import { TextShimmer } from "../../../components/text-shimmer";
import { ElapsedTime } from "../../../components/elapsed-time";
import type { ToolRecord } from "./index";
import css from "./render.less";

// ─── 状态图标 ─────────────────────────────────────────────────────────────────

export const StatusIcon = ({ tool, icon }: { tool: ToolRecord; icon?: React.ReactElement }) => {
  if (tool.status === "pending") {
    return <span className={css["tool-icon-pending"]}><Loading /></span>;
  }
  if (tool.status === "error") {
    return <span className={css["tool-icon"]}><ErrorIcon /></span>;
  }
  return (
    <span className={css["tool-icon"]}>
      {icon ?? <Success />}
    </span>
  );
};

// ─── Duration（工具执行耗时）──────────────────────────────────────────────────

export const Duration = ({ tool }: { tool: ToolRecord }) => {
  if (!tool.execStartTime) return null;
  return (
    <ElapsedTime
      startTime={tool.execStartTime}
      endTime={tool.status !== "pending" && tool.execEndTime ? tool.execEndTime : undefined}
      className={css["tool-duration"]}
    />
  );
};

// ─── 标签文字：pending 时走 shimmer，否则普通文字 ─────────────────────────────

export const Label = ({ tool, text }: { tool: ToolRecord; text: string }) =>
  tool.status === "pending"
    ? <span className={css["tool-label"]}><TextShimmer>{text}</TextShimmer></span>
    : <span className={css["tool-label"]}>{text}</span>;

// ─── 基础渲染（未注册专属渲染时的默认样式）────────────────────────────────────

export const DefaultToolRenderer = ({ tool }: { tool: ToolRecord }) => {
  return (
    <div className={css["tool-card"]}>
      <StatusIcon tool={tool} />
      <Label tool={tool} text={tool.title ?? tool.name} />
      <Duration tool={tool} />
    </div>
  )
};

// ─── 简单行级 diff ────────────────────────────────────────────────────────────

interface DiffLine {
  type: "add" | "del" | "ctx";
  text: string;
}

/**
 * 极简 LCS diff：对 oldLines / newLines 做逐行对比，
 * 输出带 +/- 标记的行数组（上下文 ±3 行）。
 */
export function computeDiff(oldStr: string, newStr: string): DiffLine[] {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");

  const m = oldLines.length, n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = oldLines[i] === newLines[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const raw: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && oldLines[i] === newLines[j]) {
      raw.push({ type: "ctx", text: oldLines[i] });
      i++; j++;
    } else if (j < n && (i >= m || dp[i][j + 1] >= dp[i + 1][j])) {
      raw.push({ type: "add", text: newLines[j] });
      j++;
    } else {
      raw.push({ type: "del", text: oldLines[i] });
      i++;
    }
  }

  const CTX = 3;
  const changed = new Set<number>();
  raw.forEach((l, idx) => { if (l.type !== "ctx") changed.add(idx); });
  const keep = new Set<number>();
  changed.forEach((idx) => {
    for (let d = -CTX; d <= CTX; d++) {
      const k = idx + d;
      if (k >= 0 && k < raw.length) keep.add(k);
    }
  });

  return raw.filter((_, idx) => keep.has(idx));
}

// ─── DiffView ────────────────────────────────────────────────────────────────

const DiffErrorBoundary: React.FC<{ onError: () => void; children: React.ReactNode }> = ({ onError, children }: { onError: () => void; children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  
  React.useEffect(() => {
    if (hasError) {
      onError();
    }
  }, [hasError, onError]);
  
  if (hasError) {
    return null;
  }
  
  return (
    <React.Fragment>
      {children}
    </React.Fragment>
  );
};

const DiffLines = ({ oldStr, newStr, bodyClass }: { oldStr: string; newStr: string; bodyClass?: string }) => {
  const lines = computeDiff(oldStr, newStr);
  return (
    <pre className={bodyClass ?? css["code-card-body"]}>
      <code>
        {lines.map((l, i) => (
          <span
            key={i}
            className={
              l.type === "add" ? css["diff-add"] :
              l.type === "del" ? css["diff-del"] : css["diff-ctx"]
            }
          >
            <span className={css["diff-sign"]} aria-hidden>
              {l.type === "add" ? "+" : l.type === "del" ? "-" : ""}
            </span>
            {l.text}
            {"\n"}
          </span>
        ))}
      </code>
    </pre>
  );
};

export const DiffView = ({ oldStr, newStr, onError, bodyClass }: { oldStr: string; newStr: string; onError: () => void; bodyClass?: string }) => (
  <DiffErrorBoundary onError={onError}>
    <DiffLines oldStr={oldStr} newStr={newStr} bodyClass={bodyClass} />
  </DiffErrorBoundary>
);

// ─── 代码展示卡片 ─────────────────────────────────────────────────────────────

export interface CodeCardProps {
  tool: ToolRecord;
  icon: React.ReactElement;
  title: string;
  content: string;
  lineMeta?: string | null;
  diffMode?: { oldStr: string; newStr: string };
  /** 是否展示代码内容区域，默认 true */
  showCode?: boolean;
}

export const PendingCodeCard = ({ tool, icon, title }: { tool: ToolRecord; icon: React.ReactElement; title: string }) => (
  <div className={css["code-card"]}>
    <div className={css["code-card-header"]} style={{ cursor: "default" }}>
      <span className={css["code-card-icon"]}>
        <StatusIcon tool={tool} icon={icon} />
      </span>
      <span className={css["code-card-filename"]}><TextShimmer>{title}</TextShimmer></span>
      <Duration tool={tool} />
    </div>
  </div>
);

export const StreamingCodeCard = ({ tool, icon, title, content, lang: langOverride }: { tool: ToolRecord; icon: React.ReactElement; title: string; content: string; lang?: string }) => {
  const lang = langOverride ?? detectLang(tool.args?.path ?? "");
  const lineCount = content ? content.split("\n").length : 0;
  return (
    <div className={css["code-card"]}>
      <div className={`${css["code-card-header"]} ${css["code-card-header-with-body"]}`} style={{ cursor: "default" }}>
        <span className={css["code-card-icon"]}>
          <StatusIcon tool={tool} icon={icon} />
        </span>
        <span className={css["code-card-filename"]}><TextShimmer>{title}</TextShimmer></span>
        {lineCount > 0 && (
          <span className={css["code-card-lines"]}>{lineCount} 行</span>
        )}
        <Duration tool={tool} />
      </div>
      <pre className={css["code-card-body"]}>
        <code className={`language-${lang}`}>{content}</code>
      </pre>
    </div>
  );
};

export const CodeCard = ({ tool, icon, title, content, lineMeta, diffMode, showCode = true }: CodeCardProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [diffBroken, setDiffBroken] = useState(false);
  const lang = detectLang(tool.args?.path ?? "");
  const lineCount = content ? content.split("\n").length : 0;

  const isError = tool.status === "error";
  const hasBody = showCode && (diffMode || content);
  const isCollapsed = !showCode || collapsed || diffBroken || isError;
  const canToggle = showCode && !diffBroken && !isError && hasBody;

  return (
    <div className={css["code-card"]}>
      <div
        className={`${css["code-card-header"]}${hasBody ? ` ${css["code-card-header-with-body"]}` : ""}`}
        onClick={() => canToggle && setCollapsed((c: boolean) => !c)}
        style={canToggle ? undefined : { cursor: "default" }}
      >
        <span className={css["code-card-icon"]}>
          {isError ? <ErrorIcon /> : icon}
        </span>
        <span className={css["code-card-filename"]}>{title}</span>
        {lineMeta && <span className={css["code-card-lines"]}>{lineMeta}</span>}
        {!lineMeta && lineCount > 0 && !isError && showCode && (
          <span className={css["code-card-lines"]}>{lineCount} 行</span>
        )}
        <Duration tool={tool} />
        {canToggle && (
          <span className={css["code-card-toggle"]}>{isCollapsed ? "▶" : "▼"}</span>
        )}
      </div>
      {hasBody && !isCollapsed && (
        diffMode ? (
          <DiffView
            oldStr={diffMode.oldStr}
            newStr={diffMode.newStr}
            onError={() => setDiffBroken(true)}
          />
        ) : content ? (
          <pre className={css["code-card-body"]}>
            <code className={`language-${lang}`}>{content}</code>
          </pre>
        ) : null
      )}
    </div>
  );
};

// ─── 批量操作组件（BatchGroup）────────────────────────────────────────────────

export interface BatchItemProps {
  tool: ToolRecord;
  path: string;
  name: string;
  content?: string;
  diffMode?: { oldStr: string; newStr: string };
  streaming?: boolean;
  error?: string;
}

export const BatchItem = ({ tool, path, name, content, diffMode, streaming, error }: BatchItemProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [diffBroken, setDiffBroken] = useState(false);
  const lang = detectLang(path);
  const lineCount = content ? content.split("\n").length : 0;
  const isError = tool.status === "error";

  const hasBody = !!(diffMode || content) && !error;
  const isCollapsed = streaming ? false : (collapsed || diffBroken || !!error);
  const canToggle = hasBody && !streaming && !diffBroken && !error;

  const headerCls = [
    css["batch-item-header"],
    !canToggle ? css["batch-item-header-no-toggle"] : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={css["batch-item"]}>
      <div
        className={headerCls}
        onClick={() => canToggle && setCollapsed((prev: boolean) => !prev)}
      >
        <span className={css["batch-item-icon"]}>
          {streaming ? <Loading /> : error ? <ErrorIcon /> : <Success />}
        </span>
        {streaming
          ? <span className={css["batch-item-filename"]}><TextShimmer>{name + "..."}</TextShimmer></span>
          : <span className={css["batch-item-filename"]} style={error ? { color: "#c0392b" } : undefined}>{name}</span>}
        {lineCount > 0 && (
          <span className={css["batch-item-lines"]}>{lineCount} 行</span>
        )}
        {canToggle && (
          <span className={css["batch-item-toggle"]}>{isCollapsed ? "▶" : "▼"}</span>
        )}
      </div>
      {!isCollapsed && hasBody && (
        diffMode && !diffBroken ? (
          <DiffView
            oldStr={diffMode.oldStr}
            newStr={diffMode.newStr}
            onError={() => setDiffBroken(true)}
            bodyClass={`${css["code-card-body"]} ${css["batch-item-body"]}`}
          />
        ) : content ? (
          <pre className={`${css["code-card-body"]} ${css["batch-item-body"]}`}>
            <code className={`language-${lang}`}>{content}</code>
          </pre>
        ) : null
      )}
    </div>
  );
};

export interface BatchGroupProps {
  tool: ToolRecord;
  icon: React.ReactElement;
  verb: string;
  items: React.ReactNode;
  count: number;
  hasPartialError?: boolean;
}

export const BatchGroup = ({ tool, icon, verb, items, count, hasPartialError }: BatchGroupProps) => {
  const isError = tool.status === "error";
  const isPending = tool.status === "pending";

  const headerTitle = isPending
    ? `${verb}...`
    : verb;

  const metaLabel = count > 0 ? `${count} 个文件` : undefined;

  return (
    <div className={css["batch-group"]}>
      <div className={css["batch-group-header"]}>
        <span className={css["batch-group-header-icon"]}>
          {isPending ? <Loading /> : isError ? <ErrorIcon /> : hasPartialError ? <ErrorIcon /> : icon}
        </span>
        {isPending
          ? <span className={css["batch-group-header-title"]}><TextShimmer>{headerTitle}</TextShimmer></span>
          : <span className={css["batch-group-header-title"]}>{headerTitle}</span>}
        {metaLabel && <span className={css["batch-group-header-meta"]}>{metaLabel}</span>}
        <Duration tool={tool} />
      </div>
      {(hasPartialError || !isError) && (
        <div className={css["batch-group-body"]}>
          {items}
        </div>
      )}
    </div>
  );
};

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

export function basename(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() ?? path;
}

/**
 * 从一组路径中计算每条路径的"有意义短路径"：
 * 去除所有路径共同的前缀目录后剩余的部分。
 */
export function shortPath(path: string, allPaths: string[]): string {
  const norm = path.replace(/\\/g, "/");
  if (allPaths.length <= 1) return norm;

  const parts = allPaths.map((p) => p.replace(/\\/g, "/").split("/"));
  const normParts = norm.split("/");

  const minLen = Math.min(...parts.map((p) => p.length - 1));
  let commonDepth = 0;
  for (let i = 0; i < minLen; i++) {
    const seg = parts[0][i];
    if (parts.every((p) => p[i] === seg)) {
      commonDepth = i + 1;
    } else {
      break;
    }
  }

  const minKeep = Math.min(2, normParts.length);
  const keepFrom = Math.min(commonDepth, normParts.length - minKeep);
  const short = normParts.slice(keepFrom).join("/");
  return short || norm;
}

export function detectLang(path: string | undefined | null): string {
  if (!path) return "plaintext";
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    css: "css", less: "css", scss: "css",
    json: "json", md: "markdown", html: "html", xml: "xml",
    py: "python", go: "go", rs: "rust", java: "java",
  };
  return map[ext] ?? "plaintext";
}

