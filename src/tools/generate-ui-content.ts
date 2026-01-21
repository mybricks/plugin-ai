import { fileFormat } from '@mybricks/rxai'
import { getFiles, createActionsParser, getComponentOperationSummary, stripFileBlocks, createVarActionsParser, PromiseStack, ComIdTransform, uuid } from './utils'
import { context } from "../context";
import { ComponentsManager } from "../agents/workspace/components-manager";

interface GenerateUiContentParams {
  /** 当前根组件信息 */
  getRootComponentDoc: () => string;
  getTargetId: () => string;
  getRootIdByPageId: (id: string) => string | undefined;
  componentIdToTitleMap: Map<string, string>;
  /** 应用特殊上下文信息 */
  appendPrompt?: string;
  /** 返回示例 */
  fewShots?: string;
  /** 当所有actions返回时 */
  onActions: (actions: any[], status: string) => void
  /** 清空当前画布信息 */
  onClearPage: () => void
}

const NAME = 'clear-and-generate-canvas'
generateUiContent.toolName = NAME;

class UITree {
  nodeMap = new Map();
  comIdToNamespace = new Map();
  comIdTransform = new ComIdTransform([]);
  
  getComId(comId: string) {
    return this.comIdTransform.getComId(comId);
  }

  addNode(node: any) {
    const { id, parent } = node;
    const namespace = this.comIdToNamespace.get(parent.id);
    let scope = false
    if (namespace) {
      const component = ComponentsManager.getAiComponent(namespace);
      if (component?.all?.slots?.find((slot: any) => slot.id === parent.slotId)?.type === "scope") {
        scope = true;
      }
    }
    this.nodeMap.set(id, {
      id,
      parent: {
        ...parent,
        scope
      }
    });
  }

  getScope(nodeId: any) {
    let node = this.nodeMap.get(nodeId);
    while (node) {
      if (node.parent.id === "_root_") {
        return node.parent;
      }
      if (node.parent.scope) {
        return node.parent;
      }

      node = this.nodeMap.get(node.parent.id);
    }
  }

  setNamespace(comId: string, namespace: string) {
    this.comIdToNamespace.set(comId, namespace);
  }
}

export default function generateUiContent(config: GenerateUiContentParams): any {
  const streamActionsParser = createActionsParser();
  const excuteActionsParser = createActionsParser();

  const streamVarActionsParser = createVarActionsParser();

  const pageId = config?.getTargetId();
  const rootId = config?.getRootIdByPageId(pageId);

  let fileNameToContent: Record<string, string> = {};
  let displayContent = "";

  const diagrams: Record<string, string> = {};
  const promiseStack = new PromiseStack();
  const uiTree = new UITree();

  return {
    name: NAME,
    displayName: "生成搭建内容",
    description: `根据需求/附件图片，一次性搭建并生成符合需求的 MyBricks UI内容。
参数：无
工具分类：操作执行类；
作用：清空之前的画布内容，在当前画布中生成一个完整的UI内容；
要求：需要聚焦到一个具体的画布上；
前置依赖：必须确保前一个工具执行过「需求整理和组件选型」，用于获取组件文档，否则无法生成；
`,
    aiRole: "expert",
    getPrompts(params) {
      return `<工具总览>
  你是一个生成 MyBricks UI区域的工具，你作为MyBricks的资深搭建助手及客服专家，经验丰富、实事求是、逻辑严谨。
  <任务目标>
    你的任务是通过两段 actions 序列完成用户的目标。
    1. 搭建UI的 actions 序列。
    2. 搭建初始化数据的 actions 序列。
  </任务目标>
</工具总览>

<特别注意>
  - 如果附件中有图片，需要在搭建过程中作为重要的参考，要注意分辨设计稿（或者截图）或者用户绘制的线框图，对于前者、要求最大程度还原图片中的各项功能要素与视觉设计要素，总体要求考虑到功能一致完整与合理性、注意外观视觉美观大方、富有现代感.
</特别注意>

<当前画布根组件信息>
${config.getRootComponentDoc()}

IMPORTANT: 生成UI的根组件ID必须使用此文档信息。
</当前画布根组件信息>

<如何搭建UI以及修改>
  通过一系列的action来分步骤实现用户需求。
  
  ${fileFormat({
    content: `[comId, target, type, params]`,
    fileName: '操作步骤.json'
  })}

  <关于actions>
    actions.json文件由多个action构成,每个 action 在结构上都严格遵循以下格式：[comId, target, type, params];
    - comId 代表要操作的目标组件的id;
    - target 指的是组件的整体或某个部分，以选择器的形式表示，注意当type=addChild时，target为插槽id;
    - type action的类型，包括了 setLayout、doConfig、addChild、delete 几类动作;
    - params 为不同type类型对应的参数;
    
    综合而言，每个action的语义是：对某个组件(comId)的整体或某个部分(target)，执行某个动作(type)，并传入参数(params)。
    
    注意：
      - 在返回多个步骤时，务必注意其逻辑顺序，例如有些action需要先完成，后续的action（可能受控于ifVisible,只有ifVislble返回true才能使用）才能进行；
      - 有些修改需要先完成整体、再进行局部的修改；
    
    各action详细说明如下：
    
    <setLayout>
      - 设置组件的布局和尺寸信息，params的格式以Typescript的形式说明如下：
        
      \`\`\`typescript
      /**
       * 宽高尺寸
       * number - 具体的px值
       * fit-content - 适应内容
       * 100% - 填充，仅允许100%，不允许其他百分比宽度
       * auto - 自动填充，等同于flex=1
       * 只能是三者其一，明确不允许使用其他属性，比如calc等方法
       */
      type Size = number | "fit-content" | "100%" | "auto"
    
      /** flex中子组件定位，可配置如下layout */
      type setLayout_flex_params = {
        width?: Size;
        height?: Size;
        /** 上外边距 */
        marginTop?: number;
        /** 右外边距 */
        marginRight?: number;
        /** 下外边距 */
        marginBottom?: number;
        /** 左外边距 */
        marginLeft?: number;
      }
      \`\`\`
  
      注意：
      - 1. 只有在flex布局中的组件，可以在layout中使用margin相关配置；

      \`\`\`typescript
      /** 对于flex布局的插槽，我们可以添加absolute定位的组件 */
      type setLayout_absolute_params = {
        position: 'absolute';
        width?: Size;
        height?: Size;
        /** 距离左侧 */
        left?: number;
        /** 距离右侧 */
        right?: number;
        /** 距离上方 */
        top?: number;
        /** 距离下方 */
        bottom?: number;
      }
      \`\`\`
  
      \`\`\`typescript
      /** 如果组件本身是fixed类型定位，可配置如下layout */
      type setLayout_fixed_params = {
        position: 'fixed';
        width?: Size;
        height?: Size;
        /** 距离左侧 */
        left?: number;
        /** 距离右侧 */
        right?: number;
        /** 距离上方 */
        top?: number;
        /** 距离下方 */
        bottom?: number;
      }
      \`\`\`
      
      例如，当用户要求将当前组件的宽度设置为200px，可以返回以下内容：
      ${fileFormat({
        content: `["u_ou1rs",":root","setLayout",{"width":200}]`,
        fileName: '样式配置步骤.json'
      })}
      
      注意：当需要修改布局和尺寸信息时，仅返回用户要求的内容即可，无需返回所有的布局和尺寸信息属性。
    </setLayout>
    
    <doConfig>
      - 配置组件，使用<组件可配置的内容/>的配置项，对组件的属性或样式进行配置；
      - 如果配置项的type在 <常见editType的使用 /> 中有说明，务必遵守其中的说明及注意事项；
      
      - params的格式以Typescript的形式说明如下：
      
      \`\`\`typescript
      //配置样式
      type configStyle_params = {
        path:string,//在<当前组件可配置的内容/>中对应的配置项path
        style: {
          [key: string]: propertyValue; //元素的内联样式对象，仅能配置style编辑器description中声明的属性，不要超出范围。
        }
      }
      
      //配置属性
      type configProperty_params = {
        path:string,//在<当前组件可配置的内容/>中对应的配置项path
        value: any//需要配置的value
      }
      \`\`\`
      
      例如：
      - 属性的配置：
      ${fileFormat({
        content: `["u_ou1rs",":root","doConfig",{"path":"常规/标题","value":"标题内容"}]`,
        fileName: '样式配置步骤.json'
      })}
      
      - 样式的配置：
      ${fileFormat({
        content: `["u_ou1rs",":root","doConfig",{"path":"常规/banner样式","style":{"backgroundColor":"red"}}]`,
        fileName: '样式配置步骤.json'
      })}
      
        注意：
        - 当需要修改组件的样式时，只允许修改style编辑器description中声明的属性；
        - 当需要修改组件的样式时，背景统一使用background,而非backgroundColor等属性；
    </doConfig>
  
    <addChild>
      - addChild代表向目标组件的插槽中添加UI组件，需要满足两个条件:
        1. 目标组件中目前有定义插槽，且已知插槽的id是什么；
        2. 被添加的组件只能使用 <允许添加的组件/> 中声明的*UI组件*；
      - params的格式以Typescript的形式说明如下：
      
      \`\`\`typescript
      type add_params = {
        title:string //被添加组件的标题
        ns:string //在 <允许添加的组件 /> 中声明的UI组件namespace
        comId:string // 新添加的组件5位uuid，禁止重复，在所有UI组件中唯一
        layout?: setLayout_flex_params ｜ setLayout_fixed_params ｜ setLayout_absolute_params //可选，添加组件时可以指定位置和尺寸信息
        configs?: Array<configStyle_params | configProperty_params> // 添加组件可以配置的信息
        // 渲染优化
        ignore?: boolean //可选，是否添加ignore标记
        enhance?: boolean //可选，是否添加enhance标记
      }
      \`\`\`
      
      例如：
      ${fileFormat({
        content: `["u_ou1rs","content","addChild",{"title":"添加的文本组件","ns":"namespace占位","comId":"u_iysd7"}]`,
        fileName: '添加文本组件步骤.json'
      })}

      ${fileFormat({
        content: `["u_ou1rs","content","addChild",{"title":"背景图","ns":"namespace占位","comId":"u_ko4sn","layout":{"width":"100%","height":200,"marginTop":8,"marginLeft":12,"marginRight":12},"configs":[{"path":"常规/图片地址","value":"https://ai.mybricks.world/image-search?term=风景"},{"path":"样式/图片","style":{"borderRadius":"8px"}}]}]`,
        fileName: '添加带配置属性的步骤.json'
      })}
  
      ${fileFormat({
        content: `["u_ou1rs","content","addChild",{"title":"添加的布局组件","ns":"namespace占位","comId":"u_nb5yg","ignore": true}]`,
        fileName: '添加带ignore标记的步骤.json'
      })}
  
      注意:
        - 新添加的组件ID必须使用5位唯一的字母数字组合，禁止重复，在所有UI组件中唯一；
    </addChild>

    <delete>
      - 删除组件

      例如，当用户要求删除组件u_o21rs，可以返回以下内容：
      ${fileFormat({
        content: `["u_o21rs",":root","delete"]`,
        fileName: '删除组件整体.json'
      })}
      注意：删除时，必须删除组件的整体，不能删除组件的某个部分，所以使用:root选择器。
    </delete>
  
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
        - 有些操作需要在其他操作开启（布尔类型的配置项）后才能进行；
      - 禁止重复使用相同的action；
  </关于actions>

  <UI搭建原则>
    界面只有两类基本要素:组件、以及组件的插槽，组件的插槽可以嵌套其他组件。

    搭建只能使用「UI组件」，不可使用「逻辑计算组件」。
    
    <组件的定位原则>
      组件的定位有三种方式：flex定位、fixed、absolute定位。

      **flex定位**
        - 组件会相对于所在的插槽进行定位；
        - 通过尺寸（width、height） + 外间距（margin）来进行定位；
        - flex布局下的组件不允许使用left、top、right、bottom等定位属性；
        
      **fixed定位**
        - 组件会相对于当前组件的插槽进行定位，且脱离文档流；
        - 通过尺寸（width、height） + 位置（left、top、right、bottom）来进行定位；
        - fixed定位的组件不允许使用margin；
      
        使用fixed定位的例子:
        ${fileFormat({
          content: `["_root_","_rootSlot_","addChild",{"title":"添加一个固定定位组件","comId":"u_fu3nr","ns":"组件","layout":{"position":"fixed","width":"100%","height":84,"bottom":0,"left":0},"configs":[]}]`,
          fileName: '添加一个fixed定位组件.json'
        })}

      在插槽的不同布局下，组件的定位由所在插槽的布局方式决定：
        - 在当前组件的插槽中，可以添加fixed定位的组件，禁止在其他插槽中添加fixed定位的组件；
        - 如果插槽是flex布局，则子组件主要使用flex定位，特殊情况下使用absolute定位；
    </组件的定位原则>
   
    <布局原则>
      插槽的布局(display=flex)指的是对于内部组件（仅对其直接子组件，对于子组件插槽中的子组件无影响)的布局约束:
      
      **flex布局**
      （基本等同于CSS3规范中的flex布局）插槽中的所有子组件通过宽高和margin进行布局。

      <辅助标记说明>
        在 addChild 操作中，可以通过对布局类组件添加辅助标记来指导最终的渲染和布局行为。这些标记是可选的，但合理使用可以极大提升UI的性能和美观度。目前支持以下标记：
        1. ignore（结构优化标记）
          作用：当一个容器（通常是布局组件）只用于排列其内部元素（如分栏、对齐），而本身不需要任何可见样式（无背景、无边框、无圆角）且不响应交互（如点击）时，可以添加 ignore=true 标记。系统在最终渲染时，可以将这个布局容器优化掉，减少不必要的嵌套层级。
          决策流程：（从上往下执行）
            - 检查父级：父组件是根组件 _root_ 吗？是，则 ignore=false；
            - 检查父级：父级是否为布局容器？不是，则 ignore=false；
            - 检查当前组件属性：组件本身是否配置了样式（背景色、边框、圆角、内间距等）？是，则 ignore=false；
            - 猜测当前组件意图：组件是否可能作为整体被点击（如一个卡片）？是，则 ignore=false；
            - 检查当前组件插槽：组件是否存在非flex布局的插槽？是，则 ignore=false；
            - 否则（即：它只是一个纯粹的透明容器，仅用于 flex 布局，且父级也是布局容器），ignore=true。

        2. enhance（布局优化标记）
          作用：当一个flex容器（通常是布局组件）需要进行布局优化时，即从flex布局优化成自由布局，可以添加 enhance=true 标记。
          决策流程：（从上往下执行）
            - 检查当前组件属性：组件是否配置了 ignore=true？是，则 enhance=false；
            - 检查当前组件插槽：组件是否不存在flex布局的插槽？是，则 enhance=false；
            - 最后检查是否属于图文信息排列展示容器，且配置了flex布局？是，则 enhance=true。

        例子：第一个布局组件仅承担布局功能，可以添加ignore标记；第二个布局组件承担样式功能，不能添加ignore标记，第二个组件里添加了一个居中的文本，判断为信息卡片，添加enhance标记。
          ${fileFormat({
            content: `["目标组件id","插槽id占位","addChild",{"title":"第一个布局","comId":"u_dk98v","ignore":true,"ns":"组件","layout":{"width":"100%","height":120},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
          ["目标组件id","插槽id占位","addChild",{"title":"第二个布局","comId":"u_sdj3k","enhance":true,"ns":"组件","layout":{"width":"100%","height":120},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}},{"path":"样式/样式","style":{"background":"#FFFFFF"}}]}]
          ["u_sdj3k","插槽id占位","addChild",{"title":"文本","comId":"u_tn5ix","ns":"组件","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/文本内容","value":"居中文本"}]}]
          `,
            fileName: '标记使用.json'
          })}
      </辅助标记说明>
  
      <布局使用示例>
        **flex布局**
          子组件通过嵌套来搭建，无需考虑子组件的宽度和高度。

          下面的例子使用flex实现左侧固定宽度，右侧自适应宽度布局，右侧宽度配置width=auto:
          ${fileFormat({
            content: `["目标组件id","插槽id占位","addChild",{"title":"添加一个布局组件","comId":"u_flex0","ns":"布局组件","layout":{"width":"100%","height":60},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
          ["u_flex0","插槽id占位","addChild",{"title":"左侧固定宽度组件","comId":"u_lf4x1","ns":"组件","layout":{"width":60,"height":40,"marginRight":8},"configs":[]}]
          ["u_flex0","插槽id占位","addChild",{"title":"右侧自适应组件","comId":"u_rfo1x","ns":"组件","layout":{"width":"auto","height":40},"configs":[]}]
          `,
            fileName: '左侧固定宽度+右侧自适应宽度.json'
          })}
          在上例中:
            - 声明布局编辑器的值，注意布局编辑器必须声明，其中flexDirection也必须声明，关注justifyContent效果，默认为flex-start；
            - 左侧组件使用固定宽度，右侧组件使用width=auto(效果等同于flex=1)实现自适应宽度；
            - 通过marginRight配置左侧组件与右侧组件的间距；
          
          
          下面的例子使用flex进行嵌套，来实现左侧图标+文本，右侧箭头的布局:
          ${fileFormat({
            content: `["目标组件id","插槽id占位","addChild",{"title":"添加一个布局组件","comId":"u_flex1","ns":"布局组件","layout":{"width":"100%","height":60},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
          ["u_flex1","插槽id占位","addChild",{"title":"左侧布局组件","comId":"u_pl92s","ignore": true,"ns":"布局组件","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center", "justifyContent": "flex-start"}}]}]
          ["u_pl92s","插槽id占位","addChild",{"title":"图标组件","comId":"u_i98js","ns":"图标组件","layout":{"width":24,"height":24,"marginRight":8},"configs":[]}]
          ["u_pl92s","插槽id占位","addChild",{"title":"文本组件","comId":"u_tsdo2","ns":"文本组件","layout":{"width":"100%","height":"fit-content"},"configs":[]}]
          ["u_flex1","插槽id占位","addChild",{"title":"箭头图标组件","comId":"u_ar762","ns":"图标组件","layout":{"width":24,"height":24},"configs":[]}]
          `,
            fileName: 'flex嵌套实现左右布局.json'
          })}
          在上例中:
            - 声明布局编辑器的值，注意布局编辑器必须声明，其中flexDirection也必须声明；
            - 使用嵌套布局来完成左侧多元素 + 右侧单元素的布局，默认justifyContent=flex-start，所以左侧布局无需设置；
            - 左侧的图标+文本使用嵌套布局实现，且添加ignore标记，表示仅承担布局功能；

          下面的例子使用flex实现垂直居中布局:
          ${fileFormat({
            content: `["目标组件id","插槽id占位","addChild",{"title":"添加一个布局组件","comId":"u_flex2","ns":"布局组件","layout":{"width":"100%","height":120},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}}]}]
          ["u_flex2","插槽id占位","addChild",{"title":"子组件","comId":"u_child","ns":"组件","layout":{"width":80,"height":80},"configs":[]}]
          `,
            fileName: '垂直居中布局.json'
          })}
          在上例中:
            - 声明布局编辑器的值，注意布局编辑器必须声明，其中flexDirection声明成column；
            - 通过alignItems来实现子组件的垂直居中； 
          
          下面的例子使用flex进行横向左右均分布局，实现各占一半的效果:
          ${fileFormat({
            content: `["目标组件id","插槽id占位","addChild",{"title":"添加一个布局组件","comId":"u_flex3","ignore": true,"ns":"布局组件","layout":{"width":"100%","height":120},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
          ["u_flex3","插槽id占位","addChild",{"title":"A组件","comId":"u_a321s","ns":"组件","layout":{"width":"auto","height":40,"marginRight":8},"configs":[]}]
          ["u_flex3","插槽id占位","addChild",{"title":"B组件","comId":"u_b321s","ns":"组件","layout":{"width":"auto","height":40},"configs":[]}]
          `,
            fileName: '左右各占一半布局.json'
          })}
          在上例中:
            - 为了实现各占一半，配置A组件和B组件的宽度都为自适应auto（效果等同于flex=1），实现各占一半的效果；
              - 注意：不允许配置百分比宽度；
            - 判断仅布局，添加ignore标记，优化搭建内容。
            - 通过marginRight配置左侧组件与右侧组件的间距；

          下面的例子使用flex进行横向均分或等分布局，实现一行N列的效果:
          ${fileFormat({
            content: `["目标组件id","插槽id占位","addChild",{"title":"添加一个布局组件","comId":"u_flex4","ignore": true,"ns":"布局组件","layout":{"width":"100%","height":120},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
          ["u_flex4","插槽id占位","addChild",{"title":"A组件","comId":"u_aksi","ns":"组件","layout":{"width":40,"height":40},"configs":[]}]
          ["u_flex4","插槽id占位","addChild",{"title":"B组件","comId":"u_b293e","ns":"组件","layout":{"width":40,"height":40},"configs":[]}]
          ["u_flex4","插槽id占位","addChild",{"title":"C组件","comId":"u_csim2","ns":"组件","layout":{"width":40,"height":40},"configs":[]}]
          `,
            fileName: '一行N列布局.json'
          })}
          在上例中:
            - 声明布局编辑器的值，注意布局编辑器必须声明，其中flexDirection也必须声明；
            - 针对内容元素的尺寸，配置合理的高度，防止内容溢出；
            - 为了实现均分，保证卡片之间存在间距，配置卡片宽度和高度都为固定值
              - 注意：不允许配置百分比宽度；
            - 判断仅布局，添加ignore标记，优化搭建内容。
          
          下面的例子展示flex布局中负margin的妙用，通过负margin实现背景层+内容层重叠的效果：
          ${fileFormat({
            content: `["目标组件id","插槽id占位","addChild",{"title":"添加一个布局组件","comId":"u_flex6","ns":"布局组件","layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"column"}}]}]
          ["u_flex6","插槽id占位","addChild",{"title":"背景层","comId":"u_asds6","ns":"组件","layout":{"width":"100%","height":60},"configs":[]}]
          ["u_flex6","插槽id占位","addChild",{"title":"内容层","comId":"u_csdt6","ns":"组件","layout":{"width":"100%","height":100, "marginTop": -30},"configs":[]}]
          `,
            fileName: '负margin实现背景层+内容层重叠.json'
          })}
          在上例中:
            - 声明布局编辑器的值，注意布局编辑器必须声明，其中flexDirection也必须声明；
            - 通过负margin实现背景层+内容层重叠的效果；

          特殊地，在flex布局中的元素还可以配置position=absolute，用于实现绝对定位效果:
          ${fileFormat({
            content: `["目标组件id","插槽id占位","addChild",{"title":"添加一个布局组件","comId":"u_flex5","ns":"布局组件","layout":{"width":"100%","height":200},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
          ["u_flex5","插槽id占位","addChild",{"title":"绝对定位组件","comId":"u_abs12","ns":"组件","layout":{"position":"absolute","width":100,"height":40,"top":20,"left":20},"configs":[]}]
          ["u_flex5","插槽id占位","addChild",{"title":"普通组件","comId":"u_nor12","ns":"组件","layout":{"width":80,"height":80},"configs":[]}]
          `,
            fileName: '绝对定位效果.json'
          })}
          在上例中:
            - 声明布局编辑器的值，注意布局编辑器必须声明，其中flexDirection也必须声明；
            - 通过layout中的属性，设置成绝对定位效果，在一些特殊的角标等场景下很有效果；
            
      </布局使用示例>

      <布局注意事项>
        - 布局相关组件在添加时必须配置布局编辑器的值，尤其需要配置flexDirection和justifyContent；
          - 对于flexDirection，必须配置，仅允许配置row或column；
        - 优先考虑fit-content，如果要使用固定宽高，必须考虑到固定宽高会不会溢出导出布局错乱的问题；
      <布局注意事项>
      
    </布局原则>
    
    <最佳实践>
      1.永远保证UI的美观以及和谐统一，在基础组件的使用上遵循美观统一原则；
      2.在搭建开始前，我们建议对每个组件进行全面评估，特别是思考是否需要 <辅助标记 />，这能极大提升后续维护性；
      3.在选用组件时，文本、图片、图标、按钮等基础组件拥有最高优先级；

      <关于美观>
        组件使用：
          - 对于文本：注意保持视觉的统一性，选用合适的文本大小粗细，同时尽量配置文本省略，防止文本换行导致效果不佳。
          - 对于图标：为了保证视觉的统一与专业性，我们的共识是统一使用图标组件。请避免使用 Emoji 或特殊字符，它们可能导致在不同设备上的显示差异。
          - 对于图片：图片是传递信息与氛围的关键。我们建议根据其用途选择合适的来源：
            - https://placehold.co/600x400/orange/ffffff?text=hello，可以配置一个橙色背景带白色hello文字的色块占位图片；
            - https://ai.mybricks.world/image-search?term=搜索词&w=宽&h=高，可以配置一个高质量的摄影图片；
            对于海报/写实图片：我们建议使用高质量的摄影图片；
            对于品牌/Logo：我们建议使用色块占位图片；
            对于插画/装饰性图形：我们优先推荐使用图标来点缀；如果确实需要图片，也可以使用色块占位图片，防止摄影图片过于跳脱；
        布局使用：一个组件的位置、尺寸、margin，永远需要参考其父容器。时刻牢记这一点，可以从根本上解决绝大多数的重叠与溢出问题。
        占位使用：如果某个区域当前无法实现，我们推荐使用一个与整体风格协调的「卡片+文本」作为占位符，并简要说明。这既保证了界面的完整性，也为后续开发留下了线索。
      </关于美观>

      <选用组件>
        1.对于文本、图片、图标、按钮等基础组件，任何情况下都可以优先使用；
        2. 对于重复性元素：当遇到相似元素重复出现时，我们的判断标准是：
          若内容是动态的（如用户列表），应选用列表类组件。
          若内容是静态的（如功能入口），布局组件（N行M列）是更高效的选择
      </选用组件>
  </最佳实践>
  </UI搭建原则>
</如何搭建UI以及修改>

<如何搭建初始化数据以及修改>
通过一系列的action来分步骤实现初始化数据需求。
初始化数据，需要通过创建变量，通过变量的值更新事件调用UI组件的输入，或者绑定UI组件的配置项实现。

${fileFormat({
  content: `[actionType,params]`,
  fileName: '初始化数据操作步骤.json'
})}

  <关于作用域插槽的说明>
  在组件说明的<slots>内标记了"作用域插槽"的插槽。
  禁止跨作用域的<connect>。
  </关于作用域插槽的说明>

  <作用域插槽定位规则>
  - 根级作用域：comId为"_root_"，slotId为"_rootSlot_"
  - 组件级作用域：根据具体组件的comId和对应的作用域slotId定位
  </作用域插槽定位规则>

  <关于actions>
    各action详细说明如下：

    <createVar>
    创建变量，在结构上严格遵循以下格式：["createVar",params]
    - 在作用域插槽内创建变量
    - params的格式以Typescript的形式说明如下：
    \`\`\`typescript
    type CreateVarParams {
      target: { // 创建变量的作用域插槽定位
        comId: string; // 目标组件的id
        slotId: string; // 目标组件的作用域插槽id
        inputId？: string; // 如果创建在组件级作用域插槽内，必须声明插槽的输入id，根据<slots>下作用域插槽下的输入说明分析如何使用
      }
      title: string; // 定义语义化的变量名
      schema: Schema; // 标准JSON Schema协议，用于定义类型
      value: Schema; // 默认值，类型需要与 schema 定义保持一致，尽量扩写mock数据，不要出现空值的情况
      comId: string; // 变量的唯一id，禁止重复
    }
    \`\`\`
    </createVar>

    <connect>
    连接，将变量与UI组件的输入连接
    在结构上严格遵循以下格式：["connect",varParams,comParams]
    - 禁止跨作用域的连接
    - varParams的格式以Typescript的形式说明如下：
    \`\`\`typescript
    type VarParams {
      comId: string; // 变量id
      xpath: string; // 变量值的属性路径，使用举例：需要变量a，则值为""。需要变量a的b属性，则值为"/b"。需要变量a的b属性的c属性，则值为"/b/c"。以/开头，以/分割。
    }
    \`\`\`
    - comParams的格式以Typescript的形式说明如下：
    \`\`\`typescript
    type ComParams {
      comId: string; // UI组件id
      inputId: string; // 在选择inputId时，必须仔细阅读目标UI组件文档中<inputs>部分的描述，确保其语义与变量的用途完全匹配；
    }
    \`\`\`
    - 如果目标UI组件在<inputs>部分中没有找到任何可用的输入与变量语义匹配、或者<inputs>内容为“无”，则**严禁**生成<connect>。
    </connect>
  </关于actions>

  <示例>
  *用户信息*：
  ${fileFormat({
    content: `["createVar",{"target":{"comId":"comId","slotId":"作用域slotId"},"title":"用户信息","schema":{"type":"object","properties":{"name":{"type":"string"},"age":{"type":"number"}}},"value":{"name":"张三","age":18},"comId":"u_userinfo"}]
["connect",{"comId":"u_userinfo","xpath":"/name"},{"comId":"u_username","inputId":"设置内容"}]
["connect",{"comId":"u_userinfo","xpath":"/age"},{"comId":"u_userage","inputId":"设置内容"}]`,
    fileName: '初始化数据操作步骤.json'
  })}

  *列表渲染*：
  ${fileFormat({
    content: `["createVar",{"target":{"comId":"comId","slotId":"作用域slotId"},"title":"商品列表","schema":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string"},"name":{"type":"string"},"price":{"type":"number"},"image":{"type":"string"},"description":{"type":"string"}}}},"value":[{"id":"1","name":"iPhone 15","price":5999,"image":"https://example.com/iphone15.jpg","description":"最新款iPhone"},{"id":"2","name":"MacBook Pro","price":12999,"image":"https://example.com/macbook.jpg","description":"专业级笔记本电脑"},{"id":"3","name":"AirPods Pro","price":1999,"image":"https://example.com/airpods.jpg","description":"降噪耳机"}],"comId":"u_productList"}]
["connect",{"comId":"u_productList","xpath":""},{"comId":"u_listContainer","inputId":"数据源"}]
["createVar",{"target":{"comId":"u_listContainer","slotId":"itemSlot","inputId":"当前项"},"title":"当前商品","schema":{"type":"object","properties":{"id":{"type":"string"},"name":{"type":"string"},"price":{"type":"number"},"image":{"type":"string"},"description":{"type":"string"}}},"value":{"id":"","name":"","price":0,"image":"","description":""},"comId":"u_currentProduct"}]
["connect",{"comId":"u_currentProduct","xpath":"/name"},{"comId":"u_productName","inputId":"设置内容"}]
["connect",{"comId":"u_currentProduct","xpath":"/price"},{"comId":"u_productPrice","inputId":"设置内容"}]
["connect",{"comId":"u_currentProduct","xpath":"/image"},{"comId":"u_productImage","inputId":"图片地址"}]
["connect",{"comId":"u_currentProduct","xpath":"/description"},{"comId":"u_productDesc","inputId":"设置内容"}]`,
    fileName: '初始化数据操作步骤.json'
  })}
  </示例>

  <注意>
  - 创建的变量必须覆盖<需求文档>中列出的所有*初始化数据*条目，确保不遗漏任何一项，缺少变量会带来不可挽回的损失；
  - 无论UI组件是否已经有静态配置或默认值，都必须通过变量进行驱动更新，确保初始化数据的正确性；
  </注意>

  <最佳实践>
  1. 阅读<需求文档>里*初始化数据*条目，并思考：
    - 各变量的含义和作用
    - 是否有可以合并的变量，例如（表格数据源 + 分页信息、用户头像 + 用户信息等）
    - 变量需要驱动哪个UI组件，该UI组件位于哪一个作用域插槽内
    - 根据UI组件的<使用说明>以及<slots>相关信息，识别是否需要在其作用域插槽内创建变量，例如（列表类、需要循环渲染子组件的组件，需要额外创建作用域子项的变量）
  2. 创建变量，并思考：
    - 按需创建变量，创建的变量必须要被使用，否则禁止创建；
    - 所需创建变量的Schema和value，做到按需创建，创建的key都能够connect到具体的UI组件；
    - 变量驱动UI是否需要取内部属性；
    - 如果取内部属性，属性是否都用上了，例如：用户信息变量（name，age，add，等），需要把所有属性都connect到具体的UI组件。
    - 依赖数组类型数据驱动的组件，如果有作用域插槽，需要思考是否要在作用域插槽内创建变量来驱动子组件。
  3. 通过connect操作，将变量连接到UI组件的输入，并思考：
    - 连接的UI组件是否存在作用域插槽隔离
    - 阅读UI组件文档的<inputs>，判断输入是否满足数据驱动需求，如果满足使用对应的inputId值，不满足的禁止连接。
  </最佳实践>
</如何搭建初始化数据以及修改>

${config.appendPrompt ? `<对于项目环境的说明>
${config.appendPrompt}
</对于项目环境的说明>` : ''}

<生成UI思路>
按照以下步骤完成：
  1、总体分析，按照以下步骤进行：
    1）确定总体的功能；
    2）保持总体UI设计简洁大方、符合现代审美、富有设计感，重点注意：
       - 建立清晰的视觉层次：通过字体大小、粗细、颜色、间距建立信息层级；
       - 使用现代设计元素：渐变背景、圆角卡片、轻微阴影、毛玻璃效果等；
       - 保持设计统一性：统一圆角值、间距系统、色彩方案、字体层级；
       - 色彩和谐：使用协调的配色方案，确保对比度和可读性；
       - 细节精致：注意圆角、阴影、边框等细节，体现专业感和现代感；
    3) 如果需要还原附件图片中的视觉设计效果:
      特别关注整体的布局、定位、颜色、字体颜色、背景色、尺寸、间距、边框、圆角等UI信息，按照以下的流程还原参考图片：
      - 提取图片中的关键UI信息并总结；
      - 根据总结和图片将所有UI信息细节使用actions一比一还原出来，注意适配画布尺寸；
      - 忠于图片/设计稿进行搭建，而不是文字性的总结，文字总结会有歧义；
      - 注意每一个元素的以及邻近元素的位置，上下左右元素，以及子组件的布局方式，务必保证与设计稿对齐；

  2、选择合适的组件与插槽，留意（知识库有更新）的提示，注意使用的组件不要超出当前【知识库】的范围：
    1）按照自上而下、从左向右的方式分析形成组件方案以及采用的插槽；
    2）选用合理的布局；
  
  3、详细分析各个组件，按照以下要点展开：
    - 标题(title):组件的标题；
    - 布局(layout):组件的宽高与外间距信息，只能声明width、height、margin，不允许使用padding等属性；
    - 样式(styleAry):根据组件声明的css给出合理的设计实现；
    - 数据(data):根据【知识库】中该组件的data声明进行实现；

  4、返回搭建UI的actions操作步骤文件内容，注意：
    - 每一个action符合JSON规范，每一行为一个action
    - 禁止包含任何注释（包括单行//和多行/* */）
    - 禁止出现省略号(...)或任何占位符
    - 确保所有代码都是完整可执行的，不包含示例片段
    - 禁止使用非法字符或特殊符号
    - 所有内容均为静态数据，禁止解构，禁止使用变量

  5、最后，根据搭建UI的actions操作步骤文件内容，返回搭建初始化数据的actions操作步骤文件内容，注意：·
    - 每一个action符合JSON规范，每一行为一个action
    - 禁止包含任何注释（包括单行//和多行/* */）
    - 禁止出现省略号(...)或任何占位符
    - 确保所有代码都是完整可执行的，不包含示例片段
    - 禁止使用非法字符或特殊符号
    - 所有内容均为静态数据，禁止解构，禁止使用变量
</生成UI思路>

<生成UI限制>
生成UI必须从根组件_root_开始配置，以及从插槽_rootSlot_开始添加组件。
</生成UI限制>

${config.fewShots ? `<examples>

${config.fewShots}

</examples>` : ''}`
    },
    stream({ files, status, replaceContent }) {
      let actions = [];
      let varActions = [];

      const actionsFile = getFiles([files[0] || {}], {extName: 'json' })
      const varActionsFile = getFiles([files[1] || {}], {extName: 'json' })

      if (actionsFile) {
        actions = streamActionsParser(actionsFile.content ?? "");
        if (!fileNameToContent[actionsFile!.fileName]) {
          fileNameToContent[actionsFile!.fileName] = "";
        }
      }

      if (varActionsFile) {
        varActions = streamVarActionsParser(varActionsFile.content ?? "");
      }

      actions = fixActions(actions, {
        rootId,
        pageId
      })

      if (status === 'start') {
        config.onClearPage()
      }
      
      if (actions.length > 0 || varActions.length > 0 || status === 'start' || status === 'complete') {
        const currentStatus = status === 'complete' ? "ing" : status;
        const copiedActions = JSON.parse(JSON.stringify(actions));
        try {
          // config.onActions(actions, status)
          actions.forEach((action) => {
            if (action.type === "addChild") {
              const childComId = action.params.comId;
              // 对于addChild操作，每次添加时都生成新的UUID映射
              action.params.comId = uiTree.comIdTransform.addComId(childComId);
              uiTree.setNamespace(action.params.comId, action.params.namespace);

              const parentComId = action.comId;

              if (parentComId !== "_root_") {
                // 获取父组件时，使用最近添加的comId
                action.comId = uiTree.getComId(parentComId);
              }

              uiTree.addNode({
                id: action.params.comId,
                parent: {
                  id: action.comId,
                  slotId: action.target,
                }
              })
            } else if (action.type === "doConfig") {
              const comId = action.comId;
              if (comId !== "_root_") {
                // 获取组件时，使用最近添加的comId
                action.comId = uiTree.getComId(comId);
              }
            }
          })
          actions.forEach((action: any) => {
            promiseStack.add(() => config.onActions([action], currentStatus))
          })
        } catch (error) {
          console.error('generate-page onActions error', error);
        }
        const actionsContent = getComponentOperationSummary(copiedActions, config.componentIdToTitleMap)

        if (actionsFile) {
          if (!fileNameToContent[actionsFile!.fileName]) {
            fileNameToContent[actionsFile!.fileName] = actionsContent.trim();
          } else {
            fileNameToContent[actionsFile!.fileName] += `\n${actionsContent.trim()}`;
          }
        }

        try {
          varActions.forEach((action: any) => {
            if (action[0] === "createVar") {
              const { comId, schema, target, title, value } = action[1];

              const targetComId = target.comId === "_root_" ? null : uiTree.getComId(target.comId);
              const varComId = uiTree.getComId(comId);
              uiTree.addNode({
                id: varComId,
                parent: {
                  id: targetComId || "_root_",
                  slotId: target.slotId,
                }
              })

              const newAction = {
                type: "defineVar",
                params: {
                  comId: targetComId,
                  slotId: target.slotId === "_rootSlot_" ? "_root_" : target.slotId,
                  id: varComId,
                  title,
                  schema,
                  initValue: value
                }
              }
              promiseStack.add(() => {
                console.log("[创建变量]", newAction)
                return config.onActions([newAction], currentStatus)
              })
              if (target.inputId) {
                // 创建插槽输入到变量的赋值
                const varInstanceId = uuid()
                const newActions = [
                  // 创建变量节点
                  {
                    type: "createCom",
                    params: {
                      type: "var",
                      varId: varComId,
                      inputId: "set",
                      instanceId: varInstanceId,
                    }
                  },
                  {
                    type: "connectTo",
                    params: {
                      from: {
                        type: "frame",
                        comId: targetComId,
                        frameId: target.slotId,
                        outputId: target.inputId
                      },
                      to: {
                        type: "com",
                        inputId: "set",
                        instanceId: varInstanceId
                      }
                    }
                  },
                ]
                promiseStack.add(() => {
                  const diagramId = context.api?.diagram?.api?.getDiagramInfo(targetComId, target.slotId).id;
                  diagrams[`${targetComId}_${target.slotId}`] = diagramId;
                  return context.api?.diagram?.api?.updateDiagram(diagramId, newActions, "start")
                })
              }
            } else if (action[0] === "connect") {
              const varParams = action[1];
              const uiComParams = action[2]
              const varComId = uiTree.getComId(varParams.comId);
              const uiComId = uiTree.getComId(uiComParams.comId);

              const scope: any = {
                status: currentStatus,
              }

              const uiScope = uiTree.getScope(uiComId);
              const varScope = uiTree.getScope(varComId);
              let diagramKey = varComId

              if ((uiScope.id !== varScope.id) || (uiScope.slotId !== varScope.slotId)) {
                diagramKey = `${uiScope.id}_${uiScope.slotId}_${varComId}`;

                if (!diagrams[diagramKey]) {
                  diagrams[diagramKey] = "pending"
                  const newAction = {
                    type: "defineListener",
                    params: {
                      comId: uiScope.id,
                      slotId: uiScope.slotId,
                      varId: varComId
                    }
                  }
                  promiseStack.add(() => config.onActions([newAction], currentStatus))
                  promiseStack.add(() => {
                    diagrams[diagramKey] = context.api?.diagram?.api?.getDiagramInfoByListenerInfo(uiScope.id, uiScope.slotId, varComId).id;
                    scope.status = "start";
                  })
                }
              } else {
                if (!diagrams[diagramKey]) {
                  promiseStack.add(() => {
                    diagrams[diagramKey] = context.api?.diagram?.api?.getDiagramInfoByVarId(varComId).id;
                    scope.status = "start";
                  })
                }
              }

              const varInstanceId = uuid()
              const uiComInstanceId = uuid()
              const newActions = varParams.xpath ? [
                // 创建变量节点
                {
                  type: "createCom",
                  params: {
                    type: "var",
                    varId: varComId,
                    inputId: "get",
                    instanceId: varInstanceId,
                    xpath: varParams.xpath,
                  }
                },
                // 创建UI组件节点
                {
                  type: "createCom",
                  params: {
                    type: "uiCom",
                    comId: uiComId,
                    inputId: uiComParams.inputId,
                    instanceId: uiComInstanceId
                  }
                },
                // 变量值变更到读变量
                {
                  type: "connectTo",
                  params: {
                    from: {
                      type: "com",
                      comId: varComId,
                      outputId: "changed",
                    },
                    to: {
                      type: "com",
                      inputId: "get",
                      instanceId: varInstanceId
                    }
                  }
                },
                // 变量return值到ui组件的输入
                {
                  type: "connectTo",
                  params: {
                    from: {
                      type: "com",
                      instanceId: varInstanceId,
                      outputId: "return"
                    },
                    to: {
                      type: "com",
                      instanceId: uiComInstanceId,
                      inputId: uiComParams.inputId
                    }
                  }
                },
              ] : [
                // 创建UI组件节点
                {
                  type: "createCom",
                  params: {
                    type: "uiCom",
                    comId: uiComId,
                    inputId: uiComParams.inputId,
                    instanceId: uiComInstanceId
                  }
                },
                // 变量值变更到UI组件
                {
                  type: "connectTo",
                  params: {
                    from: {
                      type: "com",
                      comId: varComId,
                      outputId: "changed",
                    },
                    to: {
                      type: "com",
                      instanceId: uiComInstanceId,
                      inputId: uiComParams.inputId
                    }
                  }
                },
              ]
              console.log("[连接ui组件]", newActions)
              promiseStack.add(() => {
                return context.api?.diagram?.api?.updateDiagram(diagrams[diagramKey], newActions, scope.status)
              })
            }
          })
        } catch (error) {
          console.error('generate-page onVarActions error', error);
        }
        
        if (status === "complete") {
          promiseStack.add(() => {
            config.onActions([], status)
            Object.entries(diagrams).forEach(([_, id]) => {
              context.api?.diagram?.api?.updateDiagram(id, [], status)
            })
          })
        }
      }

      return displayContent = Object.entries(fileNameToContent).reduce((pre, [fileName, content]) => {
        return pre.replace(fileName, content);
      }, replaceContent)
    },
    execute({ files, content }) {
      let actions: any = [];
      const actionsFile = getFiles(files, {extName: 'json' })

      console.log("[files]", files);
      console.log("[uiTree]", uiTree)

      if (!actionsFile) {
        return {
          llmContent: content,
          displayContent: content
        }
      }
      actions = excuteActionsParser(actionsFile.content ?? "");
      // let actions: any = [];
      // const actionsFile = getFiles(files, {extName: 'json' })
      // if (actionsFile) {
      //   actions = actionsParser(actionsFile.content ?? "");
      // }
      // config.onActions(actions)

      actions = fixActions(actions, {
        rootId,
        pageId
      })

      console.log('generate-page actions=', JSON.parse(JSON.stringify(actions)));

      try {
        const llmContent = stripFileBlocks(content);
        const actionsContent = actions?.length ? getComponentOperationSummary(actions, config.componentIdToTitleMap) : ""
        const summary = (llmContent ? `${llmContent}\n\n` : "") + (actionsContent ? `修改内容如下\n${actionsContent}` : "当前没有内容修改");

        return {
          llmContent: summary,
          displayContent: summary
        }
  //       const summary = getComponentOperationSummary(actions, config.componentIdToTitleMap)

  //       return {
  //         llmContent: `根据需求，执行以下操作
  // ${summary}`,
  //         displayContent: `根据需求，执行以下操作
  // ${summary}`
  //       }
      } catch (error) {
        
      }

      return {
        llmContent: '已执行所有操作',
        displayContent: '已执行所有操作'
      }
    },
  }
}

function fixActions(actions: any[], {
  rootId,
  pageId
}: {
  rootId?: string,
  pageId?: string
}) {
  return (actions ?? []).map(action => {
    if (action.comId === rootId && action.type === 'addChild' && action.target === '_rootSlot_') {
      action.comId = '_root_'
    }

    if (action.comId === pageId) {
      action.comId = '_root_'
    }
    return action;
  })
}

/** 生成UI内容的简化参数（用于 MyBricksTools） */
export interface GenerateUiContentConfigParams {
  fewShots: string;
}

/** 生成UI内容的工具配置函数（用于 MyBricksTools） */
export function GenerateUiContent(params: GenerateUiContentConfigParams) {
  return {
    name: NAME,
    params: {
      fewShots: params?.fewShots,
    },
  }
}