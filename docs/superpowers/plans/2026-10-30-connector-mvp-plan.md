# Connector MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hard-coded, frontend-only connector capability to `@mybricks/plugin-ai` so the low-code page generator can reuse existing OA-style HTTP endpoints by emitting `fetch`-based data calls into the generated page DSL.

**Architecture:** Introduce a small `connectors/` module inside `packages/plugin-lowcode`. A hard-coded registry describes one connector (OA) with its interfaces. A prompt helper injects those interfaces into the page-generation subAgent's system prompt. The runtime exposes a thin `connectorRuntime.call()` wrapper around `fetch`, and the generated page embeds connector call expressions that execute at runtime. The first milestone is read-only, static, and direct-fetch; no backend gateway, no auth, no CORS handling.

**Tech Stack:** TypeScript, React, existing `@mybricks/agent`/`@mybricks/plugin-ai` packages, no new dependencies.

---

## File Map

| File | Responsibility |
|------|----------------|
| `packages/plugin-lowcode/src/connectors/registry.ts` | Hard-coded connector/interface metadata. |
| `packages/plugin-lowcode/src/connectors/types.ts` | Shared TypeScript interfaces for connectors. |
| `packages/plugin-lowcode/src/connectors/prompt.ts` | Renders registry metadata as text for LLM prompts. |
| `packages/plugin-lowcode/src/connectors/runtime.ts` | Minimal frontend `fetch` wrapper `connectorRuntime.call()`. |
| `packages/plugin-lowcode/src/connectors/index.ts` | Public exports for the connectors module. |
| `packages/plugin-lowcode/src/tools/update-page/prompt.ts` | Receives connector section and appends it to the page-generation system prompt. |
| `packages/plugin-lowcode/src/tools/update-page/run.ts` | Passes connector prompt section into the subAgent. |
| `packages/plugin-lowcode/src/index.tsx` | Builds connector prompt section from registry and passes it into `lowCodePromptOptions` / tool options. |
| `packages/plugin-lowcode/src/tools/types.ts` | Adds optional `connectorPrompt` to `LowCodeToolOptions`. |
| `packages/plugin-lowcode/src/tools/index.ts` | Forwards `connectorPrompt` to `createLowCodeGeneratePageTool`. |
| `packages/plugin-lowcode/src/tools/update-page/index.ts` | Forwards `connectorPrompt` to `runUpdatePageTask`. |

---

## Task 1: Define Connector Types and Hard-Coded Registry

**Files:**
- Create: `packages/plugin-lowcode/src/connectors/types.ts`
- Create: `packages/plugin-lowcode/src/connectors/registry.ts`
- Create: `packages/plugin-lowcode/src/connectors/index.ts`
- Modify: `packages/plugin-lowcode/src/connectors/index.ts` (export types/registry after creation)

- [ ] **Step 1: Write connector types**

Create `packages/plugin-lowcode/src/connectors/types.ts` with these interfaces:

```ts
export interface ConnectorInterface {
  /** Unique interface id within the connector. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Natural-language description used by the model to decide when to use it. */
  description: string;
  /** HTTP method. */
  method: "GET" | "POST";
  /** URL path appended to the connector baseUrl. */
  path: string;
  /** Query/body parameters. */
  parameters: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
  }>;
  /** Example response body for the model to understand field shape. */
  responseExample: unknown;
}

export interface Connector {
  /** Unique connector id. */
  id: string;
  /** Human-readable connector name. */
  name: string;
  /** Natural-language description of the target system. */
  description: string;
  /** Base URL for all connector interfaces. */
  baseUrl: string;
  /** Interfaces exposed by this connector. */
  interfaces: ConnectorInterface[];
}
```

- [ ] **Step 2: Write hard-coded OA registry**

Create `packages/plugin-lowcode/src/connectors/registry.ts`:

```ts
import type { Connector } from "./types";

export const connectors: Connector[] = [
  {
    id: "oa-connector",
    name: "OA 办公平台",
    description: "企业 OA 系统，提供待办、已办、审批、组织架构等只读接口。",
    baseUrl: "https://oa.example.com/api",
    interfaces: [
      {
        id: "todo-list",
        name: "查询待办列表",
        description: "查询当前用户的待办事项列表，适用于首页待办卡片、待办看板等场景。",
        method: "GET",
        path: "/todo/list",
        parameters: [
          { name: "pageSize", type: "number", description: "每页条数，默认 10", required: false },
          { name: "pageNum", type: "number", description: "页码，从 1 开始", required: false },
        ],
        responseExample: {
          code: 0,
          data: {
            list: [
              { id: "1", title: "请假审批", applicant: "张三", status: "pending", createTime: "2026-10-30T10:00:00Z" },
            ],
            total: 1,
          },
        },
      },
      {
        id: "done-list",
        name: "查询已办列表",
        description: "查询当前用户已处理的事项列表。",
        method: "GET",
        path: "/done/list",
        parameters: [
          { name: "pageSize", type: "number", description: "每页条数，默认 10", required: false },
          { name: "pageNum", type: "number", description: "页码，从 1 开始", required: false },
        ],
        responseExample: {
          code: 0,
          data: {
            list: [
              { id: "2", title: "报销审批", applicant: "李四", status: "approved", finishTime: "2026-10-29T12:00:00Z" },
            ],
            total: 1,
          },
        },
      },
      {
        id: "leave-approval-list",
        name: "查询请假审批列表",
        description: "查询请假审批记录，适用于请假管理、审批看板等场景。",
        method: "GET",
        path: "/leave/approval/list",
        parameters: [
          { name: "pageSize", type: "number", description: "每页条数，默认 10", required: false },
          { name: "status", type: "string", description: "审批状态：pending/approved/rejected，不传表示全部", required: false },
        ],
        responseExample: {
          code: 0,
          data: {
            list: [
              { id: "3", applicant: "王五", type: "annual", startDate: "2026-11-01", endDate: "2026-11-03", status: "pending" },
            ],
            total: 1,
          },
        },
      },
    ],
  },
];

export function findConnectorById(id: string): Connector | undefined {
  return connectors.find((c) => c.id === id);
}

export function findConnectorInterface(connectorId: string, interfaceId: string): ConnectorInterface | undefined {
  return findConnectorById(connectorId)?.interfaces.find((i) => i.id === interfaceId);
}
```

- [ ] **Step 3: Export from index.ts**

Create `packages/plugin-lowcode/src/connectors/index.ts`:

```ts
export type { Connector, ConnectorInterface } from "./types";
export { connectors, findConnectorById, findConnectorInterface } from "./registry";
export { buildConnectorPrompt } from "./prompt";
export { connectorRuntime } from "./runtime";
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.base.json`
Expected: no errors (other than pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add packages/plugin-lowcode/src/connectors
git commit -m "feat(connectors): add hard-coded OA connector registry

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 2: Build Connector Prompt Section

**Files:**
- Create: `packages/plugin-lowcode/src/connectors/prompt.ts`
- Modify: `packages/plugin-lowcode/src/connectors/index.ts`

- [ ] **Step 1: Implement prompt renderer**

Create `packages/plugin-lowcode/src/connectors/prompt.ts`:

```ts
import { connectors } from "./registry";

export function buildConnectorPrompt(): string {
  if (!connectors.length) return "";

  const connectorSections = connectors.map((connector) => {
    const interfaceLines = connector.interfaces.map((iface) => [
      `  - 接口ID: ${iface.id}`,
      `    名称: ${iface.name}`,
      `    描述: ${iface.description}`,
      `    方法: ${iface.method}`,
      `    路径: ${iface.path}`,
      `    参数: ${iface.parameters.length ? iface.parameters.map((p) => `${p.name}(${p.type}${p.required ? ", 必填" : ", 可选"}) - ${p.description}`).join("; ") : "无"}`,
      `    返回示例: ${JSON.stringify(iface.responseExample)}`,
    ].join("\n"));

    return [
      `- 连接器ID: ${connector.id}`,
      `  名称: ${connector.name}`,
      `  描述: ${connector.description}`,
      `  基础URL: ${connector.baseUrl}`,
      `  接口:`,
      ...interfaceLines.map((line) => `  ${line}`),
    ].join("\n");
  });

  return [
    "# 可用连接器",
    "生成页面时，如果用户需求可以由以下连接器接口满足，必须复用这些已有接口，禁止重新生成功能重复的接口。",
    "连接器接口只能用于读取数据（只读），禁止用于提交、修改、删除数据。",
    "",
    connectorSections.join("\n\n"),
    "",
    "<使用规则>",
    "1. 先判断用户需求中哪些数据可以由连接器提供。",
    "2. 如果连接器可以满足，在生成页面时直接通过连接器调用获取数据，不要生成新的数据源或接口。",
    "3. 生成组件配置时，使用连接器返回示例中的字段名作为数据绑定参考。",
    "4. 调用方式：在页面运行时通过 connectorRuntime.call(connectorId, interfaceId, params) 获取数据。",
    "5. 当前只读场景下，禁止生成任何写操作（POST 提交表单、删除、更新等）。",
    "</使用规则>",
  ].join("\n");
}
```

- [ ] **Step 2: Re-export**

Ensure `packages/plugin-lowcode/src/connectors/index.ts` exports `buildConnectorPrompt`.

- [ ] **Step 3: Add a unit-style smoke test by running a one-off script**

Run:

```bash
node -e "const { buildConnectorPrompt } = require('./packages/plugin-lowcode/src/connectors/prompt.ts'); console.log(buildConnectorPrompt());"
```

Expected: prints the connector prompt containing `OA 办公平台`, `todo-list`, `done-list`, `leave-approval-list`.

> Note: TypeScript is not directly executable via `node`. Use `tsx` if available, otherwise rely on the TypeScript compile check in Task 1 Step 4.

- [ ] **Step 4: Commit**

```bash
git add packages/plugin-lowcode/src/connectors/prompt.ts packages/plugin-lowcode/src/connectors/index.ts
git commit -m "feat(connectors): add connector prompt builder

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 3: Implement Connector Runtime Wrapper

**Files:**
- Create: `packages/plugin-lowcode/src/connectors/runtime.ts`
- Modify: `packages/plugin-lowcode/src/connectors/index.ts`

- [ ] **Step 1: Implement runtime**

Create `packages/plugin-lowcode/src/connectors/runtime.ts`:

```ts
import { findConnectorById } from "./registry";
import type { ConnectorInterface } from "./types";

function buildUrl(baseUrl: string, iface: ConnectorInterface, params?: Record<string, unknown>): string {
  const url = new URL(iface.path, baseUrl);
  if (iface.method === "GET" && params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }
  return url.toString();
}

export const connectorRuntime = {
  async call(
    connectorId: string,
    interfaceId: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    const connector = findConnectorById(connectorId);
    if (!connector) {
      throw new Error(`Connector "${connectorId}" not found.`);
    }
    const iface = connector.interfaces.find((i) => i.id === interfaceId);
    if (!iface) {
      throw new Error(`Interface "${interfaceId}" not found in connector "${connectorId}".`);
    }

    const url = buildUrl(connector.baseUrl, iface, params);
    const response = await fetch(url, {
      method: iface.method,
      headers: {
        "Content-Type": "application/json",
      },
      ...(iface.method === "POST" && params ? { body: JSON.stringify(params) } : {}),
    });

    if (!response.ok) {
      throw new Error(`Connector request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },
};
```

- [ ] **Step 2: Re-export**

Ensure `packages/plugin-lowcode/src/connectors/index.ts` exports `connectorRuntime`.

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit -p tsconfig.base.json`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add packages/plugin-lowcode/src/connectors/runtime.ts packages/plugin-lowcode/src/connectors/index.ts
git commit -m "feat(connectors): add frontend connector runtime wrapper

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 4: Thread Connector Prompt into Page Generation

**Files:**
- Modify: `packages/plugin-lowcode/src/tools/types.ts`
- Modify: `packages/plugin-lowcode/src/tools/index.ts`
- Modify: `packages/plugin-lowcode/src/tools/update-page/index.ts`
- Modify: `packages/plugin-lowcode/src/tools/update-page/run.ts`
- Modify: `packages/plugin-lowcode/src/tools/update-page/prompt.ts`
- Modify: `packages/plugin-lowcode/src/index.tsx`

- [ ] **Step 1: Extend tool options type**

Edit `packages/plugin-lowcode/src/tools/types.ts`, add `connectorPrompt` to `LowCodeToolOptions`:

```ts
export interface LowCodeToolOptions {
  runtime: LowCodeDesignerRuntime;
  onOperatorActions?: (params: LowCodeOperatorParams) => void;
  /** Whether addChild actions may pass ignore/enhance to the designer. Disabled by default. */
  enableRenderingOptimization?: boolean;
  /** Connector prompt section injected into page-generation subAgent. */
  connectorPrompt?: string;
}
```

- [ ] **Step 2: Forward connectorPrompt through tool factories**

Edit `packages/plugin-lowcode/src/tools/index.ts`:

```ts
export function createLowCodeTools(options: LowCodeToolOptions): Tool[] {
  const { runtime } = options;
  return [
    createLowCodeGrepTool(runtime),
    createLowCodeReadTool(runtime),
    createLowCodeGeneratePageTool(options),
    createLowCodeClearPageTool(runtime),
  ];
}
```

(Already receives full `options`; no change needed except confirming it passes `options` to `createLowCodeGeneratePageTool`.)

Edit `packages/plugin-lowcode/src/tools/update-page/index.ts`, line ~84 and line ~147:

Change the destructuring at line 84 from:

```ts
const { runtime, onOperatorActions, enableRenderingOptimization = false } = options;
```

to:

```ts
const { runtime, onOperatorActions, enableRenderingOptimization = false, connectorPrompt } = options;
```

Change the `runUpdatePageTask` call at line ~147 from:

```ts
const generated = await runUpdatePageTask(runtime, { ...task, targetId }, toolContext, session!, ...);
```

to include `connectorPrompt`:

```ts
const generated = await runUpdatePageTask(runtime, { ...task, targetId }, toolContext, session!, (nextProgress) => {
  Object.assign(taskProgress, nextProgress);
  emitProgress();
}, enableRenderingOptimization, connectorPrompt);
```

- [ ] **Step 3: Accept connectorPrompt in run.ts**

Edit `packages/plugin-lowcode/src/tools/update-page/run.ts`:

Change the function signature from:

```ts
export async function runUpdatePageTask(
  runtime: LowCodeDesignerRuntime,
  params: LowCodeGeneratePageTask,
  toolContext: ToolExecutionContext,
  executor?: UpdatePageActionExecutor,
  onProgress?: (progress: PageRequestProgress) => void,
  enableRenderingOptimization = false,
)
```

to:

```ts
export async function runUpdatePageTask(
  runtime: LowCodeDesignerRuntime,
  params: LowCodeGeneratePageTask,
  toolContext: ToolExecutionContext,
  executor?: UpdatePageActionExecutor,
  onProgress?: (progress: PageRequestProgress) => void,
  enableRenderingOptimization = false,
  connectorPrompt?: string,
)
```

Change the `subAgent` creation from:

```ts
const subAgent = parentAgent.createFork({
  tools: [], system: buildPageActionSystemPrompt(dsl), aiRole: hasImage ? "image" : undefined, retry: false,
  ...
});
```

to:

```ts
const subAgent = parentAgent.createFork({
  tools: [],
  system: buildPageActionSystemPrompt(dsl, connectorPrompt),
  aiRole: hasImage ? "image" : undefined,
  retry: false,
  ...
});
```

- [ ] **Step 4: Append connector section in page action system prompt**

Edit `packages/plugin-lowcode/src/tools/update-page/prompt.ts`:

Change the signature of `buildPageActionSystemPrompt` from:

```ts
export function buildPageActionSystemPrompt(dsl: ActionDSL): string {
```

to:

```ts
export function buildPageActionSystemPrompt(dsl: ActionDSL, connectorPrompt?: string): string {
```

Append the connector section before the closing `</生成要求>` (or after `</UI搭建原则>`), around line 422. Add:

```ts
  const connectorSection = connectorPrompt
    ? `<连接器使用规范>\n${connectorPrompt}\n</连接器使用规范>\n\n`
    : "";
```

Insert `${connectorSection}` into the returned template at the end of the large prompt string, just before `</生成要求>`.

The final returned string should look like:

```ts
  return `...existing prompt...

${connectorSection}<生成要求>
- ...existing requirements...
</生成要求>`;
```

- [ ] **Step 5: Build connector prompt in plugin entry**

Edit `packages/plugin-lowcode/src/index.tsx`:

Add an import near the top:

```ts
import { buildConnectorPrompt } from "./connectors";
```

Inside `pluginLowCodeAI`, before `ensureAgent`, compute:

```ts
const connectorPrompt = buildConnectorPrompt();
```

Pass it into `createLowCodeTools`:

```ts
tools: [...createLowCodeTools({ runtime, onOperatorActions, enableRenderingOptimization, connectorPrompt }), ...(tools ?? [])],
```

- [ ] **Step 6: TypeScript check**

Run: `npx tsc --noEmit -p tsconfig.base.json`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add packages/plugin-lowcode/src/tools/types.ts packages/plugin-lowcode/src/tools/index.ts packages/plugin-lowcode/src/tools/update-page/index.ts packages/plugin-lowcode/src/tools/update-page/run.ts packages/plugin-lowcode/src/tools/update-page/prompt.ts packages/plugin-lowcode/src/index.tsx
git commit -m "feat(connectors): inject connector prompt into page generation

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 5: Document Runtime Usage for Generated Pages

**Files:**
- Modify: `docs/superpowers/specs/2026-10-30-connector-mvp-design.md`
- Modify: `packages/plugin-lowcode/src/connectors/index.ts` (already exports runtime)

- [ ] **Step 1: Update spec with runtime usage example**

Append to `docs/superpowers/specs/2026-10-30-connector-mvp-design.md` after the "运行时注入（可选兜底）" section:

```markdown
### 4. 生成产物中的使用示例

生成的页面代码或 DSL 配置中，使用 `connectorRuntime.call` 发起调用：

```ts
import { connectorRuntime } from "@mybricks/plugin-ai/connectors";

const data = await connectorRuntime.call("oa-connector", "todo-list", { pageSize: 10 });
```

在 MVP 阶段，如果生成的产物无法直接导入该模块，可以在页面 JS 代码中使用等价实现：

```ts
const data = await fetch("https://oa.example.com/api/todo/list?pageSize=10").then(r => r.json());
```

`connectorRuntime` 的作用是统一调用入口，后续迁移到网关时只需替换该实现，生成产物无需改动。
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-10-30-connector-mvp-design.md
git commit -m "docs(connectors): add runtime usage example to spec

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 6: Build and Smoke Test

**Files:**
- None new.

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: completes without errors (warnings from existing code are acceptable).

- [ ] **Step 2: Smoke test prompt length**

Run a small Node/TS script that imports `buildConnectorPrompt` and logs the string length:

```bash
node -e "
const ts = require('typescript');
const source = require('fs').readFileSync('packages/plugin-lowcode/src/connectors/prompt.ts','utf8');
const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2015 }});
eval(result.outputText);
console.log('prompt length:', buildConnectorPrompt().length);
"
```

Expected: length is between 1000 and 5000 characters.

- [ ] **Step 3: Commit build verification (optional)**

If any build artifacts changed (e.g. `dist/`), commit them:

```bash
git add -A
git commit -m "chore(connectors): rebuild plugin with connector MVP

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Spec Coverage Self-Check

| Spec Section | Implementing Task |
|--------------|-------------------|
| Hard-coded registry | Task 1 |
| AI-friendly prompt injection | Task 2 + Task 4 |
| Direct `fetch` runtime | Task 3 |
| Generated page calls connector | Task 4 (prompt tells model how) + Task 5 (docs) |
| Read-only, no auth, no gateway | Tasks 1-3 |

No placeholders remain in the plan. Type signatures are consistent across tasks (`connectorPrompt?: string`, `buildPageActionSystemPrompt(dsl, connectorPrompt?)`).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-30-connector-mvp-plan.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach do you prefer?
