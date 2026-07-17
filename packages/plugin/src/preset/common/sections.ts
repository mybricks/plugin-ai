export const frontend = {
  metaSection: `---
title: 前端工程
description: 前端页面、组件、样式、数据源、日志与设计态规范。
permissions:
  - read
  - write
---`,
  guideSection: `
## TSX 文件编写规范
1. 必须使用 TypeScript，所有组件 props、state、函数参数和返回值都需要有明确的类型定义。
2. 组件状态和业务逻辑封装在组件内部，使用 \`useState\`、\`useReducer\` 等 React hooks 管理状态。
3. 当逻辑相对独立或较为复杂时，抽取到同级 \`hooks/\` 文件夹中，每个自定义 hook 单独一个文件。
4. 禁止编写未实现的事件函数。
5. 对于浮层类组件，如弹窗、抽屉等，控制浮层显示状态的变量使用 \`useState\` 维护，禁止设置为固定值。
6. 所有来自三方库的组件和所有 html 元素都必须带有语义化明确且唯一的 \`className\`。
7. 所有与样式相关的内容都要写在 less 文件中，避免在 tsx 中通过 \`style\` 编写。
8. 各类动效、动画等尽量使用 CSS3 在 less 中实现，不要为此引入额外类库。
9. 禁止出现直接引用标签的写法，例如 \`<Tags[XX] property={'aa'}/>\`；正确写法是先定义 \`const XX = Tags[XX]; <XX property={'aa'} />\`。
10. 所有列表中的组件必须通过 \`key\` 属性做唯一标识，不要使用 index 作为 key。
11. 前端调用本项目服务端接口时，统一在 \`dataSource.ts\` 中通过 MyBricks DataSource 的 \`this.axios\` 调用 \`/api/xxx\` 请求。

## LESS 文件编写规范
1. 样式文件命名规则：\`*.module.less\` 编译时自动启用 CSS Module，\`*.less\` 编译时不开启 CSS Module。
2. 开发优先统一使用 \`*.module.less\` 编写样式。
3. \`:frame\` 配置规则仅页面和浮层类组件需要，普通组件不需要；页面必须配置 \`:frame { width }\`，浮层必须配置 \`:frame { width; height }\`。
4. \`:frame\` 只控制画布尺寸，不影响运行时布局，必须放在所有 CSS 类之前。
5. 页面根组件用 \`width: 100%\` 适配 \`:frame\` 宽度。
6. 选择器中多个单词之间使用驼峰方式，不能使用 \`-\` 连接。
7. 不使用 \`:before\`、\`:after\` 等伪类选择器来实现 DOM。

## Hooks 文件夹编写规范
- hooks 以文件夹形式存放，目录名必须是 \`hooks\`，位于组件或页面同级。
- 每个 hook 单独一个文件，文件名与 hook 名相同，如 \`useXxx.ts\`。
- 每个自定义 hook 以 \`use\` 开头命名。
- hook 应内部管理自己的副作用，不对外暴露命令式方法。
- 当多个组件需要共享逻辑时，提取到上层公共 \`hooks/\` 目录中。

## 日志规范
项目中必须使用 MyBricks 提供的 \`logger\` 工具打印前端日志，禁止使用 \`console.log\`、\`console.warn\`、\`console.error\` 等原生方法。

必须在以下场景打印足量日志：
1. 用户交互事件；
2. 数据请求；
3. 状态变更；
4. 条件分支与异常；
5. 路由跳转；
6. 任何可能失败的操作。`,
  environmentVariablesSection: `以下是系统注入的前端环境变量，可在组件代码中通过 \`process.env.<变量名>\` 访问，禁止自行声明或覆盖这些变量。

| 变量名 | 类型 | 设计态值 | 运行态值 | 说明 |
|--------|------|----------|----------|------|
| \`process.env.POPUP_VISIBLE\` | \`boolean\` | true | false | **只能在 \`popupRef\` 包裹的组件内部使用**，否则会导致运行时报错。控制浮层（弹窗/抽屉等）的默认显示状态。设计态下为 true 使浮层保持展开，方便设计者选中浮层内元素进行编辑；运行态下为 false，由业务逻辑控制显隐。浮层组件必须将此变量与业务状态做 || 合并使用，例如：visible={process.env.POPUP_VISIBLE || visible} |
| \`process.env.POPUP_NODE\` | \`HTMLElement\` | 设计器画布容器节点 | 页面容器节点 | **只能在 \`popupRef\` 包裹的组件内部使用**，否则会导致运行时报错。浮层的挂载容器。设计、运行态下均指向设计器画布，确保浮层渲染在画布内部。例如一些三方库的指定挂载节点：getContainer={() => process.env.POPUP_NODE} |`,
  assetsUsageSection: `- 对于图标：为了保证视觉的统一与专业性，我们的共识是统一使用图标组件。
  - 如果没有图标组件，则使用色块+文本占位，禁止使用 Emoji 或特殊字符。
- 对于图片：图片是传递信息与氛围的关键。我们建议根据其用途选择合适的来源：
  - https://ai.mybricks.world/image-search?term=searchWord&w=20&h=20，可以配置一个高质量的写实图片（比如摄影、人文等）；
  具体来说
  - 对于海报/写实/商品/图片等：我们建议使用高质量的写实图片；
  - 对于Logo：我们建议使用色块+文本占位；
  - 对于插画/装饰性图形：我们优先推荐使用简单的svg来占位，避免使用图片过于跳脱；`,
}

export const backend = {
  metaSection: `---
title: 服务端工程
description: 服务端工程实现规范。
permissions:
  - read
  - write
---`,
  guideSection: `
## 何时需要服务端

服务端用于提供前端无法独立完成的能力。当出现以下场景时，在服务端补齐对应能力：
- 需要在服务端完成的敏感逻辑（密钥、鉴权、签名等）；
- 需要执行前端环境无法胜任的计算或 IO；
- 需要数据持久化（写入/读取数据库、跨会话共享状态等）。

服务端只承担必要的数据出入口，业务规则、展示逻辑、状态编排保留在前端。

## 运行时约束
- 当前是一个 **serverless 工程**，禁止使用 \`crypto\`、\`fs\`、\`path\` 等 nodejs 原生模块；如需 hash、存储等能力，统一走数据库或平台提供的能力。
- 服务端不承担静态资源托管、构建产物输出等前端职责，仅负责 \`/api/*\` 接口。`,
  codeRulesSection: `1. 路径约定：使用合理、语义化的路径，如果是根路径，直接使用 “/” 即可。
2. 参数校验与异常处理：路由处理函数中做好参数校验和异常捕获，返回清晰的错误信息。
3. 涉及数据库时，数据库表结构由工具调用进行准备；业务代码只负责查询和写入，不要在接口处理函数中执行建表逻辑。
4. 路由拆分：业务路由按领域拆分为独立文件，入口文件通过 \`app.route\` 统一挂载，不要把所有接口都写进 \`backend/index.ts\`。

### 日志规范
服务启动时打印启动日志；有路由时添加统一的请求中间件，记录请求 ID、耗时、状态码等关键信息，必要时可以单独拆分一个logger文件。

### 返回规范
统一使用 JSON：
- 成功：\`{ result: 1, error_msg: 'success', data }\` + 2xx 状态码
- 失败：\`{ result: -1, error_msg: '失败原因' }\` + 4xx/5xx 状态码`,
  environmentVariablesSection: `以下是系统注入的后端环境变量，可在服务端代码中通过 \`process.env.<变量名>\` 访问，禁止自行声明或覆盖这些变量。

| 变量名 | 类型 | 设计态值 | 运行态值 | 说明 |
|--------|------|----------|----------|------|
| \`process.env.db\` | \`object\` | - | - | 数据库连接配置。字段通常包含 user、password、host、port、database。服务端需要访问数据库时从该对象读取连接配置，禁止在业务代码中硬编码数据库连接信息。 |`,
  honoUsageSection: `### Hono
当前项目支持使用 Hono 进行服务端开发。入口文件创建并导出 Hono app，业务路由按领域拆分后通过 \`app.route\` 统一挂载。`,
  pgUsageSection: `### pg
服务端需要访问 PostgreSQL 数据库时，使用 \`pg\` 包的 \`Client\` 或 \`Pool\`。
- 连接配置必须从 \`process.env.db\` 读取，禁止硬编码数据库连接信息。
- 推荐在 \`backend/db.ts\` 中集中创建并导出连接池。
- 查询结果通过 \`result.rows\` 读取。

\`\`\`ts
import { Pool } from "pg";

export const pool = new Pool({
  user: process.env.db.user,
  password: process.env.db.password,
  host: process.env.db.host,
  port: process.env.db.port,
  database: process.env.db.database,
});
\`\`\``,
  mysqlUsageSection: `### mysql2/promise
服务端需要访问 MySQL 数据库时，使用 \`mysql2/promise\` 包的 \`createPool\`。
- 连接配置必须从 \`process.env.db\` 读取，禁止硬编码数据库连接信息。
- 推荐在 \`backend/db.ts\` 中集中创建并导出连接池。
- 查询结果通过 \`const [rows] = await pool.execute(...)\` 读取。

\`\`\`ts
import { createPool } from "mysql2/promise";

export const pool = createPool({
  host: process.env.db.host,
  port: process.env.db.port,
  user: process.env.db.user,
  password: process.env.db.password,
  database: process.env.db.database,
});
\`\`\``,
  examplesSection: `1. 入口文件
\`\`\`ts
import { Hono } from "hono";
import { logger } from "mybricks";
import todoRoutes from "./routes/todo";

const app = new Hono();
const serverLogger = logger.child({ module: "backend" });

const createRequestId = () => {
  return \`\${Date.now().toString(36)}-\${Math.random().toString(36).slice(2, 8)}\`;
};

const requestHandle = async (c, next) => {
  const requestId = c.req.header("x-request-id") ?? createRequestId();
  const startedAt = Date.now();
  const requestLogger = serverLogger.child({
    requestId,
    method: c.req.method,
    path: c.req.path,
  });

  c.set("logger", requestLogger);
  c.header("x-request-id", requestId);

  try {
    await next();
  } catch (error) {
    requestLogger.error({ error }, "服务端请求异常");

    return c.json(
      { success: false, message: "服务异常，请稍后重试" },
      500,
    );
  } finally {
    requestLogger.info({
      status: c.res.status,
      duration: Date.now() - startedAt,
    }, "服务端请求完成");
  }
};

app.use("*", requestHandle);
app.route("/api/todos", todoRoutes);

serverLogger.info("server start");

export default app;
\`\`\`

2. 业务路由 todo.ts
\`\`\`ts
import { Hono } from "hono";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

const todoRoutes = new Hono();

todoRoutes.get("/", async (c) => {
  const routeLogger = c.get("logger").child({ route: "todos", action: "list" });

  try {
    const items: Todo[] = [];
    return c.json({ success: true, data: { items } });
  } catch (error) {
    routeLogger.error({ error }, "查询任务列表失败");
    return c.json({ success: false, message: "查询任务列表失败" }, 500);
  }
});

export default todoRoutes;
\`\`\``,
}

