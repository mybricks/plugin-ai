import { fileFormat, RxaiError } from '@mybricks/rxai'
import { getFiles, createActionsParser, getComponentOperationSummary, stripFileBlocks, ComIdTransform, PromiseStack } from './utils'

interface RefactorUiContentToolParams {
  appendPrompt: any;
  /** 当前根组件信息 */
  getRootComponentDoc: () => string;
  getTargetId: () => string;
  componentIdToTitleMap: Map<string, string>;
  getFocusElementHasChildren: () => boolean
  /** 当所有actions返回时 */
  onActions: (actions: any[], status: string, type: string) => void
  getFocusElementAiRole?: () => boolean;
  getComIds: () => any;
}

const NAME = 'refactor-components-in-canvas'
refactorUiContent.toolName = NAME;

export default function refactorUiContent(config: RefactorUiContentToolParams): any {
  const streamActionsParser = createActionsParser();
  const excuteActionsParser = createActionsParser();
  const hasChildren = config.getFocusElementHasChildren() !== false

  let fileNameToContent: Record<string, string> = {};
  let displayContent = "";

  // TODO，因为updateCom不支持修改_root_，所以在聚焦组件时修改页面使用updatePage，目前是用第一个action的ID来判断是修改页面还是修改组件
  let firstActionId: string
  let actionType = 'page'

  const pageId = config?.getTargetId();
  const comIdTransform = new ComIdTransform(config.getComIds());
  const promiseStack = new PromiseStack();

  return {
    name: NAME,
    displayName: "局部修改/重构",
    description: `根据用户需求/附件图片对画布中的UI内容进行局部修改/重构/移动/删除。
参数：无
工具分类：操作执行类
作用：
  1. 局部修改组件配置；
  2. 通过添加/删除组件来重构整个组件插槽中的UI内容；
  3. 对组件进行移动和删除；
前置依赖：
  - 必须确保之前进行过「获取DSL」；
  - 如果需要修改组件配置，确保之前有执行过「获取DSL」，这个工具都会自动获取组件使用文档，组件的修改必须严格参考组件使用文档；
  - 如果需要添加组件，确保之前有进行过「组件选型」，添加组件必须通过组件选型来获取组件配置文档；
注意：此工具只能对UI内容进行操作。

使用场景示例：
  - 这个卡片改成美团购物卡片
    分析：由于卡片内容完全变化，可能涉及新增组件，并且需要修改卡片组件的配置，所以需要「获取DSL」->「组件选型分析」-> 「局部重构」的规划
  - 内容不符合要求，修改里面的内容
    分析：由于需要修改里面的内容可能涉及新增组件，所以需要「获取DSL」->「组件选型分析」->「局部重构」的规划
  - 修改XX组件的样式/配置
    分析：由于仅修改组件配置，所以仅需要「获取DSL」->「局部重构」的规划
  - 图片换个链接
    分析：由于仅修改组件配置，所以仅需要「获取DSL」->「局部重构」的规划
  - 添加一个XX组件
    分析：由于需要新增组件，所以需要「获取DSL」->「组件选型分析」->「局部重构」的规划
  - 删除组件
    分析：由于仅删除组件，所以仅需要「局部重构」的规划
  - 和某某交换位置
    分析：由于移动组件需要指导插槽id及其子组件情况，所以仅需要「获取DSL」->「局部重构」的规划
`,
    getPrompts() {
      return `<工具总览>
你是一个修改组件搭建效果的工具，你作为MyBricks低代码平台（以下简称MyBricks平台或MyBricks）的资深搭建助手，拥有专业的搭建能力。

<任务目标>
  你的任务是通过 actions 序列完成用户的目标。
  !IMPORTANT: 当前工具只能完成UI界面搭建，也就是只能搭建UI部分，逻辑部分请留到后续的逻辑搭建工具中完成。
</任务目标>
</工具总览>

<当前画布根组件信息>
${config.getRootComponentDoc()}

IMPORTANT: 如果要修改UI根组件，请使用此文档。
</当前画布根组件信息>

<如何修改>
  通过一系列的action来分步骤完成对组件的修改，请返回以下格式以驱动MyBricks对组件进行修改：
  
  <关于actions>
    actions.json文件由多个action构成,每个 action 在结构上都严格遵循以下格式：[comId, target, type, params];
    - comId 代表要操作的目标组件的id(对于需要生成的新的id，必须采用u_xxxxx，xxxxx是3-7位唯一的字母数字组合);
    - target 指的是组件的整体或某个部分，以选择器的形式表示
      - 当type=addChild时，target为插槽id;
      - 当type=move时，target为:root或插槽id;
    - type action的类型，包括了 setLayout、doConfig、addChild、move、delete 动作;
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
      - addChild代表向目标组件的插槽中的内容末尾中追加内容，需要满足两个条件:
        1. 目标组件中目前有定义插槽，且已知插槽的id是什么；
        2. 被添加的组件只能使用 <允许添加的组件/> 中声明的组件；
      
      - 第三个参数target代表要添加子组件的插槽id；
      - params的格式以Typescript的形式说明如下：
      
      \`\`\`typescript
      type add_params = {
        title:string //被添加组件的标题
        ns:string //在 <允许添加的组件 /> 中声明的组件namespace
        comId:string //新添加的组件id
        layout?: setLayout_flex_params ｜ setLayout_fixed_params //可选，添加组件时可以指定位置和尺寸信息
        configs?: Array<configStyle_params | configProperty_params> // 添加组件可以配置的信息
        index?: number //可选，默认（不配置时）为最后一位，添加组件时可以指定插槽位置，index=0表示放到第一位，index=1表示放到第二位
        // 辅助标记
        ignore: boolean //可选，是否添加ignore标记
      }
      \`\`\`
      
      例如：
      - 添加文本组件：
      ${fileFormat({
        content: `["u_ou1rs","content","addChild",{"title":"添加的文本组件","ns":"namespace占位","comId":"u_iiusd7"}]`,
        fileName: '添加文本组件步骤.json'
      })}

      - 添加组件带有配置属性：
      ${fileFormat({
        content: `["u_ou1rs","content","addChild",{"title":"背景图","ns":"namespace占位","comId":"u_iiusd7","layout":{"width":"100%","height":200,"marginTop":8,"marginLeft":12,"marginRight":12},"configs":[{"path":"常规/图片地址","value":"https://ai.mybricks.world/image-search?term=风景"},{"path":"样式/图片","style":{"borderRadius":"8px"}}]}]`,
        fileName: '添加带配置属性的步骤.json'
      })}

      - 添加组件带index指定位置：
      ${fileFormat({
        content: `["u_ou1rs","content","addChild",{"title":"添加的文本组件","ns":"namespace占位","comId":"u_iiusd7","index":1}]`,
        fileName: '添加带index指定位置的步骤.json'
      })}
  
      - 添加组件带ignore标记：
      ${fileFormat({
        content: `["u_ou1rs","content","addChild",{"title":"添加的布局组件","ns":"namespace占位","comId":"u_iiusd7","ignore": true}]`,
        fileName: '添加带ignore标记的步骤.json'
      })}
  
      注意:
        - 要充分考虑被添加的组件与其他组件之间的间距以及位置关系，确保添加的组件的美观度的同时、且不会与其他组件重叠或冲突；
        - 追加的组件默认在插槽内容的末尾，如果有位置要求，可以后续使用一个move操作来移动位置；
    </addChild>
  
    <move>
      - 移动组件，或者移动组件某个插槽下的所有组件
      - index为目标插槽的具体位置
      - 由于被添加的组件永远在最后一位，如果有位置要求，可以添加一个move操作来移动位置

      - params的格式以Typescript的形式说明如下：
      \`\`\`typescript
      type moveToComParams = {
        comId:string, // 移动到目标组件
        slotId:string, // 需要移动的目标插槽
        index:number, // 移动到的位置，index=0表示放到第一位，index=1表示放到第二位
      }
      \`\`\`

      例如，当用户要求将组件u_ou1rs移动到组件u_iek32的某个插槽中，并且放到第一位，可以返回以下内容：
      ${fileFormat({
        content: `["u_ou1rs",":root","move",{"comId":"u_iek32","slotId":"插槽id","index":0}]`,
        fileName: '移动组件步骤.json'
      })}
    </move>

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
    
    <组件的定位原则>
      组件的定位有三种方式：flex定位、absolute定位、fixed定位。

      **flex定位**
        - 组件会相对于所在的插槽进行定位；
        - 通过尺寸（width、height） + 外间距（margin）来进行定位；
        - flex布局下的组件不允许使用left、top、right、bottom等定位属性；

      **absolute定位**
        - 组件会相对于当前组件的插槽进行定位，且脱离文档流；
        - 通过尺寸（width、height） + 位置（left、top、right、bottom）来进行定位；
        - absolute定位的组件不允许使用margin；
      
        使用absolute定位的例子:
        ${fileFormat({
        content: `["目标组件id","插槽id占位","addChild",{"title":"添加一个绝对定位组件","comId":"u_fixed","ns":"组件","layout":{"position":"absolute","width":"100%","height":84,"top":12,"left":0},"configs":[]}]`,
        fileName: '添加一个absolute定位组件.json'
      })}
        
      **fixed定位**
        - 组件会相对于整个画布进行定位，且脱离文档流；
        - 通过尺寸（width、height） + 位置（left、top、right、bottom）来进行定位；
        - fixed定位的组件不允许使用margin；
      
        使用fixed定位的例子:
        ${fileFormat({
        content: `["目标组件id","插槽id占位","addChild",{"title":"添加一个固定定位组件","comId":"u_fixed","ns":"组件","layout":{"position":"fixed","width":"100%","height":84,"bottom":0,"left":0},"configs":[]}]`,
        fileName: '添加一个fixed定位组件.json'
      })}

      在插槽的不同布局下，组件的定位由所在插槽的布局方式决定：
        - 在当前组件的插槽中，可以添加fixed定位的组件，禁止在其他插槽中添加fixed定位的组件；
        - 如果插槽是flex布局，则子组件只能使用flex定位 或者 absolute定位；
        - 如果插槽是relative布局，则子组件只能使用absolute定位；
    </组件的定位原则>
   
    <布局原则>
      插槽的布局(display=flex)指的是对于内部组件（仅对其直接子组件，对于子组件插槽中的子组件无影响)的布局约束:
      
      **flex布局**
      （基本等同于CSS3规范中的flex布局）插槽中的所有子组件通过宽高和margin进行布局。

      <辅助标记使用>
        在mybricks中，组件最终会绘制到搭建画布上，确定所有组件的尺寸和位置，可以将多余的嵌套布局组件优化掉，所以需要通过辅助标记ignore来忽略多余的嵌套布局。
        配置流程如下：
        当布局组件的父组件也为布局组件时，观察当前组件是否配置样式（边框、背景、内间距等），是否可能需要支持事件（点击），父组件是否也是布局组件？
        - 1. 如果布局组件不配置样式也不需要点击功能，可以添加ignore标记，表示该布局组件仅承担布局功能，可以被优化掉；
        - 2. 如果布局组件配置了样式或者有可能需要点击功能，不能添加ignore标记，表示该布局组件承担样式功能，不能被优化掉；
          - 2.1 如何判断有没有可能需要支持事件？
            - 2.1.1 如果当前布局为图标+文本等常见的导航入口，猜测该布局组件后续需要支持点击功能，不能添加ignore标记；
        - 3. 如果布局组件的父组件不是布局组件，或者是根组件，不能添加ignore标记，不能被优化掉；

        例子：第一个布局组件仅承担布局功能，可以添加ignore标记；第二个布局组件承担样式功能，不能添加ignore标记。
        ${fileFormat({
        content: `["目标组件id","插槽id占位","addChild",{"title":"添加一个布局组件","comId":"u_layout","ignore":true,"ns":"组件","layout":{"width":"100%","height":120},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
        ["目标组件id","插槽id占位","addChild",{"title":"添加一个布局组件","comId":"u_layout","ns":"组件","layout":{"width":"100%","height":120},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}},{"path":"样式/样式","style":{"background":"#FFFFFF"}}]}]
        `,
        fileName: '辅助标记.json'
      })}
 
      </辅助标记使用>
  
      <布局使用示例>
        **flex布局**
          子组件通过嵌套来搭建，无需考虑子组件的宽度和高度。

          下面的例子使用flex实现左侧固定宽度，右侧自适应布局:
          ${fileFormat({
        content: `["目标组件id","插槽id占位","addChild",{"title":"添加一个布局组件","comId":"u_flex1","ns":"布局组件","layout":{"width":"100%","height":60},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
          ["u_flex1","插槽id占位","addChild",{"title":"左侧固定宽度组件","comId":"u_leftFixed","ns":"组件","layout":{"width":60,"height":40,"marginRight":8},"configs":[]}]
          ["u_flex1","插槽id占位","addChild",{"title":"右侧自适应组件","comId":"u_rightFlex","ns":"组件","layout":{"width":'100%',"height":40},"configs":[]}]
          `,
        fileName: '左侧固定右侧自适应.json'
      })}
          在上例中:
            - 声明布局编辑器的值，注意布局编辑器必须声明，其中flexDirection也必须声明，关注justifyContent效果，默认为flex-start；
            - 左侧组件使用固定宽度，右侧组件使用width=100%(效果等同于flex=1)实现自适应宽度；
            - 通过marginRight配置左侧组件与右侧组件的间距；
          
          
          下面的例子使用flex进行嵌套，来实现左侧图标+文本，右侧箭头的布局:
          ${fileFormat({
        content: `["目标组件id","插槽id占位","addChild",{"title":"添加一个布局组件","comId":"u_flex1","ns":"布局组件","layout":{"width":"100%","height":60},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
          ["u_flex1","插槽id占位","addChild",{"title":"左侧布局组件","comId":"u_leftLayout","ignore": true,"ns":"布局组件","layout":{"width":"fit-content","height":"fit-content"},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center", "justifyContent": "flex-start"}}]}]
          ["u_leftLayout","插槽id占位","addChild",{"title":"图标组件","comId":"u_icon","ns":"图标组件","layout":{"width":24,"height":24,"marginRight":8},"configs":[]}]
          ["u_leftLayout","插槽id占位","addChild",{"title":"文本组件","comId":"u_text","ns":"文本组件","layout":{"width":"fit-content","height":"fit-content"},"configs":[]}]
          ["u_flex1","插槽id占位","addChild",{"title":"箭头图标组件","comId":"u_arrowIcon","ns":"图标组件","layout":{"width":24,"height":24},"configs":[]}]
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
          
          **自由定位布局**
          子组件通过自由定位来布局，无需考虑其他组件的布局影响。
          下面的例子使用absolute实现自由定位布局:
          ${fileFormat({
        content: `["目标组件id","插槽id占位","addChild",{"title":"添加一个布局组件","comId":"u_absoluteLayout","ns":"布局组件","layout":{"width":"100%","height":300},"configs":[{"path":"常规/布局","value":{"position":"relative"}}]}]
          ["u_absoluteLayout","插槽id占位","addChild",{"title":"绝对定位组件A","comId":"u_absA","ns":"组件","layout":{"position":"absolute","width":100,"height":40,"top":20,"left":20},"configs":[]}]
          ["u_absoluteLayout","插槽id占位","addChild",{"title":"绝对定位组件B","comId":"u_absB","ns":"组件","layout":{"position":"absolute","width":80,"height":80,"top":100,"left":150},"configs":[]}]
          `,
        fileName: 'absolute自由定位布局.json'
      })}
          在上例中:
            - 宽高不可以配置fit-content，防止内容塌陷；
            - 声明布局编辑器的值，注意布局编辑器必须声明，其中position声明成relative；
            - 通过layout中的属性，设置成绝对定位效果，实现自由定位布局；
      </布局使用示例>

      <布局的选用：重要>
        由于是修改组件，优先参考*原有组件的布局*进行搭建，除非用户有明确要求，否则不建议更改布局方式。
        - 如果当前组件使用的是flex布局，优先使用flex布局进行搭建；
        - 如果当前组件使用的是absolute布局，优先使用absolute布局进行搭建；
      </布局的选用：重要>

      <布局注意事项>
        - 布局相关组件在添加时必须配置布局编辑器的值，尤其需要配置flexDirection和justifyContent；
          - 对于flexDirection，必须配置，仅允许配置row或column；
        - 优先考虑fit-content，如果要使用固定宽高，必须考虑到固定宽高会不会溢出导出布局错乱的问题；
      <布局注意事项>
      
    </布局原则>
    
    <最佳实践>
      1. 对每一个组件，都仔细考虑是否要使用<辅助标记 />，按照<辅助标记使用 />来配置标记；
      2. 对于文本、图片、图标、按钮等基础组件，任何情况下都可以优先使用，即使不在允许使用的组件里；
      3. 对于图标，图标禁止使用emoji或者特殊符号，必须使用图标组件来搭建；
      4. 关于图片
        4.1 如果是常规图片，使用https://ai.mybricks.world/image-search?term=dog&w=100&h=200，其中term代表搜索词，w和h可以配置图片宽高；
        4.2 如果是Logo，可以使用https://placehold.co来配置一个带文本和颜色的图标，其中text需要为图标的英文搜索词，禁止使用emoji或者特殊符号；
      5. 对于文本，尺寸的计算
        - 宽度和高度要根据fontSize等样式来计算，预留更多的空间；
        - 尽量配置文本省略参数，防止一行换行后变多行带来的布局变化；
        - 文本最小大小可以配置到fontSize=10，在一些文字内容特别多的场景可以配置小文字；
      8. 子组件计算尺寸（宽度与高度）的时候，需要向上考虑父元素（插槽、父组件或祖先插槽及组件）所有的尺寸与间距等样式，否则容易计算错误；
      9. 对于横向排列或者竖向排列的多个相似元素，考虑如下情况:
        - 如果猜测是动态项，使用列表类组件来搭建；
        - 如果猜测是静态内容，优先使用布局，N行M列来搭建；
        - 如果是属于某个组件的内容，使用组件来搭建；
    </最佳实践>
  </UI搭建原则>
</如何修改>

${config.appendPrompt ? `<对于项目环境的说明>
${config.appendPrompt}
</对于项目环境的说明>` : ''}

<examples>
  <example>
    <user_query>文本组件替换成图片</user_query>
    <assistant_response>
      好的，我将当前组件的文本组件替换成图片组件，需要先删除文本组件，然后添加图片组件，由于插槽中还有其他内容，添加时需要指定index。
      ${fileFormat({
        content: `["u_24uiu",":root","delete"]
["u_parent","slotId","addChild",{"title":"添加一个图片组件","comId":"u_image1","index":0,"ns":"图片组件","layout":{"width":100,"height":100}}]`,
        fileName: '将文本组件替换成图片.json'
      })}
    </assistant_response>
  </example>

  <example>
    <user_query>宽度改成适应内容</user_query>
    <assistant_response>
      好的，我将当前组件的宽度做适应内容的调整

      ${fileFormat({
        content: `["u_908", ":root", "setLayout", {"width":"fit-content"}]`,
        fileName: '修改宽度.json'
      })}
    </assistant_response>
  </example>
  
  <example>
    <user_query>改成蓝色风格</user_query>
    <assistant_response>
      好的，我将当前组件的配色以及子组件统一修改为蓝色风格

      ${fileFormat({
        content: `["u_222", ":root", "doConfig", {"path":"样式/背景色","style":{"background": "blue"}}]
["u_child2", ":root", "doConfig", {"path":"样式/背景色","style":{"background": "blue"}}]`,
        fileName: '修改颜色.json'
      })}
    </assistant_response>
  </example>

  <example>
    <user_query>查看我的效果图，重构这个区域</user_query>
    <assistant_response>
      根据图片效果，主要执行以下修改：
      1. 容器原来是均分布局，为了实现效果图中的效果，需要修改为左右布局，左侧为图标+文本，右侧为箭头；
      2. 删除容器中原有的按钮，替换成图标+文本，替换可以使用指定位置来完成，先添加左侧容器，再添加图标和文本；
      3. 中间有一个封条装饰，flex布局下不好实现，用绝对定位实现；
      
      ${fileFormat({
        content: `["u_24uiu", ":root", "doConfig", {"path":"样式/布局","style":{"display": "flex", "flexDirection": "row", "justifyContent": "space-between", "alignItems": "center"}}]
["u_iobtn", ":root", "delete"]
["u_24uiu", "slotId", "addChild", {"title":"左侧容器","comId":"u_sdflx","index":0,"ns":"布局组件","layout":{"width":"fit-content","height":60, "marginLeft": 12},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row"}}]}]
["u_sdflex", "addChild", {"title":"图标组件","comId":"u_icon","ns":"图标组件","layout":{"width":24,"height":24,"marginLeft":8},"configs":[]}]
["u_sdflex", "addChild", {"title":"文本组件","comId":"u_text","ns":"文本组件","layout":{"width":"fit-content","height":"fit-content", "marginLeft": 8},"configs":[]}]
["u_sdflex", "addChild", {"title":"箭头图标组件","comId":"u_rso0c","ns":"图标组件","layout":{"width":24,"height":24},"configs":[]}]
["u_24uiu", "slotId", "addChild", {"title":"添加一个绝对定位组件","comId":"u_abs1","ns":"布局组件","layout":{"position": "absolute", "width": 100, "height": 30, "bottom": 0, "left": 360},"configs":[]}]
`,
        fileName: '重构区域.json'
      })}
    </assistant_response>
  </example>

  <example>
    <user_query>优化下这个排版</user_query>
    <assistant_response>
      好的，我们分析下目前的搭建内容，排版上来看，当前原有组件的是绝对定位处理的，可以看出来有几个问题：
      1. 元素之间没有对齐，显得比较杂乱；
      2. 作为头像来说，图片大小不合适，改成宽高一致并左边垂直居中；
      3. 元素之间位置有问题，看起来有几处重叠。

      我们优先使用当前布局，然后通过调整各个组件的位置和尺寸信息完成需求。

      我们调整下看看效果
      ${fileFormat({
        content: `["u_text1", ":root", "setLayout", {"position": "absolute", "width": 200, "height": 40, "top": 20, "left": 20}]
["u_image1", ":root", "setLayout", {"position": "absolute", "width": 100, "height": 100, "top": 80, "left": 20}]
["u_button1", ":root", "setLayout", {"position": "absolute", "width": 80, "height": 40, "top": 200, "left": 20}]`,
        fileName: '优化排版.json'
      })}

      注意：父组件有内间距，插槽才是实际可布局区域，根据插槽宽度来计算居中。
    </assistant_response>
  </example>
</examples>`
    },
    aiRole: config.getFocusElementAiRole?.() || (hasChildren ? 'expert' : 'architect'),
    stream({ files, status, replaceContent }) {
      let actions: any = [];
      const actionsFile = getFiles(files, { extName: 'json' })

      if (actionsFile) {
        actions = streamActionsParser(actionsFile.content ?? "");
        actions = fixActions(actions, {
          pageId
        })
        if (!fileNameToContent[actionsFile!.fileName]) {
          fileNameToContent[actionsFile!.fileName] = "";
        }

        if (actions?.[0]?.comId && !firstActionId) {
          firstActionId = actions?.[0]?.comId;
          
          if (firstActionId !== "_root_" && firstActionId !== pageId) {
            actionType = 'uiCom'
          }

          promiseStack.add(() => config.onActions([], 'start', actionType))
        }
      }

      if (actions.length > 0 || status === 'complete') {
        const currentStatus = status === 'complete' ? "ing" : status;
        try {
          const copiedActions = JSON.parse(JSON.stringify(actions));
          try {
            actions.forEach((action: any) => {
              if (action.type === "addChild") {
                const childComId = action.params.comId;
                // 对于 addChild，每次添加都生成新的 UUID 映射
                action.params.comId = comIdTransform.addComId(childComId);

                // 目标组件ID需要映射
                const parentComId = action.comId;
                if (parentComId !== "_root_") {
                  // 父组件 id 使用最近一次的映射
                  action.comId = comIdTransform.getComId(parentComId);
                }
              } else if (action.type === "move") {
                const comId = action.comId;
                if (comId !== "_root_") {
                  // 获取组件时，使用最近添加的comId
                  action.comId = comIdTransform.getComId(comId);
                }

                // 目标组件ID需要映射
                const toParams = action.params?.to ?? {};
                const targetId = toParams.comId;
                if (targetId && targetId !== "_root_") {
                  action.params.to.comId = comIdTransform.getComId(targetId);
                }
              } else if (action.type === "doConfig") {
                const comId = action.comId;
                if (comId !== "_root_") {
                  // 获取组件时，使用最近添加的comId
                  action.comId = comIdTransform.getComId(comId);
                }
              }
            })
            actions.forEach((action: any) => {
              promiseStack.add(() => config.onActions([action], currentStatus, actionType))
            })
          } catch (error) {
            console.error('refactor-component onActions error', error);
          }
          const actionsContent = getComponentOperationSummary(copiedActions, config.componentIdToTitleMap)

          if (actionsFile) {
            if (!fileNameToContent[actionsFile!.fileName]) {
              fileNameToContent[actionsFile!.fileName] = actionsContent.trim();
            } else {
              fileNameToContent[actionsFile!.fileName] += `\n${actionsContent.trim()}`;
            }
          }
        } catch (error) {}

        if (status === "complete") {
          promiseStack.add(() => config.onActions([], status, actionType))
        }
      }

      return displayContent = Object.entries(fileNameToContent).reduce((pre, [fileName, content]) => {
        return pre.replace(fileName, content);
      }, replaceContent)
    },
    execute({ files, content }) {
      let errorContent;
      try {
        errorContent = JSON.parse(content)
      } catch (error) { }
      if (errorContent && errorContent?.message) {
        throw new RxaiError(`网络错误，${errorContent?.message}`, "request")
      }

      let actions: any = [];
      const actionsFile = getFiles(files, { extName: 'json' })

      if (!actionsFile) {
        return {
          llmContent: content,
          displayContent: content
        }
      }

      return {
        llmContent: displayContent,
        displayContent: displayContent
      }

      // actions = excuteActionsParser(actionsFile.content ?? "");

      // // console.log('actions', actions)

      // // const actionsGroupById = actions.reduce((acc, item) => {
      // //   const id = item.comId;
      // //   if (!acc[id]) {
      // //     acc[id] = [];
      // //   }
      // //   acc[id].push(item);
      // //   return acc;
      // // }, {});

      // try {
      //   const llmContent = stripFileBlocks(content);
      //   const actionsContent = actions?.length ? getComponentOperationSummary(actions, OutlineInfo.getComponentIdToTitleMap(config?.getPageJson(), pageId)) : ""
      //   const summary = (llmContent ? `${llmContent}\n\n` : "") + (actionsContent ? `修改内容如下\n${actionsContent}` : "当前没有内容修改");

      //   return {
      //     llmContent: summary,
      //     displayContent: summary
      //   }

      //   //       const summary = getComponentOperationSummary(actions, OutlineInfo.getComponentIdToTitleMap(config?.getPageJson(), pageId))

      //   //       return {
      //   //         llmContent: `根据需求，我们进行如下修改
      //   // ${summary}`,
      //   //         displayContent: `根据需求，我们进行如下修改
      //   // ${summary}`
      //   //       }
      // } catch (error) {

      // }

      // return {
      //   llmContent: '已执行所有修改操作',
      //   displayContent: '已执行所有修改操作'
      // }
    },
  }
}

function fixActions(actions: any[], {
  pageId
}: {
  pageId?: string
}) {
  return (actions ?? []).map(action => {
    if (action.comId === pageId) {
      action.comId = '_root_'
    }
    return action;
  })
}

export interface RefactorUiContentConfigParams {
  fewShots: string;
}

export function RefactorUiContent(params?: RefactorUiContentConfigParams) {
  return {
    name: NAME,
    params: params,
  }
}