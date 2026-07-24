<div align="center">

# Agent SDK

**浏览器与服务端同构的 AI Agent 框架**

一套可插拔的Agent SDK，提供了`不带任何工具能力的底层基础Agent` 以及 `包含文件系统、命令行实现的CodeAgent`

支持接入`任意模型`，`配置提示词`、`添加不同拓展`，演化成对话、研究、代码、画布等各类智能体形态。

</div>

---

## 介绍

`@mybricks/agent` 把「一次 AI 任务」抽象为一个可流式消费的循环：模型思考 → 调用工具 → 观察结果 → 继续思考，直到任务完成。框架负责这套循环里所有繁琐但关键的工程细节——多步推理、上下文治理、流式输出、工具编排、历史恢复——你只需专注在**如何设计提示词、接入哪个模型、装配哪些拓展能力**上。

基于一个**基础 Agent / CodeAgent **，装配不同的工具、再用**提示词**赋予它角色与行为，就得到面向不同场景的智能体

| 智能体 | 人设 / 流程 | 拓展 |
| :-- | :-- | :-- |
| **数据研究** | 研究人设 | web_search、论文工具、探索 subAgent |
| **Code 编程** | 编程人设 + 编程流程 | 文件系统、命令行、搜索 subAgent、review subAgent |
| **画布智能体** | 画布设定 + DSL 约定 | 文件系统、命令行、DSL 操作工具 |
| **自定义智能体** | 你的提示词 | 工具、skill、subAgent |

**特点**

- 🔌 **可插拔** —— 模型、工具、文件后端、提示词都能替换，无需 fork
- 🌐 **模型无关** —— 任何支持工具调用的 LLM 都能接入：OpenAI / Anthropic / 自建网关 / 本地模型
- ♾️ **同构** —— 同一套 API，浏览器与服务端都能运行
- 📦 **开箱即用** —— 默认值面向长任务调优，构造完即可运行

## 架构

<div align="center">

<img src="./packages/agent/assets/architecture.svg" alt="架构：模型 / 拓展 / SDK / 封装 / 智能体" width="100%" />

</div>

## 提示词管理

<div align="center">

<img src="./packages/agent/assets/prompt-stack.svg" alt="提示词管理：提示词的组织结构" width="100%" />

</div>

## 快速开始

### 在浏览器中运行

无需任何后端即可跑起一个完整的代码智能体：

```ts
import { CodeAgent, IDBSandbox, Tools } from "@mybricks/agent";
import type { RemoteProviderConfig } from "@mybricks/agent";

const openrouter: RemoteProviderConfig = {
  providerId: "openrouter",
  format: "openai",
  baseUrl: "https://openrouter.ai/api/v1",
  apiKey: import.meta.env.VITE_OPENROUTER_API_KEY,
  models: [{ id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" }],
};

const agent = new CodeAgent({
  key: "my-agent",
  sandbox: new IDBSandbox({ key: "my-agent" }),
  llm: { providers: [openrouter] },
  tools: [Tools.createWebFetch()], // 可选：联网能力
});

// 流式渲染
agent.events.on("llm:content", (e) => appendToUI(e.delta));
agent.events.on("turn:complete", () => console.log("done"));

await agent.requestAI({ message: "给 index.ts 加上类型注解" });
```

### 在服务端运行

```ts
import { CodeAgent } from "@mybricks/agent";
import type { Sandbox, UnifiedFile, RemoteProviderConfig } from "@mybricks/agent";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const nodeSandbox: Sandbox = {
  async getFiles() {
    const walk = async (dir: string, acc: UnifiedFile[] = []): Promise<UnifiedFile[]> => {
      for (const e of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) await walk(full, acc);
        else acc.push({ path: path.relative(ROOT, full), content: await fs.readFile(full, "utf8") });
      }
      return acc;
    };
    return walk(ROOT);
  },
  async updateFiles(files) {
    await Promise.all(files.map(async (f) => {
      const full = path.join(ROOT, f.path);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, f.content, "utf8");
    }));
  },
  async deleteFiles(ps) {
    await Promise.all(ps.map((p) => fs.rm(path.join(ROOT, p), { force: true })));
  },
};

const openrouter: RemoteProviderConfig = {
  providerId: "openrouter",
  format: "openai",
  baseUrl: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY!,
  models: [{ id: "deepseek/deepseek-chat-v3-0324", name: "DeepSeek V3" }],
};

const agent = new CodeAgent({
  key: "server-agent",
  sandbox: nodeSandbox,
  llm: { providers: [openrouter] },
  system: "你是一个谨慎的代码助手，改动前先读取确认。",
});

await agent.requestAI({ message: "给所有 .ts 文件补上类型注解" });
```

## 安装

> **npm 包暂未发布**，目前可通过以下方式接入：

**源码引用**（推荐，支持 Tree-shaking）：

```bash
# 克隆仓库后作为 workspace 依赖引入
git clone https://github.com/mybricks/plugin-ai.git
```

```jsonc
// package.json
{
  "dependencies": {
    "@mybricks/agent": "file:../plugin-ai/packages/agent"
  }
}
```

所有 API 从 `@mybricks/agent` 导入，TypeScript 开箱即用。

**UMD 打包**（适用于浏览器 `<script>` 引入）：

```bash
# 构建 UMD 产物
npm run build
# 产物位于 packages/plugin/dist/index.umd.js
```

```html
<script src="node_modules/react/umd/react.production.min.js"></script>
<script src="node_modules/react-dom/umd/react-dom.production.min.js"></script>
<script src="node_modules/antd/dist/antd.min.js"></script>
<script src="packages/plugin/dist/index.umd.js"></script>
<script>
  const { CodeAgent, IDBSandbox, Tools } = MyBricksPluginAI;
  // 即可使用 ...
</script>
```

## 对接三方 API

模型对接统一走 `llm.providers`，两种方式：

**直连供应商** —— 对接 OpenAI / Anthropic 兼容接口，框架自动拼装端点。以 [OpenRouter](https://openrouter.ai) 为例，一个端点即可访问数百个模型：

```ts
const openrouter: RemoteProviderConfig = {
  providerId: "openrouter",
  format: "openai",                // 或 "anthropic"
  baseUrl: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY!,
  models: [{ id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" }],
};

new CodeAgent({ llm: { providers: [openrouter] } });
```

**自定义网关** —— 把请求委托给你自己的函数，适用于自建路由、私有化部署或本地模型：

```ts
const provider: CustomProviderConfig = {
  providerId: "auto",
  models: [{ id: "auto", name: "智能选择" }],
  request: myGateway,   // RequestAsStreamFn：接管请求并回吐流式增量
};
```

发起请求时也可指定单次使用的模型：`agent.requestAI({ message, providerId, modelId })`。

## 拓展

### 自定义工具

实现 `Tool` 接口并通过 `tools` 注入，即可被模型调用。这是把基础 Agent 拓展成研究、业务等各类智能体的主要方式：

```ts
import type { Tool } from "@mybricks/agent";
import { ToolValidationError } from "@mybricks/agent";

const searchTool: Tool = {
  name: "search_kb",
  title: "知识库检索",
  description: "在企业知识库中检索相关内容",
  parameters: {
    type: "object",
    properties: { query: { type: "string", description: "检索关键词" } },
    required: ["query"],
  },
  validate(p) {
    if (!p.query) throw new ToolValidationError("query is required");
  },
  async execute(p) {
    const docs = await kb.search(p.query);
    return { output: docs.map((d) => d.text).join("\n"), metadata: { count: docs.length } };
  },
};

// 基础 Agent + 联网 + 知识库 = 数据研究智能体
new Agent({
  system: "你是一名研究员，先检索事实再作答，最终输出结构化报告。",
  tools: [searchTool, Tools.createWebFetch()],
  llm: { providers: [openrouter] },
});
```

### 模式切换

框架内置 `build`（直接执行）与 `plan`（先出方案再执行）两种模式，支持定制拓展。

### 更多扩展

- **Skills** —— 可复用技能包，模型按需加载，不占用常驻上下文
- **SubAgents** —— 委派任务给拥有独立上下文的子智能体
- **Plugins** —— 把 Skills / SubAgents / 工具打包成可开关的插件

> 当前文档仅为基础版本使用，更多拓展能力（提示词配置、Skill 配置、SubAgent 编排等）文档建设中，如有需要欢迎联系我们一起共建。
