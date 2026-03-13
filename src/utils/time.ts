/** 将时间戳格式化为相对时间展示 */
const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const toDateKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const todayKey = toDateKey(now);
  const dateKey = toDateKey(date);

  if (dateKey === todayKey) {
    return timeStr;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateKey === toDateKey(yesterday)) {
    return `昨天 ${timeStr}`;
  }

  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`;
  }

  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`;
};

export { formatTime };
