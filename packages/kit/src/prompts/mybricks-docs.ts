import type { MybricksPromptSections } from "./mybricks";

const MYBRICKS_DOCS_PROMPT = `
<MyBricks 页面关联文档规范>

页面关联文档使用 YAML 维护。下面的字段、归属、扫描和校验规则本身就是完整协议，必须依据真实项目文件、真实 React 组件声明、真实 JSX 结构和真实运行逻辑生成文档。

<文件组织>
- 开始任务时必须先检查项目空间中是否存在固定目录 .myrbicks/graph/。
- 只有 .myrbicks/graph/ 存在时，才使用其中的 .yaml 或 .yml 页面关联文档。
- 通常一个页面对应一个 YAML 文件，例如 .myrbicks/graph/SignIn.yaml；一个页面的页面文件、React 组件、弹窗、事件、数据源、状态和页面关系集中在同一个文件中，不要为同一个页面拆成多个文档文件。
- YAML 文件名使用页面或模块的稳定英文名称，建议与 page.name 保持一致。
- page.fileName 必须显式填写，指向实际页面 TSX/JSX 文件的项目相对路径，例如 pages/SignIn/index.tsx。fileName 是页面与源码之间的主要关联依据。

<维护时机>
- 必须维护：.myrbicks/graph/ 下缺少对应页面 YAML；现有 YAML 内容与源码不符；或需求明确要求更新文档。更新时必须逐行审查源码与 YAML 的差异，确保 events、datasource、state 的元素 selector、字段、流程图和页面关系完全对齐。
- 建议更新：页面 fileName 对应的 tsx/jsx 文件新增、删除或重命名了 React 组件声明；页面中实际渲染的组件发生变化；页面入口或路由注册的页面文件发生变化；JSX 中新增、删除或修改了带事件 props 的元素或其 className/id；JSX 中新增、删除或修改了渲染 React state 的元素或其 className/id；新增、删除或修改了触发 datasource 调用的元素；某个文件或 React 组件的 UI 结构、交互或业务含义发生明显变化。
- 无需更新：页面 TSX/JSX 未被修改且现有 YAML 已正确反映页面文件、组件声明、事件和说明；仅修改与节点行为无关的 style.less 等样式文件。

<搜索思路>
先确认页面文件
- 页面文件：搜索 pages/ 下的 tsx/jsx 文件，或搜索路由注册、入口注册、页面跳转等使用的页面文件路径。
</搜索思路>

<真实节点识别>
不要根据特定框架 API、虚构的节点类型或约定性函数名识别节点，必须阅读真实项目源码：
- page：由一个实际 TSX/JSX 文件承载的页面。每个 YAML 只描述一个 page，page.fileName 必须指向该文件；页面的判断依据是文件内容、页面目录、入口注册、路由使用和实际渲染关系的综合结果。
- component：源码中实际声明的 React 组件，包括 function、箭头函数、class 组件以及有明确 React 组件类型的声明。component 的 name 必须与源码中的真实组件声明名称一致。
- popup：源码中实际声明、并且通过 JSX 结构或交互逻辑承担弹窗、抽屉、浮层、对话框等职责的 React 组件。仅因为名称中出现 Modal、Dialog 或 Popup 不能直接判定为 popup，必须以真实渲染和交互行为为依据。
- 强制要求：页面 YAML 的 nodes 必须覆盖 fileName 对应页面文件中实际参与页面渲染的 React 组件，包括页面组件之外的子组件、列表容器、列表单项、表单、弹窗和其它有独立职责的组件；不得只描述页面文件而遗漏真实组件。
- 页面文件中存在但没有参与当前页面渲染、没有独立 UI 职责或只是普通工具函数的声明，不要伪造为 component 节点。
- nodes 是扁平数组，不要使用 components、children、popups 等树状 Map；页面和组件的实际关系以真实 JSX、导入导出、路由和事件关系为依据，编译时会将 page 和 nodes 展平成 notifyChanged 使用的节点 Map。

<YAML 节点结构>
页面 YAML 使用固定的 version、page、nodes 字段。每个 YAML 只对应一个页面，不要把多个页面放进 pages 数组，也不要把组件继续嵌套成树。

selector 是字符串字段，不要把 selector 作为动态 YAML key。源码真实 className 写成 ".className"，源码真实 id 写成 "#elementId"。YAML 中未加引号的 # 会被解析成注释，不能省略引号；不要把 className 或 id 写成没有前缀的裸字符串。

version: 1

page:
  name: SignIn
  fileName: pages/SignIn/index.tsx
  title: 登录页
  summary: >-
    用户登录入口页，提供登录参数校验、请求处理和结果展示。
  events:
    - selector: ".signInBtn"
      name: onClick
      title: 登录
      mermaid: >-
        flowchart LR; A["校验登录参数"] --> B{"参数是否有效"}; B -->|"有效"| C["设置loading状态"]; B -->|"无效"| D["提示参数错误"]
      relations:
        - name: HomePage
          type: page

nodes:
  - name: LoginForm
    title: 登录表单
    summary: 对应 pages/SignIn/index.tsx 中真实声明并被页面渲染的 LoginForm 组件。
    type: component
    datasource:
      - selector: ".signInBtn"
        api: signIn
        desc: 点击登录按钮调用 dataSource.signIn 完成登录
    state:
      - selector: ".loginInfo"
        field: welcomeMsg
        desc: 展示登录成功后的欢迎语
      - selector: ".signInBtn"
        field: loading
        desc: 登录接口请求中的加载状态

<页面与组件关联>
- 页面节点的 fileName 必须是实际存在的 TSX/JSX 文件路径，禁止只凭页面名称猜测文件位置。
- 读取 fileName 对应文件后，扫描 import、export、function、const、class、JSX 标签、组件调用和路由/入口注册，确认页面实际包含哪些 React 组件。
- component 的 name 必须使用源码中真实声明的 React 组件名；不要使用组件的中文标题、文件夹名或自行创造的别名代替 name。
- 页面文件名、组件声明名、组件实际使用位置和 YAML 节点 name 不一致时，先修正关联关系，再补充字段。
- 一个页面文件可以声明多个 React 组件；每个具有独立 UI、交互、状态或数据请求职责的组件都应在 nodes 数组中有独立记录。
- 组件通过 props 传递给另一个组件时，状态、事件和数据源仍归属真实声明并实际消费它们的组件，不要因为页面层级而上提或复制。
- 页面跳转、弹窗打开和组件嵌套关系必须根据真实 JSX、路由配置、状态控制、事件处理和组件调用判断，不得只根据节点名称推断。
- datasource、state、events 都是记录数组；每条记录通过 selector 关联源码中的真实元素。真实 className 使用 ".className"，真实 id 使用 "#elementId"；如果源码中只有 className，不得改写成 id，反之亦然。

<文档位置对应规则>
- page：使用 page.fileName 指向真实页面 TSX/JSX 文件；name 使用页面文件中实际的页面组件声明名，若文件没有可作为页面的命名声明，再使用稳定的文件名。
- React 组件节点：放在 nodes 数组中；name 使用源码中的真实组件声明名，type 写 component。
- 弹窗组件节点：放在 nodes 数组中；只有源码实际承担浮层职责时 type 才能写 popup。
- 页面文件中真实存在但不参与页面渲染的工具函数、类型、常量和普通 hooks，不得写成 component 节点；如果它直接承载 UI 的自定义 hooks 逻辑，应在所属 React 组件的字段中说明，不要虚构 React 组件。
- 已有 YAML 节点直接更新，禁止为同一个页面文件或 React 组件声明新增重复节点。

<节点字段>
page 必须包含 name、fileName、title、summary；nodes 中每个节点必须包含 name、title、summary、type。
- name：节点名称。page 使用真实页面组件声明名或稳定文件名；component 和 popup 使用源码中真实的 React 组件声明名；不得使用虚构名称。
- title：根据页面或组件的真实职责写简洁的语义化标题，避免与 name 简单重复。例如组件名是 SignInForm 时，title 应写登录表单而不是 SignInForm。
- summary：页面或组件的用途、场景和关键行为说明，补充 title 未覆盖的信息，避免只罗列 UI 元素。
- type：nodes 中只能使用 component、popup；component 表示真实 React 组件，popup 表示真实承担浮层职责的 React 组件。page 的类型由固定的 page 字段确定。
- fileName：page.fileName 是实际 TSX/JSX 项目相对路径；运行时用它构造 data-zone-filename，必须与实际渲染文件一致。nodes 不填写 fileName。

<datasource 协议>
datasource 记录真实 React 组件作用域内实际触发的 dataSource.ts 接口调用，归属声明并执行该调用的最近组件，不是页面级接口清单。
- 触发机制：React 组件的事件处理器或 React hooks（如 useEffect、useCallback）直接调用 dataSource.ts 中的函数发起请求时，必须记录该真实函数。
- 判断标准：组件代码中出现 await dataSource.xxx() 或 dataSource.xxx()，就必须记录 datasource，api 名称必须是 dataSource.ts 中真实导出的函数名。
- 结构：datasource 是数组，每条记录包含 selector、api、desc。
  - selector：触发调用元素的真实 CSS selector；className 写成 ".className"，id 写成 "#elementId"。
  - api：dataSource.ts 中导出的真实函数名。
  - desc：接口用途说明。
  - 没有具体交互元素、由 React hooks 在组件挂载时发起的初始化请求，selector 使用 "root"。
- datasource 写在声明并执行接口调用的最近 React component、popup 或 page 节点；不要因为调用发生在子组件内部就复制到父页面。
- 由按钮、表单等具体交互元素触发时，必须使用该元素真实的 ".className" 或 "#elementId"，禁止错误归到 "root"。
- 严禁重复：接口调用发生在哪个真实 React 组件的代码作用域内，就只记录在该最小组件节点中，父页面和上层组件禁止重复声明。
- 没有接口调用时省略 datasource，禁止写空对象、无接口调用等占位文本。
- 强制扫描：写 datasource 前必须阅读页面和组件代码，检查每个事件处理函数和 React hooks 回调体内的 dataSource.xxx() 调用；按钮触发和初始化调用都不能漏记。

<state 协议>
state 只记录真实 React 组件通过 useState、useReducer、自定义hooks 等状态管理、并实际渲染到 JSX UI 的状态，归属声明和消费该状态的最近组件，而不是页面级状态汇总。
- 如果状态值直接渲染在 JSX 标签上，selector 使用该标签真实的 ".className" 或 "#elementId"；如果源码同时没有 className 和 id，必须先在源码中补充语义化 className，再写 YAML。
- 直接渲染示例：<div className={css.xxx}>{someState}</div>；通过 prop 传入也算渲染，例如 <img className={css.xxx} src={imageUrl} />，其中 imageUrl 是 state 变量。
- 结构：state 是数组，每条记录包含 selector、field、desc。
  - selector：实际渲染状态元素的真实 CSS selector；className 写成 ".className"，id 写成 "#elementId"。
  - field：真实 React 组件中 useState/useReducer 声明的变量名。
  - desc：状态用途说明。
- "root" 只允许在极端情况使用：该 React 组件的 JSX 根元素自身没有 className 和 id，并且状态数据直接渲染在这个根元素上。绝对禁止把子孙元素渲染的状态写到 root 下。
- 如果 React state 只参与逻辑控制、没有直接影响 JSX UI 渲染，禁止写入 state；不能因为子组件存在状态就把它写到父页面 root 下。
- 严禁重复：状态实际由哪个 React 组件消费和渲染，就只能记录在该最小组件节点；父 page 或上层 component 禁止重复声明子组件状态。
- 没有状态渲染时省略 state，禁止写空对象或无状态渲染等占位文本。
- 精确粒度：selector 必须是实际渲染状态的元素，而不是父容器。例如 card 容器中渲染 userName 的 span，state 应使用 userName 对应的 ".userName"，不应使用 ".card"。
- state 只记录组件自身通过 React hooks 管理的状态。

<events 协议>
events 记录真实 React 组件作用域内所有带事件 props 的交互元素，归属事件处理函数所在的最近组件。
- 带 onClick、onChange、onBlur 等事件 props 的元素必须有 className 或 id；源码两者都缺少时，先补充语义化且唯一的 className，再写 YAML。
- 结构：events 是数组，每条记录包含 selector、name、title、mermaid，可选 relations。
  - selector：带事件元素的真实 CSS selector；className 写成 ".className"，id 写成 "#elementId"。
  - name：事件 props 的真实名称，例如 onClick、onChange、onBlur。
  - title：简短中文说明。
  - mermaid：完整事件流程图。
  - relations：事件涉及页面跳转或打开浮层时使用数组，每项包含真实节点 name 和 page/popup type。
- 每个事件都必须描述该元素上的完整事件流程。relations 只在事件真实涉及页面跳转或打开浮层时使用，每项的 name 是实际节点 name，type 只能是 page 或 popup。
- relations 中的 page 必须指向真实 page 节点，popup 必须指向真实承担浮层职责的 React 组件节点；禁止根据名称捏造关系。
- 严禁重复：事件发生在哪个真实 React 组件的 JSX 作用域内，就只记录在该最小组件节点；父页面禁止重复声明子组件事件。
- 没有交互事件时省略 events，禁止写空对象或无事件占位文本。
- 严禁使用 root 作为 events 第一层 key；events 只能描述具体元素的 onXXX 实现，不存在整个根节点事件。只有 datasource 或 state 的极端初始化场景才允许使用 "root"。

<Mermaid 协议>
- 流程图方向统一使用 LR，格式以 flowchart LR; 开头；所有节点文本必须使用双引号。
- 条件判断节点使用 {} 包裹，分支标签使用 |标注内容| 写在箭头上。
- 判断节点的每个分支必须分别从判断节点引出，并用分号分隔。正确：B{"是否展开"} -->|"是"| C["移除"]; B -->|"否"| D["添加"]。错误：B{"是否展开"} -->|"是"| C["移除"] -->|"否"| D["添加"]。
- 每条语句末尾用分号分隔，最后一条语句不加分号；生成后检查多余分号、引号统一、节点连接完整、无断链和悬空节点。
- 流程图逻辑必须贴合真实 React 事件处理函数和 hooks 回调，节点名称简洁，避免冗余步骤。
- 流程图必须覆盖事件处理函数和 hooks 回调的完整链路，从真实元素事件到处理结束，不得省略内部逻辑。
- 禁止出现调用 XX API、调用 XX 函数等无意义节点；需要展开这些调用内部的真实业务逻辑。
- 节点使用动作描述，不写具体取值。例如写设置 loading 状态、取消 loading 状态，不写设置 loading 为 true、设置 loading 为 false。
- 禁止用户动作类节点，如点击按钮；禁止开始、结束、执行业务操作等空洞节点。
- 必须严格依据真实代码绘制，不得捏造业务。
- if/else、三元判断、early return、请求成功/失败等每个分支都必须用判断节点和分支标签表达，并且每个分支后续都要独立延伸。

<编译协议>
- 运行时读取 .myrbicks/graph/ 下的 YAML，必须使用 page.fileName 将 YAML 关联到实际 TSX/JSX 文件；禁止按 YAML 文件名或自然语言页面名猜测文件。
- version、page、nodes 是固定结构；page 生成 page 节点，nodes 中的 type 生成 component 或 popup 节点。
- datasource、state、events 数组编译为设计器服务、状态和交互信息；relations 数组编译为真实页面或浮层关联信息。
- 所有 ".className" / "#elementId" 必须来自源码真实元素，所有 API、状态变量、事件、节点和关系必须来自真实项目代码；YAML 只记录和编译真实信息，不得捏造。
- 每次修改源码或 YAML 后，必须重新逐字对比两者，确保页面 fileName、组件声明名、nodes、selector、字段、流程图和 relations 完整一致。
</编译协议>
</MyBricks 页面关联文档规范>
`;

export const MYBRICKS_DOCS_PROMPT_SECTIONS = {
  developeGuide: {
    firstOfAll: `参考项目完成需求`,
    assetsUsageSection: `无`,
    architectureSection: `无`,
    examplesSection: ``,
    end: `无`,
  },
  designGuide: {
    firstOfAll: `按照需求完成`,
  },
  documentGuide: {
    firstOfAll: MYBRICKS_DOCS_PROMPT,
    requirementGuide: `无`,
  },
} satisfies MybricksPromptSections;

export type MybricksDocsPromptSections = typeof MYBRICKS_DOCS_PROMPT_SECTIONS;
