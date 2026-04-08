import React from "react";
import { Success, Eye, Pencil, FileWrite, ErrorIcon } from "../../../components/icons";
import { TextShimmer } from "../../../components/text-shimmer";
import { ElapsedTime } from "../../../components/elapsed-time";
import { registerToolRenderer } from "./index";
import type { ToolCallRecord } from "@plugin-ai/agent";

/** UI 层用，在 ToolCallRecord 基础上扩展 pending 状态 */
export type ToolRecord = Omit<ToolCallRecord, "status"> & { status: "pending" | "success" | "error" };
import css from "./render.less";

// ─── 状态图标 ─────────────────────────────────────────────────────────────────

const StatusIcon = ({ tool, icon }: { tool: ToolRecord; icon?: React.ReactElement }) => {
  if (tool.status === "pending") {
    return <span className={css["tool-icon-pending"]}>○</span>;
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
// pending: 从 execStartTime 起实时计时；完成后展示静态耗时

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

// ─── read_file 渲染 ───────────────────────────────────────────────────────────

const ReadFileRenderer = ({ tool }: { tool: ToolRecord }) => {
  const path: string = tool.args?.path ?? "";
  const label = path
    ? (tool.status === "pending" ? `${basename(path)} 读取中...` : `查看文件 ${basename(path)}`)
    : "读取中...";

  let lineMeta: string | null = null;
  if (tool.status === "success" && tool.result) {
    const content: string = tool.result.content ?? "";
    if (content) {
      const start = tool.result.startLine ?? 1;
      const end = tool.result.endLine ?? tool.result.totalLines ?? content.split("\n").length;
      lineMeta = `L${start} - L${end}`;
    } else if (Array.isArray(tool.result.files)) {
      lineMeta = `${tool.result.files.length} 个文件`;
    }
  }

  return (
    <div className={css["tool-card"]}>
      <StatusIcon tool={tool} icon={<Eye />} />
      <Label tool={tool} text={label} />
      {lineMeta && <span className={css["tool-meta"]}>{lineMeta}</span>}
      <Duration tool={tool} />
    </div>
  );
};

// ─── 文件编写类工具渲染（write_to_file / replace_in_file / multi_replace_in_file）

const FileWriteRenderer = ({ tool, icon }: { tool: ToolRecord; icon: React.ReactElement }) => {
  const path: string = tool.args?.path ?? "";
  const name = path ? basename(path) : "";

  // pending 状态：无路径时"生成中..."，有路径时"filename 生成中..."
  if (tool.status === "pending") {
    const label = name ? `${name} 生成中...` : "生成中...";
    return (
      <div className={css["tool-card"]}>
        <StatusIcon tool={tool} icon={icon} />
        <TextShimmer className={css["tool-label"]}>{label}</TextShimmer>
        <Duration tool={tool} />
      </div>
    );
  }

  // success / error：展示代码卡片
  const content: string = tool.args?.content ?? tool.args?.newString ?? "";
  const lang = detectLang(path);
  const lineCount = content ? content.split("\n").length : 0;

  return (
    <div className={css["code-card"]}>
      <div className={css["code-card-header"]}>
        <span className={css["code-card-icon"]}>
          {tool.status === "error" ? <ErrorIcon /> : icon}
        </span>
        <span className={css["code-card-filename"]}>{name || path}</span>
        {lineCount > 0 && (
          <span className={css["code-card-lines"]}>{lineCount} 行</span>
        )}
        <Duration tool={tool} />
      </div>
      {content && (
        <pre className={css["code-card-body"]}>
          <code className={`language-${lang}`}>{content}</code>
        </pre>
      )}
    </div>
  );
};

const WriteFileRenderer = ({ tool }: { tool: ToolRecord }) => (
  <FileWriteRenderer tool={tool} icon={<FileWrite />} />
);

const EditFileRenderer = ({ tool }: { tool: ToolRecord }) => (
  <FileWriteRenderer tool={tool} icon={<Pencil />} />
);

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

function basename(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() ?? path;
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

// ─── 注册 ─────────────────────────────────────────────────────────────────────

registerToolRenderer("read_file", (tool) => <ReadFileRenderer tool={tool} />);
registerToolRenderer("write_file", (tool) => <WriteFileRenderer tool={tool} />);
registerToolRenderer("edit_file", (tool) => <EditFileRenderer tool={tool} />);
