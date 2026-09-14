import React from "react";
import type { ToolRecord } from "../index";
import { Loading, Success, ErrorIcon, FileIcon } from "../../../../components/icons";
import { TextShimmer } from "../../../../components/text-shimmer";
import { ElapsedTime } from "../../../../components/elapsed-time";
import css from "../render.less";

type ProjectFile = { path: string; lineCount: number; status: string };

/**
 * filesToGenerate 是这次任务的完整目标清单；progress / result.metadata.files
 * 只记录已经观测到的文件。合并后 UI 在取消时也能展示尚未生成的剩余项。
 */
function getProjectFiles(tool: ToolRecord, isRunning: boolean): ProjectFile[] {
  const expectedPaths = Array.isArray(tool.args?.filesToGenerate)
    ? tool.args.filesToGenerate.filter((path: unknown): path is string => typeof path === "string" && !!path)
    : [];
  const progressFiles: ProjectFile[] = Array.isArray(tool.progress?.files) ? tool.progress.files : [];
  const resultFiles: ProjectFile[] = Array.isArray(tool.result?.metadata?.files) ? tool.result.metadata.files : [];
  // 工具结束后优先取最终 metadata，避免取消瞬间残留的 writing progress 覆盖成功写入状态。
  const observedFiles = isRunning ? progressFiles : resultFiles.length ? resultFiles : progressFiles;

  if (expectedPaths.length === 0) return observedFiles;

  const observedByPath = new Map(observedFiles.map((file) => [file.path, file]));
  const expected = expectedPaths.map((path) => observedByPath.get(path) ?? {
    path,
    lineCount: 0,
    status: "pending",
  });
  // 容错：工具实际报告了目标清单外的文件时仍展示出来，避免信息丢失。
  const unexpected = observedFiles.filter((file) => !expectedPaths.includes(file.path));
  return [...expected, ...unexpected];
}

/**
 * 初始化项目专用渲染器（为 init-project 工具设计）
 */
export const InitProjectRenderer = ({ tool }: { tool: ToolRecord }) => {
  const isRunning = tool.status === "pending";
  const isError = tool.status === "error";
  const files = getProjectFiles(tool, isRunning);
  const headerTitle = isRunning
    ? "初始化项目..."
    : isError && files.length === 0
        ? "初始化项目失败"
        : "初始化项目";

  return (
    <div className={css["init-project-card"]}>
      {/* Header */}
      <div className={css["init-project-header"]}>
        <span className={css["init-project-header-icon"]}>
          {isRunning ? <Loading /> : isError ? <ErrorIcon /> : <Success />}
        </span>
        {isRunning ? (
          <span className={css["init-project-header-title"]}>
            <TextShimmer>{headerTitle}</TextShimmer>
          </span>
        ) : (
          <span className={css["init-project-header-title"]}>{headerTitle}</span>
        )}
        {files.length > 0 && (
          <span className={css["init-project-header-meta"]}>{files.length} 个文件</span>
        )}
        {tool.execStartTime && (
          <ElapsedTime
            startTime={tool.execStartTime}
            endTime={isRunning ? undefined : tool.execEndTime}
            className={css["tool-duration"]}
          />
        )}
      </div>

      {/* 文件列表面板 */}
      {files.length > 0 && (
        <div className={css["init-project-files"]}>
          <div className={css["init-project-section-title"]}>文件列表</div>
          <div className={css["init-project-files-list"]}>
            {files.map((file, idx) => {
              const fileStatus = file.status || "complete";
              const isWriting = fileStatus === "writing";
              const isFileError = fileStatus === "error";
              const isPending = fileStatus === "pending";
              const statusText = isPending ? "" : `${file.lineCount} 行`;

              return (
                <div key={idx} className={css["init-project-file-item"]}>
                  <span className={css["init-project-file-icon"]}>
                    {isWriting
                      ? <Loading />
                      : isFileError
                        ? <ErrorIcon />
                        : isPending
                          ? <span className={css["init-project-file-pending"]} />
                          : <FileIcon />}
                  </span>
                  <span className={css["init-project-file-name"]}>{file.path}</span>
                  {statusText && <span className={css["init-project-file-lines"]}>{statusText}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
