import React, { useState } from "react";
import { Success, Eye, Pencil, FileWrite, Delete } from "../../../components/icons";
import { TextShimmer } from "../../../components/text-shimmer";
import { ElapsedTime } from "../../../components/elapsed-time";
import { registerToolRenderer } from "./index";
import type { ToolCallRecord } from "../../../../../../agent/src";
import { READ_TOOL_NAME, WRITE_TOOL_NAME, MULTI_WRITE_TOOL_NAME, EDIT_TOOL_NAME, MULTI_EDIT_TOOL_NAME, DELETE_TOOL_NAME } from "../../../../../../agent/src";
import { CHECK_STATUS_TOOL_NAME } from "../../../../sandbox/tools/check-status";

/** UI 层用，在 ToolCallRecord 基础上扩展 pending 状态 */
export type ToolRecord = Omit<ToolCallRecord, "status"> & { status: "pending" | "success" | "error" };
import css from "./render.less";

// ─── 状态图标 ─────────────────────────────────────────────────────────────────

const StatusIcon = ({ tool, icon }: { tool: ToolRecord; icon?: React.ReactElement }) => {
  if (tool.status === "pending") {
    return <span className={css["tool-icon-pending"]}>○</span>;
  }
  return (
    <span className={css["tool-icon"]}>
      {icon ?? <Success />}
    </span>
  );
};

// ─── Duration（工具执行耗时）──────────────────────────────────────────────────

const Duration = ({ tool }: { tool: ToolRecord }) => {
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

const Label = ({ tool, text }: { tool: ToolRecord; text: string }) =>
  tool.status === "pending"
    ? <TextShimmer className={css["tool-label"]}>{text}</TextShimmer>
    : <span className={css["tool-label"]}>{text}</span>;

// ─── 基础渲染（未注册专属渲染时的默认样式）────────────────────────────────────

export const DefaultToolRenderer = ({ tool }: { tool: ToolRecord }) => (
  <div className={css["tool-card"]}>
    <StatusIcon tool={tool} />
    <Label tool={tool} text={tool.name} />
    <Duration tool={tool} />
  </div>
);

// ─── 简单行级 diff ────────────────────────────────────────────────────────────

interface DiffLine {
  type: "add" | "del" | "ctx";
  text: string;
}

/**
 * 极简 LCS diff：对 oldLines / newLines 做逐行对比，
 * 输出带 +/- 标记的行数组（上下文 ±3 行）。
 */
function computeDiff(oldStr: string, newStr: string): DiffLine[] {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");

  // LCS 矩阵
  const m = oldLines.length, n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = oldLines[i] === newLines[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  // 回溯生成 diff
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

  // 过滤：只保留变更行周围 ±3 行上下文
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

class DiffErrorBoundary extends React.Component<
  { onError: () => void; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

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

const DiffView = ({ oldStr, newStr, onError, bodyClass }: { oldStr: string; newStr: string; onError: () => void; bodyClass?: string }) => (
  <DiffErrorBoundary onError={onError}>
    <DiffLines oldStr={oldStr} newStr={newStr} bodyClass={bodyClass} />
  </DiffErrorBoundary>
);

// ─── 代码展示卡片（成功/错误时展开展示代码内容）─────────────────────────────

interface CodeCardProps {
  tool: ToolRecord;
  icon: React.ReactElement;
  title: string;
  content: string;
  /** 当 content 是"删除片段"时为 true，用于展示不同样式 */
  isDelete?: boolean;
  lineMeta?: string | null;
  /** edit_file diff 模式 */
  diffMode?: { oldStr: string; newStr: string };
}

const PendingCodeCard = ({ tool, icon, title }: { tool: ToolRecord; icon: React.ReactElement; title: string }) => (
  <div className={css["code-card"]}>
    <div className={css["code-card-header"]} style={{ cursor: "default" }}>
      <span className={css["code-card-icon"]}>
        <StatusIcon tool={tool} icon={icon} />
      </span>
      <TextShimmer className={css["code-card-filename"]}>{title}</TextShimmer>
      <Duration tool={tool} />
    </div>
  </div>
);

/** pending 时展示流式内容的代码卡片（默认展开，内容实时刷新） */
const StreamingCodeCard = ({ tool, icon, title, content }: { tool: ToolRecord; icon: React.ReactElement; title: string; content: string }) => {
  const lang = detectLang(tool.args?.path ?? "");
  return (
    <div className={css["code-card"]}>
      <div className={css["code-card-header"]} style={{ cursor: "default" }}>
        <span className={css["code-card-icon"]}>
          <StatusIcon tool={tool} icon={icon} />
        </span>
        <TextShimmer className={css["code-card-filename"]}>{title}</TextShimmer>
        <Duration tool={tool} />
      </div>
      <pre className={css["code-card-body"]}>
        <code className={`language-${lang}`}>{content}</code>
      </pre>
    </div>
  );
};

const CodeCard = ({ tool, icon, title, content, isDelete, lineMeta, diffMode }: CodeCardProps) => {
  const [collapsed, setCollapsed] = useState(false);
  // diff 渲染失败时强制折叠且禁止展开
  const [diffBroken, setDiffBroken] = useState(false);
  const lang = detectLang(tool.args?.path ?? "");
  const lineCount = content ? content.split("\n").length : 0;

  // error 状态：强制折叠且禁止展开
  const isError = tool.status === "error";
  const isCollapsed = collapsed || diffBroken || isError;
  const canToggle = !diffBroken && !isError;

  return (
    <div className={`${css["code-card"]}${isError ? ` ${css["code-card-error"]}` : ""}`}>
      <div
        className={css["code-card-header"]}
        onClick={() => canToggle && setCollapsed((c) => !c)}
        style={canToggle ? undefined : { cursor: "default" }}
      >
        <span className={css["code-card-icon"]}>
          {icon}
        </span>
        <span className={css["code-card-filename"]}>{title}</span>
        {lineMeta && <span className={css["code-card-lines"]}>{lineMeta}</span>}
        {!lineMeta && lineCount > 0 && !isError && (
          <span className={css["code-card-lines"]}>{lineCount} 行</span>
        )}
        <Duration tool={tool} />
        {canToggle && (
          <span className={css["code-card-toggle"]}>{isCollapsed ? "▶" : "▼"}</span>
        )}
      </div>
      {!isCollapsed && (
        diffMode ? (
          <DiffView
            oldStr={diffMode.oldStr}
            newStr={diffMode.newStr}
            onError={() => setDiffBroken(true)}
          />
        ) : content ? (
          <pre className={`${css["code-card-body"]}${isDelete ? ` ${css["code-card-body-delete"]}` : ""}`}>
            <code className={`language-${lang}`}>{content}</code>
          </pre>
        ) : null
      )}
    </div>
  );
};

// ─── read_file 渲染 ───────────────────────────────────────────────────────────

const ReadFileRenderer = ({ tool }: { tool: ToolRecord }) => {
  const path: string = tool.args?.path ?? "";
  const name = path ? basename(path) : "";
  const baseTitle = name ? `查看文件 ${name}` : (path || "查看文件");
  const title = errorSuffix(baseTitle, tool.status);

  // pending 状态
  if (tool.status === "pending") {
    return <PendingCodeCard tool={tool} icon={<Eye />} title={`${title}...`} />;
  }

  // 成功/错误：展示代码卡片
  const content: string = tool.result?.content ?? "";
  let lineMeta: string | null = null;
  if (tool.status === "success" && tool.result) {
    if (content) {
      const start = tool.result.startLine ?? 1;
      const end = tool.result.endLine ?? tool.result.totalLines ?? content.split("\n").length;
      lineMeta = `L${start} - L${end}`;
    } else if (Array.isArray(tool.result.files)) {
      lineMeta = `${tool.result.files.length} 个文件`;
    }
  }

  if (!content) {
    return (
      <div className={css["tool-card"]}>
        <StatusIcon tool={tool} icon={<Eye />} />
        <span className={css["tool-label"]}>{title}</span>
        {lineMeta && <span className={css["tool-meta"]}>{lineMeta}</span>}
        <Duration tool={tool} />
      </div>
    );
  }

  return (
    <CodeCard
      tool={tool}
      icon={<Eye />}
      title={title}
      content={content}
      lineMeta={lineMeta}
    />
  );
};

// ─── write_file 渲染 ──────────────────────────────────────────────────────────

const WriteFileRenderer = ({ tool }: { tool: ToolRecord }) => {
  const path: string = tool.args?.path ?? "";
  const name = path ? basename(path) : "";
  const baseTitle = name ? `写文件 ${name}` : (path || "写文件");
  const title = errorSuffix(baseTitle, tool.status);

  const content: string = tool.args?.content ?? "";

  // pending 时：有内容就展示流式预览，否则展示 shimmer
  if (tool.status === "pending") {
    if (content) {
      return <StreamingCodeCard tool={tool} icon={<FileWrite />} title={`${title}...`} content={content} />;
    }
    return <PendingCodeCard tool={tool} icon={<FileWrite />} title={`${title}...`} />;
  }

  return (
    <CodeCard
      tool={tool}
      icon={<FileWrite />}
      title={title}
      content={content}
    />
  );
};

// ─── 批量操作组件（BatchGroup）────────────────────────────────────────────────

interface BatchItemProps {
  tool: ToolRecord;
  /** 文件路径（用于语言检测） */
  path: string;
  /** 文件名（display） */
  name: string;
  /** 流式/完成内容（可能未闭合） */
  content?: string;
  /** diff 模式（edit 完成后） */
  diffMode?: { oldStr: string; newStr: string };
  /** 是否删除片段 */
  isDelete?: boolean;
  /** 是否是流式 pending 中 */
  streaming?: boolean;
}

const BatchItem = ({ tool, path, name, content, diffMode, isDelete, streaming }: BatchItemProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [diffBroken, setDiffBroken] = useState(false);
  const lang = detectLang(path);
  const lineCount = content ? content.split("\n").length : 0;
  const isError = tool.status === "error";

  const hasBody = !!(diffMode || content);
  const isCollapsed = streaming ? false : (collapsed || diffBroken);
  const canToggle = hasBody && !streaming && !diffBroken;

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
          {streaming
            ? <span style={{ opacity: 0.4, fontSize: 10 }}>○</span>
            : <Success />}
        </span>
        {streaming
          ? <TextShimmer className={css["batch-item-filename"]}>{name + "..."}</TextShimmer>
          : <span className={css["batch-item-filename"]}>{name}{isError ? "（失败）" : ""}</span>}
        {!streaming && lineCount > 0 && (
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
          <pre className={`${css["code-card-body"]} ${css["batch-item-body"]}${isDelete ? ` ${css["batch-item-body-delete"]}` : ""}`}>
            <code className={`language-${lang}`}>{content}</code>
          </pre>
        ) : null
      )}
    </div>
  );
};

interface BatchGroupProps {
  tool: ToolRecord;
  icon: React.ReactElement;
  /** 标题（如"写文件"、"修改文件"） */
  verb: string;
  items: React.ReactNode;
  count: number;
}

const BatchGroup = ({ tool, icon, verb, items, count }: BatchGroupProps) => {
  const isError = tool.status === "error";
  const isPending = tool.status === "pending";

  const headerTitle = isPending
    ? `${verb}...`
    : isError
      ? `${verb}（失败）`
      : verb;

  const metaLabel = count > 0 ? `${count} 个文件` : undefined;

  return (
    <div className={css["batch-group"]}>
      <div className={css["batch-group-header"]}>
        <span className={css["batch-group-header-icon"]}>
          {isPending
            ? <span style={{ opacity: 0.4, fontSize: 12 }}>○</span>
            : icon}
        </span>
        {isPending
          ? <TextShimmer className={css["batch-group-header-title"]}>{headerTitle}</TextShimmer>
          : <span className={css["batch-group-header-title"]}>{headerTitle}</span>}
        {metaLabel && <span className={css["batch-group-header-meta"]}>{metaLabel}</span>}
        <Duration tool={tool} />
      </div>
      <div className={css["batch-group-body"]}>
        {items}
      </div>
    </div>
  );
};

// ─── multi_write 渲染 ───────────────────────────────────────────────────────

const MultiWriteRenderer = ({ tool }: { tool: ToolRecord }) => {
  const files: Array<{ path: string; content?: string }> = Array.isArray(tool.args?.files) ? tool.args.files : [];
  const isPending = tool.status === "pending";

  if (files.length === 0) {
    return (
      <div className={css["tool-card"]}>
        <StatusIcon tool={tool} icon={<FileWrite />} />
        <Label tool={tool} text="批量写文件" />
        <Duration tool={tool} />
      </div>
    );
  }

  const paths = files.map((f) => f.path);
  const items = files.map((file, idx) => {
    const name = shortPath(file.path, paths);
    const content = file.content ?? "";
    const isLastAndPending = isPending && idx === files.length - 1;
    return (
      <BatchItem
        key={file.path || idx}
        tool={tool}
        path={file.path}
        name={name}
        content={content}
        streaming={isLastAndPending && !content ? false : isLastAndPending}
      />
    );
  });

  return (
    <BatchGroup
      tool={tool}
      icon={<FileWrite />}
      verb="批量写文件"
      count={files.length}
      items={items}
    />
  );
};

// ─── multi_edit 渲染 ───────────────────────────────────────────────────────

type EditItem = { path: string; old_str?: string; new_str?: string; replace_all?: boolean };

const MultiEditRenderer = ({ tool }: { tool: ToolRecord }) => {
  const edits: EditItem[] = Array.isArray(tool.args?.edits) ? tool.args.edits : [];
  const isPending = tool.status === "pending";

  if (edits.length === 0) {
    return (
      <div className={css["tool-card"]}>
        <StatusIcon tool={tool} icon={<Pencil />} />
        <Label tool={tool} text="批量修改" />
        <Duration tool={tool} />
      </div>
    );
  }

  const paths = edits.map((e) => e.path);
  const items = edits.map((edit, idx) => {
    const name = shortPath(edit.path, paths);
    const oldStr = edit.old_str ?? "";
    const newStr = edit.new_str ?? "";
    const isDelete = !isPending && newStr === "" && oldStr !== "";
    const streamContent = newStr || oldStr;
    const isLastAndPending = isPending && idx === edits.length - 1;
    return (
      <BatchItem
        key={(edit.path || idx) + "-" + idx}
        tool={tool}
        path={edit.path}
        name={name}
        content={isDelete ? oldStr : (isPending ? streamContent : newStr)}
        diffMode={!isPending && !isDelete && oldStr ? { oldStr, newStr } : undefined}
        isDelete={isDelete}
        streaming={isLastAndPending}
      />
    );
  });

  return (
    <BatchGroup
      tool={tool}
      icon={<Pencil />}
      verb="批量修改"
      count={edits.length}
      items={items}
    />
  );
};

// ─── edit_file 渲染 ───────────────────────────────────────────────────────────

const EditFileRenderer = ({ tool }: { tool: ToolRecord }) => {
  const path: string = tool.args?.path ?? "";
  const name = path ? basename(path) : "";
  const baseTitle = name ? `修改文件 ${name}` : (path || "修改文件");
  const title = errorSuffix(baseTitle, tool.status);

  // pending 状态：流式时 new_str 可能还在生成，有内容就展示流式预览
  if (tool.status === "pending") {
    const streamContent: string = tool.args?.new_str ?? tool.args?.old_str ?? "";
    if (streamContent) {
      return <StreamingCodeCard tool={tool} icon={<Pencil />} title={`${title}...`} content={streamContent} />;
    }
    return <PendingCodeCard tool={tool} icon={<Pencil />} title={`${title}...`} />;
  }

  const newStr: string = tool.args?.new_str ?? "";
  const oldStr: string = tool.args?.old_str ?? "";
  const isDelete = newStr === "" && oldStr !== "";
  if (isDelete) {
    return (
      <CodeCard
        tool={tool}
        icon={<Pencil />}
        title={title}
        content={oldStr}
        isDelete
      />
    );
  }

  return (
    <CodeCard
      tool={tool}
      icon={<Pencil />}
      title={title}
      content={newStr}
      diffMode={{ oldStr, newStr }}
    />
  );
};

// ─── delete_file 渲染 ─────────────────────────────────────────────────────────

const DeleteFileRenderer = ({ tool }: { tool: ToolRecord }) => {
  const paths: string[] = Array.isArray(tool.args?.paths) ? tool.args.paths : [];
  const deletedPaths: string[] = Array.isArray(tool.result?.deletedPaths) ? tool.result.deletedPaths : paths;
  const baseTitle = deletedPaths.length === 1 ? `删除文件 ${basename(deletedPaths[0])}` : `删除文件 ${deletedPaths.length} 项`;
  const title = errorSuffix(baseTitle, tool.status);
  const content = deletedPaths.join("\n");

  if (tool.status === "pending") {
    return <PendingCodeCard tool={tool} icon={<Delete />} title={`${title}...`} />;
  }

  if (!content) {
    return (
      <div className={css["tool-card"]}>
        <StatusIcon tool={tool} icon={<Delete />} />
        <span className={css["tool-label"]}>{title}</span>
        <Duration tool={tool} />
      </div>
    );
  }

  return (
    <CodeCard
      tool={tool}
      icon={<Delete />}
      title={title}
      content={content}
      isDelete
    />
  );
};

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

function basename(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() ?? path;
}

/**
 * 从一组路径中计算每条路径的"有意义短路径"：
 * 去除所有路径共同的前缀目录后剩余的部分。
 * 例如 ["src/a/foo.ts", "src/b/bar.ts"] → ["a/foo.ts", "b/bar.ts"]
 * 单个路径时直接返回原路径（或文件名若路径较短）。
 */
function shortPath(path: string, allPaths: string[]): string {
  const norm = path.replace(/\\/g, "/");
  if (allPaths.length <= 1) return norm;

  const parts = allPaths.map((p) => p.replace(/\\/g, "/").split("/"));
  const normParts = norm.split("/");

  // 找公共前缀深度（不含文件名那一层）
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

  // 去掉公共前缀后，至少保留"父目录/文件名"（最后两段），
  // 避免所有文件同目录时退化为纯文件名
  const minKeep = Math.min(2, normParts.length);
  const keepFrom = Math.min(commonDepth, normParts.length - minKeep);
  const short = normParts.slice(keepFrom).join("/");
  return short || norm;
}

function detectLang(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    css: "css", less: "css", scss: "css",
    json: "json", md: "markdown", html: "html", xml: "xml",
    py: "python", go: "go", rs: "rust", java: "java",
  };
  return map[ext] ?? "plaintext";
}

/** 在 error 状态时添加"失败"后缀 */
const errorSuffix = (title: string, status: string) =>
  status === "error" ? `${title}失败` : title;

// ─── check-status 渲染 ───────────────────────────────────────────────────────

const CheckStatusRenderer = ({ tool }: { tool: ToolRecord }) => {
  const label = errorSuffix("查看当前状态", tool.status);
  if (tool.status === "pending") {
    return (
      <div className={css["tool-card"]}>
        <StatusIcon tool={tool} icon={<Eye />} />
        <TextShimmer className={css["tool-label"]}>{label}...</TextShimmer>
        <Duration tool={tool} />
      </div>
    );
  }

  // 成功/错误：展示 tool-card（内容通常很长，不展开代码块）
  return (
    <div className={css["tool-card"]}>
      <StatusIcon tool={tool} icon={<Eye />} />
      <span className={css["tool-label"]}>{label}</span>
      <Duration tool={tool} />
    </div>
  );
};

// ─── 注册 ─────────────────────────────────────────────────────────────────────

registerToolRenderer(READ_TOOL_NAME, (tool) => <ReadFileRenderer tool={tool} />);
registerToolRenderer(WRITE_TOOL_NAME, (tool) => <WriteFileRenderer tool={tool} />);
registerToolRenderer(MULTI_WRITE_TOOL_NAME, (tool) => <MultiWriteRenderer tool={tool} />);
registerToolRenderer(EDIT_TOOL_NAME, (tool) => <EditFileRenderer tool={tool} />);
registerToolRenderer(MULTI_EDIT_TOOL_NAME, (tool) => <MultiEditRenderer tool={tool} />);
registerToolRenderer(DELETE_TOOL_NAME, (tool) => <DeleteFileRenderer tool={tool} />);
registerToolRenderer(CHECK_STATUS_TOOL_NAME, (tool) => <CheckStatusRenderer tool={tool} />);
