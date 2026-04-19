import React from "react";
import type { ToolRecord } from "../index";
import { Loading, Success, ErrorIcon, FileIcon } from "../../../../components/icons";
import { TextShimmer } from "../../../../components/text-shimmer";
import { ElapsedTime } from "../../../../components/elapsed-time";
import css from "../render.less";

/**
 * 初始化项目专用渲染器（为 init-project 工具设计）
 */
export const InitProjectRenderer = ({ tool }: { tool: ToolRecord }) => {
  // 从 args、progress 或 metadata 中获取需求
  const requirement =
    tool.args?.requirement ??
    tool.progress?.requirement ??
    tool.result?.metadata?.requirement ??
    "";
  const isRunning = tool.status === "pending";
  const isError = tool.status === "error";

  if (isError) {
    return (
      <div className={css["tool-card"]}>
        <span className={css["tool-icon"]}><ErrorIcon /></span>
        <span className={css["tool-label"]}>初始化项目失败</span>
        {tool.execStartTime && (
          <ElapsedTime startTime={tool.execStartTime} endTime={tool.execEndTime || undefined} className={css["tool-duration"]} />
        )}
      </div>
    );
  }

  const allFiles: Array<{ path: string; lineCount: number; status: string }> = isRunning
    ? (tool.progress?.files ?? [])
    : (tool.result?.metadata?.files ?? []);

  // 过滤掉 md 文件
  const files = allFiles.filter((file) => !file.path.toLowerCase().endsWith(".md"));

  const headerTitle = isRunning ? "初始化项目..." : "初始化项目";

  return (
    <div className={css["init-project-card"]}>
      {/* Header */}
      <div className={css["init-project-header"]}>
        <span className={css["init-project-header-icon"]}>
          {isRunning ? <Loading /> : <Success />}
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

      {/* 需求面板 */}
      {requirement && (
        <div className={css["init-project-requirement"]}>
          <div className={css["init-project-section-title"]}>需求</div>
          <div className={css["init-project-requirement-text"]}>{requirement}</div>
        </div>
      )}

      {/* 文件列表面板 */}
      {files.length > 0 && (
        <div className={css["init-project-files"]}>
          <div className={css["init-project-section-title"]}>文件列表</div>
          <div className={css["init-project-files-list"]}>
            {files.map((file, idx) => {
              const fileStatus = file.status || "complete";
              const isWriting = fileStatus === "writing";
              const isFileError = fileStatus === "error";

              return (
                <div key={idx} className={css["init-project-file-item"]}>
                  <span className={css["init-project-file-icon"]}>
                    {isWriting ? <Loading /> : isFileError ? <ErrorIcon /> : <FileIcon />}
                  </span>
                  <span className={css["init-project-file-name"]}>{file.path}</span>
                  <span className={css["init-project-file-lines"]}>{file.lineCount} 行</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
