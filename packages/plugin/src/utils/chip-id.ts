/**
 * 生成一个短随机 chip id，用于 [[chip:id]] 占位符。
 * 各类 chip（dom / file / mention...）共用同一套生成逻辑，
 * 保持长度一致，避免占位符本身占用过多 token。
 */
export function createChatChipId(): string {
  return Math.random().toString(36).slice(2, 6);
}
