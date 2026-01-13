/**
 * API 收集和回放统一导出
 */

import { apiRecorder, RecordedAction, RecordedActionType } from './recorder';
import { replay, replayFromJSON, ReplayAPI, ReplayOptions } from './replayer';
import { APIRecordReplayManager } from './manager';

export { apiRecorder, replay, replayFromJSON, APIRecordReplayManager };
export type { RecordedAction, RecordedActionType, ReplayAPI, ReplayOptions };

