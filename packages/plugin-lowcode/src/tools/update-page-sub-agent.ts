import type { ToolExecutionContext } from "../../../agent/src/agent";
import type { LowCodeDesignerRuntime } from "../designer";
import { buildLowCodeDesignerContext, buildLowCodeStableContext } from "../outline";
import { getTargetById } from "./execution";
import type { LowCodeUpdatePageParams } from "./types";
import { activeDSL, EXAMPLES } from "../dsl";
import type { ActionDSL, CanonicalAction } from "../dsl";

const ENABLE_RENDER_OPTIMIZATION = false;

function prepareActionForUpdatePage(action: CanonicalAction): CanonicalAction {
  if (ENABLE_RENDER_OPTIMIZATION) return action;
  if (action.type !== "addChild") return action;
  if (!("ignore" in action) && !("enhance" in action)) return action;
  const { ignore: _i, enhance: _e, ...rest } = action as any;
  return rest as CanonicalAction;
}

function printGeneratedActionsJson(content: string, actions: CanonicalAction[], parseError?: unknown): void {
  console.log("[plugin-lowcode] lowcode_update_page raw content", content.trim());
  console.log("[plugin-lowcode] lowcode_update_page actions total json", JSON.stringify(actions, null, 2));
  if (parseError) {
    console.error("[plugin-lowcode] lowcode_update_page actions parse error", parseError);
  }
}

function buildSystemPrompt(dsl: ActionDSL): string {
  const { fileTag } = dsl;
  const ex = (actions: CanonicalAction[]) => dsl.exampleBlock(actions);

  return `你是 MyBricks 低代码页面搭建专家。你的唯一任务是根据用户需求和低代码上下文，一次性生成完整的页面更新 actions。

注意：不要调用任何工具，只输出文件代码块。
注意：我们处于快速原型模式，只需要黑白的线框原型图，不要配置背景等样式，页面背景色为白色。

<输出规则>
只输出一个 ${fileTag} 代码块。代码块中每一行是一个完整 JSON action，不允许输出解释、Markdown 正文、注释、省略号、占位符或非法 JSON。

格式：
${ex(EXAMPLES.outputFormat)}
</输出规则>

<如何搭建UI以及修改>
  通过一系列的action来分步骤实现用户需求。

  <关于actions>
    ${dsl.formatDescription}

    综合而言，每个action的语义是：对某个组件(comId)的整体或某个部分(target)，执行某个动作(type)，并传入参数(params)。

    注意：
      - 在返回多个步骤时，务必注意其逻辑顺序，例如有些action需要先完成，后续的action（可能受控于ifVisible,只有ifVislble返回true才能使用）才能进行；
      - 有些修改需要先完成整体、再进行局部的修改；

    各action详细说明如下：

    <layout>
      - 设置组件的布局和尺寸信息，params的格式以Typescript的形式说明如下：

      \`\`\`typescript
      /**
       * 宽高尺寸
       * number - 具体的px值
       * fit-content - 适应内容
       * 100% - 填充，仅允许100%，不允许其他百分比宽度
       * 只能是四者其一，明确不允许使用其他属性，比如calc等方法
       */
      type Size = number | "fit-content" | "100%"

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
      ${ex(EXAMPLES.setLayoutSimple)}

      注意：当需要修改布局和尺寸信息时，仅返回用户要求的内容即可，无需返回所有的布局和尺寸信息属性。
    </layout>

    <cfg>
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
      ${ex(EXAMPLES.doConfigProperty)}

      - 样式的配置：
      ${ex(EXAMPLES.doConfigStyle)}

        注意：
        - 当需要修改组件的样式时，只允许修改style编辑器description中声明的属性；
        - 当需要修改组件的样式时，背景统一使用background,而非backgroundColor等属性；
    </cfg>

    ${dsl.addChildDescription(ex)}

    <del>
      - 删除组件

      例如，当用户要求删除组件u_o21rs，可以返回以下内容：
      ${ex(EXAMPLES.delete)}
      注意：删除时，必须删除组件的整体，不能删除组件的某个部分，所以使用:root选择器。
    </del>

    注意：${fileTag}文件每一行遵循语法，禁止非法代码，禁止出现内容省略提示、单行注释、省略字符。
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
        ${ex(EXAMPLES.fixedLayout)}

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
          ${ex(EXAMPLES.flexLeftFixed)}
          在上例中:
            - 声明方向和区域列表，注意每个区域必须有稳定的name和slotId；
            - 左侧区域使用width固定宽度，右侧区域使用span实现自适应宽度；
            - 子组件必须添加到对应slotId插槽下，例如left、right；


          下面的例子使用vibe.layout进行嵌套，来实现左侧图标+文本，右侧箭头的布局:
          ${ex(EXAMPLES.flexIconTextArrow)}
          在上例中:
            - 使用一个vibe.layout声明left和right两个区域；
            - 左侧区域内部用columnGap控制图标与文本间距；
            - 右侧区域固定width=24，用于承载箭头或占位图标；

          下面的例子使用vibe.layout实现垂直居中布局:
          ${ex(EXAMPLES.flexCenter)}
          在上例中:
            - 使用单个center区域承载内容；
            - 通过区域slotStyle的alignItems=center和justifyContent=center实现居中；

          下面的例子使用vibe.layout进行横向左右均分布局，实现各占一半的效果:
          ${ex(EXAMPLES.flexHalves)}
          在上例中:
            - 为了实现各占一半，配置两个区域的span都为1；
            - 区域占比在区域列表中声明，不要用子组件百分比宽度模拟；
            - 判断仅布局，添加ignore标记，优化搭建内容。
            - 区域内子组件仍可通过margin配置自身与周边内容的间距；

          下面的例子使用vibe.layout进行横向均分或等分布局，实现一行N列的效果:
          ${ex(EXAMPLES.flexNColumns)}
          在上例中:
            - 为每一列声明一个区域，并给每个区域配置span=1；
            - 子组件添加到各自区域slotId下；
            - 判断仅布局，添加ignore标记，优化搭建内容。

          特殊地，在flex布局中的元素还可以配置position=absolute，用于实现绝对定位效果:
          ${ex(EXAMPLES.absoluteInFlex)}
          在上例中:
            - 声明布局编辑器的值，注意布局编辑器必须声明，其中flexDirection也必须声明；
            - 通过layout中的属性，设置成绝对定位效果，在一些特殊的角标等场景下很有效果；

      </布局使用示例>
    </布局原则>

    <最佳实践>
      分析用户意图、规划页面布局和内容、再选择并合理使用组件，保证页面的美观、丰富和完整性。

      <意图分析>
        1.搭建目标分类：PC端、移动端、或者是其他
        2.搭建意图分类：
          - 简略需求，比如一句话“开发一个美妆网站”，往往是让你发散需求，需要在保证不偏移的情况性，仅可能发散更多内容；
          - 还原需求，还原用户提供的附件或者其他内容，需要遵循还原内容，尽量不发散需求；
          - 清晰需求，用户提供了丰富度高并且完整的的需求，按照用户的需求进行搭建，必须时进行发挥；
      </意图分析>

      <规划页面布局>
        确认画布的宽度、高度和布局，以及各个页面级布局的margin、间距等；
      </规划页面布局>

      <合理使用组件>
        在选用组件时，文本、图片、图标、按钮等基础组件拥有最高优先级；
        对于文本：注意保持视觉的统一性，选用合适的文本大小粗细，同时尽量配置文本省略，防止文本换行导致效果不佳。
        对于布局：一个组件的位置、尺寸、margin，永远需要参考其父容器。时刻牢记这一点，可以从根本上解决绝大多数的重叠与溢出问题。
        对于重复性元素：当遇到相似元素重复出现时，我们的判断标准是：
          若内容是动态的（如用户列表），应选用列表嵌套布局进行实现；
          若内容是静态的（如功能入口），布局组件（N行M列）是更高效的选择；
      </合理使用组件>

      <美观和丰富度>
        丰富度：根据「搭建目标」和「搭建意图」，合理安排页面内容的丰富程度；
          - 比如：PC端的页面，由于屏幕足够大，往往提供左右不对称的布局用来丰富内容
          - 比如：移动端的页面，则通过从上往下的更多的区块，以及详细的卡片细节来丰富内容
        切记：保证页面的丰富度和完整性，避免出现空白区域，必要时使用占位组件；
      </美观和丰富度>
  </最佳实践>

  <颜色系统>
  由于是绘制原型线框图的场景，如果需要提供样式，我们使用的边框、背景色值都是Tailwind的默认中性色 neutral 系列的色值，
  必要情况下，则使用 neutral 系列的深色代表高亮的情况。
  </颜色系统>

  </UI搭建原则>

  <生成页面示例>
    注意：以下示例为了演示，省略了很多内容，只保留了核心要点，在实际生成过程中，必须保证页面的丰富度和完整性，进行搭建。

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

        ${ex(EXAMPLES.adminPageExample)}
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
            - 将左侧菜单设置span=1自适应宽度，保证自适应宽度，右侧头像昵称区域设置width=300；
            - 顶部导航自身保持width=100%，只配置marginBottom=12用于和下方内容拉开间距，内部间距由子组件配置marginLeft=12、marginRight=12配置内部留白，避免内容贴边；
          文档的详情内容，其中
            - 详情内容作为正文内容区，配置marginLeft=12、marginRight=12，形成正文左右留白；
            - 文章头部的高度设置fit-content，保证头部内容能完整展示；
            - 文章内容直接使用flex纵向布局，保证内容增长时容器变高，并通过marginTop配置与文章头部的上下间距，再配置marginLeft=12、marginRight=12和插槽留白，防止贴边；

        ${ex(EXAMPLES.blogPageExample)}
      </assistant_response>
    </example>
  </生成页面示例>
</如何搭建UI以及修改>

<生成要求>
- 必须一次性规划并生成完整 actions，不要分批、不要只输出局部片段。
- 严格根据 Focus DSL、Available Components 和组件文档选择组件、slot、path、value、style。
- 返回 actions 时必须注意操作顺序：先创建父容器，再向父容器插槽添加子组件，再配置依赖父组件存在的内容。
- UI 搭建优先使用 flex 布局，组件通过 width、height、margin 与父插槽关系定位；避免重叠和溢出。
- 界面要完整、美观、层级清晰，文本、图片、图标、按钮等基础组件优先使用。
</生成要求>`;
}

export async function generateActionsWithSubAgent(
  runtime: LowCodeDesignerRuntime,
  params: LowCodeUpdatePageParams,
  toolContext: ToolExecutionContext,
  onAction?: (action: CanonicalAction) => Promise<any>,
): Promise<{ actions: CanonicalAction[]; content: string }> {
  const dsl = activeDSL;
  const parentAgent = toolContext.getAgent();
  const { message, attachments } = toolContext.getUserMessage();
  const hasImage = attachments?.some((attachment: any) => attachment.type === "image" || attachment.mime?.startsWith?.("image/"));
  const subAgent = parentAgent.createFork({
    tools: [],
    system: buildSystemPrompt(dsl),
    aiRole: hasImage ? "image" : undefined,
    retry: false,
  });

  let lastContent = "";
  let lastThinkingContent = "";
  const emittedActionKeys = new Set<string>();
  const streamedActions: CanonicalAction[] = [];
  const updatePageActions: CanonicalAction[] = [];
  let actionQueue = Promise.resolve();
  const enqueueAction = (action: CanonicalAction) => {
    if (!onAction) return;
    actionQueue = actionQueue.then(async () => {
      try {
        const updatePageAction = await onAction(prepareActionForUpdatePage(action));
        if (updatePageAction !== undefined) updatePageActions.push(updatePageAction);
      } catch (error) {
        console.error("[plugin-lowcode] lowcode_update_page action execution error", { action, error });
      }
    });
  };
  const unsubscribe = subAgent.events.on("llm:content", ({ content, thinkingContent }) => {
    lastContent = content || "";
    if (thinkingContent !== undefined) lastThinkingContent = thinkingContent || "";
    const parsedActions = dsl.parseStreamingContent(lastContent);
    parsedActions.forEach((action) => {
      const key = JSON.stringify(action);
      if (emittedActionKeys.has(key)) return;
      emittedActionKeys.add(key);
      streamedActions.push(action);
      enqueueAction(action);
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
  let actions: CanonicalAction[] = [];
  let parseError: unknown;
  try {
    actions = streamedActions.length ? streamedActions : dsl.parseContent(content);
  } catch (error) {
    parseError = error;
  }
  if (requestError) {
    throw requestError;
  }
  if (parseError) {
    throw parseError;
  }
  if (onAction && !streamedActions.length) {
    actions.forEach(enqueueAction);
  }
  await actionQueue;
  if (!actions.length) {
    throw new Error("lowcode_update_page subAgent did not generate any actions.");
  }
  if (onAction) actions = updatePageActions;
  printGeneratedActionsJson(content, actions, parseError);
  return { actions, content };
}
