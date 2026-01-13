/**
 * API 调用收集模块
 * 用于收集 createPage、createCanvas、updatePage 的调用参数和时间戳
 */

export type RecordedActionType = 'createPage' | 'createCanvas' | 'updatePage';

export interface RecordedAction {
  /** 操作类型 */
  type: RecordedActionType;
  /** 调用参数（序列化后的参数） */
  params: any[];
  /** 距离上一次调用的时间间隔（毫秒） */
  delay: number;
  /** 时间戳（可选，用于调试） */
  timestamp?: number;
}

class APIRecorder {
  private records: RecordedAction[] = [];
  private lastRecordTime: number = Date.now();
  private isRecording: boolean = false;

  /**
   * 开始记录
   */
  start() {
    this.isRecording = true;
    this.records = [];
    this.lastRecordTime = Date.now();
  }

  /**
   * 停止记录
   */
  stop() {
    this.isRecording = false;
  }

  /**
   * 记录一次 API 调用
   * @param type API 类型
   * @param params 调用参数
   */
  record(type: RecordedActionType, params: any[]) {
    if (!this.isRecording) {
      return;
    }

    const now = Date.now();
    const delay = now - this.lastRecordTime;
    this.lastRecordTime = now;

    // 深度克隆参数，避免引用问题
    const serializedParams = this.serializeParams(params);

    this.records.push({
      type,
      params: serializedParams,
      delay,
      timestamp: now,
    });
  }

  /**
   * 序列化参数，使用 JSON 创建对象快照
   * 确保所有对象参数都被深度克隆，避免引用问题
   */
  private serializeParams(params: any[]): any[] {
    return params.map((param) => {
      try {
        // 使用 JSON 序列化创建快照（深度克隆）
        return JSON.parse(JSON.stringify(param));
      } catch (error) {
        // 如果序列化失败，返回错误标记
        return { 
          __type: 'unserializable', 
          __value: String(param),
          __error: String(error)
        };
      }
    });
  }

  /**
   * 获取所有记录
   */
  getRecords(): RecordedAction[] {
    return [...this.records];
  }

  /**
   * 导出为 JSON 字符串
   */
  dump(): string {
    return JSON.stringify(this.records, null, 2);
  }

  /**
   * 清空记录
   */
  clear() {
    this.records = [];
    this.lastRecordTime = Date.now();
  }

  /**
   * 检查是否正在记录
   */
  getRecording(): boolean {
    return this.isRecording;
  }
}

// 单例模式
export const apiRecorder = new APIRecorder();

