# HttpAgent 接口调用流程

> 本文只描述浏览器在不同场景下如何调用 `aicode-agents` 接口。

## 基本约定

PluginAI 对外继续使用现有的 `disabled`，不修改它的公开语义和使用方式。

`HttpAgent` 内部如果需要更容易理解的判断，可以封装一个函数：

```ts
function getAccessMode(disabled: boolean): "owner" | "readonly" {
  return disabled ? "readonly" : "owner";
}
```

- `disabled === false`：当前浏览器持锁，可以 run，并实时接收消息和文件变化。
- `disabled === true`：当前浏览器不允许发起 Agent 请求、清空历史或写入版本，但仍可通过 `/connect` 回放 turn 和文件变化；不能执行或回传 Browser Tool。

其他约定：

- 客户端不向服务端上传或删除文件。
- 服务端不再发送 `session:snapshot`。
- 同一时间只能存在一个 `/run` 或 `/connect` SSE。
- `/run` 流可以处理 `browser:task`。
- `/connect` 流不会收到 `browser:task`。
- 文件变化只由 `workspace:file-change` 触发，不定时轮询。

## 使用的接口

| 接口 | 用途 |
|---|---|
| `GET /workspaces/:id/turns` | 获取已保存的历史对话 |
| `POST /workspaces/:id/run` | 创建新 turn，并通过 SSE 返回实时事件 |
| `GET /workspaces/:id/connect` | 恢复正在运行的 turn；没有 active turn 时返回 204 |
| `POST /workspaces/:id/abort` | 中止正在运行的 turn |
| `GET /workspaces/:id/files` | 获取服务端文件 manifest 和 version |
| `GET /workspaces/:id/files/content?path=...` | 获取文件内容 |
| `GET /workspaces/:id/files/changes?sinceVersion=N` | 获取文件增量 |
| `GET /workspaces/:id/plans?status=active&limit=1` | 按 frontmatter `status` 查询计划文件；返回 `{ items, total, nextCursor }`，支持 cursor 分页 |
| `POST /workspaces/:id/browser/connect` | 在 run 前登记当前浏览器可执行 Browser Tool；非默认 Agent 的 body 为 `{ agentId }` |
| `POST /workspaces/:id/browser/tasks/:requestId` | 回传 Browser Tool 结果 |
| `POST /workspaces/:id/turns/clear` | 清空服务端历史对话 |
| `POST /workspaces/:id/turns/:turnId/suggestions/dismiss` | 持久化关闭某轮建议选项 |
| `GET /workspaces/:id/versions?pageSize=N&pageNum=N` | 查询版本快照元数据列表 |
| `GET /workspaces/:id/versions/:versionId` | 获取单个版本快照元数据 |
| `GET /workspaces/:id/versions/:versionId/files` | 获取版本快照文件列表 |

非默认 Agent 使用对应的 `/agents/:agentId/...` 路由。

## 场景一：浏览器打开，持锁，没有正在运行的 Agent

```mermaid
flowchart TD
    A["浏览器打开<br/>disabled = false"] --> B["GET /turns<br/>加载历史"]
    B --> C["GET /files<br/>获得 manifest 和 fileVersion"]
    C --> D["对 hash 不同的文件<br/>GET /files/content"]
    D --> E["GET /connect"]
    E -->|"204 No Content"| F["再 GET /turns<br/>关闭初始化期间的竞态"]
    F --> G["GET /files/changes<br/>sinceVersion = fileVersion"]
    G --> H["进入可对话状态"]
    H --> I["用户发送消息"]
    I --> J["POST /run<br/>开始消费 SSE"]
```

这里调用一次 `/connect`，用于确认刷新前是否已有 active turn。

`/connect` 返回 204 后再次拉取 turns 和文件增量，是为了处理下面的竞态：

```text
第一次 GET /turns 时 Agent 还在运行
→ 调用 /connect 前 Agent 恰好结束
→ /connect 返回 204
```

## 场景二：当前浏览器发起 run

```mermaid
flowchart TD
    A["POST /browser/connect<br/>登记 Browser Tool"] --> B["POST /run"]
    B --> C["消费 /run SSE"]
    C --> D{"收到事件"}

    D -->|"Agent 原生事件"| E["更新消息列表"]
    E --> D

    D -->|"workspace:file-change"| F["比较 event.data.version<br/>和本地 fileVersion"]
    F -->|"有新版本"| G["GET /files/changes"]
    G --> H["write: GET /files/content<br/>delete: 删除本地文件"]
    H --> I["更新 fileVersion"]
    I --> D

    D -->|"browser:task"| J["执行浏览器工具"]
    J --> K["POST /browser/tasks/:requestId"]
    K --> D

    D -->|"turn:complete / abort / error"| L["SSE 正常关闭"]
    L --> M["GET /turns<br/>校准最终历史"]
    M --> N["GET /files/changes<br/>执行文件收尾"]
```

正常终态后 SSE 关闭，不调用 `/connect`。

`POST /browser/connect` 是 Browser Tool 的尽力登记，不是 `/run` 的前置条件：登记失败会记录错误，但仍继续请求 `/run`，由服务端将 Browser Tool 视为不可用并自行降级。

### `/run` 返回 HTTP 错误

```mermaid
flowchart TD
    A["POST /run"] --> B{"HTTP 响应"}
    B -->|"2xx SSE"| C["正常消费事件"]
    B -->|"409"| D["显示服务端错误<br/>不调用 /connect"]
    B -->|"其他 4xx / 5xx"| E["显示服务端错误<br/>不调用 /connect"]
```

409 表示本次 run 没有创建成功，不能自动接管已有 turn。

### `/run` 发生网络断线

```mermaid
flowchart TD
    A["消费 /run SSE"] --> B{"连接如何结束"}
    B -->|"已收到 turn 终态"| C["正常结束<br/>不调用 /connect"]
    B -->|"用户主动关闭"| D["停止观察<br/>不调用 /connect"]
    B -->|"网络异常"| E["GET /connect"]
    B -->|"没有终态就 EOF"| E
    E -->|"SSE"| F["恢复当前 turn"]
    E -->|"204"| G["GET /turns + 文件增量<br/>确认任务是否已经结束"]
```

只有传输异常或没有终态的提前 EOF 才使用 `/connect` 恢复。

## 场景三：浏览器刷新，持锁，Agent 正在运行

```mermaid
flowchart TD
    A["浏览器刷新<br/>disabled = false"] --> B["GET /turns"]
    B --> C["GET /files<br/>记录 fileVersion"]
    C --> D["GET /connect"]
    D -->|"SSE"| E["从 turn 开始回放事件"]

    E --> F{"收到事件"}
    F -->|"Agent 原生事件"| G["恢复并实时更新消息"]
    G --> F

    F -->|"workspace:file-change"| H["GET /files/changes"]
    H --> I["更新本地文件和 fileVersion"]
    I --> F

    F -->|"browser:task"| J["服务端已过滤<br/>客户端不会收到"]

    F -->|"turn 终态"| K["connect SSE 关闭"]
    K --> L["GET /turns"]
    L --> M["GET /files/changes<br/>文件收尾"]
    M --> N["进入可对话状态"]
```

恢复已有 Agent 使用 `/connect`，不能使用 `/run`。

刷新后恢复的连接不执行 Browser Tool。服务端会过滤 `browser:task`，相关工具超时后按服务端策略降级。

## 场景四：浏览器打开，但未持锁

```mermaid
flowchart TD
    A["浏览器打开<br/>disabled = true"] --> B["GET /turns<br/>加载历史快照"]
    B --> C["GET /files<br/>获取文件快照"]
    C --> D["对 hash 不同的文件<br/>GET /files/content"]
    D --> E["显示只读内容"]

    E --> F["GET /connect 回放 turn 与文件变化"]
    E --> G["不调用 /run"]
    E --> H["不执行或回传 Browser Tool"]
```

未持锁时不能发起新的 `/run`，但 `/connect` 的回放及其中的文件变化仍会同步到当前浏览器；任何 `browser:task` 都不会由当前浏览器执行或回传。

## 场景五：锁状态发生变化

### 从未持锁变为持锁

```mermaid
flowchart TD
    A["disabled: true → false"] --> B["GET /turns"]
    B --> C["GET /files"]
    C --> D["GET /connect"]
    D -->|"204"| E["可以发起 run"]
    D -->|"SSE"| F["恢复正在运行的 Agent"]
```

### 从持锁变为未持锁

```mermaid
flowchart TD
    A["disabled: false → true"] --> B["保留或建立 /connect 回放"]
    B --> C["继续回放消息与文件变化"]
    B --> D["不再处理或回传 Browser Tool"]
    B --> E["不调用 /abort<br/>服务端 Agent 继续运行"]
```

关闭浏览器连接和中止服务端 Agent 是两个不同操作。只有用户明确点击停止时才调用 `/abort`。

## 文件变化处理

```mermaid
flowchart TD
    A["收到 workspace:file-change"] --> B{"event.version <= fileVersion?"}
    B -->|"是"| C["忽略回放或重复事件"]
    B -->|"否"| D["记录最高 targetVersion"]
    D --> E["GET /files/changes<br/>sinceVersion = fileVersion"]
    E --> F["应用 changes"]
    F --> G["fileVersion = currentVersion"]
    G --> H{"同步期间又收到更高版本?"}
    H -->|"是"| E
    H -->|"否"| I["结束本次同步"]
```

`workspace:file-change` 是唯一实时触发源，没有 `setInterval` 或固定频率轮询。

## Browser Tool 处理

只有未禁用的当前浏览器直接消费 `/run` 时处理：

```mermaid
sequenceDiagram
    participant S as Service
    participant H as HttpAgent
    participant T as Browser Tool

    S->>H: SSE browser:task
    H->>T: execute(name, input)
    T-->>H: output / metadata / error
    H->>S: POST /browser/tasks/:requestId
```

`/connect` 不处理 Browser Tool；即使服务端意外下发 `browser:task`，禁用态客户端也会在执行前和回传前分别拦截。

## History 对象接口

`HttpAgent.getHistory()` 对远程 Agent 不能返回 `null`。它至少要返回一个绑定当前 workspace / agent 的 history 对象，用来适配现有 `BoundHistory` 版本快照能力。

| history 方法 | 服务端接口 | 说明 |
|---|---|---|
| `listVersions(params?)` | `GET /workspaces/:id/versions?pageSize=N&pageNum=N` | 查询版本快照元数据列表；这是 history 对象的必备接口 |
| `addVersion(record, files)` | `POST /workspaces/:id/versions` | 浏览器端手动保存、初始化和回滚版本经 workspace 转交服务端 History |
| `getVersion(versionId)` | `GET /workspaces/:id/versions/:versionId` | 获取单个版本元数据，不含 files |
| `getVersionFiles(versionId)` | `GET /workspaces/:id/versions/:versionId/files` | 获取版本文件内容，用于查看或回滚 |
| `updateVersion(versionId, patch)` | `PATCH /workspaces/:id/versions/:versionId` | 更新版本摘要或文件补丁 |

这些 history 接口独立于本文的初始化、run、connect、文件变化和 Browser Tool 主流程；它们主要供版本面板、手动保存、回滚等外部调用方使用。remote Agent 的 AI 轮次版本由服务端 hooks 创建和更新，组件库的 `afterTurn` / `afterTurnSummary` 不会重复写入。

## 修改边界

本次实现涉及 `packages/plugin` 的 HTTP history 适配，以及服务端 workspace 的版本路由。

严格禁止修改：

- `packages/agent/src/agent.ts`

`HttpAgent` 通过 Plugin 层适配现有 `AgentEvents`、`HistoryManager` 和 `TurnRecord`，不能为了远程协议改变本地 Agent。
