# Remote Agent 版本的设计器 dump 补写

状态：已按以下约定实现首版，尚需联调。本文以 `vibe-design` 的灵创存储链路为主要例子，其他应用和存储类型需要分别确认。

首版实现选择：通过 `session:released` 可选字段传递 `version.id` 和 `workspaceVersion`；仅直接消费 `/run` 的 HttpAgent 接收，重放不补发；HttpAgent 等待文件同步到目标版本或更高版本，再调用可选的 `remoteAgent.onVersionSaved`。website 负责生成 dump 并直接请求 `aicode-service`。未传回调、无法完成同步和错误均跳过。补写仅支持 Blob AI 版本，要求当前认证用户是该版本创建者；服务端按 contentUrl 条件更新，避免覆盖其他 Blob 写入。

## 已确认的要求

- 只要本次客户端收到了用于触发补写的事件，且应用提供 dump 能力，就尝试补写；允许事件未送达或 dump 遗漏。当前采用 `session:released`，由直接消费 `/run` 的客户端处理。
- 允许读取到旧 dump；当前核心目标是同步文件，不要求 dump 与文件始终严格一致。
- 允许采集或补写失败，不向用户提示，不影响原有交互。
- dump 尚未采集或上传时，允许开始下一轮。

## 背景与目标

开启 remoteAgent 后，AI 在 `aicode-agents` 执行并更新 workspace 文件。回合结束后，服务端创建 AI 版本；设计器 dump 则来自浏览器，服务端当前无法直接调用设计器的序列化能力。结果是 AI 版本中的 files 已更新，而 dump 仍继承上一条内容，二者可能不一致。

目标是在不阻塞 Agent 回合和版本保存的前提下，将客户端生成的 dump 补写到**对应的 AI 版本**，保留该版本已有的文件、版本记录和消息关联。未提供 dump 能力的应用继续沿用当前行为。

## 当前实现

1. `AgentTurnRunner` 的服务端 `afterTurn` 启动版本任务。`addAgentVersion` 检查该 turn 是否记录了文件操作：有则获取 workspace 文件快照并创建 AI 版本，无则跳过；这里不按 turn 的 success、abort 或 error 筛选。
2. Agent 正常走到成功、中止或错误出口时会调用 `afterTurn`。中止或失败之前如果已有文件变更，也会尝试保存版本。进程崩溃、收尾被异常中断、保存失败等情形不保证版本落库。
3. 灵创 `save-agent-version` 用当前 files 新建内容记录，dump 从上一条内容继承；内容快照通过 Blob 存储。`VersionService.save` 在远端写入后还会同步 VFS，后一步失败时存在远端已写入的窗口。
4. 成功 turn 的 `turn:settled` 在版本任务和其他后置任务结束后发出；abort/error 不发 `turn:settled`。`turn:complete` 早于后置处理完成，不能视作版本已创建。
5. `/run` SSE 在成功时等待 `turn:settled` 和 `session:released`；中止或失败时等待释放后结束。两个事件的先后顺序不固定。服务端释放 session 锁前会等待版本任务。
6. HttpAgent 收到 `workspace:file-change` 后异步同步文件，并不等待同步完成才处理后续事件。现有 `FileHmr.syncChanges(targetVersion)` 在未初始化等情况下可能直接返回，不能仅以 Promise 完成证明设计器已经应用了指定快照。
7. website 的 `getDumpWithIcons()` 调用 `designer.dump()` 并补充图标状态；其他页面还有字体等扩展数据。应用已具备生成完整 dump 的业务逻辑。
8. 当前源码版本对比读取版本 files，不读取 dump。回滚实现也主要应用文件差异。设计器初始化则会读取最新 content 的 dump，因此 files 与 dump 的一致性仍然重要。

主要代码：

- `src/modules/agents/agent-turn-runner.ts`：版本任务、文件变更和 turn 事件。
- `src/common/sse/sse-stream.ts`：SSE 收口条件。
- `src/modules/workspace/versions/version.service.ts`：远端版本写入与 VFS 同步。
- `aicode-service/src/modules/mybricks/agent-version.service.ts`：AI 版本继承 dump 和 Blob 写入。
- `plugin-ai/packages/plugin/src/ui/chat/chat-panel/remote/http-agent.ts`：turn 事件、客户端 hooks 和文件同步。
- `aicode-frontend/packages/website/src/pages/vibe-design/inner.tsx`：设计器 dump、附加状态和保存。

## 实现方案：版本创建后异步补写

```text
Agent 结束 -> 服务端保存 AI 版本（files + 继承的 dump）
           -> 服务端通知客户端版本标识和文件快照标识
           -> HttpAgent 等待本地文件同步到该版本或更高版本
           -> 调用应用可选的 onVersionSaved 回调
           -> 应用生成并异步提交 dump，服务端补写指定版本
```

### 版本通知

通知至少需要 `turnId`、`versionId` 和用于确认文件一致性的 workspace 快照版本或等价标识；若已有可用的 contentId，也可一并返回。只有能明确确认目标版本已保存时才携带版本标识；无文件变更、版本写入失败时不得伪造版本成功信号。

首版扩展 `session:released`，覆盖正常收尾的成功、中止和失败出口。连接中断、重放，以及写入已成功但 VFS 同步失败等窗口允许遗漏。

仅给既有事件增加可选字段，不应改变原有关闭条件。新增事件的写入和发送有自身开销；无论选哪种通知，都不要等待客户端补写完成后再释放锁或关闭 SSE。

### 应用提供 dump，HttpAgent 负责协调

通过 `remoteAgent.onVersionSaved?: ({ turnId, versionId }) => Promise<void>` 注入可选回调。website 在回调中生成 dump、补充图标和字体等状态，并直接请求 `aicode-service`；HttpAgent 不内置设计器和业务接口。

- 未传回调、没有版本通知：跳过补写，不等待，也不影响原有版本保存。
- 回调返回空值、抛错，或上传失败：记录诊断信息，不向用户提示；不改变 turn 状态或阻塞原有 hooks、SSE、锁释放。允许遗漏，不要求可靠重试。
- 当前仅直接消费 `/run` 的连接处理该事件；HttpAgent 用内存中的版本 ID 集合去重，不承诺跨页面重启的持久化去重。服务端用 contentUrl 条件更新避免覆盖并发变更，但不提供持久化幂等键。

### 文件与 dump 一致性

不能仅依赖收到 `turn:complete`、`turn:settled`、latestContent 变化或固定延时推断文件已同步。HttpAgent 等待 workspace 文件同步到目标版本或更高版本后触发应用回调；下一轮开始和更高版本文件同步不阻止补写，因此 dump 可以包含比目标版本更新的文件。无法完成同步或设计器未初始化时允许遗漏，不因此阻止下一轮。

`workspaceVersion` 不代表设计器其他状态的版本。服务端保存的 files 是权威版本文件；补写不提交或覆盖这些 files。dump 内嵌文件可能较旧或较新，作为文件回退来源时需接受这一限制。

#### 文件同步开销与边界

- 目标版本已同步且没有进行中的同步时，主要是内存版本判断和异步调用，不额外请求文件。
- 目标版本未到达且已有同步任务时，`syncChanges` 返回已有 `syncPromise`，不会并行启动另一个同步任务；但目标版本在同步期间提高时，同一任务可能多次请求增量，因此不保证只有一次 HTTP 请求。
- 没有进行中任务且版本落后时，会发起增量同步；需要时下载变化的文件，服务端要求快照时可能重新同步快照。
- 当前实现是尽力触发：未绑定或未初始化、同步失败、目标版本未到达，或等待结束时还有其他同步任务进行，都会跳过回调。若旧任务结束时排入新的同步任务，`runAtVersion` 不继续等待它。跳过后不重试，允许遗漏。
- 等待与回调均不阻塞 session 释放、SSE 收尾或下一轮。dump 生成、序列化及上传由应用执行，开销独立于文件同步；尚无实际耗时数据。

### 补写接口与并发

应用调用 `aicode-service` 的 `POST /api/mybricks/update-dump-by-version`；请求通过 `conversationId + versionId` 定位版本，携带设计器 dump。接口校验认证身份和版本创建者，不要求 turnId；事件中的 turnId 仍可供客户端关联回合。

当前 Blob 版本读取目标快照、用新 dump 合并原 files、上传新 Blob，再使用原 contentUrl 条件更新该条记录的引用。更新只修改 contentUrl，不覆盖 `versionRecord`、summary 和消息关联；`aicode-agents` 的摘要更新也只更新 summary 字段。重复提交若遇到内容引用变化则失败，不覆盖新引用。不可把“最新 content”当作目标版本。

补写存在最终一致窗口：版本创建后到补写完成前，读取该版本可能看到旧 dump，这符合已确认要求。即使针对旧版本补写成功，如果已有更新的 content，最新内容仍可能继承的是旧 dump；也不能把旧版本 dump 盲目写进新版本。失败、关闭页面和下一轮并发造成的遗漏均可接受。

### 与 hook、事件的关系

- 保持现有服务端 `afterTurn`、摘要、`turn:settled` 和 `session:released` 的职责与等待关系。
- dump 采集和 HTTP 上传独立于原有 turn 收尾执行；不要求 SSE 保持打开至上传完成。
- 客户端 `afterTurn` 在当前 `/run` 路径会等 `session:released` 后执行；不要假设其与 `turn:settled` 总有固定先后顺序。
- 事件接收、文件同步、采集和提交需要去重与错误处理；观察不同出口及重连时机，不能依赖单一客户端的内存状态保证最终成功。

## 不推荐：服务端等待客户端 dump 后再保存

可以借鉴 browser task 的请求、响应和超时方式，在创建版本前等待客户端提供 dump，超时再保存。但这会延长版本任务；现有代码在释放 session 锁前等待该任务，成功 turn 的 `turn:settled` 和 SSE 收口也会随之推迟。浏览器断线、未提供能力的应用和超时都需要额外处理；现有 browser task 还要求连接处于 running 状态，不保证可以直接在 turn 收尾阶段复用。因此当前更倾向于异步补写。

## 当前范围与待验证事项

首版接入 website 的做页面和设计类页面；其他应用不传 `onVersionSaved` 时不补写。事件采用 `session:released`，应用直接调用 `aicode-service`。剩余重点是验证跨仓库联调和文件同步的并发边界。

说明：此前提到的“恢复目标”指两种不同操作：重新打开页面时用最新 content 的 dump 初始化设计器，以及从历史版本回滚。目前已核实的回滚链路主要恢复 files，不应假定它会按历史 dump 恢复画布。用户已明确核心目标是同步文件，允许旧 dump；无需将历史 dump 的严格恢复作为本方案前提。

## 联调验证

- 三种 turn 出口、有/无文件变更、远端写入失败以及写入成功后 VFS 同步失败。
- `session:released`、`turn:settled` 的先后顺序、SSE 关闭和重连重放；通知与版本标识的可靠关联。
- 文件同步屏障在初始化、增量同步失败、版本已超前、下一轮开始和设计器卸载时的行为。
- Blob 补写与摘要更新、手动保存、重复提交并发时不丢失 files 或元数据；验证权限与幂等。
- 补写前后刷新、版本列表与 files diff；补写失败、浏览器断线和应用未传回调时的表现。
