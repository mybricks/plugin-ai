# Workspace by Knowledges

基于知识库架构重构的工作空间实现。

## 🎉 新功能亮点

### 1. Provider 改用 `new` 而不是 `extends`
- ✅ 更好的代码提示和类型检查
- ✅ 更简洁，不需要理解继承
- ✅ 使用 `new DirectoryProvider(config)` 创建 provider

### 2. 动态文档支持多目录
- ✅ 在 `KnowledgeBase` 底层直接支持动态文档
- ✅ 支持注册多个动态文档目录
- ✅ 每个目录可独立配置名称、描述、权重、是否隐藏
- ✅ 动态文档可以聚合在不同的目录下

**快速使用：**
```typescript
const workspace = new Workspace();

// 注册动态文档目录
workspace.registerDynamicDirectory({
  id: 'opened-pages',
  name: '已打开的页面',
  weight: 80,
  hidden: false
});

// 添加动态文档
await workspace.openDocument('page1', {
  type: '画布',
  content: '<页面内容>',
  title: '页面1',
  directoryId: 'opened-pages'
});
```

📖 详细文档：[动态文档功能使用指南](./DYNAMIC_DOCS_GUIDE.md)  
💡 使用示例：[example-usage.ts](./example-usage.ts)

## 概述

将原有的 `workspace` 模块重构为基于 `knowledges` 架构的实现，提供更清晰的文件系统视图和更灵活的扩展能力。从 `context` 获取所有依赖，无需手动传入 API。

## 核心特性

- **继承自 KnowledgeBase** - 拥有知识库的所有功能
- **从 context 获取依赖** - 无需手动传入 API 和 focusInfo
- **三种 Provider** - 项目信息、聚焦信息、组件配置文档
- **默认自动打开** - 项目信息和聚焦信息默认打开
- **动态文档支持** - 可以运行时添加/删除页面和组件文档
- **权重排序** - Provider 按权重排序，控制显示顺序
- **隐藏节点** - 组件配置文档是隐藏的，不在目录树中显示但可以打开

## 目录结构

```
workspace-by-knowledges/
├── types.ts                        # 类型定义
├── workspace.ts                    # Workspace 主类
├── providers/                      # Provider 实现
│   ├── project-info-provider.ts    # 项目信息 provider（文件形式）
│   ├── focus-info-provider.ts      # 聚焦信息 provider（文件形式）
│   ├── component-docs-provider.ts  # 组件配置文档 provider（隐藏目录）
│   └── index.ts
├── utils/                          # 工具函数
│   ├── components-manager.ts       # 组件管理器
│   ├── outline-focus.ts            # 聚焦层级结构生成
│   └── index.ts
├── test.ts                         # 测试文件
├── index.ts                        # 主导出
├── README.md                       # 文档
└── MIGRATION.md                    # 迁移指南
```

## 核心目录结构

### 1. 项目信息（project-info）

提供项目的画布索引信息，作为单个文件呈现（默认打开）。

**文件结构：**
```
项目信息.md [默认打开]
```

**文件内容：**
```markdown
## 画布索引
- 首页[id=u_abc123]
- 用户列表[id=u_def456] 【当前聚焦】
- 详情页[id=u_ghi789]
  - 详情子页面[id=u_jkl012]
```

**特点：**
- 单个 `.md` 文件，位于根目录
- 默认自动打开
- 包含所有画布的树形结构
- 标记当前聚焦的画布
- 权重：100（最高，排在最前面）

### 2. 聚焦信息（focus-info）

提供当前聚焦元素的层级结构和描述，作为单个文件呈现（默认打开）。

**文件结构：**
```
聚焦信息.md [默认打开]
```

**文件内容：**
```markdown
## 聚焦信息
以下是当前聚焦组件的简略树结构，展示了聚焦元素的父级、兄弟、子级元素的关系。
注意：此树结构并不完整，折叠了无关元素信息，如需详细信息请打开DSL文档获取。

<聚焦层级结构>

<聚焦描述>
```

**特点：**
- 单个 `.md` 文件，位于根目录
- 默认自动打开
- 包含聚焦元素的简略树结构
- 包含聚焦元素的详细描述
- 权重：90（排在项目信息之后）

### 3. 组件配置文档（component-docs）- 隐藏目录

提供所有组件的详细配置文档，作为隐藏的目录（不在目录树中显示）。

**目录结构：**
```
组件配置文档/ (隐藏)
├── mybricks.normal-pc.antd5.button.md (隐藏)
├── mybricks.normal-pc.antd5.input.md (隐藏)
├── mybricks.normal-pc.antd5.table.md (隐藏)
└── ... (更多组件)
```

**特点：**
- 隐藏目录，不在目录树中显示
- 目录下的文件也都是隐藏的
- 文件可以被打开查看
- 自动处理组件依赖关系（打开组件时自动打开依赖）
- 包含组件的所有使用说明
- 权重：0（默认权重）

### 4. 动态文档目录（可选）

可以注册自定义的动态文档目录，用于存放运行时生成的文档：

**目录结构：**
```
已打开的页面/ (可选)
├── 首页.md
├── 详情页.md
└── ...

已打开的组件/ (可选)
├── 按钮组件.md
├── 输入框组件.md
└── ...
```

**特点：**
- 运行时动态添加/删除
- 可以配置是否隐藏
- 可以配置权重和显示顺序

## 使用方法

### 基础使用

```typescript
import { Workspace } from './workspace-by-knowledges';

// 创建 Workspace 实例（从 context 获取所有依赖）
const workspace = new Workspace({
  name: '我的工作空间',
  description: '项目工作空间'
});

// 等待默认文件打开完成
await workspace.waitForReady();

// 获取目录树（隐藏的节点不会显示）
const tree = await workspace.getDirectoryTree({ showDescription: true });
console.log(tree);
// 输出：
// - 项目信息.md [已打开] （包含项目的画布索引）
// - 聚焦信息.md [已打开] （当前聚焦组件的树结构和描述）
// （组件配置文档目录被隐藏，不显示）

// 查看已打开的文件
console.log(workspace.getOpenedFilePaths());
// ['项目信息.md', '聚焦信息.md']

// 导出工作空间内容（用于发送给 AI）
const content = await workspace.export({ includeTree: true });
```

### 打开组件文档

```typescript
// 方式1：通过路径打开（需要知道完整路径）
await workspace.openComponentDoc('组件配置文档/mybricks.normal-pc.antd5.button.md');

// 方式2：通过 namespace 打开（推荐）
await workspace.openComponentDocByNamespace('mybricks.normal-pc.antd5.button');

// 自动打开依赖组件
// 如果 button 组件依赖 icon 组件，icon 组件也会被自动打开
```

### 动态文档功能

```typescript
// 1. 注册动态文档目录
workspace.registerDynamicDirectory({
  id: 'opened-pages',
  name: '已打开的页面',
  description: '用户打开的页面文档',
  weight: 80,
  hidden: false // 不隐藏，在目录树中显示
});

// 2. 打开文档（使用 openDocument 方法）
await workspace.openDocument('page_u_abc123', {
  type: '画布',
  content: '<页面内容>',
  title: '首页',
  description: '项目首页',
  directoryId: 'opened-pages'
});

// 3. 关闭文档
workspace.closeDocument('page_u_abc123', 'opened-pages');

// 4. 清空所有动态文档
workspace.clearDynamicDocuments('opened-pages');
```

### 高级功能

```typescript
// 刷新工作空间（当 context.currentFocus 变化时）
await workspace.refresh();

// 查找节点（包括隐藏的节点）
const node = await workspace.findNode('组件配置文档/mybricks.normal-pc.antd5.button.md');

// 获取已打开的文件列表（包括隐藏文件）
const openedFiles = workspace.getOpenedFilePaths();

// 关闭文件
workspace.closeFile('项目信息.md');

// 清空所有已打开的文件
workspace.clearOpenedFiles();

// 获取根节点
const root = workspace.getRoot();

// 获取动态文档
const doc = workspace.getDynamicDocument('page1', 'opened-pages');
```

## 与原 Workspace 的对比

### 原 Workspace

```typescript
// 需要手动传入 API 和 outlineInfoManager
const workspace = new WorkSpace(
  { currentFocus },
  workspaceAPI,
  outlineInfoManager
);

// 打开文档
workspace.openDocument(id);

// 获取项目结构
const projectStruct = workspace.getProjectStruct();

// 打开组件文档
workspace.openComponentDoc(namespace);

// 检查是否有组件文档
if (workspace.hasComponentsDocs()) {
  const docs = workspace.getComponentsDocs();
}
```

**特点：**
- 需要手动传入多个依赖
- 命令式 API
- 文档管理较为简单
- 结构相对扁平

### 新 Workspace

```typescript
// 从 context 获取所有依赖，无需手动传入
const workspace = new Workspace({
  name: 'Workspace',
  description: '工作空间知识库'
});

// 默认自动打开项目信息和聚焦信息
await workspace.waitForReady();

// 打开组件文档（通过 namespace）
await workspace.openComponentDocByNamespace('mybricks.normal-pc.antd5.button');

// 打开动态文档
await workspace.openDocument('page1', {
  type: '画布',
  content: '<页面内容>',
  directoryId: 'opened-pages'
});

// 获取目录树（隐藏节点不显示）
const tree = await workspace.getDirectoryTree();

// 导出所有内容（包含已打开的隐藏文件）
const content = await workspace.export();
```

**特点：**
- 从 context 获取依赖，更简洁
- 继承自 KnowledgeBase，拥有知识库的所有功能
- 文件系统视图，更直观
- 动态内容获取，始终最新
- 自动处理组件依赖关系
- 支持动态文档、权重排序、隐藏节点
- 更好的扩展性

## 优势

1. **从 context 获取依赖**
   - 无需手动传入 API 和 focusInfo
   - 代码更简洁，减少参数传递

2. **清晰的文件系统视图**
   - 所有资源以文件形式呈现
   - 路径清晰，易于理解

3. **动态内容获取**
   - 每次打开文件都获取最新内容
   - 不缓存过期数据

4. **灵活的扩展能力**
   - 继承自 KnowledgeBase，拥有知识库的所有功能
   - 基于 Provider 模式
   - 可以轻松添加新的目录类型

5. **自动依赖管理**
   - 打开组件时自动加载依赖
   - 避免遗漏必要信息

6. **统一的导出接口**
   - 可直接导出为大模型消息
   - 格式统一，易于处理

7. **支持高级功能**
   - 动态文档
   - 权重排序
   - 隐藏节点
   - 自定义根节点

## 快速切换

由于是独立的文件夹，可以方便地在新旧实现之间切换：

```typescript
// 使用旧实现
import { WorkSpace } from './workspace/workspace';

// 使用新实现
import { Workspace } from './workspace-by-knowledges';
```

两者可以共存，不会相互影响，方便逐步迁移或对比测试。

## 扩展指南

### 添加新的 Provider

如需添加新的目录类型，只需：

1. 在 `providers/` 目录创建新的 provider 文件
2. 使用 `new DirectoryProvider(config)` 创建 Provider
3. 在 `Workspace` 的构造函数中注册该 Provider

示例：

```typescript
// providers/my-custom-provider.ts
import { DirectoryProvider, IKnowledgeNode, KnowledgeNodeType } from '../../knowledges/types';
import { context } from '../../../context';

export function createMyCustomProvider() {
  return new DirectoryProvider({
    id: 'my-custom',
    name: '我的自定义内容',
    description: '自定义内容描述',
    weight: 50, // 设置权重
    hidden: false, // 是否隐藏

  async getChildren(parentId: string): Promise<IKnowledgeNode[]> {
      if (parentId === 'my-custom') {
        // 从 context 获取数据
        const data = context.api?.custom?.getData?.();
        
        return data.map(item => ({
          id: item.id,
          name: item.name,
          type: KnowledgeNodeType.FILE,
          extname: '.md',
          metadata: { providerId: 'my-custom' }
        }));
      }
      return [];
    },

  async readFile(fileId: string): Promise<string> {
      // 从 context 获取文件内容
      return context.api?.custom?.getContent?.(fileId) || '';
    }
  });
}

// workspace.ts
import { createMyCustomProvider } from './providers/my-custom-provider';

class Workspace extends KnowledgeBase {
  constructor(config?: WorkspaceConfig) {
    super({ name: 'Workspace', ... });
    
    // 注册自定义 Provider
    this.registerProvider(createMyCustomProvider());
  }
}
```

### 添加新的动态文档目录

```typescript
// 在 Workspace 构造函数中
this.registerDynamicDirectory({
  id: 'custom-docs',
  name: '自定义文档',
  description: '自定义的动态文档',
  weight: 60,
  hidden: false
});

// 使用
await workspace.openDocument('doc1', {
  type: '自定义',
  content: '内容',
  directoryId: 'custom-docs'
});
```

## 注意事项

1. **从 context 获取依赖** - 确保在设计器环境中运行，context 必须已经初始化
2. **默认自动打开** - 项目信息和聚焦信息默认自动打开，无需手动调用 openFile
3. **动态内容获取** - 所有文件内容都是动态获取的，确保 API 能正确返回最新数据
4. **组件依赖管理** - 打开组件文档会自动加载依赖，可能会打开多个文件
5. **路径格式** - 路径区分大小写，使用正斜杠 `/` 分隔，如 `组件配置文档/pc.button.md`
6. **隐藏节点** - 组件配置文档目录是隐藏的，不会在目录树中显示，但可以被打开和使用
7. **权重排序** - Provider 按权重排序：项目信息(100) > 聚焦信息(90) > 动态文档目录(可配置) > 组件配置文档(0)
8. **刷新机制** - 当 context.currentFocus 变化时，可以调用 `workspace.refresh()` 刷新工作空间

## API 参考

### Workspace 类

继承自 `KnowledgeBase`，拥有所有知识库的方法。

#### 构造函数

```typescript
constructor(config?: WorkspaceConfig)

interface WorkspaceConfig extends KnowledgeBaseConfig {
  // 所有依赖从 context 获取，无需传入
}
```

#### Workspace 特有方法

- `waitForReady(): Promise<void>` - 等待默认文件打开完成
- `openComponentDoc(path: string): Promise<void>` - 打开组件文档（通过路径）
- `openComponentDocByNamespace(namespace: string): Promise<void>` - 打开组件文档（通过 namespace）
- `openDocument(id: string, options: OpenDocumentOptions): Promise<void>` - 打开动态文档
- `closeDocument(id: string, directoryId?: string): void` - 关闭动态文档
- `refresh(): Promise<void>` - 刷新工作空间

#### 继承的方法（来自 KnowledgeBase）

- `registerProvider(provider: IDirectoryProvider): void` - 注册 Provider
- `registerDynamicDirectory(config: DynamicDocDirectoryConfig): void` - 注册动态文档目录
- `openFile(path: string): Promise<void>` - 打开文件
- `closeFile(path: string): void` - 关闭文件
- `isFileOpened(path: string): boolean` - 检查文件是否已打开
- `getOpenedFilePaths(): string[]` - 获取已打开的文件列表
- `clearOpenedFiles(): void` - 清空所有已打开的文件
- `getDirectoryTree(options?): Promise<string>` - 获取目录树
- `export(options?: ExportOptions): Promise<string>` - 导出为消息内容
- `findNode(path: string): Promise<KnowledgeNode | null>` - 查找节点
- `getRoot(): KnowledgeNode` - 获取根节点
- 以及所有动态文档相关方法...

