# 聊天运行状态条（RunningBar）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agent 运行期间在 ChatPanel 输入框上方固定展示醒目状态条（spinner +「正在工作」+ 阶段文案 + mm:ss 计时），默认开启。

**Architecture:** 独立 `RunningBar` 展示组件（无状态，props 驱动），由 `ChatPanel` 内置挂载在消息区与 Sender 块之间；计时数据取 `useAgent` 已暴露的 `loading`/`loadingTip` 与 pending turn 的 `startTime`，不改动 context/queue 层。

**Tech Stack:** React 18 函数组件 + less module（CSS 变量主题体系，参照 `--mybricks-color-primary` / `--chat-*` 约定）。

**验证方式（与 spec 的偏差）:** 本仓库无测试设施（无 jest/vitest 配置、无测试文件，`tsc -p tsconfig.json` 存量报错），补测试设施超出本特性范围。每个任务以 `npm run build:plugin` 构建通过为准，最后在 playground 手动验证视觉与交互。spec 中的组件级测试用例以下述手动检查清单代替。

**规范:** 本仓库 less 文件首行需有 `/*! plugin-ai-comp-view-anchor */` 锚点注释；注释、文案用中文；提交信息用 conventional commits（`feat:`/`fix:` 前缀）。

---

### Task 1: ElapsedTime 支持 clock 格式

**Files:**
- Modify: `packages/plugin/src/ui/components/elapsed-time/index.tsx`（整文件替换为下方内容）

- [ ] **Step 1: 修改组件，新增 `format` prop**

将 `packages/plugin/src/ui/components/elapsed-time/index.tsx` 整体替换为：

```tsx
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
```

关键点：现有调用方（`messages/index.tsx`、`tool-renders/shared.tsx` 等）不传 `format`，行为不变。

- [ ] **Step 2: 构建验证**

Run: `npm run build:plugin`
Expected: 构建成功退出（exit 0），无报错。

- [ ] **Step 3: 提交**

```bash
git add packages/plugin/src/ui/components/elapsed-time/index.tsx
git commit -m "feat(elapsed-time): 新增 clock 计时格式（mm:ss / h:mm:ss）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: 新建 RunningBar 组件

**Files:**
- Create: `packages/plugin/src/ui/components/running-bar/index.tsx`
- Create: `packages/plugin/src/ui/components/running-bar/index.less`

- [ ] **Step 1: 创建组件文件**

创建 `packages/plugin/src/ui/components/running-bar/index.tsx`：

```tsx
import React from "react";
import { Loading } from "../icons";
import { TextShimmer } from "../text-shimmer";
import { ElapsedTime } from "../elapsed-time";
import css from "./index.less";

interface RunningBarProps {
  /** 是否正在运行 */
  loading: boolean;
  /** 阶段状态文案，如「模型响应中...」 */
  stageText: string;
  /** 当前 turn 开始时间（Unix ms）；缺失时不展示计时器 */
  startTime?: number;
  /** 覆盖默认标题「正在工作」 */
  title?: string;
}

/** Agent 运行状态条：spinner + 标题 + 阶段文案 + 计时，运行时固定在输入框上方。 */
const RunningBar = ({ loading, stageText, startTime, title = "正在工作" }: RunningBarProps) => {
  if (!loading) return null;
  return (
    <div className={css["running-bar"]} role="status" aria-live="polite">
      <span className={css["running-bar-spinner"]}>
        <Loading />
      </span>
      <span className={css["running-bar-title"]}>{title}</span>
      <TextShimmer className={css["running-bar-stage"]}>{stageText}</TextShimmer>
      {startTime !== undefined ? (
        <ElapsedTime startTime={startTime} format="clock" className={css["running-bar-elapsed"]} />
      ) : null}
    </div>
  );
};

export { RunningBar };
```

说明：`Loading` 图标（`components/icons`）自带 `.spin` 旋转动画；`TextShimmer`（`components/text-shimmer`）为文字流光动画；两者均为现有组件，样式经外层 class 覆盖。

- [ ] **Step 2: 创建样式文件**

创建 `packages/plugin/src/ui/components/running-bar/index.less`：

```less
/*! plugin-ai-comp-view-anchor */

.running-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin: var(--chat-running-bar-margin, 6px var(--chat-sender-padding, 10px) 0);
  padding: var(--chat-running-bar-padding, 5px 12px);
  border-radius: var(--chat-running-bar-radius, 8px);
  font-size: var(--chat-font-size-sm, 12px);
  color: var(--mybricks-color-primary, #FA6400);
  background: color-mix(in srgb, var(--mybricks-color-primary, #FA6400) 8%, transparent);
}

.running-bar-spinner {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;

  svg {
    width: var(--chat-icon-size, 14px);
    height: var(--chat-icon-size, 14px);
  }
}

.running-bar-title {
  font-weight: 500;
  white-space: nowrap;
}

.running-bar-stage {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.running-bar-elapsed {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  opacity: 0.85;
}
```

样式约定：颜色全部走 `--mybricks-*` 主题变量（含 fallback），主题色浅底 + 主题色文字，不硬编码绿色；新增尺寸变量带 fallback，宿主可覆盖。

- [ ] **Step 3: 构建验证**

Run: `npm run build:plugin`
Expected: 构建成功退出（exit 0）。

- [ ] **Step 4: 提交**

```bash
git add packages/plugin/src/ui/components/running-bar/
git commit -m "feat(running-bar): 新增 Agent 运行状态条组件

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: ChatPanel 接入（默认开启 + runningBar prop）

**Files:**
- Modify: `packages/plugin/src/ui/chat/chat-panel/index.tsx`

- [ ] **Step 1: 新增 import**

在 `index.tsx` 现有组件 import 区（`import { Header } from "./header";` 一行之后）加：

```tsx
import { RunningBar } from "../../components/running-bar";
```

- [ ] **Step 2: 新增 prop 类型**

在 `ChatPanelProps` 接口中 `resolveSessionStageText?: SessionStageTextResolver;`（约 126 行）之后加：

```tsx
  /**
   * Agent 运行状态条：spinner + 标题 + 阶段文案 + 计时，固定在输入框上方。
   * 默认 true 展示；false 关闭；传对象可自定义标题。
   */
  runningBar?: boolean | { title?: string };
```

- [ ] **Step 3: 解构 prop**

在组件参数解构中 `resolveSessionStageText,`（约 173 行）之后加：

```tsx
  runningBar = true,
```

- [ ] **Step 4: 计算 startTime 并构造状态条节点**

在 `senderBlockNode` 定义（`const senderBlockNode = ...` 三元表达式，约 298-303 行）之后、`return (` 之前加：

```tsx
  // 运行状态条：计时取当前 pending turn 的 startTime（记录层持久，跨 remount 准确）。
  const runningBarEnabled = runningBar !== false;
  const runningBarTitle = typeof runningBar === "object" ? runningBar.title : undefined;
  const runningStartTime = loadingTurnId
    ? messages.find((record) => record.id === loadingTurnId)?.startTime
    : undefined;
  const runningBarNode = runningBarEnabled ? (
    <RunningBar
      loading={loading}
      stageText={loadingTip}
      startTime={runningStartTime}
      title={runningBarTitle}
    />
  ) : null;
```

- [ ] **Step 5: 修改渲染位置（两种布局）**

5a. `MessageList` 的 `renderFooter`（约 334 行），把：

```tsx
            renderFooter={scrollWithSender ? () => senderBlockNode : undefined}
```

改为：

```tsx
            renderFooter={scrollWithSender ? () => <>{runningBarNode}{senderBlockNode}</> : undefined}
```

（`scrollWithSender` 模式下 Sender 在滚动容器内以 sticky footer 渲染，状态条放进同一 sticky footer 才能固定在输入框上方。）

5b. 面板底部（约 339 行），把：

```tsx
        {scrollWithSender ? null : senderBlockNode}
```

改为：

```tsx
        {scrollWithSender ? null : <>{runningBarNode}{senderBlockNode}</>}
```

- [ ] **Step 6: 构建验证**

Run: `npm run build:plugin`
Expected: 构建成功退出（exit 0）。

- [ ] **Step 7: 提交**

```bash
git add packages/plugin/src/ui/chat/chat-panel/index.tsx
git commit -m "feat(chat-panel): 运行时在输入框上方展示 RunningBar 状态条

默认开启，可通过 runningBar prop 关闭或自定义标题。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: ChatPanelList 透传 runningBar

**Files:**
- Modify: `packages/plugin/src/ui/chat/chat-panel-list/index.tsx`

- [ ] **Step 1: 新增 prop 类型**

在 `ChatPanelListProps` 接口中 `mcpConnectors` 属性（约 30-33 行附近，`/** 连接器选择配置 */` 注释块）之后加：

```tsx
  /** Agent 运行状态条配置，透传给内部 ChatPanel；默认展示 */
  runningBar?: ChatPanelProps["runningBar"];
```

- [ ] **Step 2: 解构并透传**

2a. 组件参数解构（约 61 行）：

```tsx
const ChatPanelList = ({ user, copilot, onUpload, title, size = "small", className, style, mcpConnectors, runningBar }: ChatPanelListProps) => {
```

2b. 内部 `<ChatPanel ...>`（约 249-265 行）在 `mcpConnectors={connectorConfig}` 之后加一行：

```tsx
              runningBar={runningBar}
```

- [ ] **Step 3: 构建验证**

Run: `npm run build:plugin`
Expected: 构建成功退出（exit 0）。

- [ ] **Step 4: 提交**

```bash
git add packages/plugin/src/ui/chat/chat-panel-list/index.tsx
git commit -m "feat(chat-panel-list): 透传 runningBar 配置

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: 端到端验证

**Files:** 无新增修改（验证任务）

- [ ] **Step 1: 完整构建**

Run: `cd /Users/chenpeng/Desktop/work/code/hn/plugin-ai && npm run build:plugin`
Expected: exit 0。

- [ ] **Step 2: playground 手动验证**

Run: `cd /Users/chenpeng/Desktop/work/code/hn/plugin-ai/packages/playground && npm run dev`（如 node_modules 未装先 `npm install`）

浏览器打开 vite 输出的地址，进入使用 ChatPanel 的 case，检查清单：

1. 发送消息后，输入框上方出现状态条：spinner 旋转 +「正在工作」+ 阶段文案流光 + `00:00` 起的 mm:ss 计时逐秒递增。
2. 运行阶段切换时（准备中 → 模型响应中...）文案随之变化，计时连续不重置。
3. 运行结束/停止后状态条消失，消息区恢复原布局（无残留空隙）。
4. 运行中向上滚动长消息列表，状态条位置固定不动。
5. 未运行时无状态条，布局与改动前一致。
6. （如 playground 有对应 case）`runningBar={false}` 不渲染；`runningBar={{ title: "自定义" }}` 标题替换。
7. `scrollWithSender` 模式的 case（如有）状态条仍在输入框上方固定。

- [ ] **Step 3: 修复发现的问题（如有）并提交**

```bash
git add -A
git commit -m "fix(running-bar): 修复手动验证发现的问题

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

（无问题则跳过本步。）
