import { fileFormat } from "@mybricks/rxai";
import { jsonrepair } from 'jsonrepair'
import { getFiles, transformPageInfo } from './utils'
import { ComponentsManager } from './../agents/workspace/components-manager'

const NAME = 'build-event-flow'
buildProcess.toolName = NAME

enum Status {
  IDLE = "IDLE",
  RUNNING = "RUNNING",
  FINISHED = "FINISHED"
}

const getCurrentFocusComponentDescription = (params: any) => {
  const { type, outlineInfo } = params;
  const { id, title, data, inputs, outputs } = outlineInfo;
  if (type === "logicCom") {
    return "<当前聚焦组件说明>" + 
    "\n类型：计算组件" +
    `\n标题：${title}` +
    `\nid：${id}` +
    `\n数据源：${JSON.stringify(data)}` + 
    `\n输入项：${inputs?.length ? inputs.reduce((pre: string, { hostId, title }: any) => {
      return pre + `\n  - ${title}（${hostId}）`
    }, "") + "\n" : "无"}` +
    `\n输出项：${outputs?.length ? outputs.reduce((pre: string, { hostId, title }: any) => {
      return pre + `\n  - ${title}（${hostId}）`
    }, "") + "\n" : "无"}` +
    `注意：
- 除了上述列出的输入、输出外，还可以从<组件使用文档>的<可以使用的配置项>内查看组件是否支持创建输入和输出项目。` + 
    "\n</当前聚焦组件说明>"
  }

  return "";
}

const initDiagram = (diagramInfo: any) => {
  if (!diagramInfo) {
    return null
  }

  return {
    ...diagramInfo,
    status: Status.IDLE
  }
}

function buildProcess(props: any) {
  // const pageOutlineInfo = props.getPageOutlineInfo();
  // const connectableComponents = scopeBasedComponentStructure({...pageOutlineInfo, id: "_root_", title: "页面", scope: true });
  // console.log("[pageOutlineInfo]", pageOutlineInfo);
  // console.log("[connectableComponents]", connectableComponents)
  // throw new Error("stop")

  const streamActionsParser = createActionsParser();

  /** key: comid-outputid -> diagramId */
  const diagramIdMap: Record<string, {
    id: string;
    status: Status
  }> = {};
  let currentDiagram: { id: string, status: Status } | null = initDiagram(props.getDiagramInfo());
  let updatePageStatus: Status = Status.IDLE;
  let updateComStatus: Status = Status.IDLE;

  return {
    name: NAME,
    // displayName: "搭建事件流程",
    displayName: "事件/逻辑配置",
    description: `配置计算组件，搭建各类事件流程，绑定变量，实现数据驱动

处理以下需求：
  1. 当...时，要...
  2. 添加...事件/流程
  3. 增/删/改/查...
  4. 数据处理
  5. 驱动ui更新
  6. 变量绑定
  7. 根据..数据搭建/开发
  8. 把..改成动态、涉及到驱动ui的
  9. 对计算组件的配置

参数：无
工具分类：操作执行类
作用：
  1. 创建组件事件；
  2. 搭建事件流程；
前置依赖：
  - 必须确保之前进行过「获取DSL」；
  - 如果需要添加计算组件，确保之前有进行过「组件选型」，添加计算组件必须通过组件选型来获取组件配置文档；

明确调用时机：
当需求中出现以下任意特征时，请使用本工具：
1. 句式特征："点击/输入/选择...后，需要..."，"添加事件/流程..."
2. 关系特征：将组件A的某个事件与组件B的某个动作连接
3. 流程特征：为交互事件配置后续的响应链

典型适用案例：
• "点击提交按钮后，调用API接口"
• "输入框内容变化时，实时验证表单"
• "下拉选择变更时，更新相关组件"
• "页面加载完成后，初始化数据"

不适用情况：
• 仅修改单个组件属性（使用属性配置）
• 纯数据计算转换（使用数据处理）
• 样式或布局调整（使用样式工具）

关键识别模式：
需求 = [触发组件] + [事件类型] + [连接关系] + [目标组件] + [执行动作]
示例："表格组件的行点击事件 → 连接到详情弹窗的显示动作"

提示：如果需求描述了一个"因果链"，本工具就是正确选择。
`,
    getPrompts: () => {
      const pageOutlineInfo = props.getPageOutlineInfo();
      const connectableComponents = pageOutlineInfo ? scopeBasedComponentStructure({...pageOutlineInfo, id: "_root_", title: "页面", scope: true }) : "";
      const targetPageId = props.getPageId();
      const pages = transformPageInfo(props.getAllPageInfo());
      const allPageInfo = pages.reduce((pre: string, { id, title, type, inputs, outputs }: any) => {
        if (id === targetPageId) {
          // 跳过当前页
          return pre;
        }

        return (pre ? (pre + "\n") : "") + `- ${title}` + 
        `\n  页面id：${id}` + 
        `\n  输入端口列表：${inputs.reduce((pre: string, { id, title }: any) => {
          return pre + `\n    - ${title}（${id}）`
        }, "")}` + 
        `\n\n  输出端口列表：${outputs.reduce((pre: string, { id, title }: any) => {
          return pre + `\n    - ${title}（${id}）`
        }, "")}`

        // return (pre ? (pre + "\n") : "") + `<${title}>` + 
        // `\n场景名称：${title}` + 
        // `\nsceneId: ${id}` + 
        // `\n输入端口列表：${inputs.reduce((pre: string, { id, title }: any) => {
        //   return pre + `\n` + ` - ${title}（${id}）`
        // }, "")}` + 
        // `\n输出端口列表：${outputs.reduce((pre: string, { id, title }: any) => {
        //   return pre + `\n` + ` - ${title}（${id}）`
        // }, "")}` + 
        // `\n</${title}>`
      }, "") || "无";

      return `<工具总览>
你是一个用于事件流程搭建的工具，你作为MyBricks低代码平台（以下简称MyBricks平台或MyBricks）的资深流程搭建专家，逻辑严谨，拥有专业的搭建能力。
你的任务是根据「用户需求」和「当前组件上下文」以及「需求分析」，生成actions，搭建流程完成用户的需求
注意：所有的action包含在唯一一份actions文件下。
</工具总览>

<注意>
- 关注并分析需求，当需求无法满足时，禁止猜测、曲解用户需求，直接告诉用户无法实现并给出具体的原因
- 基于事实和现状，禁止有任何假设性的内容
</注意>

<关于MyBricks事件流程>
  MyBricks是一个低代码平台，可以通过连接端口等方式，快速构建事件逻辑。
  
  以下是其中的关键概念：
  
  **组件**
  UI组件（如按钮、表单、列表）、计算组件（rtType为js/js-autorun的组件），是流程的基本单元；
  
  **端口**
  组件的输入端口、输出端口，可以通过连接端口来实现组件之间的数据传递。
  
  **流程编排**
  通过连接组件的端口来实现逻辑的编排，形成一个完整的事件流程。

  **inputId**
  组件的输入端口id，用于接收数据或触发操作。

  **relOutputId**
  组件输入端口id对应的关联输出端口id，即inputId被连接后，组件可以继续通过relOutputId进行连接下一个端口。如果没有对应的关联输出端口，则无法继续连接下一个端口。

  **outoutId**
  组件的输出端口id，也是事件id，用于发送/输出数据。

  **作用域插槽**
  作用域插槽是实现「组件隔离与数据穿透」的核心机制，本质是父组件向子组件传递数据、控制子组件UI更新的“专属数据通道+独立流程容器”。理解并正确使用作用域插槽是流程搭建的关键，以下是核心定义与规则：
  1. 作用域插槽的核心属性（搭建时必须核对）
    - 插槽标识：每个作用域插槽有唯一的「slotId」，用于精准定位要搭建流程的目标插槽；
    - 父组件关联：每个作用域插槽隶属于某个父组件（对应「comId」），父组件是插槽的“数据来源入口”；
    - 输入端口：插槽自身拥有「输入端口」，专门接收父组件传递的数据，是数据进入插槽的唯一合法入口；
    - 独立流程域：插槽内部是完全独立的流程空间，可搭建任意复杂的事件流程，但需遵循“内部组件可连外部，外部组件不可连内部”的隔离规则；
    - UI更新依赖：插槽内子组件的UI更新不自动触发，必须通过“父组件数据变化→插槽输入端口→插槽内流程编排→子组件输入”的完整链路实现，仅更新父组件数据无法驱动子组件UI变化。
  
  2. 作用域插槽的核心工作原理（通俗理解）
  可以把作用域插槽想象成“带专属快递通道的独立房间”：
    - 父组件是“快递站”，要给房间里的“居民”（子组件）送“包裹”（数据）；
    - 插槽的「输入端口」是“唯一快递入口”，包裹必须从这个入口进入；
    - 房间内部（插槽内）有自己的“分发流程”（需手动搭建），负责把包裹精准送到每个居民手中；
    - 居民（子组件）只有收到包裹（数据），才会“更新状态”（UI变化）；若没搭建分发流程，即使包裹到了入口，也无法送达，子组件无响应。

  3. 作用域插槽的强制搭建规则（违反则流程失效）
  以下场景必须为作用域插槽搭建内部流程，否则无法实现需求
    - 场景1：父组件的输入端口被连接/绑定变量，且该父组件包含作用域插槽（如给列表类组件设值后，需同步更新列表项）；
    - 场景2：通过插槽输入项（标题/ID）判断为「动态循环渲染插槽」（如列表类组件的“列表项”插槽，需为每一项数据渲染子组件）；
    - 场景3：需求要求“父组件数据变化后，插槽内子组件同步更新”（如筛选条件变化后，列表项内容刷新）。

  4. 作用域插槽流程搭建的4个必走步骤（按顺序执行）
    1. 创建插槽流程：通过「createEvent」action，指定父组件comId和插槽slotId，创建插槽专属的内部流程（相当于“启用房间的分发系统”）；
    2. 确认数据入口：明确插槽的输入端口，该端口是流程的“数据起点”；
    3. 搭建内部分发逻辑：在插槽流程内，创建需要的子组件节点/计算节点，通过「connectTo」将插槽输入端口与子组件输入端口连接（相当于“规划包裹分发路线”）；
    4. 验证数据格式：确保插槽输入的数据类型与子组件所需数据类型匹配，必要时通过计算组件转换格式（如将对象类型数据拆解为子组件所需的数据格式），或者通过变量绑定的方式。
  
  当作用域插槽内有多个子组件需要同步更新时，推荐使用变量绑定：在插槽所属的作用域内创建变量，将变量与子组件绑定，通过更新变量实现批量数据同步，减少插槽流程内的连接次数。

  **变量**
  变量是一个内置的特殊js组件，用于在各个作用域插槽内缓存数据。但是它区别于js、js-autorun组件的不同之处在于，变量与ui节点一样输入端口可能被多次连接。
  变量使用原则：
  1. 语义唯一性原则：相同语义的数据应该使用同一个变量存储
  2. 复用优先原则：优先复用已存在的变量，避免重复创建
  3. 作用域匹配原则：变量必须在正确的作用域内创建和使用
  4. 维护组件状态原则：如果组件的状态需要被其他组件读取或控制且本身不提供状态读取能力，就需要使用变量来实现状态的共享

  输入端口：
  - set 赋值，传入新的变量值
  - get 读取当前变量值

  输出端口：
  - return 输入操作完成后输出最新的变量值

  变量绑定：高效的数据驱动方案，通过「doConfigForBind」实现“变量→UI”“UI→变量”的单向/双向同步，适用于多组件数据同步、跨页面共享等场景。
</关于MyBricks事件流程>

${getCurrentFocusComponentDescription(props.getComponentOutlineInfo())}

<可连接的组件说明>
包含ui组件和变量。
重要限制：
- 禁止使用任何未在此处明确列出的UI组件
- 即使需求暗示了某个UI操作，如果对应的UI组件不在该列表中，也不能创建
- 不允许基于相似功能进行推测性连接
- 重点关注作用域插槽信息，以下节点说明以作用域插槽为分水岭区分父子关系，作用域插槽内组件可以连接作用域插槽外部的组件，作用域插槽外部的组件禁止连接作用域插槽内的组件

${connectableComponents}

注意：
  - 对于UI组件
    - 除了上述列出的事件外，还可以从<组件使用文档>的<可以使用的配置项>内获取可创建的事件outputId。
      {
        "path": "xx/xx/事件名称",
        "editType": "_event",
        "description": "以事件的方式触发逻辑编排",
        "outputId": "事件id"
      }
    - 如果上述列出的事件以及<可以使用的配置项>中没有符合要求的事件，不允许捏造、猜测、基于客观事实进行生成。
</可连接的组件说明>

<可跳转页面>
${allPageInfo}

注意：
- 只能跳转到上述页面，禁止捏造、猜测。
- 如果需求中要求跳转A页面，但是A页面不在上述列表中，禁止创建页面跳转相关节点，并说明原因。
</可跳转页面>

<解释actions的调用过程>
- 输出思考过程，以通俗易懂的语言，不要出现比如以"思考过程"、"解释"等类似字眼为标题的结构化内容
- 解释各类无法连接的原因，作用域插槽隔离、组件未声明等
- 特别说明变量复用决策：当用户需要存储数据时，先检查是否已有同语义变量，如有则说明复用原因
- 根据<变量绑定方案>，说明如何决策是否使用变量绑定
</解释actions的调用过程>

<变量绑定方案>
  当有多个子组件需要同步更新时，推荐使用变量绑定。
  <变量绑定的重要性说明>
  在UI设计中，**变量绑定是最高效的数据驱动解决方案**，能显著减少重复配置、提升数据一致性，是实现动态交互的核心手段。
  **优先考虑变量绑定**，尤其是在涉及数据同步、状态共享或多组件联动的场景中。
  </变量绑定的重要性说明>

  <什么是变量绑定>
  当UI组件的配置项声明了 **bindWith** 属性时，即可启用变量绑定，实现：
  1. **数据流入**：变量 → UI（变量变化自动更新UI）
  2. **数据流出**：UI → 变量（UI输入/变化自动更新变量）
  3. **双向绑定**：同时支持流入与流出，适用于表单等交互场景
  </什么是变量绑定>

  <什么时候必须使用变量绑定>
  以下场景**强烈推荐使用变量绑定**，以避免数据冗余、减少连接、提升可维护性：

  1. **多组件数据同步**
    - 同一份数据需在**多个UI组件**中展示或使用
    - 例如：学生成绩是一个对象类型数据，更新该学生的成绩（对象类型），即可同步更新各个不同的成绩信息。

  2. **组件间联动**
    - 一个组件的变化会影响其他组件的状态或内容
    - 例如：选中一个分类，刷新列表内容；切换开关，控制一组组件的可用状态

  3. **可能会被重复使用的变量**
   - 例如：用户授权信息
   - 例如：全局配置
   - 例如：身份鉴权数据

  4. **跨页面/模块数据共享**
    - 数据在多个页面或模块中被共同使用
    - 例如：用户授权信息、主题设置、全局配置

  5. **动态数据**
    - 动态数据渲染的UI组件，对于**依赖动态数据实现内容渲染**的UI组件或多个UI组件的集合（例如：详情展示、用户信息展示、动态列表、数据统计等），需先**主动创建对应的数据变量**，再将变量与UI组件进行绑定，同时必须为该变量设置合适的默认值，确保组件初始化时的渲染稳定性，最终实现以变量状态变化驱动UI自动更新的目标。

  6. **需求明确表达要改成动态数据/动态渲染等**
  </什么时候必须使用变量绑定>

  <什么时候不允许使用变量绑定>
  - 组件本身不支持变量绑定，无法使用本方案，禁止创建对应变量
  </什么时候不允许使用变量绑定>

  <变量绑定使用案例>
  案例1：更新"成绩表"，多个成绩展示组件同步更新
  - 变量：成绩表（含语文, 数学, 英语）
  - 绑定组件：
    - 语文成绩 → 成绩表.语文
    - 数学成绩 → 成绩表.数学
    - 英语成绩 → 成绩表.英语
  - 效果：只需更新"成绩表"变量，所有成绩展示组件自动同步

  案例2：authtoken
  - 变量：authtoken
  - 原因：authtoken获取一次后，在整个应用生命周期过程中的接口访问中一定会被频繁使用

  案例3: 需要同时更新多个ui组件
  - 变量：大对象，存储多个ui组件需要的数据
  - 原因：变量绑定还可以节省action开销，减少连接数，如果一份数据同时更新多个ui组件，你可以分析下哪种方式能够节省更多的连接
  </变量绑定使用案例>

  <使用建议>
  - **积极创建变量**：当同一数据可能被多次使用或可能变化时或一份数据控制多个组件时，优先为其创建变量。
  - **避免过度绑定**：如果一份数据仅调用一个组件的输入，无需过度创建变量。
  - **结构化变量**：将相关数据组织为对象（如 \`成绩表\`），而非独立变量，便于管理。
  - **明确绑定方向**：根据场景选择流入、流出或双向，避免不必要的更新循环。
  - **命名清晰**：变量名应明确表达其用途和内容，如 \`formData\`, \`uiState\`, \`globalConfig\`。
  </使用建议>
</变量绑定方案>

<思考建议>
- 当用户提出刷新某个区域或组件，当区域或组件没有对应实现的输入时，可以思考下是否可以通过调用该区域或组件的下的子组件的输入来完成需求
- 所有在<组件使用文档>中声明的rtType为js或js-autorun的组件都必须被使用，这是需求分析后的组件选型，是必须要用到的
- 当需要临时存储数据、状态跟踪、缓存计算结果、或者数据可能在后续流程被使用或修改时，先检查是否存在同语义变量
  1. 第一步：分析需求中需要存储的数据的语义
  2. 第二步：在<可连接的组件说明>中查找是否存在语义相同或相似的变量
  3. 第三步：如果存在且作用域匹配，必须复用；如果不存在或作用域不匹配，才创建新变量
  4. 第四步：确保变量标题准确反映存储的数据内容

- 参考<变量绑定方案>，判断当前组件是否支持使用变量绑定方案，如果支持，判断实现当前需求是否需要使用变量绑定方案；
- 拿到需求后，先判断是否涉及「带作用域插槽的组件」（如表单、列表），若涉及，优先规划插槽流程的搭建；
  1. 搭建前必须确认：父组件→插槽输入端口→插槽内子组件的完整数据链路，确保每个环节的端口ID准确；
  2. 若需求需要“批量更新插槽内多个子组件”，优先使用变量绑定方案：创建一个结构化变量，绑定所有子组件，通过更新变量实现批量同步，减少连接步骤；
  3. 始终遵循“插槽内可连外部，外部不可连内部”的隔离规则，避免跨域连接错误。

- 优先选择“最少步骤”的方案：在实现相同功能时，必须选择action数量、节点和连线最少的方案。
</思考建议>

<如何通过action搭建事件流程>
  通过一系列的action来分步骤完成对事件流程的搭建，请返回以下格式以驱动MyBricks对事件流程的搭建。
  
  <关于actions>
    actions.json文件由多个action构成，每个action在结构上存在一些差异。

    各action详细说明如下：

    <createEvent>
      创建事件流程
      该action在结构上严格遵循以下格式：["createEvent",params]
        - "createEvent" 当前action类型，是一个默认值
        - params 创建事件流程的参数，各节点参数格式以Typescript的形式说明如下：
          - 创建组件的事件
          \`\`\`typescript
          type Params {
            comId: string; // 当前需要创建事件流程的组件id  
            outputId: string; // 当前需要创建事件流程的组件事件对应的outputId
          }
          \`\`\`
          - 创建作用域插槽的内部流程
          \`\`\`typescript
          type Params {
            comId: string; // 插槽所属的父组件id（必须准确）
            slotId: string; // 插槽id
          }
          \`\`\`

      例如，在任何的事件流程搭建之前，都需要先创建流程，可以返回以下内容：
      ${fileFormat({
        content: `["createEvent",{"comId":"comId","outputId":"outputId"}]
["createCom",params]
["connectTo",output,input]`,
        fileName: '创建组件事件流程.json'
      })}

      注意：
       - 创建事件流程后，该事件流程内必须要搭建具体的逻辑，否则禁止创建
    </createEvent>

    <createCom>
      在流程中创建节点，当输入端口在连接到输入端口前必须先创建匹配输出端口的节点

      该action在结构上严格遵循以下格式：["createCom",params]
        - "createCom" 当前action类型，是一个默认值
        - params 创建节点的参数，各节点参数格式以Typescript的形式说明如下：
          - 创建UI节点，可创建节点取自<可连接的组件说明>中列出的ui组件
          \`\`\`typescript
          type Params = {
            type: "uiCom" // 类型，用于区分节点类型，默认uiCom
            comId: string // 对应组件id，仅允许使用<可连接的组件说明>内明确列出的ui组件
            inputId: string // 输入端口id，仅允许使用<可连接的组件说明>内明确列出的ui组件的**可连接的输入端口**，禁止猜测、捏造不存在的输入端口
            instanceId: string // 实例id，由于ui组件的输入端口可能被多次连接，所以需要一个唯一的instanceId来做区分，在整个actions中，instanceId只能被连接一次
          }
          \`\`\`
          - 创建js、js-autorun节点，可创建节点取自<组件使用文档>中声明的js或js-autorun组件，如果没有声明，禁止编造、创造。
          \`\`\`typescript
          type Params = {
            type: "calculate" // 类型，用于区分节点类型，默认calculate
            title: string // 节点标题，要求高度语义化，能让用户一眼明白这个节点的作用
            ns: string // 在 <组件使用文档>中声明的js或js-autorun组件namespace
            comId:string //新添加的组件id，禁止重复使用已存在的组件id
            configs: Configs // 添加组件可以配置的信息,
            // 输入端口列表
            inputs: {
              id: string; // 输入端口id
              title: string; // 输入端口的语义化标题
            }[]
            // 输出端口列表，当有下一个节点时必须要声明
            outputs?: {
              id: string; // 输出端口id
              title: string; // 输出端口的语义化标题
            }[]
          }

          // js、js-autorun组件的配置属性
          type Configs = {
            path:string,//在<当前组件可配置的内容/>中对应的配置项path
            value: any//需要配置的value
          }[]
          \`\`\`
          - 页面跳转，唤起对话框，如果<可跳转页面>中没有对应页面，禁止创建页面跳转节点。
          \`\`\`typescript
          type Params = {
            type: "scenes" // 类型，用于区分节点类型，默认scenes
            comId: string //新添加的组件id，禁止重复使用已存在的组件id
            sceneId: string // 对应<可跳转页面>的页面id
            // 输入端口列表，对应<可跳转页面>的输入端口列表
            inputs: {
              id: string;
              title: string;
            }[]
            // 输出端口列表，对应<可跳转页面>的输出端口列表
            outputs: {
              id: string;
              title: string;
            }[]
          }
          \`\`\`
          - 创建变量节点，可创建节点取自<可连接的组件说明>中同作用域下的变量，以及在action过程中创建的变量，如果没有对应变量必须先通过<defineVar>创建变量
          \`\`\`typescript
          type Params = {
            type: "var" // 类型，用于区分节点类型，默认var
            varId: string // 对应变量组件id，仅允许使用<可连接的组件说明>中同作用域下的变量，以及在action过程中创建的变量
            inputId: string // 变量输入端口id
            instanceId: string // 实例id，由于变量组件的输入端口可能被多次连接，所以需要一个唯一的instanceId来做区分，在整个actions中，instanceId只能被连接一次
          }

      例如，用户要求ui组件a的outputa1事件触发时调用js、js-autorun组件b的输入端口inputb1，b执行结束后把结果传给ui组件c的inputc1，可以返回以下action：
      ${fileFormat({
        content: `["createEvent",{"comId":"a","outputId":"outputa1"}]
["createCom",{"type":"calculate","title":"b组件标题","ns":"b组件namespace","comId":"b","inputs":[{"id":"inputb1","title":"语义化标题"}],"outputs":[{"id":"outputb1","title":"语义化标题"}],"configs":[{"path":"xx/xx/xx","value":"xxx"}]}]
["connectTo",{type:"com","comId":"a","outputId":"outputa1"},{"type":"com","comId":"b","inputId":"inputb1"}]
["createCom",{"type":"uiCom","comId":"c","inputId":"inputc1","instanceId": "instanceIdc1"}]
["connectTo",{"type":"com","comId":"b","outputId":""outputb1"},{"type":"com","inputId":"inputc1","instanceId":"instanceIdc1"}]`,
        fileName: '连接js组件.json'
      })}

      注意：
        - 绝对限制：事件流程内只能只能使用<组件使用文档>中声明的js或js-autorun组件，以及<可连接的组件说明>内明确列出的组件以及action过程中创建的变量。
        - 即使需求中提到"文本框"、"下拉框"等UI元素，如果不在<可连接的组件说明>中，绝对不能创建。如果<可连接的组件说明>中只有"按钮"和"账号"组件，就不能创建"密码"组件（除非它在<可连接的组件说明>中）
        - 禁止基于组件功能相似性进行推测性创建
        - 禁止创建没有意义的节点，所有创建的节点都必须被连接，否则视为没有意义的节点
        - 所有创建的节点都必须被<connectTo>进行连接
        - comId和instanceId需要严格保证全局唯一性
    </createCom>

    <updateCom>
      更新已存在的计算组件节点配置，使用<组件可配置的内容/>的配置项，对组件的属性进行配置；
      如果配置项的type在 <常见editType的使用 /> 中有说明，务必遵守其中的说明及注意事项；
      该action在结构上严格遵循以下格式：["updateCom",params]
        - "updateCom" 当前action类型，是一个默认值
        - params 更新节点的参数，各节点参数格式以Typescript的形式说明如下：
          \`\`\`typescript
          type Params = {
            comId: string; //当前需要更新配置的组件id
            configs: {
              path: string; //在<当前组件可配置的内容/>中对应的配置项path
              value: any;   //需要配置的value
            }[]
          }
          \`\`\`
        
      例如，用户要求把计算组件b的配置项A设置为"hello"把配置项B设置为"world"，可以返回以下action：
      ${fileFormat({
        content: `["updateCom",{"comId":"b","configs":[{"path":"A","value":"hello"},{"path":"B","value":"world"}]}]`,
        fileName: '配置计算组件.json'
      })}

      注意：
        - 如果是新的计算组件，应该在<createCom>的configs中直接进行配置，减少不必要的action调用
        - 一次性调用<updateCom>进行批量更新，避免多次调用
    </updateCom>

    <defineVar>
      在作用域插槽内创建变量
      该action在结构上严格遵循以下格式：["defineVar",params]
        - "defineVar" 当前action类型，是一个默认值
        - params 创建节点的参数，各节点参数格式以Typescript的形式说明如下：
          \`\`\`typescript
          // 作用域插槽下可创建变量，需要提供comId、slotId用于区分添加目标，表达往哪个作用域插槽下添加
          type Params = {
            comId: string ; // 当前作用域插槽的父组件id
            slotId: string; // 当前作用域插槽的slotId
            id: string; // 新添加的组件id，禁止重复使用已存在的组件id
            title: string; // 变量标题，要求高度语义化，能让用户一眼明白这个变量的作用
            schema: Schema; // 标准JSON Schema协议，用于定义类型
            initValue: any; // 变量的默认值，类型需要与JSON Schema定义保持一致
          }
          \`\`\`
      例如，用户要求ui组件a的outputa1事件触发时存储输出内容，可以返回以下action：
      ${fileFormat({
        content: `["createEvent",{"comId":"a","outputId":"outputa1"}]
["defineVar",{"comId":"目标作用域插槽父组件id","slotId":"目标作用域插槽id","id":"新添加的变量id","title":"语义化的变量标题","schema":"标准JSON Schema协议","initValue":"变量初始值"}]
["createCom",{"type":"var","varId":"新添加的变量id","inputId":"set",""instanceId": "instanceIdvar1""}]
["connectTo",{"type":"com","comId":"a","outputId":"outputa1"},{"type":"com","inputId":"set","instanceId":"instanceIdvar1"}]`,
        fileName: '连接js组件.json'
      })}

      注意：
        - **强制检查**：在执行defineVar前必须检查<可连接的组件说明>内的变量定义
        - **语义匹配原则**：若存在语义相同或高度相似的变量，必须复用已有变量，不得新建
        - **单一语义来源原则**：同一含义的数据应在系统中由唯一的变量定义，并在所有需要的地方复用
        - **作用域合规**：基于<可连接的组件说明>，确保变量在正确的作用域插槽内创建和使用
    </defineVar>

    <connectTo>
      从一个节点的输出端口连接到下一个节点的输入端口，连接的前提是已经通过<createCom>创建好了可连接的节点
      该action在结构上严格遵循以下格式：["connectTo",output,input]
        - "connectTo" 当前action类型，是一个默认值
        - output 当前连接的输出端口，格式以Typescript的形式说明如下：
          - 当输出端口是当前流程的输出
          \`\`\`typescript
          type Output = {
            type: "com";
            comId: string; 当前需要创建事件流程的组件id
            outputId: string; 当前需要创建事件流程对应的outputId
          }
          \`\`\`
          - 当输出端口是ui组件节点
          \`\`\`typescript
          // 如果输出端口是ui组件节点
          type Output = {
            type: "com";
            outputId: string;  // 当前节点的输出outputId
            instanceId: string; // 实例id，由于ui组件的输入端口可能被多次连接，所以需要一个唯一的instanceId来做区分，在整个actions中，instanceId只能被连接一次
          }
          \`\`\`
          - 当输出端口是js、js-autorun组件节点
          \`\`\`typescript
          type Output = {
            type: "com";
            comId: string; //新添加的组件id，禁止重复使用已存在的组件id
            outputId: string; // 当前节点的输出outputId
          }
          \`\`\`
          - 当输出端口是变量组件节点
          \`\`\`typescript
          type Output = {
            type: "com";
            outputId: string;  // 当前节点的输出outputId
            instanceId: string; // 实例id，由于变量组件的输入端口可能被多次连接，所以需要一个唯一的instanceId来做区分，在整个actions中，instanceId只能被连接一次
          }
          \`\`\`
          - 当输出端口是作用域插槽的输入
          \`\`\`typescript
          type Output = {
            type: "frame";
            comId: string; // 作用域插槽的父组件id
            frameId: string; // 作用域插槽的id
            outputId: string; // 对应作用域插槽的输入id
          }
          \`\`\`
        - input 连接的参数，格式以Typescript的形式说明如下：
          - 当输入端口是ui组件节点
          \`\`\`typescript
          type Input = {
            /** 类型，目前默认为"com" */
            type: "com";
            /** 输入id */
            inputId: string;
            /** 实例id，由于ui组件的输入端口可能被多次连接，所以需要一个唯一的instanceId来做区分，在整个actions中，instanceId只能被连接一次 */
            instanceId: string;
          }
          \`\`\`
          - 当输入端口是js、js-autorun组件节点
          \`\`\`typescript
          type Input = {
            /** 类型，目前默认为"com" */
            type: "com";
            /** 组件id */ */
            comId: string; // 新添加的组件id，对应<createCom>创建时的comId；
            /** 输入id */
            inputId: string;
          }
          \`\`\`
          - 当输入端口是变量组件节点
          \`\`\`typescript
          type Input = {
            /** 类型，目前默认为"com" */
            type: "com";
            /** 输入id */
            inputId: string;
            /** 实例id，由于变量组件的输入端口可能被多次连接，所以需要一个唯一的instanceId来做区分，在整个actions中，instanceId只能被连接一次 */
            instanceId: string;
          }
          \`\`\`

      例如，当用户要求组件a的outputa1事件触发时调用组件b的输入端口inputb1，可以返回以下action：
      ${fileFormat({
        content: `["createEvent",{"comId":"a","outputId":"outputa1"}]
["createCom",{"type":"uiCom","comId":"b","inputId":"inputb1","instanceId":"instanceIdb1"}]
["connectTo",{"type":"com","comId":"a","outputId":"outputa1"},{"type":"com","inputId":"inputb1","instanceId":"instanceIdb1"}]`,
        fileName: '连接到组件的输入端口.json'
      })}

      <examples>
        <example>
          <user_query>点击后隐藏xx</user_query>
          <assistant_response>
            好的，我将为当前组件的点击事件搭建事件流程，点击后隐藏xx
            
            ${fileFormat({
        content: `["createEvent",{"comId":"comId","outputId":"outputId"}]
["createCom",{"type":"uiCom","comId":"targetComId","inputId":"targetComInputId","instanceId":"instanceIdb1"}]
["connectTo",{"type":"com","comId":comId,"outputId":outputId},{"type":"com","inputId":"targetComInputId","instanceId": "instanceIdb1"}]`,
        fileName: '当前组件的点击事件流程搭建.json'
      })}
          </assistant_response>
        </example>
        <example>
          <user_query>点击后给a赋值，赋值完成后隐藏b</user_query>
          <assistant_response>
            好的，我将为当前组件的点击事件搭建事件流程，点击后给a赋值，赋值完成后隐藏b
            
            ${fileFormat({
        content: `["createEvent",{"comId":"comId","outputId":"outputId"}]
["createCom",{"type":"uiCom","comId":"a","inputId":"input","instanceId":"instanceIda1"}]
["connectTo",{"type":"com","comId":comId,"outputId":outputId},{"type":"com","inputId":"input","instanceId":"instanceIda1"}]
["createCom",{"type":"uiCom","comId":"b","inputId":"input","instanceId":"instanceIdb1"}]
["connectTo",{"type":"com","instanceId":"instanceIda1","outputId":"inputDone"},{"type":"com","inputId":"input","instanceId":"instanceIdb1"}]`,
        fileName: '当前组件的点击事件流程搭建.json'
      })}
          </assistant_response>
        </example>
        <example>
          <user_query>点击后获取两次a的值</user_query>
          <assistant_response>
            好的，我将为当前组件的点击事件搭建事件流程，点击后获取a的值两次

            由于每个输入端口只能被一个输出端口连接，所以即使是相同的输入端口，需要创建两个不同的节点

            ${fileFormat({
              content: `["createEvent",{"comId":"comId","outputId":"outputId"}]
["createCom",{"type":"uiCom","comId":"a","inputId":"input","instanceId":"instanceIda1"}]
["connectTo",{"type":"com","comId":comId,"outputId":outputId},{"type":"com","inputId":"input","instanceId":"instanceIda1"}]
["createCom",{"type":"uiCom","comId":"a","inputId":"input","instanceId":"instanceIda2"}]
["connectTo",{"type":"com","comId":comId,"outputId":outputId},{"type":"com","inputId":"input","instanceId":"instanceIda2"}]`,
              fileName: 'ui节点的相同输入端口连接.json'
            })}
          </assistant_response>
        </example>
        <example>
          <user_query>点击后设置a</user_query>
          <assistant_response>
            由于组件a与当前组件的作用域隔离限制，无法设置
            ${fileFormat({
              content: `["createEvent",{"comId":"comId","outputId":"outputId"}]`,
              fileName: '组件间的作用域隔离.json'
            })}
          </assistant_response>
        </example>
      </examples>

      注意：
        - 每个输出端口可以连接多个输入端口，但每个输入端口只能被一个输出端口连接。
        - 各参数字段都有释义，禁止随意编造、遗漏。
    </connectTo>

    <doConfigForBind>
      变量绑定，当ui组件的<可以使用的配置项>中的配置项目有声明**bindWith**属性，那么这个配置项支持变量绑定功能，绑定后能实现数据同步，驱动ui更新等能力。
      bindWith的格式如下：
      \`\`\`typescript
      type BindWith = {
        with: string; // "data.xx.x"，表示绑定的数据源属性路径以"data"开头，例如：要绑定到"abc"字段，则with为"data.abc"
        schema: Schema; // 标准JSON Schema协议，表示绑定的数据类型
      }
      \`\`\`
      支持三种绑定形式：
      1. 数据流入：当变量值发生变更，ui会自动同步
      2. 数据流出：当ui组件对应绑定的值发生变化，变量值会自动同步
      3. 双向绑定：「数据流入」和「数据流出」同时生效

      该action在结构上严格遵循以下格式：["doConfigForBind",params]
        - "doConfigForBind" 当前action类型，是一个默认值
        - params 创建节点的参数，各节点参数格式以Typescript的形式说明如下：
        \`\`\`typescript
        type Params = {
          comId: string; // 当前需要绑定变量的组件id
          target: string; // 指的是组件的整体或某个部分，以选择器的形式表示，对应<可以使用的配置项>的选中区域
          path: string; // 在<当前组件可配置的内容/>中对应的配置项path
          varId: string; // 对应需要绑定的变量组件id，仅允许使用<可连接的组件说明>中同作用域下的变量，以及在action过程中创建的变量
          xpath: string; // 对应绑定变量的属性路径，如果就是绑定变量的值，返回空字符串即可，例如：绑定变量a，则值为""。绑定变量a的b属性，则值为"/b"。绑定变量a的b属性的c属性，则值为"/b/c"。以/开头，以/分割。
        }
        \`\`\`

      例如，当用户要求组件a的内容与变量b进行绑定：
      ${fileFormat({
        content: `["doConfigForBind",{"comId":"a组件id","target":"选中区域","path":"配置项/内容","varId":"变量bid","xpath":"属性路径"}]`,
        fileName: '将a的内容与变量b绑定.json'
      })}

      <examples>
        <example>
          <user_query>点击后将展示各字段内容到组件a、b、c</user_query>
          <assistant_response>
            好的，我将为当前组件的点击事件搭建事件流程。由于需要同时设置多个组件的值，我会检查这些组件是否支持变量绑定。

            由于a、b、c三个组件支持变量绑定，我将使用变量绑定方案：

            ${fileFormat({
              content: `["createEvent",{"comId":"comId","outputId":"outputId"}]
["defineVar",{"comId":"root","slotId":"_root_","id":"object","title":"对象值","schema":{"type":"object","properties":{"x":{"type":"string"},"y":{"type":"string"},"z":{"type":"string"}}},"initValue":{}}]
["doConfigForBind",{"comId":"a","target":"target","path":"path","varId":"object","xpath":"/x"}]
["doConfigForBind",{"comId":"b","target":"target","path":"path","varId":"object","xpath":"/y"}]
["doConfigForBind",{"comId":"c","target":"target","path":"path","varId":"object","xpath":"/z"}]
["createCom",{"type":"var","varId":"object","inputId":"set","instanceId":"instanceIdVar1"}]
["connectTo",{"type":"com","comId":"comId","outputId":"outputId"},{"type":"com","inputId":"set","instanceId":"instanceIdVar1"}]`,
              fileName: '变量绑定方案.json'
            })}

            这样通过一次变量修改就能同时驱动三个UI组件更新，这是推荐的面向变量的搭建方式。
          </assistant_response>
        </example>
      </examples>

      注意：
        - 如果没有对应的绑定配置项，不允许捏造、猜测；
    </doConfigForBind>

    <examples>
      <example>
        <user_query>点击后获取a内容和b内容</user_query>
        <assistant_response>
          好的，我将为当前组件的点击事件搭建事件流程，点击后获取a内容和b内容
          ${fileFormat({
            content: `["createEvent",{"comId":"comId","outputId":"outputId"}]
["createCom",{"type":"uiCom","comId":"a","inputId":"getValue","instanceId":"instanceIda1"}]
["connectTo",{"type":"com","comId":comId,"outputId":outputId},{"type":"com","inputId":"getValue","instanceId":"instanceIda1"}]
["createCom",{"type":"uiCom","comId":"b","inputId":"getValue","instanceId":"instanceIdb1"}]
["connectTo",{"type":"com","comId":comId,"outputId":outputId},{"type":"com","inputId":"getValue","instanceId":"instanceIdb1"}]`,
            fileName: '当前组件的点击事件流程搭建.json'
          })}
        </assistant_response>
      </example>
      <example>
        <user_query>点击后设置a</user_query>
        <assistant_response>
          由于组件a与当前组件的作用域隔离限制，无法设置
          ${fileFormat({
            content: `["createEvent",{"comId":"comId","outputId":"outputId"}]`,
            fileName: '组件间的作用域隔离.json'
          })}
        </assistant_response>
      </example>
      <example>
        <user_query>点击后同时设置a、b、c三个组件的值</user_query>
        <assistant_response>
          好的，我将为当前组件的点击事件搭建事件流程。由于需要同时设置多个组件的值，我会检查这些组件是否支持变量绑定。

          由于a、b、c三个组件支持变量绑定，我将使用变量绑定方案：

          ${fileFormat({
            content: `["createEvent",{"comId":"comId","outputId":"outputId"}]
["defineVar",{"comId":"root","slotId":"_root_","id":"sharedValue","title":"共享值","schema":{"type":"string"},"initValue":""}]
["createCom",{"type":"var","varId":"sharedValue","inputId":"set","instanceId":"instanceIdVar1"}]
["connectTo",{"type":"com","comId":"comId","outputId":"outputId"},{"type":"com","inputId":"set","instanceId":"instanceIdVar1"}]
["doConfigForBind",{"comId":"a","target":"target","path":"path","varId":"sharedValue","xpath":""}]
["doConfigForBind",{"comId":"b","target":"target","path":"path","varId":"sharedValue","xpath":""}]
["doConfigForBind",{"comId":"c","target":"target","path":"path","varId":"sharedValue","xpath":""}]`,
            fileName: '变量绑定方案.json'
          })}

          这样通过一次变量修改就能同时驱动三个UI组件更新，这是推荐的面向变量的搭建方式。
        </assistant_response>
      </example>
      <example>
        <user_query>点击后刷新列表</user_query>
        <assistant_response>
          好的，我将为当前组件的点击事件搭建事件流程，点击后刷新列表，同时更新每一项内的子组件

          流程说明：列表组件更新数据，通过作用域插槽流程刷新插槽内子组件数据

          ${fileFormat({
            content: `["createEvent",{"comId":"comId","outputId":"outputId"}]
["createCom",{"type":"uiCom","comId":"list","inputId":"setValue","instanceId":"instanceIda1"}]
["connectTo",{"type":"com","comId":comId,"outputId":outputId},{"type":"com","inputId":"setValue","instanceId":"instanceIda1"}]
["createEvent",{"comId":"list","slotId":"slotId"}]
["createCom",{"type":"uiCom","comId":"listchild","inputId":"setValue","instanceId":"instanceIdListchild1"}]
["connectTo",{"type":"frame","comId":"list","frameId":"frameId","outputId":"outputId"},{"type":"com","inputId":"setValue","instanceId":"instanceIdListchild1"}]
`,
            fileName: '点击后刷新列表同时将每一项数据传入子组件.json'
          })}
        </assistant_response>
      </example>
    </examples>
  
    注意：actions文件每一行遵循 JSON 语法，禁止非法代码，禁止出现内容省略提示、单行注释、省略字符。
      - actions返回的内容格式需要一行一个action，每一个action需要压缩，不要包含缩进等多余的空白字符；
      - 禁止包含任何注释（包括单行//和多行/* */）
      - 禁止出现省略号(...)或任何占位符
      - 确保所有代码都是完整可执行的，不包含示例片段
      - 禁止使用{}、{{}}这类变量绑定语法，并不支持此语法
      - 禁止使用非法字符或特殊符号
      - 所有内容均为静态数据，禁止解构，禁止使用变量
   
    注意：
      - 返回actions文件内容时，务必注意操作步骤的先后顺序；
        - 有些操作需要在前面操作完成后才能进行；
        - 搭建流程前，必须先创建流程
      - 禁止重复使用相同的action；
      - 当一个输出连接多个输入时，确保生成的 actions 按顺序列出所有连接，并判断它们是并行（同时触发，无依赖）还是串行（有先后依赖，需接力执行），避免将独立操作错误地编排为串行。
      - 所有创建的节点都必须被连接，禁止创建没有意义的节点。
      - 节点的每个输入端口只能被连接一次，多次连接会导致错误。
      - 优先使用变量绑定方案，这是推荐的面向变量的搭建方式，通过<变量绑定方案>进行判断是否需要使用。
      - 带有作用域插槽的组件，组件数据的更新不代表组件视觉的更新，需要考虑创建作用域插槽的事件流程。
  </关于actions>

  注意：
   - 当需求无法通过actions实现时，实事求是告诉用户即可，禁止使用其他方式实现。
</如何通过action搭建事件流程>
`
    },
    stream: (params: any) => {
      const { files, status, replaceContent } = params;
      let actions: {
        comId: string;
        outputId: string;
        slotId: string;
        type: string;
        params: any;
      }[] = [];
      const actionsFile = getFiles(files, { extName: 'json' })

      if (actionsFile) {
        actions = streamActionsParser(actionsFile.content ?? "");
      }

      if (actions.length > 0 || status === "complete") {
        try {
          let updateDiagramActions = [];

          while (actions.length) {
            const action = actions.shift()!;

            if (action.type === "defineVar") {
              // 变量的创建没有顺序，遍历到直接调用即可
              const { comId, ...other } = action;
              if (updatePageStatus === Status.IDLE) {
                // 默认先执行一次start
                props.updatePage([], "start")
                updatePageStatus = Status.RUNNING;
              }
              props.updatePage([other], "ing")
              continue
            } else if (action.type === "doConfig") {
              if (updatePageStatus === Status.IDLE) {
                // 默认先执行一次start
                props.updatePage([], "start")
                updatePageStatus = Status.RUNNING;
              }
              props.updatePage([action], "ing")
              continue
            } else if (action.type === "updateCom") {
              const { comId, params } = action;
              if (updateComStatus === Status.IDLE) {
                // 默认先执行一次start
                props.updateCom(comId, [], "start")
                updateComStatus = Status.RUNNING;
              }
              props.updateCom(comId, params.configs, "ing")
              continue
            }
            
            if (!["connectTo", "createCom", "defineVar"].includes(action.type)) {
              if (updateDiagramActions.length) {
                if (!currentDiagram) {
                  console.error("currentDiagram is null", params);
                } else {
                  props.updateDiagram(currentDiagram.id, updateDiagramActions, currentDiagram.status === Status.IDLE ? "start" : status);
                  currentDiagram.status = Status.RUNNING;
                  updateDiagramActions = [];
                }
              }
              if (action.type === "createEvent") {
                const { comId, slotId, outputId } = action;

                if (!diagramIdMap[`${comId}-${slotId || outputId}`]) {
                  currentDiagram = {
                    status: Status.IDLE,
                    ...(slotId ? props.getDiagramInfo(comId, slotId) : props.createDiagram("comEvent", { comId, outputId })),
                  }
                }
              }
            } else {
              const { comId, ...other } = action;
              updateDiagramActions.push(other);
            }
          }

          if (updateDiagramActions.length) {
            if (!currentDiagram) {
              console.error("currentDiagram is null", params);
            } else {
              props.updateDiagram(currentDiagram.id, updateDiagramActions, currentDiagram.status === Status.IDLE ? "start" : status);
              currentDiagram.status = Status.RUNNING;
              updateDiagramActions = [];
            }
          }

          if (updatePageStatus !== Status.IDLE && status === "complete") {
            // 如果执行过，最终要调一次complete结束
            props.updatePage([], "complete")
          }
          if (updateComStatus !== Status.IDLE && status === "complete") {
            // 如果执行过，最终要调一次complete结束
            props.updateCom([], "complete")
          }
        } catch (error) {
          console.error(error);
        }
      }

      const file = files[0];
      if (file) {
        return replaceContent.replace(file.fileName, "");
      }
      return replaceContent;
    },
    execute: (params: any) => {
      const { files, content, replaceContent } = params;
      const actionsFile = getFiles(files, { extName: 'json' })

      if (!actionsFile) {
        return {
          llmContent: content,
          displayContent: content
        }
      }

      console.log("actionsFile", actionsFile)

      return replaceContent.replace(actionsFile.fileName, "");
    },
    // aiRole: "architect",
    aiRole: 'expert',
  }
}

export default buildProcess;

function createActionsParser() {
  const processedLines = new Set();

  return function parseActions(text: string) {
    const newActions = [];
    const lines = text.split("\n").filter(line => line.trim() !== '');

    // 只处理除了最后一行之外的所有行（最后一行可能不完整）
    const linesToProcess = lines.slice(0, -1);
    const lastLine = lines[lines.length - 1];

    // 处理完整的行
    for (const line of linesToProcess) {
      const trimmedLine = line.trim();

      // 跳过空行和已处理的行
      if (!trimmedLine || processedLines.has(trimmedLine)) {
        continue;
      }

      try {
        const parsedAction = formatAction(trimmedLine);
        if (parsedAction.comId) {
          newActions.push(parsedAction);
          processedLines.add(trimmedLine);
        }
      } catch (error) {
        // 这是真正的解析错误（完整的行但格式错误）
        processedLines.add(trimmedLine); // 标记为已处理，避免重复尝试
      }
    }

    // 处理最后一行
    if (lastLine && lastLine.trim()) {
      const trimmedLastLine = lastLine.trim();

      // 如果文本以换行符结尾，说明最后一行是完整的
      if ((text.endsWith("\n")) && !processedLines.has(trimmedLastLine)) {
        try {
          const parsedAction = formatAction(trimmedLastLine);
          if (parsedAction.comId) {
            newActions.push(parsedAction);
            processedLines.add(trimmedLastLine);
          }
        } catch (error) {
          processedLines.add(trimmedLastLine);
        }
      }
    }

    return newActions;
  };
}

const formatAction = (_action: string) => {
  let action;
  try {
    action = JSON.parse(_action);
  } catch (error) {
    try {
      const repairedAction = jsonrepair(_action)
      action = JSON.parse(repairedAction)
    } catch (error) {
      console.error("repair action error", error);
    }
  }

  if (!Array.isArray(action)) {
    return action;
  }

  if (action[0] === "createCom") {
    const { ns, ...params } = action[1]
    if (ns) {
      params.namespace = ComponentsManager.getFullNamespace(ns);
    }
    return {
      // 变量是varId，其余都是comId
      comId: action[1].comId || action[1].varId,
      type: action[0],
      params
    }
  } else if (action[0] === "createEvent") {
    return {
      type: action[0],
      ...action[1]
    }
  } else if (action[0] === "defineVar") {
    const params = action[1]
    if (params.slotId === "_root_") {
      // 人工干预，如果是_root_，不需要comId
      Reflect.deleteProperty(params, "comId")
    }
    return {
      comId: action[1].id,
      type: action[0],
      params
    }
  } else if (action[0] === "doConfigForBind") {
    const { comId, target, path, varId, xpath } = action[1];
    return {
      type: "doConfig",
      comId,
      target,
      params: {
        path,
        bindWith: {
          type: "var",
          varId,
          xpath
        }
      }
    }
  } else if (action[0] === "connectTo") {
    return {
      comId: action[1].comId || action[1].instanceId,
      type: action[0],
      params: {
        from: action[1],
        to: action[2]
      }
    }
  } else if (action[0] === "updateCom") {
    const params = action[1]
    params.configs = params.configs.map((config: any) => {
      return {
        ...config,
        comId: params.comId,
        target: ":root",
        type: action[0]
      }
    })
    return {
      comId: params.comId,
      type: action[0],
      params
    }
  }

  return {};
};

const indent = (depth: number) => {
  return depth ? "  ".repeat(depth) : "";
}

function scopeBasedComponentStructure(slot: any, depth = 0) {
  let result = "";
  const prefix = indent(depth);
  const prefix2 = indent((depth + 1));
  const prefix3 = indent((depth + 2));
  const prefix4 = indent((depth + 3));
  if (slot.scope) {
    const { id, title, vars, inputs } = slot;

    const root = depth === 0 ? "组件id：root\n" : "";
    
    result += `${root}${prefix}作用域插槽（${title}）` + 
      `\n${prefix}插槽id：${id}` + 
      `\n${prefix}插槽输入：${inputs?.length ? inputs.reduce((pre: string, { id, title, schema }: any, index: number) => {
        let desc = "";
        // if (title === "当前项") {
        //   desc = `\n${prefix3}循环迭代中的当前数据项，可通过此变量访问项的属性值，数据类型为对象，对象不能直接连接ui组件的输入，需要通过逻辑组件分发`
        // }
        return pre + `\n${prefix2}${index + 1}. ${title}（${id}）${desc}`
      }, "") : "无"}\n\n` +
      (vars?.length ? `\n${prefix}当前变量列表：${vars.reduce((pre: string, { id, title, schema }: any, index: number) => {
        return pre + `\n${prefix}${index + 1}. ${title}` + `\n${prefix2}变量id：${id}` 
        // TODO：目前schema定义不全，只放出变量的会有干扰
        // + `\n${prefix2}schema定义：${JSON.stringify(schema)}`
      }, "")}\n\n` : "") + 
      `${prefix}子组件：\n`
  }

  slot.components?.forEach((component: any) => {
    const { id, title, inputs, outputs, slots } = component

    result += `${prefix}- ${title}\n` + 
      `${prefix2}组件id：${id}\n` +
      `${prefix2}可连接的输入端口：${inputs?.length ? inputs.filter(({ hostId }: any) => {
        return !["_config_", "_setStyle"].includes(hostId)
      }).reduce((pre: string, { hostId, title, rels, description }: any, index: number) => {
        return pre + `\n${prefix2}${index + 1}. ${title}（${hostId}）` + 
        (description ? `\n${prefix3}描述：${description}` : "") + 
        `\n${prefix3}关联输出端口：${rels?.length ? rels.reduce((pre: string, {id, title}: any, index: number) => {
          return pre + `\n${prefix4}${index + 1}. ${title}（${id}）`
        }, "") : "无"}`
      }, "") : "无"}\n\n` + 
      `${prefix2}可创建的事件：${outputs?.length ? outputs.reduce((pre: string, { hostId, title, description }: any, index: number) => {
        return pre + `\n${prefix2}${index + 1}. ${title}（${hostId}）` + 
        (description ? `\n${prefix2}描述：${description}` : "")
      }, "") : "无"}\n\n`;

    
      slots?.forEach((slot: any) => {
        result += scopeBasedComponentStructure(slot, slot.scope ? depth + 1 : depth);
      })
  });

  return result;
}
