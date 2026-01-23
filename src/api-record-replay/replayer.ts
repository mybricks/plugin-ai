/**
 * API 调用回放模块
 * 根据记录的 JSON 序列执行回放
 */

import { RecordedAction, RecordedActionType } from './recorder';

export interface ReplayOptions {
  /** 是否忽略时间间隔，立即执行 */
  ignoreDelay?: boolean;
  /** 时间间隔的倍数（用于加速或减速回放） */
  delayMultiplier?: number;
  /** 每个操作执行前的回调 */
  onBeforeAction?: (action: RecordedAction, index: number) => void;
  /** 每个操作执行后的回调 */
  onAfterAction?: (action: RecordedAction, index: number, result: any) => void;
  /** 回放完成后的回调 */
  onComplete?: () => void;
  /** 回放出错时的回调 */
  onError?: (error: Error, action: RecordedAction, index: number) => void;
}

export interface ReplayAPI {
  createPage: (id: string, title: string, config?: any) => Promise<{ id: string; onProgress: Function; }>;
  createCanvas: () => Promise<{ id: string; title: string; }>;
  updatePage: (...params: any[]) => Promise<void>;
  updateUiCom: (...params: any[]) => Promise<void>;
  updateLogicCom: (...params: any[]) => Promise<void>;
  createDiagram: (...params: any[]) => Promise<any>;
  updateDiagram: (...params: any[]) => Promise<any>;
}

/**
 * 回放记录的 API 调用
 * @param records 记录的 API 调用序列
 * @param api API 实现对象
 * @param options 回放选项
 */
export async function replay(
  records: RecordedAction[],
  api: ReplayAPI,
  options: ReplayOptions = {}
): Promise<void> {
  const {
    ignoreDelay = false,
    delayMultiplier = 1,
    onBeforeAction,
    onAfterAction,
    onComplete,
    onError,
  } = options;

  for (let i = 0; i < records.length; i++) {
    const action = records[i];

    try {
      // 执行前回调
      onBeforeAction?.(action, i);

      // 等待时间间隔
      if (!ignoreDelay && action.delay > 0) {
        const delay = action.delay * delayMultiplier;
        await sleep(delay);
      }

      // 执行 API 调用
      let result: any;
      switch (action.type) {
        case 'createPage': {
          const [id, title, config] = action.params;
          result = await api.createPage(id, title, config);
          break;
        }
        case 'createCanvas': {
          result = await api.createCanvas();
          break;
        }
        case 'updatePage': {
          // updatePage 的参数是展开的，需要展开传递
          result = await api.updatePage(...action.params);
          break;
        }
        case 'updateUiCom': {
          // updateUiCom 的参数是展开的，需要展开传递
          result = await api.updateUiCom(...action.params);
          break;
        }
        case 'updateLogicCom': {
          // updateLogicCom 的参数是展开的，需要展开传递
          result = await api.updateLogicCom(...action.params);
          break;
        }
        case 'createDiagram': {
          // createDiagram 的参数是展开的，需要展开传递
          result = await api.createDiagram(...action.params);
          break;
        }
        case 'updateDiagram': {
          // updateDiagram 的参数是展开的，需要展开传递
          result = await api.updateDiagram(...action.params);
          break;
        }
        default:
          throw new Error(`Unknown action type: ${(action as any).type}`);
      }

      // 执行后回调
      onAfterAction?.(action, i, result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err, action, i);
      
      // 根据选项决定是否继续执行
      // 默认继续执行，只记录错误
      console.error(`Replay error at action ${i} (${action.type}):`, err);
    }
  }

  // 完成回调
  onComplete?.();
}

/**
 * 从 JSON 字符串加载并回放
 * @param jsonString JSON 字符串
 * @param api API 实现对象
 * @param options 回放选项
 */
export async function replayFromJSON(
  jsonString: string,
  api: ReplayAPI,
  options: ReplayOptions = {}
): Promise<void> {
  try {
    const records: RecordedAction[] = JSON.parse(jsonString);
    await replay(records, api, options);
  } catch (error) {
    throw new Error(`Failed to parse replay JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 睡眠函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

