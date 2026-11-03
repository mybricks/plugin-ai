# Plugin AI MCP bridge

通用 Node.js HTTP 模块，不启动服务器。调用方必须通过现有 HTTP 服务的统一入口分发请求及 upgrade。验证阶段可省略 token；无 token 时只接受直接来自本机回环地址的连接。

```js
import { createServer } from 'node:http';
import { createPluginAiMcp } from '@mybricks/plugin-ai-mcp';

const mcp = createPluginAiMcp({
  target: "codex", // 当前唯一实现的客户端出口
  allowedOrigins: ['http://127.0.0.1:5200'],
});
const server = createServer((req, res) => {
  if (mcp.handleRequest(req, res)) return;
  res.writeHead(404).end();
});
server.on('upgrade', (req, socket, head) => {
  if (!mcp.handleUpgrade(req, socket, head)) socket.destroy();
});
server.listen(5200, '127.0.0.1');
server.on('close', () => mcp.close());
```

`handleRequest` 和 `handleUpgrade` 返回是否接管，必须由宿主的统一路由调用；不要假设 EventEmitter 监听器返回值能阻止其他监听器执行。`allowedOrigins` 必填；`token` 可选。省略 token 时仅接受本机回环连接；配置 token 时 HTTP 使用 bearer token，浏览器 WebSocket 通过第一条消息认证。允许多个浏览器连接；当前只允许一个活动工作区。

浏览器端为 `pluginAI({ mcp: { bridgeUrl, tools } })`，`tools` 是显式白名单。它会在设计器调用 `connectToAI` 且本地 CodeAgent 准备好后注册实际工具，复用其 VFS、校验和执行实现。需要内部 Agent 上下文或 UI 交互的工具不能简单放入白名单。关闭页面会断开连接；首次发现工具之前先打开设计器。

## Showcase 本地试用

```bash
npm install --prefix packages/mcp
npm run dev:showcase
```

访问终端显示的本地地址，选择「MCP 测试」，输入工作区 ID 并保持设计器打开。启动终端会输出 MCP 地址；端口冲突时可用 `SHOWCASE_PORT=5201 npm run dev:showcase`。

在终端注册 MCP 地址（地址按实际端口替换）：

```bash
codex mcp add mybricks --url http://127.0.0.1:5200/__plugin-ai/mcp
codex
```

若 Codex 先于设计器完成工具发现，重新连接 MCP 客户端。可以要求 Codex 先列出并进入工作区，读取 `plugin-ai://overview`，再按需读取 `plugin-ai://development-guide` 和总纲中列出的 Skill。

## 出口、Skills 和开发规范

`src/index.js` 提供共享的 HTTP、浏览器桥接和工作区生命周期；`src/targets/` 存放客户端出口配置，目前实现 `codex`。后续可以增加 Claude Code 等经过验证的出口，而不重复实现公共服务。

- 当前 Node 模块提供 Codex 出口：Streamable HTTP、MCP tools、`resources/list` 和 `resources/read`。简短 server instructions 引导客户端先读取总览；具体规范与 Skill 不塞入 system prompt。
- `plugin-ai://overview` 是当前资源总览，包含开发指南地址、Skill 名称、描述、适用场景和激活方式。
- `plugin-ai://development-guide` 从 PluginAI 的 `promptSections`、开发与设计规则及设计器有效类库生成。它不包含 CodeAgent 自身的 system prompt。
- `plugin-ai://skills/<skill-name>/SKILL.md` 是 Skill 正文，同目录下的其他文件分别作为 Resource 提供。包含用户注入和已解析插件的 Skill；动态内容在读取时更新。禁用的 Skill 不对外暴露，仅限手动调用的 Skill 在总览中标明。
- Resource 是按需读取的内容，不会自动成为 Codex 的原生 Skill 或 system prompt。Codex 是否按指引主动读取取决于客户端版本与会话；需要更确定的行为时，可在项目 `AGENTS.md` 或用户指令中要求先读取总览。
- 当前不支持 MCP Prompt、Resource 订阅/变更推送；资源列表和内容在请求时重新生成。浏览器未连接时读取不可用。工具输出目前映射为文本，不包含附件或自定义卡片。

## 工作区流程

每项任务依次调用 `list_workspaces`、`enter_workspace`（传 `workspaceId`；同名实例须附 `browserId`），读取 `plugin-ai://overview`，再按总纲读取开发规范及相关 Skill，并使用工作区工具。结束后调用 `exit_workspace`。进入后必须先成功读取总纲，工作区工具与其他 Resource 才会开放；退出或浏览器断线会清除绑定。Showcase 会显示工作区被进入、退出及最近一次操作。

当前本地验证版的绑定由 Node 进程共享，不区分多个 Codex 客户端；同时使用多个客户端时，后进入的工作区会替换先前绑定。工具/资源目录在连接或绑定发生变化后可能需要客户端刷新。
