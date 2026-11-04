import { useEffect, useState } from "react";

/**
 * 耗时展示组件。
 *   - endTime 有值：展示静态耗时（endTime - startTime）
 *   - endTime 无值：实时计时（每 200ms 刷新）
 *
 * format="auto"（默认）：小于 1 秒不展示；分钟级保留一位小数，秒级取整。
 * format="clock"：稳定宽度计时 mm:ss（超过 1 小时 h:mm:ss），从 0 秒起展示。
 */
const ElapsedTime = ({
  startTime,
  endTime,
  className,
  format = "auto",
}: {
  startTime: number;
  endTime?: number;
  className: string;
  /** 展示格式：auto（8s / 1.2m）或 clock（00:08 / 1:02:03） */
  format?: "auto" | "clock";
}) => {
  const [elapsed, setElapsed] = useState(() => (endTime ?? Date.now()) - startTime);

  useEffect(() => {
    if (endTime !== undefined) {
      setElapsed(endTime - startTime);
      return;
    }
    const timer = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 200);
    return () => clearInterval(timer);
  }, [startTime, endTime]);

  const text =
    format === "clock"
      ? formatClock(elapsed)
      : elapsed < 1000
      ? null
      : elapsed >= 60000
      ? (elapsed / 60000).toFixed(1) + "m"
      : Math.floor(elapsed / 1000) + "s";

  if (!text) return null;
  return <span className={className}>{text}</span>;
};

/** mm:ss，超过 1 小时 h:mm:ss。 */
function formatClock(elapsed: number): string {
  const totalSeconds = Math.floor(elapsed / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export { ElapsedTime };
