import { fileFormat } from '@mybricks/rxai'
import { getFiles, createActionsParser, getComponentOperationSummary, stripFileBlocks, PromiseStack, ComIdTransform } from './utils'
import { context } from "../context";
import { ComponentsManager } from "../agents/workspace/components-manager";

/**
 * 分析需求并拆分工具的参数接口
 * getRootComponentDoc 等 API 参考 generate-ui-content
 */
interface AnalyzeRequirementAndSplitToolParams {
  /** 当前根组件信息（用于 getPrompts） */
  getRootComponentDoc?: () => string;
  getTargetId?: () => string;
  getRootIdByPageId?: (id: string) => string | undefined;
  componentIdToTitleMap?: Map<string, string>;
  /** 当 UI actions 返回时 */
  onActions?: (actions: any[], status: string) => void;
  /** 添加代码块（需求文档） */
  onAddCodingBlock?: (com: any) => void;
  /** 清空当前画布信息 */
  onClearPage?: () => void;
}

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
    let scope = false;
    if (namespace) {
      const component = ComponentsManager.getAiComponent(namespace);
      if (component?.all?.slots?.find((slot: any) => slot.id === parent.slotId)?.type === 'scope') {
        scope = true;
      }
    }
    this.nodeMap.set(id, {
      id,
      parent: {
        ...parent,
        scope,
      },
    });
  }

  setNamespace(comId: string, namespace: string) {
    this.comIdToNamespace.set(comId, namespace);
  }
}

function fixActions(
  actions: any[],
  { rootId, pageId }: { rootId?: string; pageId?: string }
) {
  return (actions ?? []).map((action) => {
    if (action.comId === rootId && action.type === 'addChild' && action.target === '_rootSlot_') {
      action.comId = '_root_';
    }
    if (action.comId === pageId) {
      action.comId = '_root_';
    }
    return action;
  });
}

const NAME = 'analyze-requirement-and-split'
analyzeRequirementAndSplit.toolName = NAME

/**
 * 分析需求并拆分的工具函数
 * 将用户需求拆成多个实现模块，每个模块对应后续一次代码开发
 */
export default function analyzeRequirementAndSplit(
  config: AnalyzeRequirementAndSplitToolParams = {}
): any {
  const streamActionsParser = createActionsParser({ enabledActionTags: context.enabledActionTags });
  const excuteActionsParser = createActionsParser({ enabledActionTags: context.enabledActionTags });

  const pageId = config?.getTargetId?.();
  const rootId = config?.getRootIdByPageId?.(pageId ?? '');

  let fileNameToContent: Record<string, string> = {};
  let displayContent = '';
  const promiseStack = new PromiseStack();
  const uiTree = new UITree();

  return {
    name: NAME,
    displayName: '需求拆分',
    description: `把用户需求拆分成不同的实现模块，供后续代码开发。
参数：无；
作用：理解用户需求，按实现维度拆成多个模块，每个模块对应后续一次代码开发调用；
返回值：实现拆分/修改的actions文件；

常见场景：
1. 实现一个页面：拆成多个不同区域的内容，交给代码开发工具；
2. 改/加一个功能：拆成涉及到的几个实现模块，再逐个开发；
`,
    aiRole: 'architect',
    getPrompts: () => {
      return `<工具总览>
你是需求分析与模块拆分工具。把用户需求拆成多个模块和需求，每个模块可交由后续工具进行开发。
</工具总览>

<任务流程>
1. 理解用户需求要落地的具体内容；
2. 按实现维度拆分/修改区域模块；
3. 输出actions文件；
</任务流程>

<特别注意>
  - 如果附件中有图片，需要在搭建过程中作为重要的参考，要注意分辨设计稿（或者截图）或者用户绘制的线框图，对于前者、要求最大程度还原图片中的各项功能要素与视觉设计要素，总体要求考虑到功能一致完整与合理性、注意外观视觉美观大方、富有现代感.
</特别注意>

<当前画布根组件信息>
${config.getRootComponentDoc?.() ?? ''}

IMPORTANT: 生成UI的根组件ID必须使用此文档信息。
</当前画布根组件信息>

<搭建画布信息>
  搭建画布的宽度一般建议在 1024 - 1920之间，所有元素的尺寸需要关注此信息，且尽可能自适应布局。
  
  搭建画布的宽度只是在MyBricks搭建时的画布宽度，实际运行时可能会更宽。
  
  搭建内容必须参考PC端网站进行设计，内容必须考虑左右排列的丰富度，以及以下PC的特性
    比如:
      1. 布局需要自适应画布宽度，实际运行的电脑宽度不固定；
      2. 宽度和间距配置的时候要注意画布的宽度，不要超出，也不要让内容间距太大；
</搭建画布信息>

<如何搭建UI以及修改>
  通过一系列的action来分步骤实现用户需求。
  
  ${fileFormat({
    content: `[comId, target, type, params]`,
    fileName: '操作步骤.actions'
  })}

  <关于actions>
    actions 文件（扩展名为 .actions）由多个 action 构成,每个 action 在结构上都严格遵循以下格式：[comId, target, type, params];
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
        fileName: '样式配置步骤.actions'
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
        fileName: '样式配置步骤.actions'
      })}
      
      - 样式的配置：
      ${fileFormat({
        content: `["u_ou1rs",":root","doConfig",{"path":"常规/banner样式","style":{"backgroundColor":"red"}}]`,
        fileName: '样式配置步骤.actions'
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
        fileName: '添加文本组件步骤.actions'
      })}

      ${fileFormat({
        content: `["u_ou1rs","content","addChild",{"title":"背景图","ns":"namespace占位","comId":"u_ko4sn","layout":{"width":"100%","height":200,"marginTop":8,"marginLeft":12,"marginRight":12},"configs":[{"path":"常规/图片地址","value":"https://ai.mybricks.world/image-search?term=风景"},{"path":"样式/图片","style":{"borderRadius":"8px"}}]}]`,
        fileName: '添加带配置属性的步骤.actions'
      })}
  
      ${fileFormat({
        content: `["u_ou1rs","content","addChild",{"title":"添加的布局组件","ns":"namespace占位","comId":"u_nb5yg","ignore": true}]`,
        fileName: '添加带ignore标记的步骤.actions'
      })}
  
      注意:
        - 新添加的组件ID必须使用5位唯一的字母数字组合，禁止重复，在所有UI组件中唯一；
    </addChild>

    <delete>
      - 删除组件

      例如，当用户要求删除组件u_o21rs，可以返回以下内容：
      ${fileFormat({
        content: `["u_o21rs",":root","delete"]`,
        fileName: '删除组件整体.actions'
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

    **容器组件限制**：根组件可以配置背景；仅容器组件（如布局容器、some.container 等）不允许配置 padding 和背景色（含 doConfig 的 style.background/backgroundColor 以及 layout 中的 backgroundColor）。
    
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
          fileName: '添加一个fixed定位组件.actions'
        })}

      在插槽的不同布局下，组件的定位由所在插槽的布局方式决定：
        - 在当前组件的插槽中，可以添加fixed定位的组件，禁止在其他插槽中添加fixed定位的组件；
        - 如果插槽是flex布局，则子组件主要使用flex定位，特殊情况下使用absolute定位；
    </组件的定位原则>
   
    <布局原则>
      插槽的布局(display=flex)指的是对于内部组件（仅对其直接子组件，对于子组件插槽中的子组件无影响)的布局约束:
      
      **flex布局**
      （基本等同于CSS3规范中的flex布局）插槽中的所有子组件通过宽高和margin进行布局。
  
      <布局使用示例>
        **flex布局**
          子组件通过嵌套来搭建，无需考虑子组件的宽度和高度。

          下面的例子使用flex实现左侧固定宽度，右侧自适应宽度布局，右侧宽度配置width=auto:
          ${fileFormat({
            content: `["目标组件id","插槽id占位","addChild",{"title":"添加一个布局组件","comId":"u_flex0","ns":"布局组件","layout":{"width":"100%","height":60},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
          ["u_flex0","插槽id占位","addChild",{"title":"左侧固定宽度组件","comId":"u_lf4x1","ns":"组件","layout":{"width":60,"height":40,"marginRight":8},"configs":[]}]
          ["u_flex0","插槽id占位","addChild",{"title":"右侧自适应组件","comId":"u_rfo1x","ns":"组件","layout":{"width":"auto","height":40},"configs":[]}]
          `,
            fileName: '左侧固定宽度+右侧自适应宽度.actions'
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
            fileName: 'flex嵌套实现左右布局.actions'
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
            fileName: '垂直居中布局.actions'
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
            fileName: '左右各占一半布局.actions'
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
            fileName: '一行N列布局.actions'
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
            fileName: '负margin实现背景层+内容层重叠.actions'
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
            fileName: '绝对定位效果.actions'
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
  </UI搭建原则>
</如何搭建UI以及修改>

<examples>
  <example>
    <user_query>搭建一个知乎个人中心页面</user_query>
    <assistant_response>
      首先，必须根据页面内容设置一个数字类型的宽度和高度，必须为具体数字。
      其次，必须对页面布局设置一个合理的布局和背景。
      然后
      基于用户当前的选择上下文，我们来实现一个知乎个人中心页面，思考过程如下：
      1. 搭建页面时一般用从上到下的搭建方式，我们推荐在页面最外层设置为flex的垂直布局，这样好调整位置；
      2. 将页面从上到下分成顶部信息、个人资料、核心内容三个区域来拆分。

      ${fileFormat({
        content: `["_root_",":root","setLayout",{"height": 820,"width": 1440}]
        ["_root_",":root","doConfig",{"path":"root/标题","value":"个人中心页面框架"}]
        ["_root_",":root","doConfig",{"path":"root/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}}]
        ["_root_",":root","doConfig",{"path":"root/样式","style":{"background":"#F5F5F5"}}]
        ["_root_","_rootSlot_","addChild",{"title":"顶部导航","ns":"some.ai-mix","comId":"u_top32","layout":{"width":"100%","height":80},"configs":[{"path":"常规/需求文档","value":"# 顶部导航区域 背景和间距：背景白色，无间距。 内容：包含左侧的菜单和右侧的头像+消息入口"}]}]
        ["_root_","_rootSlot_","addChild",{"title":"个人资料","ns":"some.ai-mix","comId":"u_a2fer","layout":{"width":"100%","height":"fit-content","marginTop":12, "marginLeft":12, "marginRight":12},"configs":[{"path":"常规/需求文档","value":"# 个人资料区域 背景和间距：白色，间距无（外层已处理）。内容：包含头像、昵称、登记、性别等集合信息，左侧是头像、昵称、登记、性别等集合信息，右侧是编辑按钮"}]}]
        ["_root_","_rootSlot_","addChild",{"title":"核心内容","ns":"some.ai-mix","comId":"u_iiusd7","layout":{"width":"100%","height":"fit-content","marginTop":12, "marginLeft":12, "marginRight":12},"configs":[{"path":"常规/需求文档","value":"#核心内容区域 背景和间距：白色，间距无（外层已处理）。 内容：左侧是最近浏览记录，展示浏览/点赞的帖子（有特殊的已点赞标记），右侧分为上下两个部分，上面是个人成就，勋章等荣誉信息，下方是帮助中心、举报中心、关于知乎等页脚入口"}]}]`,
        fileName: '生成个人中心页面操作步骤.actions'
      })}

      注意：
      - flex布局优先使用fit-content来计算内容高度；
      - 三个区域有明显的卡片UI区分，所以间距在外层处理。
    </assistant_response>
  </example>

  <example>
    <user_query>还原设计稿效果</user_query>
    <assistant_response>
      好的，还原设计稿效果，首先必须根据页面内容设置一个数字类型的宽度和高度，必须为具体数字。
      其次，必须对页面布局设置一个合理的布局。
      然后
      基于用户当前的选择上下文，我们来实现一个知乎云服务器页面，思考过程如下：
      1. 整体结构为顶部导航栏 + 左侧菜单 + 右侧内容的经典布局，采用flex布局来实现；
      2. 将页面从上到下，从左到右分成多个部分；

      ${fileFormat({
        content: `["_root_",":root","setLayout",{"height": 1080, "width": 1600}]
        ["_root_",":root","doConfig",{"path":"root/布局","value":{"display":"flex","flexDirection":"column"}}]
        ["_root_","_rootSlot_","addChild",{"title":"顶部导航栏","ns":"some.ai-mix","comId":"u_top32","layout":{"width":"100%","height":60},"configs":[{"path":"常规/需求文档","value":"# 顶部导航栏 背景和间距：背景白色，无间距。 内容：包含左侧的菜单、中间搜索框、右侧的头像入口"}}]}]
        ["_root_","_rootSlot_","addChild",{"title":"横向左右布局","ns": "some.container","comId":"u_2h32d","layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex", "flexDirection": "row", "justifyContent": "space-between", "alignItems": "center"}}]}]
        ["u_2h32d","content","addChild",{"title":"左侧菜单","ns":"some.ai-mix","comId":"u_leftMenu","layout":{"width":200,"height":"fit-content"},"configs":[{"path":"常规/需求文档","value":"# 左侧菜单 背景和间距：背景白色，无间距。 内容：包含左侧的菜单、中间搜索框、右侧的头像入口"}}]}]
        ["u_2h32d","content","addChild",{"title":"右侧核心内容","ns":"some.container","comId":"u_rightContent","layout":{"width":"auto","height":"fit-content", "marginLeft": 12, "marginRight": 12, "marginTop": 12, "marginBottom": 12},"configs":[{"path":"常规/布局","value":{"display":"flex", "flexDirection": "column"}}]}]
        ["u_rightContent", "content", "addChild",{"title":"指标卡片区","ns":"some.ai-mix","comId":"u_data","layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"常规/需求文档","value":"# 指标卡片区 背景和间距：背景白色，无间距。 内容：从左到右包含四个指标卡，每个指标卡包含一个标题、一个数值、一个图标"}}]}]
        ["u_rightContent", "content", "addChild",{"title":"表格片区","ns":"some.ai-mix","comId":"u_table","layout":{"width":"100%","height":"fit-content", "marginTop": 12},"configs":[{"path":"常规/需求文档","value":"# 表格片区 背景和间距：背景白色。 内容：包含一个服务器价格表格，表格包含多个列"}}]}]`,
        fileName: '还原云服务器页面操作步骤.actions'
      })}

      注意：
      - flex布局优先使用fit-content来计算内容高度；
      - 布局用于提供布局和间距，让AI组件不用关心宏观间距和布局，只需要考虑自身即可；
        - 左右布局容器左侧为固定宽度，右侧为auto自适应宽度，这样更适合自适应页面宽度；
        - 核心内容包揽了间距，简化AI组件内部样式逻辑；
    </assistant_response>
  </example>

  <example>
    <user_query>添加一个两行三列的导航</user_query>
    <assistant_response>
      好的，两行三列，就是均分网格布局，考虑到导航往往是动态数据，我们一般使用列表 + 间距来实现。
      所以提供一个列表容器，添加一个宽度=100%的flex布局容器，将内容添加进去即可。
      
      首先，必须根据页面内容设置一个数字类型的宽度和高度，必须为具体数字。
      其次，必须对页面布局设置一个合理的布局。
      
      ${fileFormat({
        content: `["_root_",":root","setLayout",{"height": 360, "width": 520}]
        ["_root_",":root","doConfig",{"path":"root/标题","value":"两行三列的导航"}]
        ["_root_",":root","doConfig",{"path":"root/布局","value":{"display":"flex","flexDirection":"column","alignItems":"center"}}]
        ["_root_","_rootSlot_","addChild",{"title":"循环列表","ns":"some.list","comId":"u_list","layout":{"width":"100%","height":"fit-content","marginLeft":8,"marginRight":8},"configs":[{ "path": "常规/列间距", "value": 8 }]}]
        ["u_list","item","addChild",{"title":"Flex容器","ns":"some.container","comId":"u_iiusd7","enhance": true,"layout":{"width":"100%","height":200},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"center", "alignItems":"center"}}]}]
        ["u_iiusd7","content","addChild",{"title":"导航1","ns":"some.icon","comId":"u_icon1","layout":{"width":120,"height":120,"marginTop":8},"configs":[{"path":"样式/文本","style":{"background":"#0000FF"}}]}]`,
        fileName: '两行三列导航操作步骤.actions'
      })}

    注意：
      - 这个Flex容器很有可能后续提供点击事件，所以不允许添加ignore标记，同时他属于图文展示，可以添加enhance标记。
    </assistant_response>
  </example>
</examples>`
    },
    stream({ files, status, replaceContent }: { files?: any; status?: string; replaceContent?: string }) {
      console.log('analyze-requirement-and-split stream', status)
      let actions: any[] = [];

      const actionsFile = getFiles(
        Array.isArray(files) ? (files[0] != null ? { 0: files[0] } : {}) : files ?? {},
        { extName: 'actions' }
      ) ?? getFiles(
        Array.isArray(files) ? (files[0] != null ? { 0: files[0] } : {}) : files ?? {},
        { extName: 'json' }
      );

      if (actionsFile) {
        actions = streamActionsParser(actionsFile.content ?? '', actionsFile?.isComplete);
        if (!fileNameToContent[actionsFile.fileName]) {
          fileNameToContent[actionsFile.fileName] = '';
        }
      }

      actions = fixActions(actions, { rootId, pageId });

      if (status === 'start') {
        config.onClearPage?.();
      }

      if (actions.length > 0 || status === 'start' || status === 'complete') {
        const currentStatus = (status === 'complete' ? 'ing' : status) ?? 'ing';
        const copiedActions = JSON.parse(JSON.stringify(actions));
        try {
          actions.forEach((action: any) => {
            if (action.type === 'addChild') {
              const childComId = action.params.comId;
              action.params.comId = uiTree.comIdTransform.addComId(childComId);
              uiTree.setNamespace(action.params.comId, action.params.ns ?? action.params.namespace);

              const parentComId = action.comId;
              if (parentComId !== '_root_') {
                action.comId = uiTree.getComId(parentComId);
              }

              uiTree.addNode({
                id: action.params.comId,
                parent: { id: action.comId, slotId: action.target },
              });

              if (
                action.params.comId &&
                action.params.configs?.[0]?.path === '常规/需求文档'
              ) {
                config.onAddCodingBlock?.({
                  comId: action.params.comId,
                  requirement: action.params.configs[0].value?.replace?.(/# /, '') ?? '',
                });
              }
            } else if (action.type === 'doConfig') {
              const comId = action.comId;
              if (comId !== '_root_') {
                action.comId = uiTree.getComId(comId);
              }
            }
          });
          actions.forEach((action: any) => {
            promiseStack.add(() => config.onActions?.([action], currentStatus));
          });
        } catch (error) {
          console.error('analyze-requirement-and-split stream onActions error', error);
        }

        const actionsContent = getComponentOperationSummary(
          copiedActions,
          config.componentIdToTitleMap ?? new Map()
        );
        if (actionsFile) {
          if (!fileNameToContent[actionsFile.fileName]) {
            fileNameToContent[actionsFile.fileName] = actionsContent.trim();
          } else {
            fileNameToContent[actionsFile.fileName] += `\n${actionsContent.trim()}`;
          }
        }

        if (status === 'complete') {
          promiseStack.add(() => config.onActions?.([], status));
        }
      }

      displayContent = Object.entries(fileNameToContent).reduce(
        (pre, [fileName, content]) => pre.replace(fileName, content),
        replaceContent ?? ''
      ) as string;
      return displayContent;
    },
    execute({ files, content }: { files?: any; content?: any }) {
      let actions: any[] = [];
      const actionsFile =
        getFiles(files ?? {}, { extName: 'actions' }) ??
        getFiles(files ?? {}, { extName: 'json' });

      if (!actionsFile) {
        return {
          llmContent: content,
          displayContent: content ?? '',
        };
      }

      actions = excuteActionsParser(actionsFile.content ?? '');
      actions = fixActions(actions, { rootId, pageId });

      try {
        const llmContent = stripFileBlocks(content ?? '');
        const actionsContent =
          actions?.length > 0
            ? getComponentOperationSummary(
                actions as Parameters<typeof getComponentOperationSummary>[0],
                config.componentIdToTitleMap ?? new Map()
              )
            : '';
        const summary =
          (llmContent ? `${llmContent}\n\n` : '') +
          (actionsContent ? `修改内容如下\n${actionsContent}` : '当前没有内容修改');

        return {
          llmContent: summary,
          displayContent: summary,
        };
      } catch (error) {
        console.error('analyze-requirement-and-split execute error', error);
      }

      return {
        llmContent: content ?? '已执行所有操作',
        displayContent: content ?? '已执行所有操作',
      };
    },
  };
}
