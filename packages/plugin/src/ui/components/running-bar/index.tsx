import React from "react";
import { Loading } from "../icons";
import { TextShimmer } from "../text-shimmer";
import { ElapsedTime } from "../elapsed-time";
import css from "./index.less";

interface RunningBarProps {
  /** 是否正在运行 */
  loading: boolean;
  /** 阶段状态文案，如「模型响应中...」 */
  stageText: string;
  /** 当前 turn 开始时间（Unix ms）；缺失时不展示计时器 */
  startTime?: number;
  /** 覆盖默认标题「正在工作」 */
  title?: string;
}

/** Agent 运行状态条：spinner + 标题 + 阶段文案 + 计时，运行时固定在输入框上方。 */
const RunningBar = ({ loading, stageText, startTime, title = "正在工作" }: RunningBarProps) => {
  if (!loading) return null;
  return (
    <div className={css["running-bar"]} role="status" aria-live="polite">
      <span className={css["running-bar-spinner"]}>
        <Loading />
      </span>
      <span className={css["running-bar-title"]}>{title}</span>
      <TextShimmer className={css["running-bar-stage"]}>{stageText}</TextShimmer>
      {startTime !== undefined ? (
        <ElapsedTime startTime={startTime} format="clock" className={css["running-bar-elapsed"]} />
      ) : null}
    </div>
  );
};

export { RunningBar };
