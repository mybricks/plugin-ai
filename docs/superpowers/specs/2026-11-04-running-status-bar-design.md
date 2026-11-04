# 聊天运行状态条（RunningBar）设计

日期：2026-11-04
分支：feat/manatee-channel

## 背景与目标

Agent 运行期间，ChatPanel 只有 pending 消息气泡内的小字 loading 和输入框停止按钮两处反馈，不够明显（宿主右上角的计时器不在本仓库范围内）。目标是增加一个类似 WorkBuddy「正在工作」的醒目状态条，运行时固定在输入框上方。

## 需求决策

- **位置**：消息区与 Sender 块之间，固定不随消息滚动（不受 `scrollWithSender` 布局影响）。
- **内容**：动画 spinner 图标 +「正在工作」标题 + 阶段状态文案（shimmer 动画）+ mm:ss 运行计时器。不含停止按钮。
- **生效范围**：ChatPanel / ChatPanelList 默认开启；通过新增可选 prop `runningBar` 配置（`true`（默认）/ `false` / `{ title?: string }`）。

## 方案

独立 `RunningBar` 组件，由 ChatPanel 内置挂载（备选的「塞进 Sender」「仅导出由宿主挂载」分别因耦合 session 状态、不满足默认开启而否决）。

### 组件

`packages/plugin/src/ui/components/running-bar/index.tsx` + `index.less`

```tsx
interface RunningBarProps {
  loading: boolean;
  /** 阶段文案，如「模型响应中...」 */
  stageText: string;
  /** 当前 turn 开始时间（Unix ms） */
  startTime?: number;
  /** 覆盖默认标题「正在工作」 */
  title?: string;
}
```

- `loading` 为 false 时渲染 null（不做退场动画，保持简单；出现即占位）。
- spinner 用现有 icons 体系中的 loading 图标 + CSS 旋转；文案用现有 `text-shimmer` 组件/样式；计时复用扩展后的 `ElapsedTime`。

### 样式

结构类 WorkBuddy：横向条形、圆角、spinner + 标题 + 文案 + 计时。颜色不硬编码绿色，跟随现有主题 CSS 变量体系（主题色浅色底 + 主题色文字/图标），保证在各类宿主主题下可用；宽度撑满消息区。

### ElapsedTime 扩展

`ui/components/elapsed-time/index.tsx` 新增 `format?: "auto" | "clock"`：

- `"auto"`（默认）：现有行为不变（`8s` / `1.2m`，小于 1 秒不展示）。
- `"clock"`：`mm:ss`，超过 1 小时 `h:mm:ss`；从 0 秒起展示（状态条需要稳定宽度，避免闪烁跳变）。

### ChatPanel 接入

`chat-panel/index.tsx`：

- 新增 prop `runningBar?: boolean | { title?: string }`，默认 `true`。
- 从 `messages` 中取 `loadingTurnId` 对应 pending record 的 `startTime` 传给 RunningBar（跨 remount 计时准确）。
- 布局：`{header}{messages-area}{runningBar}{senderBlock}`；`scrollWithSender` 时 RunningBar 仍在滚动容器外，位于 sender 块上方。
- ChatPanelList 内部透传该配置。

## 错误处理

- `startTime` 缺失（极端时序下 pending record 尚未创建）：RunningBar 不渲染计时器，其余正常。
- 队列排队（pendingQueue 非空）不改变状态条行为——状态条只反映当前运行。

## 测试

- 组件级：RunningBar 在 loading/stageText/startTime 各组合下的渲染（无 startTime 时不渲染计时）。
- ElapsedTime：`clock` 格式边界（<1s、59s、1h+、endTime 固定值）。
- ChatPanel：runningBar 默认渲染、`false` 关闭、`{title}` 自定义标题；scrollWithSender 两种布局下位置正确。
- 构建验证：`npm run build:plugin` 通过。
