# API 收集和回放功能

## 概述

该模块提供了对 `createPage`、`createCanvas`、`updatePage` 这三个 API 的收集和回放功能。

## 使用方式

### 在浏览器控制台中使用

所有功能都通过 `window.APIRecordReplay` 对象提供：

#### 1. 开始录制

```javascript
// 开始录制 API 调用
window.APIRecordReplay.start();
```

#### 2. 执行操作

录制开始后，所有对 `createPage`、`createCanvas`、`updatePage` 的调用都会被自动记录。

#### 3. 停止录制

```javascript
// 停止录制
window.APIRecordReplay.stop();
```

#### 4. 导出记录

```javascript
// 导出为 JSON 字符串
const jsonString = window.APIRecordReplay.dump();
console.log(jsonString);

// 或者获取记录数组
const records = window.APIRecordReplay.getRecords();
console.log(records);
```

#### 5. 回放记录

```javascript
// 回放当前录制的记录
await window.APIRecordReplay.replay();

// 或者从 JSON 字符串回放
const jsonString = '[...]'; // 之前导出的 JSON
await window.APIRecordReplay.replayFromJSON(jsonString);

// 或者回放指定的记录数组
const records = window.APIRecordReplay.getRecords();
await window.APIRecordReplay.replay(records);
```

#### 6. 回放选项

```javascript
// 带选项的回放
await window.APIRecordReplay.replay(undefined, {
  // 忽略时间间隔，立即执行
  ignoreDelay: false,
  
  // 时间间隔倍数（1.0 = 正常速度，2.0 = 2倍速，0.5 = 0.5倍速）
  delayMultiplier: 1.0,
  
  // 每个操作执行前的回调
  onBeforeAction: (action, index) => {
    console.log(`准备执行操作 ${index}: ${action.type}`);
  },
  
  // 每个操作执行后的回调
  onAfterAction: (action, index, result) => {
    console.log(`操作 ${index} 完成:`, result);
  },
  
  // 回放完成后的回调
  onComplete: () => {
    console.log('回放完成');
  },
  
  // 回放出错时的回调
  onError: (error, action, index) => {
    console.error(`操作 ${index} 出错:`, error);
  }
});
```

#### 7. 其他操作

```javascript
// 检查是否正在录制
const isRecording = window.APIRecordReplay.isRecording();
console.log('正在录制:', isRecording);

// 清空记录
window.APIRecordReplay.clear();
```

## 完整示例

```javascript
// 1. 开始录制
window.APIRecordReplay.start();

// 2. 执行一些操作（这些操作会被自动记录）
// await context.api.page.api.createPage('canvas-id', 'Page Title');
// await context.api.page.api.createCanvas();
// await context.api.page.api.updatePage(...args);

// 3. 停止录制
window.APIRecordReplay.stop();

// 4. 导出记录
const jsonString = window.APIRecordReplay.dump();
console.log('导出的 JSON:', jsonString);

// 5. 保存到文件或复制到剪贴板
// copy(jsonString); // 如果浏览器支持

// 6. 回放记录
await window.APIRecordReplay.replay({
  onBeforeAction: (action, index) => {
    console.log(`执行操作 ${index + 1}: ${action.type}`);
  },
  onComplete: () => {
    console.log('回放完成');
  }
});
```

## 记录格式

记录的 JSON 格式如下：

```json
[
  {
    "type": "createPage",
    "params": ["canvas-id", "Page Title", { "config": "value" }],
    "delay": 0,
    "timestamp": 1234567890123
  },
  {
    "type": "createCanvas",
    "params": [],
    "delay": 100,
    "timestamp": 1234567890223
  },
  {
    "type": "updatePage",
    "params": [["action1"], "ing"],
    "delay": 50,
    "timestamp": 1234567890273
  }
]
```

- `type`: 操作类型（'createPage' | 'createCanvas' | 'updatePage'）
- `params`: 调用参数数组
- `delay`: 距离上一次调用的时间间隔（毫秒）
- `timestamp`: 时间戳（可选，用于调试）

## 注意事项

1. 录制功能会自动在 API 调用时记录，无需手动调用记录方法
2. 函数参数会被序列化为特殊标记，无法完全还原
3. 回放时会按照原始时间间隔执行，确保使用 `await` 等待完成
4. 如果 API 调用失败，默认会继续执行后续操作，错误会通过 `onError` 回调通知
5. 回放使用的是当前上下文中的 API，确保 API 可用

