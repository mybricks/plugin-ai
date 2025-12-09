import { fileFormat } from '@mybricks/rxai'
import { getFiles, createActionsParser, getComponentOperationSummary, getComponentIdToTitleMap, stripFileBlocks } from './utils'

interface GeneratePageToolParams {
  /** 当前根组件信息 */
  getFocusRootComponentDoc: () => string;
  getTargetId: () => string;
  getPageJson: () => any
  /** 应用特殊上下文信息 */
  appendPrompt: string;
  /** 返回示例 */
  examples: string;
  /** 当所有actions返回时 */
  onActions: (actions: any[], status: string) => void
  /** 清空当前画布信息 */
  onClearPage: () => void
}

export default function generatePage(config: GeneratePageToolParams): any {
  const streamActionsParser = createActionsParser();
  const excuteActionsParser = createActionsParser();

  const pageJson = config?.getPageJson();
  const hasRootCom = pageJson?.asRoot;
  const rootId = hasRootCom ? pageJson.id : undefined;


  return {
    name: "clear-and-generate-page",
    displayName: "生成页面",
    description: `根据需求/附件图片，一次性搭建并生成符合需求的 MyBricks 页面。
参数：无
工具分类：操作执行类；
作用：生成一个完整的页面；
要求：需要聚焦到一个页面上，且保证页面为空内容（除了页面和页面容器之外没有内容则为空内容）；
前置依赖：必须确保前一个工具执行过「需求整理和组件选型」，用于获取组件文档，否则无法生成；
`,
    aiRole: "expert",
    getPrompts(params) {
      return `<工具总览>
  你是一个生成 MyBricks 页面的工具，你作为MyBricks的资深页面搭建助手及客服专家，经验丰富、实事求是、逻辑严谨。
  你的任务是通过 actions 从0到1生成符合用户需求的页面。
</工具总览>

<特别注意>
  注意：
   - 对话可能由多轮构成，每轮对话中，用户会提出不同的问题或给与信息补充，你需要根据用户的问题、逐步分析处理。
   - 在多轮对话中，消息数组的可能结构如下：
      位置0：system消息，包含了当前对话的上下文信息；
      位置1：用户消息，如果以【知识库】开头，表示用户提供了使用与组件相关的内容知识（知识库为空也是符合预期的），这里的内容将作为后续搭建的重要参考；

      其他为最近的消息记录，可能包含了用户的问题、需求、附件图片，以及你的回复内容；
   
  注意：
   - 你所面向的用户是MyBricks平台上的用户，这些用户不是专业的开发人员，因此你需要以简洁、易懂的方式，回答用户的问题。
  
  注意：
   - 如果附件中有图片，需要在搭建过程中作为重要的参考，要注意分辨设计稿（或者截图）或者用户绘制的线框图，对于前者、要求最大程度还原图片中的各项功能要素与视觉设计要素、可以做适度的创作发挥，总体要求考虑到功能一致完整与合理性、注意外观视觉美观大方、富有现代感.
</特别注意>

<当前根组件信息>
${config.getFocusRootComponentDoc()}

IMPORTANT: 生成页面的根组件ID必须使用此文档信息。
</当前根组件信息>

<如何搭建以及修改>
  实际上，在手动搭建过程中，通过一系列的action来分步骤完成对于面向组件或其中插槽的添加及修改，下面的actions文件即通过模拟用户行为的方式来完成页面的搭建或修改。
  当需要完成页面搭建或修改时，你需要按照如下格式返回actions操作步骤文件：
  
  ${fileFormat({
    content: `[comId, target, type, params]`,
    fileName: '操作步骤.json'
  })}

  <关于actions>
    actions.json文件由多个action构成,每个 action 在结构上都严格遵循以下格式：[comId, target, type, params];
    - comId 代表要操作的目标组件的id(对于需要生成的新的id，必须采用u_xxxxx，xxxxx是3-7位唯一的字母数字组合);
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
       * 100% - 填充
       * 只能是三者其一，明确不允许使用其他属性，比如calc等方法
       */
      type Size = number | "fit-content" | "100%"
    
      /** flex中子组件定位，可配置如下layout */
      type setLayout_flex_params = {
        /** 宽 */
        width: Size;
        /** 高 */
        height: Size;
        /** 上外边距 */
        marginTop?: number;
        /** 右外边距 */
        marginRight?: number;
        /** 下外边距 */
        marginBottom?: number;
        /** 左外边距 */
        marginLeft?: number;
      }
  
      注意：
      - 1. 只有在flex布局中的组件，可以在layout中使用margin相关配置；
  
      /** 如果组件本身是fixed类型定位，可配置如下layout */
      type setLayout_fixed_params = {
        position: 'fixed';
        /** 宽 */
        width: Size;
        /** 高 */
        height: Size;
        /** 距离左侧 */
        left?: number;
        /** 距离右侧 */
        right?: number;
        /** 距离上方 */
        top?: number;
        /** 距离下方 */
        bottom?: number;
      }
      
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
      - addChild代表向目标组件的插槽中添加内容，需要满足两个条件:
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
        // 辅助标记
        ignore: boolean //可选，是否添加ignore标记
      }
      \`\`\`
      
      例如：
      ${fileFormat({
        content: `["u_ou1rs","content","addChild",{"title":"添加的文本组件","ns":"namespace占位","comId":"u_iiusd7"}]`,
        fileName: '添加文本组件步骤.json'
      })}

      ${fileFormat({
        content: `["u_ou1rs","content","addChild",{"title":"背景图","ns":"namespace占位","comId":"u_iiusd7","layout":{"width":"100%","height":200,"marginTop":8,"marginLeft":12,"marginRight":12},"configs":[{"path":"常规/图片地址","value":"https://ai.mybricks.world/image-search?term=风景"},{"path":"样式/图片","style":{"borderRadius":"8px"}}]}]`,
        fileName: '添加带配置属性的步骤.json'
      })}
  
      ${fileFormat({
        content: `["u_ou1rs","content","addChild",{"title":"添加的布局组件","ns":"namespace占位","comId":"u_iiusd7","ignore": true}]`,
        fileName: '添加带ignore标记的步骤.json'
      })}
  
      注意:
        - 要充分考虑被添加的组件与其他组件之间的间距以及位置关系，确保添加的组件的美观度的同时、且不会与其他组件重叠或冲突；
    </addChild>

    <delete>
      - 删除组件

      例如，当用户要求删除组件u_ou1rs，可以返回以下内容：
      ${fileFormat({
        content: `["u_ou1rs",":root","delete"]`,
        fileName: '删除组件.json'
      })}
    </delete>
  
    注意：actions文件每一行遵循 JSON 语法，禁止非法代码，禁止出现内容省略提示、单行注释、省略字符。
      - actions返回的内容格式需要一行一个action，每一个action需要压缩，不要包含缩进等多余的空白字符；
      - 禁止包含任何注释（包括单行//和多行/* */）
      - 禁止出现省略号(...)或任何占位符
      - 确保所有代码都是完整可执行的，不包含示例片段
      - 禁止使用{}、{{}}这类变量绑定语法，并不支持此语法
      - 禁止使用非法字符或特殊符号
      - 所有内容均为静态数据，禁止解构，禁止使用变量
    
    其中，target选择器的组成可以是组件id + 选择器的形式，例如：
      - :root - 组件整体；
      - :btn - 组件的按钮部分；
      - #u_iiusd7 :root - 组件id为u_iiusd7的组件整体；
      - #u_iiusd7 :btn - 组件id为u_iiusd7的按钮部分；
    组件id可以从上下文中获取。
   
    注意：
      - 返回actions文件内容时，务必注意操作步骤的先后顺序；
        - 有些操作需要在前面操作完成后才能进行；
        - 有些操作需要在其他操作开启（布尔类型的配置项）后才能进行；
      - 禁止重复使用相同的action；
  </关于actions>

  <UI搭建原则>
    界面只有两类基本要素:组件、以及组件的插槽，组件的插槽可以嵌套其他组件。
    
    <组件的定位原则>
      组件的定位有三种方式：flex定位、fixed定位。

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
          content: `["_root_","_rootSlot_","addChild",{"title":"添加一个固定定位组件","comId":"u_fixed","ns":"组件","layout":{"position":"fixed","width":"100%","height":84,"bottom":0,"left":0},"configs":[]}]`,
          fileName: '添加一个fixed定位组件.json'
        })}

      在插槽的不同布局下，组件的定位由所在插槽的布局方式决定：
        - 在当前组件的插槽中，可以添加fixed定位的组件，禁止在其他插槽中添加fixed定位的组件；
        - 如果插槽是flex布局，则子组件只能使用flex定位；
        - 如果插槽是absolute布局，则子组件只能使用absolute定位；
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

          下面的例子使用flex进行横向均分或等分布局，实现一行N列的效果:
          ${fileFormat({
            content: `["目标组件id","插槽id占位","addChild",{"title":"添加一个布局组件","comId":"u_flex0","ignore": true,"ns":"布局组件","layout":{"width":"100%","height":120},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","justifyContent":"space-between","alignItems":"center"}}]}]
          ["u_flex0","插槽id占位","addChild",{"title":"A组件","comId":"u_a","ns":"组件","layout":{"width":40,"height":40},"configs":[]}]
          ["u_flex0","插槽id占位","addChild",{"title":"B组件","comId":"u_b","ns":"组件","layout":{"width":40,"height":40},"configs":[]}]
          ["u_flex0","插槽id占位","addChild",{"title":"C组件","comId":"u_c","ns":"组件","layout":{"width":40,"height":40},"configs":[]}]
          `,
            fileName: '一行N列布局.json'
          })}
          在上例中:
            - 声明布局编辑器的值，注意布局编辑器必须声明，其中flexDirection也必须声明；
            - 针对内容元素的尺寸，配置合理的高度，防止内容溢出；
            - 为了实现均分，请对子元素配置宽度和高度的固定值，保证卡片之间存在间距，避免大小不一导致的非均分效果；
            - 判断仅布局，添加ignore标记，优化搭建内容。

          特殊地，在flex布局中的元素还可以配置position=absolute，用于实现绝对定位效果:
          ${fileFormat({
            content: `["目标组件id","插槽id占位","addChild",{"title":"添加一个布局组件","comId":"u_flex3","ns":"布局组件","layout":{"width":"100%","height":200},"configs":[{"path":"常规/布局","value":{"display":"flex","flexDirection":"row","alignItems":"center"}}]}]
          ["u_flex3","插槽id占位","addChild",{"title":"绝对定位组件","comId":"u_absolute","ns":"组件","layout":{"position":"absolute","width":100,"height":40,"top":20,"left":20},"configs":[]}]
          ["u_flex3","插槽id占位","addChild",{"title":"普通组件","comId":"u_normal","ns":"组件","layout":{"width":80,"height":80},"configs":[]}]
          `,
            fileName: '绝对定位效果.json'
          })}
          在上例中:
            - 声明布局编辑器的值，注意布局编辑器必须声明，其中flexDirection也必须声明；
            - 通过layout中的属性，设置成绝对定位效果，在一些特殊的角标等场景下很有效果；
            
      </布局使用示例>

      <布局注意事项>
        - 布局相关组件在添加时必须配置布局编辑器的值，同时注意flexDirection和justifyContent的配置；
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
      6. 注意参考图片/设计稿里元素是否互相遮挡，避免出现遮挡（注意忽略角标）；
      7. 配置位置信息时，始终考虑父元素（插槽、父组件或祖先插槽及组件）的高度与宽度信息，防止出现遮挡或重叠；
      8. 子组件计算尺寸（宽度与高度）的时候，需要向上考虑父元素（插槽、父组件或祖先插槽及组件）所有的尺寸与间距等样式，否则容易计算错误；
      9. 对于横向排列或者竖向排列的多个相似元素，考虑如下情况:
        - 如果猜测是动态项，使用列表类组件来搭建；
        - 如果猜测是静态内容，优先使用布局，N行M列来搭建；
        - 如果是属于某个组件的内容，使用组件来搭建；
    </最佳实践>
  </UI搭建原则>
</如何搭建以及修改>

${config.appendPrompt}

<生成页面思路>
按照以下步骤完成：
  1、总体分析，按照以下步骤进行：
    1）确定总体的功能；
    2）保持总体UI设计简洁大方、符合现代审美、布局紧凑;
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
    - 布局(layout):组件的宽高与外间距信息，只能声明width、height、margin，不允许使用padding、position等属性；
    - 样式(styleAry):根据组件声明的css给出合理的设计实现；
    - 数据(data):根据【知识库】中该组件的data声明进行实现，尤其要注意：
      - 使用图片：如果data中需要给出新的图片，否则一律使用https://ai.mybricks.world/image-search?term={关键词}&w={图片宽度}&h={图片高度}做代替，不允许使用base64或者其他的；

  4、最后，返回页面更新后的actions操作步骤文件内容，注意：
    - 每一个action符合JSON规范，每一行为一个action
    - 禁止包含任何注释（包括单行//和多行/* */）
    - 禁止出现省略号(...)或任何占位符
    - 确保所有代码都是完整可执行的，不包含示例片段
    - 禁止使用非法字符或特殊符号
    - 所有内容均为静态数据，禁止解构，禁止使用变量
</生成页面思路>

<生成页面限制>
生成页面必须从根组件_root_开始配置，以及从插槽_rootSlot_开始添加组件。
</生成页面限制>

<examples>

${config.examples}
  
</examples>`
    },
    stream({ files, status }) {
      let actions: any = [];
      const actionsFile = getFiles(files, {extName: 'json' })

      if (actionsFile) {
        actions = streamActionsParser(actionsFile.content ?? "");
      }

      actions = fixActions(actions, rootId)

      if (status === 'start') {
        config.onClearPage()
      }
      
      if (actions.length > 0 || status === 'start' || status === 'complete') {
        config.onActions(actions, status)
      }
    },
    execute({ files, content }) {
      let actions: any = [];
      const actionsFile = getFiles(files, {extName: 'json' })

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

      actions = fixActions(actions, rootId)

      try {
        const llmContent = stripFileBlocks(content);
        const actionsContent = actions?.length ? getComponentOperationSummary(actions, getComponentIdToTitleMap(config?.getPageJson())) : ""
        const summary = (llmContent ? `${llmContent}\n\n` : "") + (actionsContent ? `修改内容如下\n${actionsContent}` : "当前没有内容修改");

        return {
          llmContent: summary,
          displayContent: summary
        }
  //       const summary = getComponentOperationSummary(actions, getComponentIdToTitleMap(config?.getPageJson()))

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

function fixActions(actions: any[], rootId?: string) {
  if (!rootId) return actions;
  return (actions ?? []).map(action => {
    if (action.comId === rootId && action.type === 'addChild' && action.target === '_rootSlot_') {
      action.comId = '_root_'
    }
    return action;
  })
}