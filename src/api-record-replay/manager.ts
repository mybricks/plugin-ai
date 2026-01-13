/**
 * API 记录和回放管理器
 * 提供录制、dump 和回放功能
 */

import { apiRecorder, RecordedAction } from './recorder';
import { replay, replayFromJSON, ReplayAPI, ReplayOptions } from './replayer';
import { context } from '../context';

/**
 * 获取 API 实例的辅助函数
 * 从 context.designer 获取 API
 */
function getAPI() {
  return context.designer;
}

/**
 * API 记录和回放管理器
 * 提供录制、dump 和回放功能
 */
export class APIRecordReplayManager {
  /**
   * 开始录制 API 调用
   */
  start() {
    apiRecorder.start();
    console.log('[APIRecordReplay] 开始录制');
  }

  /**
   * 停止录制
   */
  stop() {
    apiRecorder.stop();
    console.log('[APIRecordReplay] 停止录制');
  }

  /**
   * 导出录制的 JSON 字符串
   * @returns JSON 字符串
   */
  dump(): string {
    const json = apiRecorder.dump();
    console.log('[APIRecordReplay] 导出记录:', json);
    return json;
  }

  /**
   * 获取记录数组
   * @returns 记录数组
   */
  getRecords(): RecordedAction[] {
    return apiRecorder.getRecords();
  }

  /**
   * 清空记录
   */
  clear() {
    apiRecorder.clear();
    console.log('[APIRecordReplay] 已清空记录');
  }

  /**
   * 检查是否正在录制
   * @returns 是否正在录制
   */
  isRecording(): boolean {
    return apiRecorder.getRecording();
  }

  /**
   * 回放记录的 API 调用
   * @param records 记录数组（可选，如果不提供则使用当前录制的记录）
   * @param options 回放选项（可选）
   */
  async replay(records?: RecordedAction[], options?: ReplayOptions) {
    const api = getAPI();
    if (!api) {
      console.error('[APIRecordReplay] API 不可用');
      return;
    }

    const replayAPI: ReplayAPI = {
      createPage: api.createPage.bind(api),
      createCanvas: api.createCanvas.bind(api),
      updatePage: api.updatePage.bind(api)
    };

    const recordsToReplay = records || apiRecorder.getRecords();
    
    if (recordsToReplay.length === 0) {
      console.warn('[APIRecordReplay] 没有可回放的记录');
      return;
    }

    console.log(`[APIRecordReplay] 开始回放 ${recordsToReplay.length} 条记录`);
    
    await replay(recordsToReplay, replayAPI, {
      onBeforeAction: (action, index) => {
        console.log(`[APIRecordReplay] 执行操作 ${index + 1}/${recordsToReplay.length}: ${action.type}`);
        options?.onBeforeAction?.(action, index);
      },
      onAfterAction: (action, index, result) => {
        options?.onAfterAction?.(action, index, result);
      },
      onComplete: () => {
        console.log('[APIRecordReplay] 回放完成');
        options?.onComplete?.();
      },
      onError: (error, action, index) => {
        console.error(`[APIRecordReplay] 回放出错:`, error);
        options?.onError?.(error, action, index);
      },
      ...options
    });
  }

  /**
   * 从 JSON 字符串回放
   * @param jsonString JSON 字符串
   * @param options 回放选项（可选）
   */
  async replayFromJSON(jsonString: string, options?: ReplayOptions) {
    const api = getAPI();
    if (!api) {
      console.error('[APIRecordReplay] API 不可用');
      return;
    }

    const replayAPI: ReplayAPI = {
      createPage: api.createPage.bind(api),
      createCanvas: api.createCanvas.bind(api),
      updatePage: api.updatePage.bind(api)
    };

    console.log('[APIRecordReplay] 从 JSON 开始回放');
    
    await replayFromJSON(jsonString, replayAPI, {
      onBeforeAction: (action, index) => {
        console.log(`[APIRecordReplay] 执行操作 ${index + 1}: ${action.type}`);
        options?.onBeforeAction?.(action, index);
      },
      onAfterAction: (action, index, result) => {
        options?.onAfterAction?.(action, index, result);
      },
      onComplete: () => {
        console.log('[APIRecordReplay] 回放完成');
        options?.onComplete?.();
      },
      onError: (error, action, index) => {
        console.error(`[APIRecordReplay] 回放出错:`, error);
        options?.onError?.(error, action, index);
      },
      ...options
    });
  }
}

