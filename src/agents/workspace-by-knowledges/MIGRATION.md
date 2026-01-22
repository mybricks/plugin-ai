# 从旧 Workspace 迁移到新 Workspace 指南

## 快速对比

### 旧 Workspace

```typescript
import { WorkSpace } from '../workspace/workspace';

const workspace = new WorkSpace(config, api, outlineInfoManager);
workspace.openDocument('page1');
const struct = workspace.getProjectStruct();
```

### 新 Workspace

```typescript
import { Workspace } from '../workspace-by-knowledges';

const workspace = new Workspace({ ...config, api });
await workspace.openFile('画布索引/首页.dsl');
const content = await workspace.export();
```

## 核心概念变化

### 1. 从"文档"到"文件"

**旧方式：** 操作抽象的"文档"
```typescript
workspace.openDocument(id);
workspace.closeDocument(id);
workspace.checkDocumentStatus(id);
```

**新方式：** 操作具体的"文件路径"
```typescript
await workspace.openFile('画布索引/首页.dsl');
workspace.closeFile('画布索引/首页.dsl');
workspace.isFileOpened('画布索引/首页.dsl');
```

### 2. 从"结构化输出"到"知识库导出"

**旧方式：** 获取预定义的结构化文本
```typescript
const struct = workspace.getProjectStruct();
// 返回固定格式的字符串
```

**新方式：** 导出知识库内容
```typescript
const content = await workspace.export({ includeTree: true });
// 返回动态的、包含目录树和文件内容的完整知识库
```

### 3. 从"组件文档管理"到"文件系统视图"

**旧方式：** 单独管理组件文档
```typescript
workspace.openComponentDoc('mybricks.normal-pc.button');
workspace.closeComponentDoc('mybricks.normal-pc.button');
const hasDocs = workspace.hasComponentsDocs();
const docs = workspace.getComponentsDocs();
```

**新方式：** 统一的文件系统
```typescript
await workspace.openFile('可用组件/pc.button.md');
workspace.closeFile('可用组件/pc.button.md');
const opened = workspace.getOpenedFilePaths();
const content = await workspace.export(); // 包含所有已打开的文件
```

## API 迁移对照表

| 旧 API | 新 API | 说明 |
|--------|--------|------|
| `openDocument(id)` | `openFile(path)` | 通过文件路径打开 |
| `closeDocument(id)` | `closeFile(path)` | 通过文件路径关闭 |
| `checkDocumentStatus(id)` | `isFileOpened(path)` | 检查文件是否打开 |
| `getProjectStruct()` | `export()` | 获取完整内容 |
| `openComponentDoc(ns)` | `openFile('可用组件/xxx.md')` | 打开组件文档 |
| `closeComponentDoc(ns)` | `closeFile('可用组件/xxx.md')` | 关闭组件文档 |
| `hasComponentsDocs()` | `getOpenedFilePaths().length > 0` | 检查是否有打开的文件 |
| `getComponentsDocs()` | `export()` | 导出时包含所有文档 |
| - | `getDirectoryTree()` | 新增：获取目录树 |
| - | `findNode(path)` | 新增：查找节点 |
| - | `clearOpenedFiles()` | 新增：清空已打开文件 |

## 详细迁移步骤

### 步骤 1：更新构造函数

**旧代码：**
```typescript
import { WorkSpace } from '../workspace/workspace';
import { FocusOutlineInfoManager } from '../workspace/outline-focus';

const outlineInfoManager = new FocusOutlineInfoManager({
  api: designerAPI,
  focusInfo: currentFocus
});

const workspace = new WorkSpace(
  { currentFocus },
  workspaceAPI,
  outlineInfoManager
);
```

**新代码：**
```typescript
import { Workspace } from '../workspace-by-knowledges';

// 从 context 获取所有依赖，无需手动传入
const workspace = new Workspace({
  name: 'Workspace',
  description: '工作空间'
});

// 等待默认文件打开完成
await workspace.waitForReady();
```

**说明：** 
- 不再需要手动传入 API、focusInfo 和 outlineInfoManager
- 所有依赖从 context 获取
- 项目信息和聚焦信息默认自动打开

### 步骤 2：更新文档打开逻辑

**旧代码：**
```typescript
// 打开页面文档
workspace.openDocument(pageId);

// 打开组件文档
workspace.openDocument(componentId);
```

**新代码：**
```typescript
// 项目信息和聚焦信息已经默认打开，无需手动打开

// 打开组件文档（通过 namespace）
await workspace.openComponentDocByNamespace('mybricks.normal-pc.antd5.button');

// 或通过路径
await workspace.openComponentDoc('组件配置文档/mybricks.normal-pc.antd5.button.md');

// 打开动态文档（如页面内容）
await workspace.openDocument('page_u_abc123', {
  type: '画布',
  content: '<页面内容>',
  title: '首页',
  directoryId: 'opened-pages' // 需要先注册动态文档目录
});
```

### 步骤 3：更新内容获取逻辑

**旧代码：**
```typescript
// 获取项目结构
const projectStruct = workspace.getProjectStruct();

// 获取组件文档
let componentDocs = '';
if (workspace.hasComponentsDocs()) {
  componentDocs = workspace.getComponentsDocs();
}

// 拼接发送给 AI
const message = `${projectStruct}\n\n${componentDocs}\n\n用户提问：${userInput}`;
```

**新代码：**
```typescript
// 直接导出工作空间内容
const workspaceContent = await workspace.export({ includeTree: true });

// 发送给 AI
const message = `${workspaceContent}\n\n用户提问：${userInput}`;
```

**优势：** 更简洁，自动包含目录树、聚焦信息、已打开文件等所有内容。

### 步骤 4：更新组件文档管理

**旧代码：**
```typescript
// 打开组件文档
workspace.openComponentDoc('mybricks.normal-pc.button');
workspace.openComponentDoc('mybricks.normal-pc.input');

// 关闭组件文档
workspace.closeComponentDoc('mybricks.normal-pc.button');

// 检查是否有文档
if (workspace.hasComponentsDocs()) {
  const docs = workspace.getComponentsDocs();
  // 使用文档
}
```

**新代码：**
```typescript
// 打开组件文档（自动打开依赖）
await workspace.openComponentByNamespace('mybricks.normal-pc.button');
await workspace.openComponentByNamespace('mybricks.normal-pc.input');

// 关闭组件文档
const abbreviation = ComponentsManager.getAbbreviation('mybricks.normal-pc.button');
workspace.closeFile(`可用组件/${abbreviation}.md`);

// 检查已打开的文件
const openedFiles = workspace.getOpenedFilePaths();
if (openedFiles.length > 0) {
  const content = await workspace.export();
  // 使用内容
}
```

### 步骤 5：更新聚焦信息处理

**旧代码：**
```typescript
// 聚焦信息在构造时传入，之后无法更新
const workspace = new WorkSpace(
  { currentFocus: { pageId: 'page1' } },
  api,
  outlineInfoManager
);
```

**新代码：**
```typescript
// 从 context 获取聚焦信息，无需手动传入
const workspace = new Workspace({
  name: 'Workspace'
});

// 聚焦信息文件已经默认打开
await workspace.waitForReady();

// 当 context.currentFocus 变化时，刷新工作空间
await workspace.refresh();

// refresh 会：
// 1. 清空所有已打开的文件
// 2. 清空所有动态文档
// 3. 重新初始化 providers
// 4. 重新打开默认文件（项目信息和聚焦信息）
```

## 实际案例：重构 AI 对话处理函数

### 旧实现

```typescript
async function handleAIChat(userMessage: string) {
  // 创建 workspace
  const outlineInfoManager = new FocusOutlineInfoManager({
    api: designerAPI,
    focusInfo: getCurrentFocus()
  });
  
  const workspace = new WorkSpace(
    { currentFocus: getCurrentFocus() },
    workspaceAPI,
    outlineInfoManager
  );
  
  // 根据用户消息打开相关文档
  if (userMessage.includes('按钮')) {
    workspace.openComponentDoc('mybricks.normal-pc.button');
  }
  
  if (userMessage.includes('页面')) {
    workspace.openDocument(getCurrentFocus().pageId);
  }
  
  // 构建消息
  const projectStruct = workspace.getProjectStruct();
  const componentDocs = workspace.hasComponentsDocs() 
    ? workspace.getComponentsDocs() 
    : '';
  
  const fullMessage = `${projectStruct}\n\n${componentDocs}\n\n用户：${userMessage}`;
  
  // 发送给 AI
  return await aiAPI.chat(fullMessage);
}
```

### 新实现

```typescript
async function handleAIChat(userMessage: string) {
  // 创建 workspace（从 context 获取所有依赖）
  const workspace = new Workspace({
    name: 'Workspace'
  });
  
  // 等待默认文件打开（项目信息和聚焦信息）
  await workspace.waitForReady();
  
  // 根据用户消息打开相关文档
  if (userMessage.includes('按钮')) {
    await workspace.openComponentDocByNamespace('mybricks.normal-pc.antd5.button');
  }
  
  // 如果需要添加页面内容，使用动态文档
  if (userMessage.includes('页面')) {
    const pageContent = await fetchPageContent(context.currentFocus?.pageId);
    await workspace.openDocument(context.currentFocus?.pageId || '', {
      type: '画布',
      content: pageContent,
      title: '当前页面'
    });
  }
  
  // 导出完整内容（包含默认打开的项目信息和聚焦信息）
  const workspaceContent = await workspace.export({ includeTree: true });
  
  // 构建消息
  const fullMessage = `${workspaceContent}\n\n用户：${userMessage}`;
  
  // 发送给 AI
  return await aiAPI.chat(fullMessage);
}
```

**改进点：**
1. 代码更简洁（减少约 40%）
2. 从 context 获取所有依赖，无需手动传入
3. 不需要手动管理 outlineInfoManager
4. 不需要分别获取和拼接不同部分的内容
5. 项目信息和聚焦信息默认自动打开
6. 支持动态文档
7. 自动处理组件依赖

## 类型迁移

### WorkspaceConfig

**旧定义：**
```typescript
interface WorkSpaceConfig {
  currentFocus: FocusInfo;
}
```

**新定义：**
```typescript
interface WorkspaceConfig extends KnowledgeBaseConfig {
  // 所有依赖从 context 获取，无需传入
  // 只需要 name 和 description（可选）
}
```

### API 获取方式

**旧方式：**
```typescript
// 需要手动传入 API
const workspaceAPI: WorkspaceAPI = {
  getAllPageInfo: () => { /* ... */ },
  getPageOutline: (pageId) => { /* ... */ },
  getComponentDoc: (namespace) => { /* ... */ },
  getAvailableComponents: () => { /* ... */ }
};

const workspace = new WorkSpace(config, workspaceAPI, outlineInfoManager);
```

**新方式：**
```typescript
// 从 context 获取所有 API，无需手动传入
// 确保 context.api 已经初始化

const workspace = new Workspace({
  name: 'Workspace'
});

// Workspace 内部会从 context 获取：
// - context.api.global.api.getAllPageInfo()
// - context.api.global.api.getComEditorPrompts() 或 context.api.uiCom.api.getComEditorPrompts()
// - context.currentFocus
```

## 注意事项

### 1. Context 依赖

新 Workspace 从 context 获取所有依赖：
```typescript
// ❌ 错误：在 context 未初始化时创建
const workspace = new Workspace({ name: 'Workspace' });

// ✅ 正确：确保在设计器环境中运行
if (context.api) {
  const workspace = new Workspace({ name: 'Workspace' });
}
```

### 2. 异步操作

新 Workspace 的很多操作都是异步的：
```typescript
// ❌ 错误：忘记 await
workspace.waitForReady();
workspace.openComponentDocByNamespace('mybricks.normal-pc.antd5.button');

// ✅ 正确
await workspace.waitForReady();
await workspace.openComponentDocByNamespace('mybricks.normal-pc.antd5.button');
```

### 3. 路径格式

新 Workspace 使用文件路径，需要注意格式：
```typescript
// ✅ 正确的路径格式
'项目信息.md'
'聚焦信息.md'
'组件配置文档/mybricks.normal-pc.antd5.button.md'

// ❌ 错误的路径格式
'项目信息\\首页.dsl'  // 不要用反斜杠
'/项目信息.md'        // 不要以斜杠开头
'项目信息'            // 缺少扩展名
```

### 4. 默认打开的文件

新 Workspace 默认打开项目信息和聚焦信息：
```typescript
const workspace = new Workspace({ name: 'Workspace' });

// 等待默认文件打开
await workspace.waitForReady();

// 此时已经打开了：
// - 项目信息.md
// - 聚焦信息.md

console.log(workspace.getOpenedFilePaths());
// ['项目信息.md', '聚焦信息.md']
```

### 5. 刷新机制

当 context.currentFocus 变化时，需要刷新工作空间：
```typescript
// 监听聚焦变化
context.on('focusChange', async () => {
  await workspace.refresh();
  
  // refresh 会重新打开默认文件
  // 并清空所有动态文档
});
```

## 渐进式迁移策略

如果项目较大，可以采用渐进式迁移：

### 阶段 1：并行运行

```typescript
import { WorkSpace as OldWorkspace } from '../workspace/workspace';
import { Workspace as NewWorkspace } from '../workspace-by-knowledges';

// 同时创建新旧两个实例
const oldWorkspace = new OldWorkspace(config, api, outlineInfo);
const newWorkspace = new NewWorkspace({ ...config, api });

// 对比输出
console.log('旧输出:', oldWorkspace.getProjectStruct());
console.log('新输出:', await newWorkspace.export());
```

### 阶段 2：部分功能切换

```typescript
// 创建适配器
class WorkspaceAdapter {
  private newWorkspace: Workspace;
  
  constructor(config) {
    this.newWorkspace = new Workspace(config);
  }
  
  // 保持旧 API，内部调用新实现
  async openDocument(id: string) {
    // 判断是页面还是组件
    if (this.isPageId(id)) {
      await this.newWorkspace.openCanvasByPageId(id);
    } else {
      // 处理组件
    }
  }
  
  async getProjectStruct() {
    return await this.newWorkspace.export();
  }
  
  // ... 其他适配方法
}
```

### 阶段 3：完全切换

全部功能验证无误后，完全切换到新实现。

## 测试建议

### 单元测试示例

```typescript
describe('Workspace Migration', () => {
  it('should produce similar output', async () => {
    const oldWorkspace = new OldWorkspace(config, api, outlineInfo);
    const newWorkspace = new Workspace({ ...config, api });
    
    // 执行相同操作
    oldWorkspace.openDocument('page1');
    await newWorkspace.openCanvasByPageId('page1');
    
    const oldOutput = oldWorkspace.getProjectStruct();
    const newOutput = await newWorkspace.export();
    
    // 对比关键信息是否一致
    expect(newOutput).toContain('page1');
    expect(newOutput).toContain('首页');
  });
});
```

## 总结

迁移到新 Workspace 的主要好处：

1. **从 context 获取依赖** - 无需手动传入 API 和 focusInfo，代码更简洁
2. **默认自动打开** - 项目信息和聚焦信息默认打开，减少手动操作
3. **更清晰的概念模型** - 文件系统视图更直观
4. **更灵活的扩展能力** - 继承自 KnowledgeBase，基于 Provider 模式
5. **更好的维护性** - 代码结构更清晰
6. **更强的功能** - 动态文档、权重排序、隐藏节点、自动依赖等
7. **统一的接口** - 基于知识库架构

### 迁移检查清单

- [ ] 确保代码运行在设计器环境中（context 已初始化）
- [ ] 移除手动传入的 API、focusInfo 和 outlineInfoManager
- [ ] 更新构造函数调用
- [ ] 添加 `await workspace.waitForReady()` 等待默认文件打开
- [ ] 将 `workspace.openComponentDoc(namespace)` 改为 `workspace.openComponentDocByNamespace(namespace)`
- [ ] 将 `workspace.getProjectStruct()` 改为 `await workspace.export()`
- [ ] 如需动态添加页面/组件内容，使用 `workspace.openDocument()` 和动态文档功能
- [ ] 添加聚焦变化监听，调用 `workspace.refresh()`
- [ ] 更新路径格式（如果有直接使用路径的地方）
- [ ] 测试所有功能是否正常工作

建议采用渐进式迁移策略，确保平稳过渡。

