# Codex harness 接入探索

> 状态：探索中（未实现）
> 最后更新：2026-10-22
> Owner：待定

本文记录在 `plugin-ai` 中引入可切换 harness、并评估 Codex SDK 作为其中一个 harness 的讨论结论。它是持续演进的设计记录；「已确认」和「待验证」必须严格区分。

## 1. Codex 的参考运行架构

先从 Codex 的架构出发，而不是把它等同为另一个模型 provider。

```text
┌─────────────────── plugin-ai 后端 / Node worker ───────────────────┐
│                                                                      │
│  @openai/codex-sdk                                                   │
│       │  启动、续跑 thread；读取结构化 stream                         │
│       ▼                                                              │
│  Codex runtime（本机进程 / CLI runtime）                             │
│       ├────────► Code Mode host / 模型服务                            │
│       ├────────► OS 文件系统、shell、sandbox、审批策略                │
│       ├────────► thread rollout / 会话持久化 / 认证状态               │
│       └────────► MCP、内建工具与文件变更事件                          │
│                                                                      │
│  [可选的深度客户端协议]                                               │
│  Codex app-server ─────► JSON-RPC client / dynamic tools / 审批 UI   │
└──────────────────────────────────────────────────────────────────────┘
```

这里有四个架构事实会决定后续方案：

1. **SDK 是 runtime 的控制面，不是普通 HTTP 模型客户端。** 它管理 thread 和 turn，并从 runtime 取得 agent 级事件；模型请求、文件读写、命令和审批最终由 runtime 处理。
2. **运行时沙箱和文件系统是独立能力域。** sandbox 决定命令、网络与可写范围；filesystem 决定 runtime 实际可见的文件、路径和变更。app-server 的 v2 filesystem API 使用绝对路径；浏览器的 IndexedDB 不是 runtime 天然可见的工作区。
3. **深度客户端能力在 app-server。** 它能承载审批、流式事件、thread/history 和 experimental dynamic tools；SDK 的公共能力面是否涵盖同样的工具注入，必须按锁定版本验证。
4. **运行时部署与应用部署绑定。** 无论 runtime 被 npm 依赖自动带入、显式安装，还是由指定路径提供，它都会在运行 worker 的主机上以本地进程形式存在；不能直接进入浏览器包。

上图中 runtime 的实际分发方式、进程生命周期和是否存在官方 virtual filesystem mount，仍是本文 R1–R3 的待确认项。

## 2. plugin-ai 的目标方案：在产品层切换 harness

我们的目标不是把 `CodeAgent` 重写成 Codex，也不是让 Codex 接管整个前端。目标是让产品层有统一的 harness 入口，同时保持现有 MyBricks 行为不变：

```text
plugin-ai Chat UI
      │  { conversationId, harnessId, message }
      ▼
HarnessRouter  ─── 统一的 UI event、产品权限、会话索引与上下文快照
  ├─ MyBricksHarness ──> 现有 CodeAgent
  │       ├─ plugin-ai Tool
  │       └─ IDBSandbox / 当前 History
  │
  └─ CodexHarness ─────> Codex SDK → Codex runtime
          ├─ 原生工作区 / Codex sandbox
          ├─ Codex thread
          └─ （后续）Tool Bridge 或 Workspace Mirror
```

换言之，统一的是**产品 facade**，而不是强行统一两个 runtime 的内部协议。

### 2.1 能力在哪一层：Markdown 架构主视图

```text
┌────────────────────────────── 产品层：plugin-ai ─────────────────────────────┐
│ Chat UI · harness selector · conversationId · 统一 event · 产品审批 / 审计     │
│                                │                                                │
│                         HarnessRouter                                             │
│          规范化上下文快照 · session 映射 · 取消 · 配置路由                       │
└───────────────────────┬──────────────────────────────┬────────────────────────┘
                        │                              │
          ┌─────────────▼─────────────┐  ┌─────────────▼─────────────┐
          │ MyBricksHarness            │  │ CodexHarness（新增 adapter）│
          │ CodeAgent / Agent           │  │ config / event / thread adapter│
          ├───────────────────────────┤  ├───────────────────────────┤
          │ Prompt：system、模板、模式 │  │ Prompt：上下文快照 → Codex │
          │ agents.md、attachment ctx  │  │ instructions / AGENTS.md   │
          │ Skills：SkillFile/use_skill│  │ Skills：Codex skill 语义   │
          │ Tools：JS Tool + hooks     │  │ Tools：内建/MCP/dynamic*   │
          │ History：TurnRecord/compact│  │ History：Codex thread       │
          │ LLM：request/llm.providers │  │ LLM：SDK → runtime config  │
          │ FS：IDBSandbox/virtual file│  │ FS：尚无直接 IDB 映射       │
          │ Sandbox：AgentSandbox      │  │ Sandbox：尚无等价映射       │
          └─────────────┬─────────────┘  └─────────────┬─────────────┘
                        │                              │
                        │                 ┌────────────▼─────────────────────────┐
                        │                 │ Codex runtime（Node/OS 进程）         │
                        │                 │ OS workspace · filesystem · sandbox   │
                        │                 │ shell/network/approval · MCP · model  │
                        │                 └──────────────────────────────────────┘

* dynamic tools 是 app-server 的 experimental 能力；是否可用于目标 SDK 版本须验证。
```

| 能力域 | plugin-ai 的真实归属 | Codex 侧的真实归属 | `HarnessRouter` 能统一什么 | 完整对标的缺口 |
| --- | --- | --- | --- | --- |
| Skill | `CodeAgent` 的 `SkillFile`、资源挂载、`use_skill` | Codex instructions / skill discovery | 配置入口、能力开关、产品展示 | 格式、加载触发、权限、工具可见性和生命周期是否一致 |
| agents.md / AGENTS.md | `CodeAgent` 在 stable context 中扫描并注入 `agents.md` | Codex runtime 的项目 instructions / `AGENTS.md` | 项目规则的产品配置与上下文快照 | 查找路径、层级、覆盖顺序和“规则是否可改变权限” |
| Tools | `Tool.execute()`、hooks、tool UI、`AgentSandbox` | runtime 内建工具、MCP、app-server dynamic tools | UI 卡片、审计 envelope、产品审批入口 | JS 闭包、hook、取消、结构化结果及审批无法直接传入 SDK |
| 提示词配置 | system、`promptOptions`、workflow、mode、模板、动态 context | Codex config、项目 instructions、turn input | 统一“产品级” prompt 配置模型 | 注入位置、优先级和缓存/历史交互不等价 |
| 历史记录 | `HistoryManager`、`TurnRecord`、compact、handoff | Codex thread / rollout / session | `conversationId ↔ harness session/thread` 索引 | 原始消息、reasoning、tool calls、compact 不可直接互放 |
| LLM 接入 | `request`、`llm.providers`、provider/model 选择 | SDK → Codex runtime → 模型/认证/配置 | 统一模型选择 UI 与 `harnessId` | provider endpoint/key 语义不等于 runtime/auth 语义 |
| 运行时沙箱 | `AgentSandbox`、工具权限、allowed commands | Codex sandbox、approval policy、网络/命令策略 | 更严格的产品策略、审计和默认值 | 两侧权限粒度、继承、拒绝和升权流程需实测 |
| 文件系统 | `IDBSandbox`、virtual files、统一文件模型 | OS absolute-path workspace、文件变更事件 | 工作区选择、diff/审批/回滚 UX | 无原生 IDB VFS；需 Browser Tool Bridge 或 Workspace Mirror |

这张表是本项目判断“完整对标”时的唯一基线：任何一项仅有名称映射、但执行语义或安全边界不一致，都只能标为“部分兼容”，不能标为“完整支持”。

### 2.2 完整对标的能力清单

「能发起 Codex 对话」不等于「完整对标 plugin-ai」。完整对标至少需要下列八个能力域同时成立：

1. Skill：发现、按需加载、权限、生命周期与可观测性。
2. Agent instructions：`agents.md` / `AGENTS.md` 的查找范围、优先级、注入时机与覆盖规则。
3. Tools：schema、执行、hook、流式进度、取消、审批、结构化结果与工具 UI。
4. 提示词配置：system、workflow、模式提示词、动态上下文与模板的叠加顺序。
5. 历史记录：多轮上下文、压缩、持久化、恢复、审计和跨 harness 切换。
6. LLM 接入：模型选择、认证、base URL、provider fallback、用量与错误语义。
7. **运行时沙箱**：读/写/执行/网络权限、审批策略、目录白名单，以及产品策略与 runtime 策略的收敛。
8. **文件系统**：真实/虚拟工作区、文件监听、diff、路径权限、并发写入、回滚和文件真相源。

### 2.3 对标实现矩阵

| 产品能力 | 现有 MyBricks 实现 | Codex 架构中的对应物 | 我们的目标实现 | 结论 |
| --- | --- | --- | --- | --- |
| 发起一轮对话 | `Agent.requestAI()` | SDK `thread.runStreamed()` / turn | `Harness.run()` | 可统一 |
| 文本/状态流 | `llm:*`、`turn:*` events | streamed thread / item events | 事件 adapter | 可统一，字段需映射 |
| 工具执行 | `Tool.execute()` + hooks | 内建工具、MCP、dynamic tools | 先观察；后续 Tool Bridge | 不直接兼容 |
| 运行时沙箱 | `AgentSandbox` 权限、allowed commands、工具执行边界 | Codex sandbox、approval policy、网络/命令策略 | 双层策略映射与更严格取交集 | 语义待验证 |
| 文件系统 | `IDBSandbox`、virtual files、统一文件模型 | runtime 的 OS absolute-path workspace、文件变更事件 | Browser Tool Bridge 或 Workspace Mirror | 不直接兼容 |
| 模型配置 | `llm.providers` | runtime model / config / auth | 独立 `harness.type = "codex"` 映射 | 不共享 provider 路由 |
| 对话续跑 | `HistoryManager` / `TurnRecord` | Codex thread + rollout/session | `HarnessSession` 映射 | 可统一产品索引，不共享原始历史 |
| 权限与审批 | plugin-ai tool policy | runtime sandbox / approval policy | 产品策略 + runtime 策略双层收敛 | 需明确优先级 |
| skills / sub-agent | CodeAgent plugins | Codex skills、AGENTS.md、MCP 等 | 逐项映射，不做自动兼容 | 后续评估 |

### 2.4 可以先承诺的兼容面

- 聊天 UI、harness selector、流式回答、错误展示、取消按钮和产品侧的会话列表。
- 统一的 `HarnessSession` 索引：一个 `conversationId` 可关联多种 harness 的独立 session/thread。
- 现有 MyBricks harness 的配置和行为保持不变。
- Codex 的模型、工作目录、sandbox、审批等配置以 `plugin-ai` 的 `harness` 配置分支表达。

### 2.5 不能假装兼容的面

- `plugin-ai` 的 JS `Tool.execute()` 不能直接传给 Codex SDK。
- `IDBSandbox` 不能直接作为 Codex runtime 的本地文件系统；它也不自动继承为 Codex sandbox 的路径权限或网络策略。
- `AgentSandbox` 与 Codex sandbox 的权限、审批和网络语义尚未证明等价，不能只把名称映射后就视作安全兼容。
- `TurnRecord`、compact、reasoning 与 tool-call 历史不能在两个 runtime 间原样重放。
- `llm.providers` 的 endpoint/key 语义不应隐式变成 Codex 的认证或配置。

## 目标与边界

目标：在一次对话中选择不同的 agent harness，同时仍以 `plugin-ai` 的配置、聊天 UI、历史、工具模型和权限模型为产品入口。

当前不做的事情：

- 不替换既有 `CodeAgent`；它仍是默认且完全兼容的 harness。
- 不把 Codex SDK 当成普通 LLM provider；它是本地 agent runtime 的封装，语义包含线程、文件系统、沙箱和审批。
- 不要求最终用户全局安装 `codex` 命令。
- 不承诺把已有 `TurnRecord` 或 tool-call 历史原样交给另一种 harness 重放。

## 商业协议与部署合规评估

> **不是法律意见。** 本章用于产品、采购、安全与法务共同做 go/no-go 决策；在签约、上线或向客户承诺能力前，须由适用法域的法务确认 OpenAI 的现行条款、客户合同、数据处理协议（如适用）与开源许可证义务。最后复核：2026-10-22。

商业可用性不能只看 SDK 是否能跑。它至少由四份“协议”共同决定：本地 runtime/SDK 的开源许可证、OpenAI 服务与认证条款、我们与客户的产品合同、以及客户代码和数据的授权边界。

### 商业部署模式：初步判断

| 模式 | 认证与运行方式 | OpenAI Docs 能确认的事实 | 当前商业判断 | 上线前必须关闭的事项 |
| --- | --- | --- | --- | --- |
| 内部开发/CI worker | 后端 worker 使用 `CODEX_API_KEY` 调用 SDK | 官方文档将 API key 列为 SDK 与自动化的支持方式，并建议仅在单次调用环境中注入密钥。 | **可作为优先评估路径**；仍需合同和安全审批。 | API 合同主体、预算/限额、密钥隔离、数据分类、日志保留。 |
| B2B 单租户私有部署 | 客户控制的 worker + 客户自己的 API key/身份 | SDK 在服务端运行；API key 适合自动化。 | **风险较低的候选**，因为凭证、代码和工作区可由客户隔离。 | 客户授权、部署责任矩阵、更新/漏洞责任、出口网络限制。 |
| 我方托管多租户 SaaS | 我方 worker 代表多个客户运行 Codex | SDK 可用于服务端自动化；官方定价将 API key 用于共享自动化环境。 | **需要专项商业与安全评审**，不能由 SDK 可用性推出已获授权。 | 租户隔离、每租户身份/额度、数据处理与跨境、审计、删除与事故责任。 |
| app-server + ChatGPT 认证用于托管商业服务 | 我方托管 app-server 并代客户维护 ChatGPT 登录 | 官方 app-server 文档明确写明：其 authentication 从未获准用于 commercial 或 hosted services；为此类场景推出了 Sign in with ChatGPT，并要求走相应合作/接入路径。 | **不得将现有 app-server auth 作为商业托管方案上线。** | 若确需该模式，先取得 OpenAI 对适用商业集成路径的书面确认。 |
| 最终用户本地运行 | runtime 随桌面/本地产品分发；用户或企业自行认证 | 本地 SDK/runtime 的确切分发、升级与许可义务仍待 R1 验证。 | **可研究，不先承诺。** | 二进制分发许可、平台支持、客户机密钥、升级机制、终端安全与遥测。 |

上述 app-server 判断应以 [官方 app-server 文档](https://learn.chatgpt.com/docs/app-server) 为准；SDK/自动化与 API key 的支持范围以 [官方 Codex SDK 文档](https://learn.chatgpt.com/docs/codex-sdk) 和 [非交互式认证指南](https://learn.chatgpt.com/docs/non-interactive-mode) 为准。OpenAI 的当前定价也将 API key 列为 Codex SDK 与脚本化自动化的适用选项，但 API 计费与 ChatGPT 订阅额度是不同体系，不能混用预算假设。[定价说明](https://learn.chatgpt.com/docs/pricing)

### 协议与责任清单

| 协议层 | 要评估的问题 | 目前不能自行假定的结论 | 责任 owner / 退出标准 |
| --- | --- | --- | --- |
| 开源许可证与供应链 | SDK、Codex runtime、平台二进制、MCP server 及其传递依赖分别采用何许可证？分发时是否要附 NOTICE、源码或许可证文本？ | “开源”不自动等于可无条件嵌入、转售或省略 notice。 | 法务 + OSS 审查：锁定版本的 SBOM、许可证扫描和分发义务清单均通过。 |
| OpenAI 服务协议 | 账户主体是谁？使用 API key、ChatGPT 认证还是合作集成？是否允许预期的托管/转售/嵌入模式？ | ChatGPT 个人或团队订阅不当然等于可供 SaaS 客户共享的后端额度。 | 商务/法务：书面确认服务条款、订购单及适用使用政策覆盖目标模式。 |
| 数据处理与保密 | 哪些代码、提示词、文件、工具结果、日志会离开客户环境？是否包含个人数据、源代码、密钥或受监管数据？ | 本地 runtime 不等于数据不出境；模型服务、遥测、MCP 和日志均可能形成数据流。 | 隐私/安全：完成数据流图、DPA/跨境评估、保留/删除策略与客户告知。 |
| 认证与密钥 | API key、ChatGPT token、客户 token 谁持有？是否会被仓库代码、工具输出、日志或子进程继承？ | 任何 job-level 或共享的密钥注入都不是安全默认值。 | 安全：短生命周期或可轮换密钥、单次调用注入、secret scan、无跨租户环境继承。 |
| 客户授权与工具风险 | 客户是否有权让 agent 读取、修改、执行、联网、调用第三方工具或处理所选工作区？ | 用户点击“运行”不自动覆盖代码所有权、第三方仓库、生产系统或连接器的授权。 | 产品/法务：客户条款、可见审批、作用域提示、审计记录与可撤销授权已定义。 |
| 输出、变更与支持 | 谁复核 agent 生成的代码/命令？失败或错误变更如何回滚？SLA、赔偿、责任限制如何表达？ | Agent 输出不能被包装为无需审查的保证性结果。 | 产品/法务/支持：human-review、rollback、免责声明、事件响应与支持边界写入合同和 UI。 |

### 与技术架构的直接对应关系

| 技术层 | 商业/协议影响 | 应落实的控制 |
| --- | --- | --- |
| `CodexHarness` / runtime worker | 运行地点、账户主体、API 计费、OS 权限与代码数据暴露面 | 每租户/每客户隔离 worker 或强隔离 profile；资源、网络和审计边界。 |
| runtime sandbox | 是否能读写客户代码、运行命令、访问网络和泄露 secrets | 默认 `read-only`；显式升权；目录与网络 allowlist；命令/工具审批记录。 |
| 文件系统与 `IDBSandbox` bridge | 文件真相、上传/同步范围、回写责任与删除能力 | 明确同步清单；只传必要文件；diff/审批/回滚；会话结束清理镜像。 |
| JS Tool / MCP bridge | 第三方系统访问、OAuth/密钥、工具副作用与审计 | 工具级授权、最小 scope、destructive action confirmation、工具供应链审查。 |
| History、thread、日志 | 对话、代码片段、工具输出和凭证是否留存 | 数据分类、脱敏、最短保留、按租户删除、导出与审计策略。 |
| Prompt、skills、AGENTS.md | 指令是否被客户代码注入或改变权限/数据边界 | 将不可信仓库文本与受信产品策略隔离；系统级权限不可被项目 instructions 覆盖。 |

### 商业 Go/No-Go 门槛

在任一商业试点对外开放前，以下条件全部满足：

1. **认证路径已批准**：不使用 app-server authentication 作为托管商业服务认证；API key 或获批准的商业登录/合作路径有书面确认。
2. **许可证已锁定**：runtime、SDK、平台二进制及 MCP/桥接依赖形成 SBOM，并完成 OSS/notice 审查。
3. **数据流可说明**：从浏览器/IDBSandbox 到 worker、runtime、模型服务、MCP 和日志的流向已画出；机密代码和个人数据的处理依据已获批准。
4. **最小权限可执行**：sandbox、filesystem、网络、工具和审批策略均能按租户落地；默认拒绝写入、执行和开放网络。
5. **客户控制可见**：用户可理解并控制工作区范围、写入、命令、外部工具和会话历史；变更具备 diff、审批、撤销或回滚路径。
6. **责任边界已落文**：客户授权、人工复核、输出限制、支持、事件响应、数据删除和费用承担均进入产品条款/合同。

### 新增商业待确认项

| 编号 | 待确认项 | 关闭条件 |
| --- | --- | --- |
| B1 | 锁定版本的 Codex SDK/runtime/平台二进制及全部 bridge/MCP 依赖的许可证和 NOTICE 义务。 | 生成 SBOM；法务批准分发与归档方案。 |
| B2 | 目标商业模式（内部、私有部署或托管 SaaS）与 OpenAI 当前服务/认证条款的匹配。 | 商务与法务记录使用的账户、认证模式、计费主体和书面依据。 |
| B3 | 客户代码、提示词、日志和工具结果的数据流、保留、删除、区域与第三方处理方。 | 完成 DPIA/安全评审（按适用要求）及客户告知。 |
| B4 | 运行时 sandbox、文件镜像、MCP 与工具副作用的责任与审批模型。 | 完成威胁建模、默认策略、审计/回滚和渗透/滥用测试。 |
| B5 | 客户合同中对 agent 输出、代码修改、授权、费用、支持与事故响应的约定。 | 法务批准对外条款和企业客户补充条款。 |

## 现有实现的相关事实

`packages/agent/src/agent.ts` 已有相对清晰的循环和 UI 事件边界：`AgentOptions.request` 提供流式模型请求；`Agent` 负责历史、ReAct 循环、工具执行、重试、compact 和 `llm:*` / `tool:*` / `turn:*` 事件。`CodeAgent` 在此之上增加文件工具、skills、sub-agent 和 sandbox。

这意味着「模型提供商」已有抽象，但「完整 harness」还没有：后者必须同时回答线程、工具、文件、审批和事件如何处理。

## Codex SDK：运行时模型

### 官方公开文档已确认

- TypeScript SDK 的入口是 `@openai/codex-sdk`，运行于 Node.js 18+ 的服务端；`runStreamed()` 能产出流式 agent、工具调用和文件变更事件。[官方 SDK 文档](https://learn.chatgpt.com/docs/codex-sdk)
- TypeScript library 用于启动、续跑与恢复本地 Codex thread；服务端调用是其支持范围。[官方 SDK 文档](https://learn.chatgpt.com/docs/codex-sdk)
- app-server 是本地 JSON-RPC 服务。v2 文件系统 API 的输入为绝对路径，而非抽象的 virtual filesystem。[官方 app-server 文档](https://learn.chatgpt.com/docs/app-server)
- `dynamicTools` 是 app-server `thread/start` 的 experimental 字段；它不能据此推断 TypeScript SDK 已公开相同的 API。

### 当前实现观察（不能视为稳定产品契约）

- 当前开源 TypeScript SDK 源码显示：SDK 会启动 `@openai/codex` runtime 子进程并经 JSONL 通信；SDK 的公开 `ThreadOptions` 包含工作目录、sandbox、审批策略等，但没有公开 JS dynamic-tool 注册项。
- 当前源码亦显示 thread 可被恢复。这说明我们必须设计 conversation 与 external thread 的映射；但 session 的落盘位置、隔离方式和生命周期仍需以锁定版本实测为准。

上述观察很容易随版本变化，因此不将「SDK 自动安装哪个 runtime」「runtime 一定落在 `node_modules`」「JS tools 一定无法通过 SDK 接入」写成既定结论。

## 阻塞性待确认事项

以下问题不解决，不进入正式接入；它们比 UI 和 router 更优先。

| 编号 | 待确认问题 | 当前证据 / 假设 | 必须得到的结论 | 验证方式 | 影响 |
| --- | --- | --- | --- | --- | --- |
| R1 | TypeScript SDK 的 runtime 从哪里解析？ | 当前源码会解析并启动本机 Codex runtime；官方文档只承诺安装 SDK。 | 是否必须显式安装 `@openai/codex`；是否包含平台二进制；是否会读取全局 PATH；是否支持锁定版本。 | 在无全局 `codex` 的干净容器中安装并运行；分别测试仅 SDK、SDK + runtime、跳过 optional deps。 | 部署与供应链 |
| R2 | SDK 与 Codex runtime 的进程/协议边界是什么？ | 当前源码观察为 Node 子进程 + JSONL。 | 是否每个 turn/每条 thread 启动进程、能否复用、取消是否杀进程、退出码及异常怎样传播。 | 记录 P0 的 PID、输入输出、abort 与 crash 行为；固定 SDK/runtime 版本。 | 资源、可靠性、隔离 |
| R3 | runtime 是否只接受本机真实文件？ | app-server FS API 接收绝对路径；尚未证明 SDK 或 runtime 可挂载虚拟 FS。 | 是否存在官方 VFS/remote FS mount；若没有，能否禁用内建文件工具并仅使用 dynamic tools。 | 搜索锁定版本的 schema/CLI help；以无真实项目文件的 fixture 运行读文件任务。 | `IDBSandbox` 可行性 |
| R4 | 不修改 runtime 时，`IDBSandbox` 如何成为文件真相源？ | 浏览器 IndexedDB 不能被 Node/OS 进程直接访问。 | 选择 Browser Tool Bridge、Workspace Mirror，或明确不支持。 | 用 `read_file` / `write_file` 双向案例验证；测试断线、冲突、取消和路径逃逸。 | 数据一致性、安全 |
| R5 | JS `Tool` 是否可保留原语义？ | app-server 有 experimental dynamic tools；TypeScript SDK 暂未确认公开入口。 | 选定 SDK 事件适配、app-server dynamic tools 或 MCP bridge；能传 JSON Schema、返回结构化结果、执行取消和审批。 | 单工具 Spike：一个纯函数工具 + 一个文件工具，覆盖成功、超时、拒绝、abort。 | 插件兼容性 |
| R6 | runtime/thread 的数据落盘与认证边界是什么？ | 可恢复 thread 暗示有持久化状态。 | session/凭证是否能限制在租户或 worker；是否可禁用或清理；重启后能否安全恢复。 | 单独用户/项目 profile 的隔离测试；检查磁盘写入与环境变量。 | 多租户与合规 |
| R7 | app-server 是否可作为产品运行时依赖？ | 官方将其标为 experimental，并提示面向本地开发/调试。 | 它是否可接受为 feature-flag 实验依赖，或必须只做 SDK POC。 | 固定版本、schema generation、升级 smoke test。 | 生产决策 |

> 决策门槛：R1–R4 未关闭前，不能宣称支持 Codex + IDBSandbox；R5 未关闭前，不能宣称现有 plugin-ai JS Tools 可复用。

### 部署前置检查（R1 的一部分）

在目标 Node 环境而非开发机上执行以下检查：

```bash
npm ls @openai/codex-sdk @openai/codex
node -e 'console.log(require.resolve("@openai/codex/package.json"))'
```

该检查只用于确认当前锁定版本的实际行为，不能替代干净环境测试。不要依赖开发机的全局 `codex`；若 runtime 依赖 optional dependencies，还必须覆盖跳过它们时的失败路径。

## app-server 是什么

app-server 是 Codex runtime 的 JSON-RPC 服务接口，用于构建完整客户端：认证、线程历史、审批、流式事件，以及动态工具回调。它不是 OpenAI 提供的公共托管 SaaS，也不是旧 `codex mcp-server` 的替代品。[官方 app-server 文档](https://learn.chatgpt.com/docs/app-server)

它同样需要一个实际运行中的 Codex runtime。若采用它，用户仍无需安装客户端；但 runtime 如何被分发、启动和升级，仍由 R1/R2 的实测结论决定。

结论：

- **最小 SDK POC**：优先用 `runStreamed()`，不手动接 app-server。
- **要把现有 JS Tool 作为 Codex 可调用工具**：app-server dynamic tools 是候选路径，不是已确认方案；必须先关闭 R5。

## 兼容性判断

| `plugin-ai` 能力 | 直接兼容 | 适配路径 | 当前结论 |
| --- | --- | --- | --- |
| `llm.providers` / `providerId` | 否 | 单独新增 `harness: codex` 配置分支 | 不混用 endpoint/key 路由语义 |
| 模型、工作目录、沙箱、审批 | 部分 | 映射至 Codex thread / SDK config | POC 可做 |
| 纯文本、最终回答、stream 事件 | 部分 | `runStreamed()` → 统一事件 | POC 可做 |
| `Tool` 的 schema/description | 未确认 | app-server dynamic tools 或 MCP bridge | R5 |
| `Tool.execute()` 闭包与 hooks | 未确认 | 在 bridge 中回调原 `execute()` | R5 |
| `IDBSandbox` | 未确认 | 浏览器工具桥或工作区镜像 | R3 / R4；不应在 POC 假装原生支持 |
| `TurnRecord` / compact / 历史重放 | 否 | 每个 harness 独立 session；切换时导出规范化上下文 | 需要设计 |
| CodeAgent skills / subAgents | 否 | 分别映射到 Codex 的 AGENTS.md、skills 或工具 | 后续评估 |

## 详细接入边界

建议首先只增加 router 和 Codex adapter，不改变 `Agent` / `CodeAgent` 的内部循环。等两个 harness 经过对比验证后，再判断是否应抽取公共 `Harness` 接口。

### 建议的配置形状

```ts
type HarnessConfig =
  | {
      type: "mybricks";
      providerId: string;
      modelId: string;
    }
  | {
      type: "codex";
      modelId?: string;
      workingDirectory: string;
      sandboxMode?: "read-only" | "workspace-write" | "danger-full-access";
      approvalPolicy?: "never" | "on-request" | "on-failure" | "untrusted";
      config?: Record<string, unknown>;
      configOverrides?: string[];
    };

type PluginAIConfig = {
  defaultHarnessId: string;
  harnesses: Record<string, HarnessConfig>;
};
```

`llm.providers` 保留给现有 MyBricks/OpenAI-compatible 路由；不要把其 API key、base URL 或 provider 协议隐式套到 Codex runtime。Codex 的认证和受管配置应由其独立环境配置处理。

## 对话与切换规则

不要跨 harness 共用底层原始 history。建议保存：

```ts
type HarnessSession = {
  conversationId: string;
  harnessId: string;
  externalThreadId?: string; // Codex thread id
  createdAt: number;
  lastActiveAt: number;
};
```

切换时：

1. 原 harness 会话保留，可切回。
2. 新 harness 建立独立会话。
3. 向新会话注入**规范化上下文快照**：用户可见历史摘要、当前文件/选区、系统约束、当前模式。
4. 不注入内部 reasoning、旧 harness 的原始 tool-call 序列，或不可验证的 compact 内容。

## JS Tool 与 IDBSandbox 的后续路径

### JS Tool：候选桥接方案（均待 R5 验证）

1. **app-server dynamic tools（优先研究）**：将 Tool 的 `name`、`description`、JSON Schema 转换为 Codex dynamic tool；收到调用后，由 bridge 调用既有 `tool.execute(args, ctx)`，再将 `ToolResult` 返回。
2. **MCP bridge**：将一组稳定的 plugin-ai tools 封装为 MCP server，供 Codex 配置连接。适合跨进程复用，但闭包、浏览器会话和 UI 回调仍需自建桥接。

两种方案均不等价于“传入一个 JS 函数”。它们需要稳定 RPC 边界、调用超时、取消传播、参数校验、权限与审批归属。

### IDBSandbox：当前仅能确认“不应假设原生兼容”

Codex runtime 看到的是宿主机真实文件系统；浏览器的 IndexedDB 无法被它直接读取。两个可选方向：

1. **Browser Tool Bridge**：让 Codex 仅通过经 RPC 暴露的 `read_file`、`write_file`、`grep`、`list_files` 操作 IDBSandbox。权限和文件真相仍留在浏览器。适合低代码编辑器。
2. **Workspace Mirror**：每轮将 IDBSandbox materialize 到会话专属目录，让 Codex 原生读写；结束时读取 diff 并以可回滚方式应用回 IDB。必须处理冲突、路径逃逸、二进制内容和原子回写。

第一阶段只做只读快照或真实工作目录；在 R3/R4 关闭前，不要宣称支持 IDBSandbox，也不要把 mirror 当成 VFS mount。

## 最小实验计划

### P0：runtime 架构与文件边界验证（无产品改动）

- 在干净 Node 环境中执行三组安装矩阵：仅 SDK、SDK + 显式 runtime、SDK + 跳过 optional dependencies；宿主机不得存在全局 `codex`。
- 记录实际解析的 executable 路径、子进程数、环境变量、thread/session 落盘位置与 `runStreamed()` 原始事件。
- 使用 `read-only` 与临时 Git 仓库验证真实文件读取；再用没有项目文件的 fixture 验证是否存在 VFS/remote-FS 配置入口。
- 中止运行和故意杀死 runtime，验证取消与错误边界。
- **通过条件**：对 R1、R2 有可复现结论；R3 至少得到“存在官方挂载机制”或“无挂载机制”的证据。P0 不以完成产品功能为目标。

### P1：`packages/codex-harness`（不接 UI）

- 仅当 R1/R2 通过后创建 package；新 package 只导出 `CodexHarness` 与配置转换函数，禁止浏览器入口引用 SDK。
- 持久化 `conversationId → Codex threadId`。
- 将 `runStreamed()` 的最小事件映射为内部统一 event：文本 delta、状态、错误、文件变更摘要。
- 先禁止 workspace write 和 shell；只验证聊天、分析、线程续跑。

### P2：灰度接入 Chat UI

- 在 feature flag 下提供 harness selector。
- 每个 turn 保存真实使用的 `harnessId` 和外部 thread id。
- 首次切换用规范化上下文快照创建会话；切回恢复原会话。
- 不在这一阶段接 JS Tool 或 IDBSandbox。

### P3：工具与虚拟文件系统实验

- 仅当 R3/R5 的 Spike 需要时，单独验证 app-server dynamic-tool 能否覆盖一个 `read_file` 及一个 `write_file`。
- 设计 Browser Tool Bridge 的协议、身份绑定、审批与取消。
- 独立实现 Workspace Mirror proof-of-concept，比较它与 bridge 的行为、延迟和冲突率。

## 验收用例

| 用例 | P0 | P1 | P2 | P3 |
| --- | ---: | ---: | ---: | ---: |
| 运行时无需全局安装 | ✓ | ✓ | ✓ | ✓ |
| 同一 Codex thread 连续两轮 | ✓ | ✓ | ✓ | ✓ |
| UI 流式输出 |  | ✓ | ✓ | ✓ |
| native/Codex harness 切换与切回 |  |  | ✓ | ✓ |
| `read_file` 访问 IDBSandbox |  |  |  | ✓ |
| `write_file` 可取消、可审计、可回滚 |  |  |  | ✓ |
| 多个浏览器会话不串文件 |  |  |  | ✓ |

## 主要风险

- runtime 的分发与本地文件系统能力仍是待验证前提；在 R1/R3 关闭前，不可把它打入浏览器同构包或承诺 IDB 直挂。
- 对话切换若错误复用内部历史，会导致工具协议和上下文语义损坏。
- Codex 原生写文件与 IDBSandbox 同时写入会产生冲突；必须只有一个明确的文件真相源。
- app-server 的 dynamic tools 属于更深、且具有实验性质的集成面；生产采用前需做版本锁定和兼容性测试。
- Codex 认证、权限、数据保留和运行成本必须由服务端部署模型明确承担，不能从 `llm.providers` 隐式继承。

## 开放问题

- Codex harness 是用户自带运行环境，还是 plugin-ai 托管的 agent worker？
- 目标环境是否允许部署原生平台二进制和持久化 Codex session？
- 需要支持哪些既有 tools：仅文件工具，还是业务工具、MCP、sub-agent 都要？
- 低代码工程的文件真相源是否永远是 IDBSandbox？是否存在可 materialize 的服务端工作区？
- 如何定义跨 harness 的上下文快照格式、长度预算和隐私边界？
- 是否需要把 `HarnessRouter` 公开为 `@mybricks/agent` 的正式 API？

## 变更记录

- 2026-10-22：创建文档。记录 Codex harness、app-server、JS Tool 与 IDBSandbox 的初步方向。
- 2026-10-22：重构为“已确认 / 当前源码观察 / 阻塞性待确认事项”。不再把 runtime 分发、SDK↔runtime 协议、VFS 挂载或 JS Tool 兼容性视为既定事实；新增 R1–R7 及可复现验证计划。
- 2026-10-22：新增“商业协议与部署合规评估”。区分开源供应链、OpenAI 服务与认证、数据处理、客户授权和产品责任；新增 B1–B5 商业 Go/No-Go 项。
- 2026-10-22：移除独立 HTML 架构图；在 Markdown 顶部增加能力归属主视图和逐域对标表，作为唯一架构基线。
