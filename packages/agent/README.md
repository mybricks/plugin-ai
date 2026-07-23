<div align="center">

# Agent SDK

**面向浏览器与服务端的 AI Agent 框架**

一套可插拔的Agent底座，接入任意模型，配置提示词、装配不同能力，即可支撑对话、研究、代码、画布等各类智能体形态。

</div>

---

## 介绍

`@mybricks//agent` 把「一次 AI 任务」抽象为一个可流式消费的循环：模型思考 → 调用工具 → 观察结果 → 继续思考，直到任务完成。框架负责这套循环里所有繁琐但关键的工程细节——多步推理、上下文治理、流式输出、工具编排、历史恢复——你只需专注在**如何设计提示词、接入哪个模型、装配哪些能力**上。

框架提供两个底座：

- **基础 Agent** —— 通用运行时，不带任何内置工具，由你自由装配
- **CodeAgent** —— 在基础 Agent 之上预置了文件读写能力，面向基于文件系统的通用Agent

同一个底座，装配不同的工具、再用**提示词**赋予它角色与行为，就得到面向不同场景的智能体

| 底座 | 装配工具 | 提示词赋予 | 得到 |
| :-- | :-- | :-- | :-- |
| 基础 Agent | — | 对话人设与语气 | 客服、助手等**对话应用** |
| 基础 Agent | 联网搜索 + 知识库检索 | 研究员心智：先查证再作答 | 输出研究报告的**数据研究智能体** |
| CodeAgent | 文件操作 + 命令行 | 工程规范与改动纪律 | 重构、修 Bug 的**代码智能体** |
| CodeAgent | 文件操作 + 定制输出 | 界面产出约定 | 生产界面文件的**画布智能体** |

**特点**

- 🔌 **可插拔** —— 模型、工具、文件后端、提示词都能替换，无需 fork
- 🌐 **模型无关** —— 任何支持工具调用的 LLM 都能接入：OpenAI / Anthropic / 自建网关 / 本地模型
- ♾️ **同构** —— 同一套 API，浏览器与服务端都能运行
- 📦 **开箱即用** —— 默认值面向长任务调优，构造完即可运行

## 架构

<div align="center">

<svg viewBox="0 0 820 480" xmlns="http://www.w3.org/2000/svg" width="100%" style="max-width:820px;font-family:-apple-system,'PingFang SC','Segoe UI',sans-serif">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0,0 L10,5 L0,10 z" fill="#64748b"/>
    </marker>
  </defs>

  <rect x="0" y="0" width="820" height="480" fill="#0d1117" rx="14"/>

  <!-- 场景层 -->
  <text x="36" y="48" fill="#7d8590" font-size="12" font-weight="600" letter-spacing="1">场景</text>
  <g font-size="13" font-weight="600" text-anchor="middle">
    <rect x="36"  y="60" width="170" height="44" rx="9" fill="#1f2a44" stroke="#2f4374"/><text x="121" y="87" fill="#c9d7ff">对话应用</text>
    <rect x="222" y="60" width="170" height="44" rx="9" fill="#1f2a44" stroke="#2f4374"/><text x="307" y="87" fill="#c9d7ff">数据研究</text>
    <rect x="428" y="60" width="170" height="44" rx="9" fill="#173a34" stroke="#20544a"/><text x="513" y="87" fill="#a7f3d0">代码智能体</text>
    <rect x="614" y="60" width="170" height="44" rx="9" fill="#173a34" stroke="#20544a"/><text x="699" y="87" fill="#a7f3d0">画布智能体</text>
  </g>

  <!-- 底座层 -->
  <text x="36" y="160" fill="#7d8590" font-size="12" font-weight="600" letter-spacing="1">底座</text>
  <rect x="36" y="172" width="365" height="96" rx="11" fill="#161d2e" stroke="#2d3a55"/>
  <text x="56" y="200" fill="#c9d7ff" font-size="15" font-weight="700">基础 Agent</text>
  <text x="56" y="224" fill="#8b98b8" font-size="12">通用运行时 · 留白底座</text>
  <text x="56" y="246" fill="#7d8590" font-size="12">装配任意工具 + 接入模型</text>

  <rect x="419" y="172" width="365" height="96" rx="11" fill="#12241f" stroke="#20544a"/>
  <text x="439" y="200" fill="#a7f3d0" font-size="15" font-weight="700">CodeAgent</text>
  <text x="439" y="224" fill="#7fb8a6" font-size="12">继承基础 Agent · 预置文件读写</text>
  <text x="439" y="246" fill="#5f8f80" font-size="12">面向代码与文件产出</text>

  <!-- 运行时层 -->
  <text x="36" y="320" fill="#7d8590" font-size="12" font-weight="600" letter-spacing="1">运行时（两层共享）</text>
  <rect x="36" y="332" width="748" height="60" rx="11" fill="#131820" stroke="#21262d"/>
  <g text-anchor="middle">
    <text x="130" y="360" font-size="13" font-weight="600" fill="#e6b673">推理循环</text><text x="130" y="380" font-size="10.5" fill="#7d8590">多步 · 防死循环 · 自动重试</text>
    <text x="316" y="360" font-size="13" font-weight="600" fill="#e6b673">上下文治理</text><text x="316" y="380" font-size="10.5" fill="#7d8590">长对话自动压缩</text>
    <text x="502" y="360" font-size="13" font-weight="600" fill="#e6b673">流式输出</text><text x="502" y="380" font-size="10.5" fill="#7d8590">边想边说 · 断线可续</text>
    <text x="688" y="360" font-size="13" font-weight="600" fill="#e6b673">历史恢复</text><text x="688" y="380" font-size="10.5" fill="#7d8590">跨会话续写</text>
  </g>

  <!-- 模型层 -->
  <text x="36" y="428" fill="#7d8590" font-size="12" font-weight="600" letter-spacing="1">模型</text>
  <rect x="36" y="440" width="748" height="26" rx="8" fill="#191a2e" stroke="#2d2f52"/>
  <text x="410" y="458" text-anchor="middle" font-size="12" fill="#b8c1f0">OpenAI · Anthropic · 自建网关 · 本地模型</text>

  <!-- 连线 -->
  <g stroke="#3d4757" stroke-width="1.5">
    <line x1="121" y1="104" x2="200" y2="172" marker-end="url(#arr)"/>
    <line x1="307" y1="104" x2="235" y2="172" marker-end="url(#arr)"/>
    <line x1="513" y1="104" x2="585" y2="172" marker-end="url(#arr)"/>
    <line x1="699" y1="104" x2="620" y2="172" marker-end="url(#arr)"/>
  </g>
</svg>

</div>

## 提示词设计

<div align="center">

<svg viewBox="0 0 760 470" xmlns="http://www.w3.org/2000/svg" width="100%" style="max-width:760px;font-family:-apple-system,'PingFang SC','Segoe UI',sans-serif">
  <rect x="0" y="0" width="760" height="470" fill="#0d1117" rx="14"/>

  <text x="40" y="42" fill="#e6edf3" font-size="16" font-weight="700">一次请求的消息栈</text>
  <text x="40" y="64" fill="#7d8590" font-size="12">自上而下按顺序拼装，绿色徽标表示该层可自由注入</text>

  <!-- 图例 -->
  <rect x="600" y="30" width="120" height="24" rx="6" fill="#12261c" stroke="#20543a"/>
  <circle cx="616" cy="42" r="4" fill="#3fb950"/>
  <text x="628" y="46" fill="#7ee787" font-size="11">可注入 / 可改写</text>

  <g font-size="13">
    <!-- system -->
    <rect x="40" y="84" width="680" height="42" rx="9" fill="#1f2a44" stroke="#2f4374"/>
    <circle cx="60" cy="105" r="4" fill="#3fb950"/>
    <text x="76" y="102" fill="#c9d7ff" font-weight="600">系统提示词</text>
    <text x="76" y="118" fill="#8b98b8" font-size="11">内置人设 + 你追加的 system，可微调可覆盖</text>

    <!-- agentsMd -->
    <rect x="40" y="134" width="680" height="42" rx="9" fill="#1c2333" stroke="#2d3a55"/>
    <circle cx="60" cy="155" r="4" fill="#3fb950"/>
    <text x="76" y="152" fill="#c9d7ff" font-weight="600">项目规则</text>
    <text x="76" y="168" fill="#8b98b8" font-size="11">团队约定 / 领域知识，作为背景注入</text>

    <!-- 动态上下文 -->
    <rect x="40" y="184" width="680" height="42" rx="9" fill="#1c2333" stroke="#2d3a55"/>
    <circle cx="60" cy="205" r="4" fill="#3fb950"/>
    <text x="76" y="202" fill="#c9d7ff" font-weight="600">动态背景上下文</text>
    <text x="76" y="218" fill="#8b98b8" font-size="11">每轮实时计算：当前选中、环境状态、按模式切换的引导语</text>

    <!-- compact + 历史 -->
    <rect x="40" y="234" width="680" height="42" rx="9" fill="#161d2e" stroke="#21262d"/>
    <text x="60" y="252" fill="#8b98b8" font-weight="600">摘要 + 历史对话</text>
    <text x="60" y="268" fill="#6e7681" font-size="11">框架自动维护：长对话压缩、跨会话恢复</text>

    <!-- 用户自定义上下文 -->
    <rect x="40" y="284" width="680" height="42" rx="9" fill="#1c2333" stroke="#2d3a55"/>
    <circle cx="60" cy="305" r="4" fill="#3fb950"/>
    <text x="76" y="302" fill="#c9d7ff" font-weight="600">临时上下文</text>
    <text x="76" y="318" fill="#8b98b8" font-size="11">本次请求附带的参考资料、附件说明</text>

    <!-- 当前消息 -->
    <rect x="40" y="334" width="680" height="42" rx="9" fill="#173a34" stroke="#20544a"/>
    <circle cx="60" cy="355" r="4" fill="#3fb950"/>
    <text x="76" y="352" fill="#a7f3d0" font-weight="600">当前用户消息</text>
    <text x="76" y="368" fill="#7fb8a6" font-size="11">这一轮真正要问的话，可在发送前二次加工</text>

    <!-- tail -->
    <rect x="40" y="384" width="680" height="42" rx="9" fill="#131820" stroke="#21262d"/>
    <text x="60" y="402" fill="#8b98b8" font-weight="600">本轮工具往返</text>
    <text x="60" y="418" fill="#6e7681" font-size="11">框架自动累积：模型的每次工具调用与结果</text>
  </g>

  <text x="40" y="452" fill="#7d8590" font-size="11">→ 发送给模型</text>
</svg>

</div>

## 快速开始

安装：

```bash
npm install @mybricks/agent
```

所有 API 从子路径 `@mybricks/agent` 导入。

### 在浏览器中运行

无需任何后端即可跑起一个完整的代码智能体：

```ts
import { CodeAgent, IDBSandbox, Tools } from "@mybricks/agent";
import type { RemoteProviderConfig } from "@mybricks/agent";

const openai: RemoteProviderConfig = {
  providerId: "openai",
  format: "openai",
  baseUrl: "https://api.openai.com/v1",
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  models: [{ id: "gpt-4o", name: "GPT-4o" }],
};

const agent = new CodeAgent({
  key: "my-agent",
  sandbox: new IDBSandbox({
    key: "my-agent",
    initialFiles: [
      { path: "README.md", content: "# Hello" },
      { path: "src/index.ts", content: "console.log('hi');" },
    ],
  }),
  llm: { providers: [openai] },
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

const anthropic: RemoteProviderConfig = {
  providerId: "anthropic",
  format: "anthropic",
  baseUrl: "https://api.anthropic.com/v1",
  apiKey: process.env.ANTHROPIC_API_KEY!,
  models: [{ id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" }],
};

const agent = new CodeAgent({
  key: "server-agent",
  sandbox: nodeSandbox,
  llm: { providers: [anthropic] },
  system: "你是一个谨慎的代码助手，改动前先读取确认。",
});

await agent.requestAI({ message: "给所有 .ts 文件补上类型注解" });
```

## 对接三方 API

模型对接统一走 `llm.providers`，两种方式：

**直连供应商** —— 对接 OpenAI / Anthropic 兼容接口，框架自动拼装端点：

```ts
const openai: RemoteProviderConfig = {
  providerId: "openai",
  format: "openai",          // 或 "anthropic"
  baseUrl: "https://api.openai.com/v1",
  apiKey: process.env.OPENAI_API_KEY!,
  models: [{ id: "gpt-4o", name: "GPT-4o" }],
};

new CodeAgent({ llm: { providers: [openai] } });
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
  llm: { providers: [openai] },
});
```

### 模式切换

框架内置 `build`（直接执行）与 `plan`（先出方案再执行）两种模式，支持定制拓展。

### 更多扩展

- **Skills** —— 可复用技能包，模型按需加载，不占用常驻上下文
- **SubAgents** —— 委派任务给拥有独立上下文的子智能体
- **Plugins** —— 把 Skills / SubAgents / 工具打包成可开关的插件
