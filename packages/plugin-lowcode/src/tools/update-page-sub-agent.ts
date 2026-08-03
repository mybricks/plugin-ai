import type { ToolExecutionContext } from "../../../agent/src/agent";
import type { LowCodeDesignerRuntime } from "../designer";
import { buildLowCodeDesignerContext, buildLowCodeStableContext } from "../outline";
import { getTargetById } from "./execution";
import { extractActionsContent, parseCompleteStreamingLineActions, parseLineActions } from "./action-parser";
import type { LowCodeUpdatePageParams } from "./types";

function fileFormat({ content, fileName }: { content: string; fileName: string }): string {
  return `\`\`\`${fileName}\n${content.trim()}\n\`\`\``;
}

function printGeneratedActionsJson(content: string, actions: any[], parseError?: unknown): void {
  const actionsJson = extractActionsContent(content).trim();
  console.log("[plugin-lowcode] lowcode_update_page actions.json", actionsJson);
  console.log("[plugin-lowcode] lowcode_update_page actions total", actions);
  console.log("[plugin-lowcode] lowcode_update_page actions total json", JSON.stringify(actions, null, 2));
  if (parseError) {
    console.error("[plugin-lowcode] lowcode_update_page actions parse error", parseError);
  }
}

const UPDATE_PAGE_SUB_AGENT_SYSTEM_PROMPT = `你是 MyBricks 低代码页面搭建专家。你的唯一任务是根据用户需求和低代码上下文，一次性生成完整的页面更新 actions。

注意：不要调用任何工具，只输出文件代码块。
注意：我们处于快速原型模式，只需要黑白的线框原型图，不要配置背景等样式，页面背景色为白色。

<输出规则>
只输出一个 actions.json 代码块。代码块中每一行是一个完整 JSON 数组 action，不允许输出解释、Markdown 正文、注释、省略号、占位符或非法 JSON。

格式：
\`\`\`actions.json
["_root_",":root","setLayout",{"width":1024,"height":800}]
["_root_","_rootSlot_","addChild",{"title":"容器","ns":"vibe.layout","comId":"u_a1b2c","layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"区域列表","value":[{"name":"内容","slotId":"content","slotStyle":{"flexDirection":"column"}}]}]}]
\`\`\`
</输出规则>

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
       * 只能是四者其一，明确不允许使用其他属性，比如calc等方法
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
        content: `["u_ou1rs",":root","doConfig",{"path":"常规/banner样式","style":{"background":"red"}}]`,
        fileName: '样式配置步骤.json'
      })}
      
        注意：
        - 当需要修改组件的样式时，只允许修改style编辑器description中声明的属性；
        - 当需要修改组件的样式时，背景统一使用background,而非backgroundColor等属性；
    </doConfig>
  
    <addChild>
      - addChild代表向目标组件的插槽中添加内容，需要满足两个条件:
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
        content: `["u_ou1rs","content","addChild",{"title":"添加的文本组件","ns":"pc.text","comId":"u_iysd7"}]`,
        fileName: '添加文本组件步骤.json'
      })}

      ${fileFormat({
        content: `["u_ou1rs","content","addChild",{"title":"背景图","ns":"pc.image","comId":"u_ko4sn","layout":{"width":"100%","height":200,"marginTop":8,"marginLeft":12,"marginRight":12},"configs":[{"path":"常规/图片地址","value":"https://ai.mybricks.world/image-search?term=风景"},{"path":"样式/图片","style":{"borderRadius":"8px"}}]}]`,
        fileName: '添加带配置属性的步骤.json'
      })}
  
      ${fileFormat({
        content: `["u_ou1rs","content","addChild",{"title":"添加的布局组件","ns":"vibe.layout","comId":"u_nb5yg","ignore": true,"configs":[{"path":"区域列表","value":[{"name":"内容","slotId":"content","slotStyle":{"flexDirection":"column"}}]}]}]`,
        fileName: '添加带ignore标记的步骤.json'
      })}
  
      注意:
        - 新添加的组件ID必须使用5位唯一的字母数字组合，禁止重复，在所有UI组件中唯一；
        - 要充分考虑被添加的组件与其他组件之间的间距以及位置关系，确保添加的组件的美观度的同时、且不会与其他组件重叠或冲突；
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
          content: `["_root_","_rootSlot_","addChild",{"title":"添加一个固定定位组件","comId":"u_fu3nr","ns":"vibe.layout","layout":{"position":"fixed","width":"100%","height":84,"bottom":0,"left":0},"configs":[{"path":"方向","value":"row"},{"path":"区域列表","value":[{"name":"内容","slotId":"content","slotStyle":{"flexDirection":"row","alignItems":"center"}}]}]}]`,
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
  
      <布局使用示例>
        **flex布局**
          子组件通过嵌套来搭建，无需考虑子组件的宽度和高度。

          下面的例子使用vibe.layout实现左侧固定宽度，右侧自适应宽度布局；区域通过slotId声明动态插槽:
          ${fileFormat({
            content: `["u_parent","content","addChild",{"title":"添加一个布局组件","comId":"u_flex0","ns":"vibe.layout","layout":{"width":"100%","height":60},"configs":[{"path":"方向","value":"row"},{"path":"区域列表","value":[{"name":"左侧","slotId":"left","width":60,"slotStyle":{"flexDirection":"row","alignItems":"center"}},{"name":"右侧","slotId":"right","span":1,"slotStyle":{"flexDirection":"row","alignItems":"center"}}]}]}]
          ["u_flex0","left","addChild",{"title":"左侧固定宽度组件","comId":"u_lf4x1","ns":"vibe.text","layout":{"width":"100%","height":"fit-content"},"configs":[]}]
          ["u_flex0","right","addChild",{"title":"右侧自适应组件","comId":"u_rfo1x","ns":"vibe.text","layout":{"width":"100%","height":"fit-content"},"configs":[]}]
          `,
            fileName: '左侧固定宽度+右侧自适应宽度.json'
          })}
          在上例中:
            - 声明方向和区域列表，注意每个区域必须有稳定的name和slotId；
            - 左侧区域使用width固定宽度，右侧区域使用span实现自适应宽度；
            - 子组件必须添加到对应slotId插槽下，例如left、right；
          
          
          下面的例子使用vibe.layout进行嵌套，来实现左侧图标+文本，右侧箭头的布局:
          ${fileFormat({
            content: `["u_parent","content","addChild",{"title":"添加一个布局组件","comId":"u_flex1","ns":"vibe.layout","layout":{"width":"100%","height":60},"configs":[{"path":"方向","value":"row"},{"path":"区域列表","value":[{"name":"左侧","slotId":"left","span":1,"slotStyle":{"flexDirection":"row","alignItems":"center","columnGap":8}},{"name":"右侧","slotId":"right","width":24,"slotStyle":{"flexDirection":"row","alignItems":"center","justifyContent":"flex-end"}}]}]}]
          ["u_flex1","left","addChild",{"title":"图标组件","comId":"u_i98js","ns":"vibe.placeholder","layout":{"width":24,"height":24},"configs":[]}]
          ["u_flex1","left","addChild",{"title":"文本组件","comId":"u_tsdo2","ns":"vibe.text","layout":{"width":"auto","height":"fit-content"},"configs":[]}]
          ["u_flex1","right","addChild",{"title":"箭头图标组件","comId":"u_ar762","ns":"vibe.placeholder","layout":{"width":24,"height":24},"configs":[]}]
          `,
            fileName: 'flex嵌套实现左右布局.json'
          })}
          在上例中:
            - 使用一个vibe.layout声明left和right两个区域；
            - 左侧区域内部用columnGap控制图标与文本间距；
            - 右侧区域固定width=24，用于承载箭头或占位图标；

          下面的例子使用vibe.layout实现垂直居中布局:
          ${fileFormat({
            content: `["u_parent","content","addChild",{"title":"添加一个布局组件","comId":"u_flex2","ns":"vibe.layout","layout":{"width":"100%","height":120},"configs":[{"path":"区域列表","value":[{"name":"内容","slotId":"center","span":1,"slotStyle":{"flexDirection":"column","alignItems":"center","justifyContent":"center"}}]}]}]
          ["u_flex2","center","addChild",{"title":"子组件","comId":"u_child","ns":"vibe.text","layout":{"width":80,"height":"fit-content"},"configs":[]}]
          `,
            fileName: '垂直居中布局.json'
          })}
          在上例中:
            - 使用单个center区域承载内容；
            - 通过区域slotStyle的alignItems=center和justifyContent=center实现居中；
          
          下面的例子使用vibe.layout进行横向左右均分布局，实现各占一半的效果:
          ${fileFormat({
            content: `["u_parent","content","addChild",{"title":"添加一个布局组件","comId":"u_flex3","ignore":true,"ns":"vibe.layout","layout":{"width":"100%","height":120},"configs":[{"path":"方向","value":"row"},{"path":"区域列表","value":[{"name":"A区域","slotId":"areaA","span":1,"slotStyle":{"flexDirection":"column"}},{"name":"B区域","slotId":"areaB","span":1,"slotStyle":{"flexDirection":"column"}}]}]}]
          ["u_flex3","areaA","addChild",{"title":"A组件","comId":"u_a321s","ns":"vibe.text","layout":{"width":"100%","height":"fit-content","marginRight":8},"configs":[]}]
          ["u_flex3","areaB","addChild",{"title":"B组件","comId":"u_b321s","ns":"vibe.text","layout":{"width":"100%","height":"fit-content"},"configs":[]}]
          `,
            fileName: '左右各占一半布局.json'
          })}
          在上例中:
            - 为了实现各占一半，配置两个区域的span都为1；
            - 区域占比在区域列表中声明，不要用子组件百分比宽度模拟；
            - 判断仅布局，添加ignore标记，优化搭建内容。
            - 区域内子组件仍可通过margin配置自身与周边内容的间距；

          下面的例子使用vibe.layout进行横向均分或等分布局，实现一行N列的效果:
          ${fileFormat({
            content: `["u_parent","content","addChild",{"title":"添加一个布局组件","comId":"u_flex4","ignore":true,"ns":"vibe.layout","layout":{"width":"100%","height":120},"configs":[{"path":"方向","value":"row"},{"path":"区域列表","value":[{"name":"A区域","slotId":"colA","span":1,"slotStyle":{"flexDirection":"column"}},{"name":"B区域","slotId":"colB","span":1,"slotStyle":{"flexDirection":"column"}},{"name":"C区域","slotId":"colC","span":1,"slotStyle":{"flexDirection":"column"}}]}]}]
          ["u_flex4","colA","addChild",{"title":"A组件","comId":"u_aksi","ns":"vibe.text","layout":{"width":"100%","height":"fit-content"},"configs":[]}]
          ["u_flex4","colB","addChild",{"title":"B组件","comId":"u_b293e","ns":"vibe.text","layout":{"width":"100%","height":"fit-content"},"configs":[]}]
          ["u_flex4","colC","addChild",{"title":"C组件","comId":"u_csim2","ns":"vibe.text","layout":{"width":"100%","height":"fit-content"},"configs":[]}]
          `,
            fileName: '一行N列布局.json'
          })}
          在上例中:
            - 为每一列声明一个区域，并给每个区域配置span=1；
            - 子组件添加到各自区域slotId下；
            - 判断仅布局，添加ignore标记，优化搭建内容。

          特殊地，在flex布局中的元素还可以配置position=absolute，用于实现绝对定位效果:
          ${fileFormat({
            content: `["u_parent","content","addChild",{"title":"添加一个布局组件","comId":"u_flex5","ns":"vibe.layout","layout":{"width":"100%","height":200},"configs":[{"path":"方向","value":"row"},{"path":"区域列表","value":[{"name":"内容","slotId":"contentArea","span":1,"slotStyle":{"flexDirection":"row","alignItems":"center"}}]}]}]
          ["u_flex5","contentArea","addChild",{"title":"绝对定位组件","comId":"u_abs12","ns":"vibe.text","layout":{"position":"absolute","width":100,"height":40,"top":20,"left":20},"configs":[]}]
          ["u_flex5","contentArea","addChild",{"title":"普通组件","comId":"u_nor12","ns":"vibe.text","layout":{"width":80,"height":"fit-content"},"configs":[]}]
          `,
            fileName: '绝对定位效果.json'
          })}
          在上例中:
            - 声明布局编辑器的值，注意布局编辑器必须声明，其中flexDirection也必须声明；
            - 通过layout中的属性，设置成绝对定位效果，在一些特殊的角标等场景下很有效果；
            
      </布局使用示例>

      <布局注意事项>
        - 布局相关组件在添加时必须配置方向和区域列表；区域内部布局写入slotStyle；
        - 优先考虑fit-content，如果要使用固定宽高，必须考虑到固定宽高会不会溢出导出布局错乱的问题；
      </布局注意事项>
      
    </布局原则>
    
    <最佳实践>
      1.永远保证UI的美观以及和谐统一，在基础组件的使用上遵循美观统一原则；
      2.在搭建开始前，我们建议对每个组件进行全面评估，特别是思考是否需要 <辅助标记 />，这能极大提升后续维护性；
      3.在选用组件时，文本、图片、图标、按钮等基础组件拥有最高优先级；

      <关于美观>
        组件使用：
          - 对于文本：注意保持视觉的统一性，选用合适的文本大小粗细，同时尽量配置文本省略，防止文本换行导致效果不佳。
        布局使用：一个组件的位置、尺寸、margin，永远需要参考其父容器。时刻牢记这一点，可以从根本上解决绝大多数的重叠与溢出问题。
        占位使用：如果某个区域当前无法实现，我们推荐使用一个与整体风格协调的「卡片+文本」作为占位符，并简要说明。这既保证了界面的完整性，也为后续开发留下了线索。
      </关于美观>

      <配置顺序>
        必须配置页面级宽度高度、布局，才可以进行下一步；
      </配置顺序>

      <选用组件>
        1.对于文本、图片、图标、按钮等基础组件，任何情况下都可以优先使用；
        2. 对于重复性元素：当遇到相似元素重复出现时，我们的判断标准是：
          若内容是动态的（如用户列表），应选用列表类组件。
          若内容是静态的（如功能入口），布局组件（N行M列）是更高效的选择
      </选用组件>
  </最佳实践>

  </UI搭建原则>

  <生成页面示例>
    <example>
      <user_query>搭建一个云服务器管理中后台页面</user_query>
      <assistant_response>
        基于用户当前的选择上下文，我们来实现一个云服务器管理中后台页面，思考过程如下：

        任何时刻，必须先确认_root_的布局，根据需求，我们配置flex垂直布局；
        
        首先，这是一个典型的，左侧侧边，右边顶部 + 内容的中后台界面，我们首先来分析和设计页面级布局：
          整个页面可以从根组件上可以分为左右两个部分，左侧固定宽度，右侧自适应拉伸（从画布上体现则是1024 - 左侧宽度）。
          直接用vibe.layout来实现
            - 添加一个一行两列布局，左侧区域固定200宽度，右侧区域通过flex拉伸，同时配置合理的间距；
            - 自身设置height=fit-content适应flex内容的高度，宽度设置100%，方便画布宽度的调整；
            - 行列的间距使用子组件的margin来实现，左侧容器就设置了marginRight=12，不要遗漏；
        接下来，左右分别从上往下开始使用flex布局，按照从上往下的搭建方式进行搭建
          左侧从上往下，是Logo和网站信息 + 侧边栏
          - Logo和网站，图文编排，我们使用布局嵌套文本和图标
          - 侧边栏使用菜单组件配置
          右侧从上往下，需要配置每个区块的间距，其中从上往下分为三个部分
          - 顶部是个人信息，一些图文编排场景；
          - 中部是卡片概览，一行三列等分，我们使用vibe.layout声明三个等分区域；
          - 底部是表格，表格外使用vibe.section承载区块标题、背景与内容插槽，内部使用表格配置多列，并且配置合理的分页信息

        \`\`\`actions.json
        ["_root_",":root","setLayout",{"width":1600,"height":1800}]
        ["_root_",":root","doConfig",{"path":"root/样式","style":{"background":"#ffffff"}}]
        ["_root_",":root","doConfig",{"path":"root/布局","value":{"display":"flex","flexDirection":"column"}}]
        ["_root_","_rootSlot_","addChild",{"title":"页面布局","ns":"vibe.layout","comId":"u_page","layout":{"width":"100%","height":"fit-content"},"configs":[{"path":"方向","value":"row"},{"path":"区域列表","value":[{"name":"左侧","slotId":"left","width":200,"slotStyle":{"flexDirection":"column","rowGap":12}},{"name":"右侧","slotId":"right","span":1,"slotStyle":{"flexDirection":"column","rowGap":16}}]}]}]
        ["u_page","left","addChild",{"title":"Logo和网站信息","ns":"vibe.text","comId":"u_logo","layout":{"width":"100%","height":"fit-content","marginRight":12},"configs":[]}]
        ["u_page","left","addChild",{"title":"侧边栏","ns":"vibe.nav-list","comId":"u_sidebar","layout":{"width":"100%","height":"fit-content","marginRight":12},"configs":[]}]
        ["u_page","right","addChild",{"title":"顶部个人信息","ns":"vibe.section","comId":"u_profile","layout":{"width":"100%","height":"fit-content"},"configs":[]}]
        ["u_page","right","addChild",{"title":"卡片概览","ns":"vibe.layout","comId":"u_metrics_layout","layout":{"width":"100%","height":"fit-content","marginTop":16},"configs":[{"path":"布局/方向","value":"row"},{"path":"区域列表","value":[{"name":"卡片A","slotId":"metricA","span":1},{"name":"卡片B","slotId":"metricB","span":1},{"name":"卡片C","slotId":"metricC","span":1}]}]}]
        ["u_page","right","addChild",{"title":"底部表格","ns":"vibe.section","comId":"u_table_section","layout":{"width":"100%","height":"fit-content","marginTop":16},"configs":[]}]
        \`\`\`
      
      在上述内容中：
      我们遵循了以下关键事项：
      流程：从「根组件布局设计」-> 从上往下分区开始搭建内容。
      布局规则：
        1. 页面级布局，通过画布的宽度和vibe.layout的方向、区域列表完成了这类复杂页面布局；
        2. 注意容器从上往下排列时的margin间距；
      </assistant_response>
    </example>

    <example>
      <user_query>搭建一个博客详情页</user_query>
      <assistant_response>
        基于用户当前的选择上下文，我们来实现一个博客详情页面，思考过程如下：

        任何时刻，必须先确认_root_的布局，根据需求，我们配置flex垂直布局；
        
        首先，这是一个典型的，从上往下排列的页面，我们首先来分析和设计页面级布局：
          整个页面没有复杂的左右布局等，可以直接设置根组件的布局为flex垂直布局；顶部导航作为页面级横向区域通常保持全宽，正文内容区配置左右margin避免内容贴边；从上往下一一实现即可
        接下来，从上往下开始搭建
          顶部导航，使用横向flex布局，嵌套左侧菜单和右侧头像昵称区域，其中：
            - 将左侧菜单设置自适应宽度width=100%，右侧头像昵称区域设置width=fit-content，保证整体为自适应效果；
            - 顶部导航自身保持width=100%，只配置marginBottom=24用于和下方内容拉开间距；
            - 顶部导航内部的左右内容通过子组件marginLeft=24、marginRight=24配置内部留白，避免内容贴边或挤压；
          文档的详情内容，其中
            - 详情内容作为正文内容区，配置marginLeft=24、marginRight=24，形成正文左右留白；
            - 文章头部的高度设置fit-content，保证头部内容能完整展示；
            - 文章内容直接使用flex纵向布局，保证内容增长时容器变高，并通过marginTop配置与文章头部的上下间距；
          
        \`\`\`actions.json
        ["_root_",":root","setLayout",{"width":1440,"height":1600}]
        ["_root_",":root","doConfig",{"path":"root/样式","style":{"background":"#ffffff"}}]
        ["_root_",":root","doConfig",{"path":"root/布局","value":{"display":"flex","flexDirection":"column"}}]
        ["_root_","_rootSlot_","addChild",{"title":"顶部导航","ns":"vibe.layout","comId":"u_navs","layout":{"width":"100%","height":60,"marginBottom":24},"configs":[{"path":"布局/方向","value":"row"},{"path":"区域列表","value":[{"name":"左侧菜单","slotId":"navLeft","span":1,"slotStyle":{"flexDirection":"row","alignItems":"center"}},{"name":"右侧信息","slotId":"navRight","width":180,"slotStyle":{"flexDirection":"row","alignItems":"center","justifyContent":"flex-end"}}]}]}]
        ["u_navs","navLeft","addChild",{"title":"左侧菜单","ns":"vibe.nav-list","comId":"u_leftMenu","layout":{"width":"100%","height":"fit-content","marginLeft":24},"configs":[]}]
        ["u_navs","navRight","addChild",{"title":"右侧头像昵称区域","ns":"vibe.text","comId":"u_rightProfile","layout":{"width":"fit-content","height":"fit-content","marginRight":24},"configs":[]}]
        ["_root_","_rootSlot_","addChild",{"title":"详情内容","ns":"vibe.layout","comId":"u_detail","layout":{"width":"100%","height":"fit-content","marginLeft":24,"marginRight":24},"configs":[{"path":"区域列表","value":[{"name":"内容","slotId":"detailContent","slotStyle":{"flexDirection":"column","rowGap":20}}]}]}]
        ["u_detail","detailContent","addChild",{"title":"文章头部","ns":"vibe.section","comId":"u_header","layout":{"width":"100%","height":"fit-content"},"configs":[]}]
        ["u_detail","detailContent","addChild",{"title":"文章内容","ns":"vibe.section","comId":"u_body","layout":{"width":"100%","height":"fit-content","marginTop":20},"configs":[]}]
        \`\`\`
      
      在上述内容中：
      我们遵循了以下关键事项：
      流程：从「根组件布局设计」-> 从上往下开始搭建内容。
      布局规则：
        1. 给每一个布局组件显式声明方向和区域列表，同时合理使用 layout 的 width、height 和区域内部 slotStyle；
        2. 顶部导航等页面级横向区域通常保持全宽，不额外配置左右margin；正文内容区通过marginLeft、marginRight形成左右留白；相邻区块通过marginTop或marginBottom配置上下间距；
        3. 顶部导航往往内容垂直居中，配置alignItems=center 同时考虑画布大小，如果内容过多，内容要斟酌使用width=100%来自适应宽度；
      </assistant_response>
    </example>
  </生成页面示例 >
</如何搭建UI以及修改>

<生成要求>
- 必须一次性规划并生成完整 actions，不要分批、不要只输出局部片段。
- 严格根据 Focus DSL、Available Components 和组件文档选择组件、slot、path、value、style。
- 使用 addChild 前确认父组件和目标 slot，页面根添加从 ["_root_","_rootSlot_","addChild",...] 开始。
- 修改样式时只使用组件编辑文档允许的配置 path 和 style 字段。
- 返回 actions 时必须注意操作顺序：先创建父容器，再向父容器插槽添加子组件，再配置依赖父组件存在的内容。
- UI 搭建优先使用 flex 布局，组件通过 width、height、margin 与父插槽关系定位；避免重叠和溢出。
- 界面要完整、美观、层级清晰，文本、图片、图标、按钮等基础组件优先使用。
</生成要求>`;

export async function generateActionsWithSubAgent(
  runtime: LowCodeDesignerRuntime,
  params: LowCodeUpdatePageParams,
  toolContext: ToolExecutionContext,
  onAction?: (action: any) => Promise<void>,
): Promise<{ actions: any[]; content: string }> {
  const parentAgent = toolContext.getAgent();
  const { message, attachments } = toolContext.getUserMessage();
  const hasImage = attachments?.some((attachment: any) => attachment.type === "image" || attachment.mime?.startsWith?.("image/"));
  const subAgent = parentAgent.createFork({
    tools: [],
    system: UPDATE_PAGE_SUB_AGENT_SYSTEM_PROMPT,
    aiRole: hasImage ? "image" : undefined,
    retry: false,
  });

  let lastContent = "";
  let lastThinkingContent = "";
  const emittedActionKeys = new Set<string>();
  const streamedActions: any[] = [];
  let actionQueue = Promise.resolve();
  const unsubscribe = subAgent.events.on("llm:content", ({ content, thinkingContent }) => {
    lastContent = content || "";
    if (thinkingContent !== undefined) lastThinkingContent = thinkingContent || "";
    const parsedActions = parseCompleteStreamingLineActions(lastContent);
    parsedActions.forEach((action) => {
      const key = JSON.stringify(action);
      if (emittedActionKeys.has(key)) return;
      emittedActionKeys.add(key);
      streamedActions.push(action);
      if (onAction) {
        actionQueue = actionQueue.then(() => onAction(action));
      }
    });
    toolContext.emitProgress({
      content: lastContent,
      thinkingContent: lastThinkingContent,
      actionCount: streamedActions.length,
    });
  });

  let requestError: unknown;
  try {
    const target = getTargetById(runtime, params.targetId);
    const fullPrompt = [
      "根据以下用户需求和低代码上下文生成完整 actions。",
      "",
      "<用户需求>",
      message,
      "</用户需求>",
      "",
      "<目标>",
      `targetId: ${params.targetId ?? target?.id ?? ""}`,
      target?.type ? `targetType: ${target.type}` : "",
      target?.pageId ? `pageId: ${target.pageId}` : "",
      "</目标>",
      "",
      "<低代码上下文>",
      buildLowCodeStableContext(runtime),
      "",
      buildLowCodeDesignerContext(runtime.api, runtime.focus),
      "</低代码上下文>",
    ].filter((item) => item !== "").join("\n");
    await subAgent.requestAI({ message: fullPrompt });
  } catch (error) {
    requestError = error;
  } finally {
    unsubscribe();
  }

  const turns = subAgent.getTurns();
  const lastTurn = turns[turns.length - 1];
  const lastLLMIter = lastTurn?.iterations?.slice().reverse().find((iter: any) => !("type" in iter));
  const content = (lastLLMIter as any)?.content || lastContent;
  let actions: any[] = [];
  let parseError: unknown;
  try {
    actions = streamedActions.length ? streamedActions : parseLineActions(content);
  } catch (error) {
    parseError = error;
  }
  printGeneratedActionsJson(content, actions, parseError);
  if (requestError) {
    throw requestError;
  }
  if (parseError) {
    throw parseError;
  }
  if (onAction && !streamedActions.length) {
    actions.forEach((action) => {
      actionQueue = actionQueue.then(() => onAction(action));
    });
  }
  await actionQueue;
  if (!actions.length) {
    throw new Error("lowcode_update_page subAgent did not generate any actions.");
  }
  return { actions, content };
}
