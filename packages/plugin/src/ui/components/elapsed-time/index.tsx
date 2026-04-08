import { useEffect, useState } from "react";

/**
 * 耗时展示组件。
 *   - endTime 有值：展示静态耗时（endTime - startTime）
 *   - endTime 无值：实时计时（每 200ms 刷新）
 *
 * 小于 1 秒不展示；分钟级保留一位小数，秒级取整。
 */
const ElapsedTime = ({
  startTime,
  endTime,
  className,
}: {
  startTime: number;
  endTime?: number;
  className: string;
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
    elapsed < 1000
      ? null
      : elapsed >= 60000
      ? (elapsed / 60000).toFixed(1) + "m"
      : Math.floor(elapsed / 1000) + "s";

  if (!text) return null;
  return <span className={className}>{text}</span>;
};

export { ElapsedTime };
