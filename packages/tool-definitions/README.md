# Tool definitions

从 agent 原始工具工厂提取 `name`、`description`、`parameters`，通过官方 `z.fromJSONSchema()` 将 parameters 转为 Zod object schema，保留必填、可选、嵌套结构、枚举及字段描述。编译产物为 ESM JavaScript，依赖 Zod，不包含工具执行逻辑。bash 使用原工具默认命令列表及虚拟文件系统描述。

仓库根目录执行：

```sh
npm run build:tool-definitions
```

产物：`packages/tool-definitions/dist/index.js`。原始工具定义更新后需重新编译。

在 `lingstyle-design-codex-plugin/packages/codex-plugin/src/server.mjs` 中使用：

```js
import toolDefinitions, { tools, read_file, bash, check_status } from
  '../../../../plugin-ai/packages/tool-definitions/dist/index.js';

// toolDefinitions.read_file / read_file: { name, description, parameters: ZodObject }
read_file.parameters.parse({ path: 'src/index.ts' });
// tools: 全部 10 个定义组成的数组
// check_status / toolDefinitions['check-status']: 状态检查工具，name 为 'check-status'
// 也可按名称导入 write_file、edit_file、multi_edit、multi_write、
// delete_file、grep_search、glob_search。
```

该相对路径适用于两个仓库在同一父目录的本地开发。分发时可复制此包（包含 package.json 和 dist）或安装后从 `@mybricks/tool-definitions` 导入。

MCP SDK 接入示例（执行处理器由接入端实现）：

```js
server.registerTool(read_file.name, {
  description: read_file.description,
  inputSchema: read_file.parameters.shape,
}, async (args) => {
  // 在此接入实际的读取逻辑，返回 MCP 工具结果。
});
```

分发时安装此包的依赖；若仅复制 dist/index.js，目标项目需安装兼容 `z.fromJSONSchema()` 的 Zod（当前依赖 `^4.6.7`）。
