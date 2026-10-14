---
name: audit-power
description: 提供页面级的审计能力指导，支持对页面的「接口、事件」进行可视化分析，仅在主动提及时使用。
when_to_use: 仅在用户提及对页面生成审计文档时使用。
---

# 审计视图

本 skill 的核心是围绕「审查目标」的 进行分析，提供审计视图：审查代码变更，形成可审计、可视化、可追溯的视图。分析维度既可以单独分析，也可以按用户意图组合分析，取决于用户这次想看什么。

审查内容按「分析维度」分成两个部分：

- **维度一：接口 和 事件**，先根据 `docs_understand_page` 生成审查目标的静态分析文档，再根据静态分析内容搜索代码实际情况，生成针对页面的可视化文档，最后使用 `docs_validate_page` 进行校准，直至生成完成

> 注意：用户需要主动说明需要看什么维度的信息，我们只修改对应维度的内容，不要超出用户需要修改的维度。

---

## 维度：接口 + 事件的可视化文档

这一部分描述页面**当前状态**下的接口调用与事件交互，通过静态分析直接从代码得出，天然按页面组织。

代码可视化文档使用 YAML 维护，放在项目的 `<configDirName>/graph/` 目录中。

文档必须依据真实的项目文件和代码进行生产，本身是面向非研发用户，对于title、desc、suammry 和 流程图都需要去研发味，更加通俗易懂；

切记：不得为了文档改动源代码文件。

核心原则：
- 在尽可能少地阅读完整文件的前提下，收集并整理文档，如果你有 页面分析 工具，可以优先调用此工具 加上目标组件的路径，先静态分析路径，能够大大减少查询成本。
- 元素绑定优先使用 JSX 源码位置，而不是 CSS selector。
- 每个节点都必须通过 `fileName` 指向真实的 TSX/JSX 文件。

<搜索方式>
1. 先查看项目的路由文件，确认路由和页面组件的关系，确定页面组件都有哪些。
2. 使用 docs:understand_page 工具（一次只能分析一个页面）来分析页面的变量、API、组件等元信息，注意必须有page节点，并且route字段需要基于真实路由进行。
2. 基于分析信息，对照搜索该页面实际使用的 React 组件、事件、状态和数据源。
3. 对照 JSX、组件声明和业务逻辑，生成修改文档，保证文档完整且准确。
4. 使用 docs:validate_page 工具检查文档的准确性。

<文件组织>
- 开始任务时先检查是否存在 `<configDirName>/graph/`，确认是在迭代已有文档还是新增文档。
- 通常一个页面对应一个 YAML，例如 `<configDirName>/graph/SignIn.yaml`；页面、React 组件、弹窗、事件、数据源、状态和页面关系集中在同一个文件中。

<维护时机>
- 必须维护：缺少对应 YAML、YAML 与源码不符，或需求明确要求更新文档。
- 建议更新：节点对应 TSX/JSX 文件新增、删除、重命名；JSX 标签、事件、状态渲染、数据源调用或组件职责发生变化。
- 无需更新：TSX/JSX 未变化且 YAML 已准确；仅调整与行为无关的样式文件。

<节点类型区分>
- 页面：由实际 TSX/JSX 文件承载的页面组件，`fileName` 指向该文件。
- 组件：真实声明并参与当前页面渲染的 React 组件。
- 弹窗：真实承担弹窗、抽屉、浮层或对话框职责的 React 组件，不能仅由名称判断。
- 项目中每个有独立 UI、交互、状态或请求职责的真实组件都应有独立节点，工具函数、类型、常量和不得写成节点。。

<YAML 结构与绑定协议>

最外层是一个 YAML 节点数组：第一个元素固定 `version`，后续每个元素是页面、组件或弹窗节点
`datasource`、`state`、`events` 都是数组；
每一项通过同级的 `loc` 和/或 `selector` 关联真实 JSX 元素。

每条记录支持两套定位：
- 首选 `loc`：源码组件JSX定位，格式为 `JSXTag:startLine-endLine`，开始和结束为JSX标签的开始和结束位置，例如 `"Button:42-44"`，单行可以写 `"Table:361-361"`，如果是jsx片段，则写元素标签，`span:380-400`。文件路径不写入 loc，由所属节点的 `fileName` 提供。
- 可选 `selector`：在有明确 selector 时 填写真实 CSS selector。class 使用 `".className"`，id 使用 `"#elementId"`；组合 selector 可以是 `".wait_content button"`。YAML 中 `#` 必须加引号。
- 同一条记录可以同时写 `loc` 和 `selector`：我们会使用 `location`为主 + selector辅助 进行可视化渲染
- 只有 `useEffect` 等没有具体 JSX 触发元素的初始化数据源，才使用 `selector: root`；此场景不要求 `loc`。
- `events` 不能使用 `root`，必须绑定到真实带事件 props 的 JSX 标签。

```yaml
- version: 1
- name: SignIn
  fileName: pages/SignIn/index.tsx
  type: page
  route: /sign
  title: 登录页
  summary: 用户登录入口页，提供登录参数校验、请求处理和结果展示。
  events:
    - loc: "Button:42-44"
      selector: ".signInBtn"
      name: onClick
      title: 登录
      mermaid: >-
        flowchart LR; A["校验登录参数"] --> B{"参数是否有效"}; B -->|"有效"| C["设置按钮为加载中状态"]; B -->|"无效"| D["提示参数错误"]
      relations:
        - name: HomePage
          type: page

- name: LoginForm
  fileName: pages/SignIn/LoginForm.tsx
  type: component
  title: 登录表单
  summary: 用于完成用户登录的表单。
  datasource:
    - loc: "Button:42-44"
      api: signIn
      desc: 提交登录信息并获取用户资料
  state:
    - loc: "Alert:55-57"
      field: welcomeMsg
      desc: 展示登录成功后的欢迎语
    - loc: "span:89-102"
      field: username
      desc: 展示获取过来的用户名称
```

<节点字段>

每个节点必须包含 `name`、`fileName`、`title`、`summary`、`type`。

- `name`：page 使用真实页面组件声明名或稳定文件名；component 和 popup 使用真实 React 组件声明名。
- `fileName`：节点 JSX 所在的真实 TSX/JSX 项目相对路径；不能省略，也不能猜测。
- `title`：简洁的语义化中文标题。
- `summary`：真实职责、场景和关键行为说明。
- `type`：`page`、`component`、`popup`。
- `route`: 对于页面来说，需要声明具体路由信息

<datasource 协议>

- 记录最近 React 组件作用域内真实调用的远程接口，`api` 必须是代码中真实函数名。
- 每条记录为 `loc`/`selector`、`api`、`desc`。由具体 JSX 触发时，使用该 JSX 标签的 `loc`；由挂载 hooks 发起时，使用 `selector: root`。
- 调用属于哪个最小组件，就只记录在哪个节点，禁止在父节点重复。

<state 协议>

- 只记录组件自身管理、且真实渲染到 JSX UI 的状态。
- 每条记录为 `loc`/`selector`、`field`、`desc`；`loc` 必须指向实际渲染该状态的 JSX 标签。
- 不直接影响 UI 的逻辑状态不记录；没有状态渲染时省略 `state`。
- `root` 仅允许没有可定位 JSX 子元素的极端渲染场景，优先使用根 JSX 标签的 `loc`。

<events 协议>

- 记录真实 JSX 标签上的 `onClick`、`onChange`、`onBlur` 等事件，归属事件处理函数所在的最近组件。
- 每条记录为 `loc`/`selector`、`name`、`title`、`mermaid`，可选 `relations`；`loc` 必须指向带该事件 props 的真实 JSX 标签。
- `relations` 仅在真实页面跳转或打开浮层时填写；每项使用真实节点 `name` 和 `page`/`popup` type。
- 不要为事件新增 className/id，也不要用父容器 selector 代替事件标签的位置。

<Mermaid 协议>
- 流程图以 `flowchart LR;` 开头，节点文本使用双引号。
- 条件判断使用 `{}`，每个分支从判断节点独立引出，并用 `|分支标签|` 标注。
- 流程必须覆盖真实事件处理器和 hooks 回调中的分支、请求成功/失败与 early return，不得捏造。

<编译协议>

- 第一个元素是 version，后续每个节点通过自身 `fileName` 关联到对应 JSX 源码文件。
- 所有节点、文件、标签、行号、API、状态字段、事件与关系必须来自真实代码。修改源码或 YAML 后，重新逐项核对 `fileName`、`loc`、`selector`、字段和流程图。
