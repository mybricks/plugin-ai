# WebSocket Agent 使用说明

## 概述

插件支持两种远程 Agent 模式：

1. **HTTP Agent**（原有方式）：HTTP/SSE 通信，服务端持有 workspace 与文件。
2. **WebSocket Agent**（新增）：对话走 SSE（`/api/v1/chat/stream`），工具调用走 WebSocket 通道回到本插件，在**本地 sandbox 的虚拟文件系统**上执行。

对接文档：http://112.17.139.222:8106/api-docs.html

## 配置方式

`remoteAgent` 增加 `type` 字段区分两种模式。

### WebSocket Agent

```typescript
AIPlugin({
  key,
  user,
  config,
  llm: { providers },
  plugins,
  skills,
  // ...
  remoteAgent: {
    type: 'websocket',
    baseUrl: 'http://112.17.139.222:8106', // 可省略，默认此地址
    apiKey: 'ak_xxx',                       // 必填：智能体平台 Bearer token
    workspaceId: 'conversation-id',
    agentCode: 'frontend_code_assistant',           // 可选；留空走默认智能体
    clientType: 'mybricks-designer',        // 可选
    meta: { projectId, userId },            // 可选：写入会话 meta 供审计
  },
});
```

> ⚠️ `apiKey` 不要硬编码在前端源码里；由宿主在运行时注入。若泄露需在服务端吊销重签。

### HTTP Agent（原有）

```typescript
remoteAgent: {
  type: 'http', // 可省略，默认 http
  baseUrl: 'http://localhost:3001/agents/api',
  workspaceId: 'conversation-id',
  agentId: 'agent-id', // 可选
}
```

## 工作流程（WebSocket 模式）

1. **建通道**：首个 turn 调 `POST /api/v1/sessions` 创建会话，拿到 `wsUrl` / `sessionId` / `heartbeatIntervalMs`，连上 WebSocket；收到 `WELCOME` 后通道就绪。
2. **发对话**：`POST /api/v1/chat/stream` 发消息，读 SSE 流。`meta` 事件回传的 `sessionId` 用于多轮续聊。
3. **工具调用**：
   - 服务端 `TOOL_CALL` → 插件在本地 sandbox 执行对应工具 → `TOOL_RESULT` 原样回填 `requestId`。
   - SSE 里的 `tool_start` / `tool_result` 是远程侧已执行工具（如 `manatee-connector_*`）的进度，仅用于 UI 展示。
   - 两类都通过 `tool:call` / `tool:result` / `tool:error` 事件驱动工具卡片。
4. **心跳/重连**：按 `heartbeatIntervalMs` 发 `PING`；2 个周期无入站消息则重连；`4001`(REPLACED) 不重连，`4003` 重建会话，其余指数退避。
5. **停止**：`abort()` 会 abort SSE fetch 并 `POST /api/v1/chat/stop`。

## 工具

WebSocket 模式下，以下工具在**本地 sandbox** 执行（setup.ts 用当前 sandbox 现造）：

- `read_file` / `write_file` / `edit_file` / `multi_edit` / `delete_file`
- `grep_search`、`bash`
- `use_skill`（有 skills 时）
- `check-status`、`init-project` 及插件工具（browserTools）

远程侧执行、仅展示进度的工具：`manatee-connector_get_api_list`、`manatee-connector_get_api_detail` 等。

## 历史与版本

WebSocket Agent 复用本地 `IDBHistory`（或宿主传入的 `history`），`getHistory()` 返回可用的版本管理视图，turn 完成后本地持久化。

## 会话初始化（seed）

系统提示词已在智能体平台侧固定配置，插件在首轮真实对话之前补齐 prompt.js 中「system 之后、用户输入之前的两条动态 user 内容」，与本地 CodeAgent 的 `getStableContextMessages` / `getAttachmentContextMessages` 使用同一批 builder，保持行为一致：

- **user[1]** — 前端开发指南：`sandbox.getContext()`（当前 promptSections、codeRules、designRules、libraries）
- **user[2]** — 环境信息 + 项目空间元信息：`<system-reminder>`（日期/可用 skills/可用 sub-agent）+ 「默认加载 skills」+ 模式提示 + `sandbox.getSandboxMetaSection()`（`<project-info>` 文件列表），拼接顺序与本地 CodeAgent 一致

流程：

1. 打开页面：从 KV `@plugin-ai/websocket-session:<agentKey>` 恢复已有 `conversationSessionId` / `seeded` / `legacySynced`。
2. 首轮 `requestAI` 内、`/chat/stream` **之前**执行 `ensureConversationInitialized`：
   - 无 sessionId → 客户端生成（append 端点「不存在时自动新建」，`/chat/stream` 复用同一个 id）；
   - 有旧 history → 兼容路径：把旧轮次（不含当前正要发送的消息）拍平为一条 `<history-context>` user 追加进去；配置消息**不再重复注入**（旧对话里已经有过）；
   - 无旧 history → 一次性追加 user[1] + user[2]。
3. seed 成功后再启动 `/chat/stream`；`meta.sessionId` 与本地一致时忽略，不一致时对齐并告警。
4. seed 结果与 `sessionId` 一并落 KV，刷新页面不再重跑；`clearHistory()` 会清空。

seed 失败会把 `seeded=false` 写回 KV 并抛出，本轮 turn 会以 error 收尾；下轮对话会重试。

## 已知限制

- 单轮流式上限 30 分钟（服务端约束），超长任务需拆多轮（同一 `sessionId` 续聊）。
- `variables` 仅在同时配置了 `agentCode` 时才会随对话发送，且键需在智能体 `businessVariables` 声明集内；chip 信息不作为 variables 发送。
- 会话绝对 TTL 8 小时、无连接 30 分钟过期，过期后下一轮自动重建；重建后 seed 会再跑一次。
- append 端点不接受 `role=assistant`，旧 history 的 AI 回复以摘要形式并入同一条 user 消息注入，不是严格多轮结构。
- seed 内容按首轮当时的项目快照生成，之后不再更新；后续轮次的最新文件列表依赖模型自己用 `grep_search` / `read_file` 获取。

## 类型

```typescript
export interface RemoteAgentConfig {
  type?: 'http' | 'websocket';
  baseUrl?: string;
  workspaceId: string;
  agentId?: string;   // http
  apiKey?: string;    // websocket（必填）
  agentCode?: string; // websocket
  clientType?: string;// websocket
  meta?: Record<string, any>; // websocket
}
```
