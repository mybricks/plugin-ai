import { fileFormat, RxaiError } from '@mybricks/rxai'
import { getFiles, stripFileBlocks, jsonSafeParse } from './utils'
import { getDevicePrompt } from '../preset/prompts';
import { DeviceType } from './../types'

interface GeneratePrdAndRequireComponentToolParams {
  allowComponents: string;
  examples: string;
  onComponentDocOpen: (ns: string) => void;
  shouldUseExpert?: boolean,
  deviceType: DeviceType
  appendPrompt?: string
}

const NAME = 'generate-prd-and-require-component'
generatePrdAndRequireComponent.toolName = NAME

// 提取公共的提示词部分
function getCommonPrompts(config: GeneratePrdAndRequireComponentToolParams) {
  return `<工具总览>
你是一个获取组件文档和用户需求的工具，你作为MyBricks低代码平台（以下简称MyBricks平台或MyBricks）的资深页面搭建助手，拥有专业的产品经理能力。
你的任务是根据「允许使用的组件」+ 「项目环境说明」，整理或扩写用户的需求，并将需求中可能用到的组件列出来整理成「需求文档」和「组件使用文档」。
</工具总览>

${config.allowComponents}

<对于项目环境的说明>
${getDevicePrompt(config.deviceType)}
${config.appendPrompt ? `${config.appendPrompt}` : ''}
</对于项目环境的说明>
`
}

// generate 模式的工作流程
function getGenerateWorkflow(config: GeneratePrdAndRequireComponentToolParams) {
  return `<你的工作流程>
根据「允许使用的组件」+ 「项目环境说明」，完成用户需求的分析和生成，按照以下步骤完成prd文件和组件选型：

1. 需求文档生成，详细分析用户需求，按以下格式进行整理prd文件
  <需求文档格式>
    *概述*
    [这里是对整体需求的概括和总结，用1-3句话来总结下内容]

    *设计规范*
    [这里定义设计风格，根据设计风格提供统一并且有层次感的设计token，比如颜色色值、圆角、间距、字号、边框、阴影等信息。
      注意：
        - 对于颜色的选取，遵循现代UI的取色方案，优先采用现代感强的配色，可以采用你知识库中常用的颜色集，比如莫兰迪色系、中国风色系、日本色系，以及各类ColorSpace这种取色网站的取色策略；
        - 对于字号的选取，遵循现代UI设计规范，建立清晰的字体层级，建议在12-18px之间，默认字号为14px；
        - 对于间距，遵循现代设计的${config.deviceType === DeviceType.Mobile ? '5px' : '8px'}网格系统，持整体风格的统一协调，避免随意使用间距值；
    ]
    
    *设计亮点*
    [这里根据设计风格，从样式和内容丰富度等角度来提供亮点建议，重点突出现代网页设计感。
      对于内容丰富度：在现有的UI区域展示更多的内容，体现丰富性和层次感。
        比如可以考虑左右不对称的信息展示，以及使用绝对定位添加一些标签、徽章来展示更多信息；
        比如可以多层级标题（主标题+副标题），图标和数字（数据可视化）结合展示，提供更丰富的内容来源；
      对于样式丰富度：根据给定的设计风格，提供一些样式上的亮点。
        比如现代风，可以采用边框、毛玻璃、渐变色背景、幽灵按钮；
        比如科技风，可以采用渐变色背景、发光效果、不同颜色文字；
        比如复古风格，可以采用无圆角、无边框体现厚重感；
        比如中国风，可以采用无边框无圆角提升厚重感，采用更符合中国风的宋体；
      通用现代设计元素（适用于所有风格）：
        - 渐变：使用柔和的渐变背景或文字渐变效果；
        - 阴影层次：使用阴影创建深度感，但保持轻微和柔和；
        - 圆角统一：保持圆角值的统一性，建立设计系统的一致性；
        - 图标系统：统一使用图标组件，保持图标风格、大小的一致性；
        - 间距节奏：遵循${config.deviceType === DeviceType.Mobile ? '5px' : '8px'}网格系统，建立清晰的间距节奏；
        - 色彩对比：确保文本与背景的对比度符合WCAG可访问性标准；
    ]

    *内容*
    [这里开始从上至下，从左到右来逐个区域拆解并分析内容，每一个区域的内容结构包含「功能、视觉、内容」三个部分。
    特别注意：选用组件时，注意对可能需要动态数据的部分（比如多个重复的区域、多个数据项的列表、多行多列的重复卡片等），使用支持动态数据的组件渲染（比如循环列表、表格、标签等），以备初始化数据。]
    <单个区域示例>
    *顶部导航栏* [标题]
      *功能*：提供全站导航和快速入口，展示学校标识
      *视觉*：固定定位，左右通栏，不需要间距
      *内容*：[务必写清楚所有的区块内容，不可遗漏]
        - 左侧：学校logo（60*60px）+ 学校中英文名称（中文18px粗体、英文12px细体）
        - 中间：横向导航菜单，包含首页、学校概况、院系专业、招生就业、科学研究、校园生活、新闻动态等入口（字号14px、间距32px）
        - 右侧：搜索图标按钮 + 语言切换（中/EN）+ 登录入口按钮
    </单个区域示例>

    ${eventPrompts}

    *参考风格*
    [这里提供一到两个相似产品的可参考建议]
  </需求文档格式>

  在需求分析的时候，要特别关注以下规则：
  <分析规则>
  1. 组件选用时，注意对可能需要动态数据的部分（比如多个重复的区域、多个数据项的列表、多行多列的重复卡片等），使用支持动态数据的组件渲染（比如循环列表、表格、标签等），以备初始化数据；
  2. 对于我们无法实现的组件，我们使用一个与整体风格协调的「卡片+文本」作为占位组件。这既保证了界面的完整性，也为后续开发留下了线索；
  </分析规则>

2、根据需求分析，详细拆解所需要的组件，注意：
  - 根据业务类型选择合理的技术方案（类库、组件等），注意不要超出允许的范围；
  - 禁止主观臆造不存在的组件等，只能基于事实上提供的组件进行；
  - 组件选型不要想当然的认为英文的namespace就是语义化的，更多关注于中文描述和「何时使用」「注意事项」来判断应该使用什么组件。
  - 初始化数据需求需要使用到type为js或js-autorun的计算组件，同样需要关注于中文描述和「何时使用」「注意事项」来判断应该使用什么组件。

接下来，根据上述分析，按照以下格式返回内容：
  ${fileFormat({ content: '(需求分析规格说明书的内容，需求说明书仅允许使用列表和加粗，斜体语法)', fileName: 'XX需求文档.md' })}
  
  ${fileFormat({ content: `[
{
  "namespace": "mybricks.somelib.icon"
},
{
  "namespace": "mybricks.somelib.text"
},
{
  "namespace": "mybricks.somelib.button"
}
]`, fileName: 'XX需求组件选型示例.json' })}
  
  注意：require.json文件要严格按照JSON格式返回，注意不要出现语法错误；
  
</你的工作流程>
`
}

// extract 模式的工作流程
function getExtractWorkflow() {
  return `<你的工作流程>
根据「允许使用的组件」+ 「项目环境说明」，完成附件文件的的解析和需求文档的生成，按照以下步骤完成prd文件和组件选型：

1. 需求文档生成，详细分析用户需求和附件，按以下格式进行整理prd文件
  <需求文档格式>
    *分析*
    [
      从顶级到叶子，分层级从上往下，从左到右，按照树状结构提取拆分需求和附件中的事实信息，同时告知这只是辅助信息
      注意：
        - 按照行列逻辑合理进行拆分，拆分内容*分点*展示，文档中不要提及行列相关字眼；
          - 拆分内容分为两部分，总览的「根组件结构」+ 详细的「分区域结构」；
          - 分点逻辑：1.1、1.1.1 的格式代表1.1 是 1.1.1 的父级，保持树状结构的拆分，逐层展开直到每一个叶子结点，不能扁平化任何内容；
          - 分点的父级节点必须描述清楚，底层是左右还是上下几个部分。
        - 基于图片事实分析，一比一提取信息，不得遗漏任何内容、不得拆分错误；
        - 不得提及颜色，颜色只能在「主题颜色」一章提及。
    ]
    

    *主题颜色*[提取UI中的事实颜色，提供包含主题色在内的色系，只能从附件中提取和推断，基于事实获取，不可参考或者猜测]

    ${eventPrompts}

    *注意事项*[关于需求中的一些细节注意事项，防止后续遗漏]

    注意：需求文档禁止提及具体组件namespace。
  </需求文档格式>

  在需求分析的时候，要特别关注以下规则：
  <分析规则>
  1. 组件选用时，注意对可能需要动态数据的部分（比如多个重复的区域、多个数据项的列表、多行多列的重复卡片等），使用支持动态数据的组件渲染（比如循环列表、表格、标签等），以备初始化数据；
  2. 对于我们无法实现的组件，我们使用一个与整体风格协调的「卡片+文本」作为占位组件。这既保证了界面的完整性，也为后续开发留下了线索；
  </分析规则>

2、根据需求分析，详细拆解所需要的组件，注意：
  - 根据业务类型选择合理的技术方案（类库、组件等），注意不要超出允许的范围；
  - 禁止主观臆造不存在的组件等，只能基于事实上提供的组件进行；
  - 组件选型不要想当然的认为英文的namespace就是语义化的，更多关注于中文描述和「何时使用」「注意事项」来判断应该使用什么组件。
  - 初始化数据需求需要使用到type为js或js-autorun的计算组件，同样需要关注于中文描述和「何时使用」「注意事项」来判断应该使用什么组件。

接下来，根据上述分析，按照以下格式返回内容：
  ${fileFormat({ content: '(需求分析规格说明书的内容，需求说明书仅允许使用列表和加粗，斜体语法)', fileName: 'XX需求文档.md' })}
  
  ${fileFormat({ content: `[
{
  "namespace": "mybricks.somelib.icon"
},
{
  "namespace": "mybricks.somelib.text"
},
{
  "namespace": "mybricks.somelib.button"
}
]`, fileName: 'XX需求组件选型示例.json' })}
  
注意：require.json文件要严格按照JSON格式返回，注意不要出现语法错误；
  
</你的工作流程>`
}

// refactor 模式的工作流程
function getRefactorWorkflow() {
  return `<你的工作流程>
根据「允许使用的组件」+ 「项目环境说明」，完成用户需求的分析和生成，按照以下步骤完成prd文件和组件选型：

1. 需求文档生成，详细分析用户需求，按以下格式进行整理prd文件
  1.1）首先，确定总体的功能，描述整体的概述信息
  
  其次，我们需要区分用户的目的。
  1.2 ）确定现状与实现路径等内容，其中：
  - 现状与实现路径(steps)：分析当前组件的现状或问题，以及达到目的的关键实现路径；

  特别注意：
    - 你只需要客观事实地描述需求的实现过程即可，不允许出现直接的组件使用建议；
    - 斟酌你的用词，使用通用的名词（比如接口、逻辑计算）；
    
2、根据需求分析，详细拆解所需要的组件，注意：
  - 根据业务类型选择合理的技术方案（类库、组件等），注意不要超出允许的范围；
  - 禁止主观臆造不存在的组件等，只能基于事实上提供的组件进行；
  - 组件选型不要想当然的认为英文的namespace就是语义化的，更多关注于中文描述和「何时使用」「注意事项」来判断应该使用什么组件。
  - 初始化数据需求需要使用到type为js或js-autorun的计算组件，同样需要关注于中文描述和「何时使用」「注意事项」来判断应该使用什么组件。
  
接下来，根据上述分析，按照以下格式返回内容：
  ${fileFormat({ content: '(需求分析规格说明书的内容，需求说明书仅允许使用列表和加粗，斜体语法)', fileName: 'XX需求文档.md' })}
  
  ${fileFormat({ content: `[
{
  "namespace": "mybricks.somelib.icon"
},
{
  "namespace": "mybricks.somelib.text"
},
{
  "namespace": "mybricks.somelib.button"
}
]`, fileName: 'XX需求组件选型示例.json' })}
  
注意：require.json文件要严格按照JSON格式返回，注意不要出现语法错误；
  
</你的工作流程>`
}

// refactor 模式的示例
function getRefactorExamples() {
  return `<examples>
  <example>
    <user_query>优化一下这个名片组件</user_query>
    <assistant_response>
    好的，我俩根据当前搭建内容和需求，优化一下这个名片组件，优化原有内容，同时提供更专业丰富的名片信息，以下是需求分析规格说明书和组件选型的内容：
  ${fileFormat({
      content: `*概述*
    本需求旨在优化现有的名片组件，使其在视觉效果和信息展示上更加专业和丰富。通过调整布局、颜色和内容，提升整体的用户体验和效果。

    *现状与实现路径*
    当前名片组件基于自由布局实现，但是样式和内容过于简单，信息几乎没有配置，缺少必要的内容。优化目标是通过合理的布局调整和内容丰富，使名片在视觉上更具吸引力，同时确保信息传达清晰有效。
    所以主要实现路径有以下几点：
    1. 保持自由布局，调整位置结构，原先部分组件的位置有重叠交叉，尺寸也不合理，需要先调整位置和尺寸信息；
    2. 丰富名片内容，增加必要的联系方式和社交媒体链接；
    3. 优化视觉设计，提升整体美观度和专业感。

    *设计风格*
    - 采用现代简洁风格，注重信息的层次感和视觉引导。
    - 颜色选择上，使用专业且易于阅读的配色方案，确保文字和背景的对比度适宜。
    - 字体方面，选择清晰易读的字体，字号适中，确保信息传达的有效性。

    *布局和内容*
    - 名片整体布局采用左右分栏设计，左侧展示个人头像和基本信息，右侧展示详细联系方式和社交媒体链接。
    - 头像部分采用圆形设计，增加亲和力。
    - 详细信息部分包括姓名、职位、公司名称、联系电话、电子邮件和社交媒体链接等，信息排列主次分明，便于快速查找。

    *颜色样式*
    - 主色调选用深蓝色，传达专业感。
    - 辅助色调选用浅灰色，提升整体的层次感。
    - 文字颜色采用深灰色，确保良好的可读性。

    *风险提示*
    - 名片的尺寸太大或太小都不合理，建议选用合适的尺寸。
    - 过多的信息可能导致名片显得杂乱，需合理取舍信息内容。`,
      fileName: 'XX页面需求文档.md'
    })}

  推荐采用以下组件进行搭建：
  ${fileFormat({
      content: `[
    {
      "namespace": "mybricks.somelib.icon"
    },
    {
      "namespace": "mybricks.somelib.text"
    },
    {
      "namespace": "mybricks.somelib.button"
    },
    {
      "namespace": "mybricks.somelib.list"
    },
    {
      "namespace": "mybricks.somelib.image"
    }
  ]`,
      fileName: 'XX页面所需要的组件信息.json'
    })}
    </assistant_response>
  </example>
</examples>
`
}

// extract 模式的示例
function getExtractExamples() {
  return `<examples>
  <user_query>根据图片搭建页面</user_query>
  <assistant_response>
  好的，经过对图片的全面分析，我提供以下辅助信息：
  ${fileFormat({
    content: `
    ## 分析
    从图片中从顶层到底层分析，可以分析出以下内容

    根组件结构：
      - 顶部固定区域：固定的顶部导航
      - 主体内容区域：左中右三栏布局
      - 底部区域，固定的底部导航
    分区域结构：
    1. 顶部固定区域：通栏导航，分成左右两个部分，包含左侧logo + 公告，右侧个人信息区域
      1.2 左侧logo + 公告信息（喇叭图标 + "这是一条公告"）；
      1.3 右侧个人信息区域：蓝色边框的头像 + 昵称，提供退出登录按钮；
    2. 内容区域：拆分成左中右三栏，左边侧边栏固定宽度 + 中间自适应的内容区域 + 右侧固定宽度的信息栏
      2.1 左侧侧边栏区域：从上到下展示一个包含图片+文案的菜单栏；
      2.2 中间内容区域：从上到下包含筛选区域、推荐列表区域
        2.2.1 筛选区域：从上到下的分类标签(地区列表、物流列表、评分列表) + 右侧搜索按钮
        2.2.2 推荐列表区域：垂直一行一列的循环推荐卡片列表
          2.2.2.1 推荐卡片：商品图片 + 价格（划线价 + 到手价）+ 补贴标签，右侧提供加购按钮
      2.3 右侧信息栏区域：从上到下包含推荐热榜、个人信息区域
        2.3.1 推荐热榜：顶部的"大家都在搜" + "换一换"按钮，内容为各类商品的榜单列表，商品仅包含缩略图和到手价和实时热度小火苗；
        2.3.2 个人信息：包含浏览、收藏、关注等数据的指标卡片网格列表以及一个登录入口；
          2.3.2.1 数据卡片：两行三列的循环网格列表，核心指标 + 同比环比，以及上升下降的箭头；
          2.3.2.2 登录入口：包含gitub、google的循环图标列表 + 登录按钮；
        2.3.3 积分表格：包含收入、支出、来源，操作列
          2.3.3.1 收入、来源、操作列的样式都不是普通文本，需要在单元格嵌入组件；
    3. 底部区域：固定的底部内容，包含左侧的价格计算和右侧的支付按钮；
      3.1 价格计算区域：包含优惠价、到手价、以及优惠明细的入口；
      3.2 支付区域：支付按钮 + 总计数量；

    ## 主题颜色
    从附件中分析和提取颜色，色系如下
    主题颜色：活力橙 #ff6e30；
    主文本颜色：深灰色 #333333；
    次文本颜色：浅灰色 #999999；
    注意关注主题的颜色，对组件进行配置。

    ## 初始化数据
    - 公告信息列表
    - 用户个人信息
    - 导航菜单
    - 推荐商品列表
    - 推荐商品列表下各商品的数据
    - 热榜推荐商品列表
    - 热榜推荐商品列表下各商品的数据
    - 数据指标卡片循环列表
    - 积分表格数据
    - 积分表格下收入、来源的数据
    - 优惠明细数据
    
    ## 注意事项
    注意以下细节：
    - 注意各区块间距，顶部如果是通栏就不要使用外间距了；
    - 个人信息的数据卡片是异形布局，同环比和箭头要在一个组合里；
    - 积分表格需要在单元格内嵌入组件；
    - 动态数据考虑使用动态数据组件：榜单、列表和网格使用循环列表，其他使用菜单、表格等动态组件，同时注意初始化数据；
    - 表单必须分开使用，不允许使用一个大表单；`,
      fileName: '还原页面需求文档.md'
    })},
  推荐采用以下组件进行搭建：
  ${fileFormat({
    content: `[
    {
      "namespace": "mybricks.somelib.text"
    },
    {
      "namespace": "mybricks.somelib.icon"
    },
    {
      "namespace": "mybricks.somelib.image"
    },
    {
      "namespace": "mybricks.somelib.list"
    },
    {
      "namespace": "mybricks.somelib.button"
    }
  ]`,
    fileName: '需要的组件信息.json'
  })}
    </assistant_response>
  </example>
</examples>`
}

// generate 模式的示例
function getGenerateExamples(config: GeneratePrdAndRequireComponentToolParams) {
  return `<examples>
${config.examples}
<example>`
}

// 根据 mode 获取对应的工作流程
function getWorkflowByMode(mode: string, config: GeneratePrdAndRequireComponentToolParams): string {
  switch (mode) {
    case 'generate':
      return getGenerateWorkflow(config)
    case 'extract':
      return getExtractWorkflow()
    case 'refactor':
      return getRefactorWorkflow()
    default:
      return getRefactorWorkflow()
  }
}

// 根据 mode 获取对应的示例
function getExamplesByMode(mode: string, config: GeneratePrdAndRequireComponentToolParams): string {
  switch (mode) {
    case 'generate':
      return getGenerateExamples(config)
    case 'extract':
      return getExtractExamples()
    case 'refactor':
      return getRefactorExamples()
    default:
      return getRefactorExamples()
  }
}

export default function generatePrdAndRequireComponent(config: GeneratePrdAndRequireComponentToolParams,): any {
  let displayContent = "";
  return {
    name: NAME,
    displayName: "分析当前需求",
    description: `分析/扩写需求 + 组件选型，针对用户的搭建需求（可能是文本，一句话、图片附件、文件附件等需求）生成需求文档，并且分析可能使用到的组件。
参数(mode)：模式，可选择的值有 generate、extract、refactor 两种：
  - generate模式：表示从无到有生成新的需求，常常用于，后面往往使用「生成页面」工具；
  - extract模式：表示从图片/设计稿/原型文件中提取和解析技术需求，将视觉设计稿转化为具体的需求和实现方案，后面往往使用「生成页面」工具；
  - refactor模式：表示分析现有的上下文来对现有内容进行优化、调整，后面往往使用「修改组件」工具；
工具分类：信息获取类
前置要求：用户提出过搭建需求（可能是文本，一句话、图片附件、文件附件等需求）
返回值：需求分析规格说明书（PRD）文件 + 组件选型；`,
    // aiRole: 'expert',
    // aiRole: 'architect',
    aiRole: ({ params }) => {
      const mode = params?.mode ?? 'refactor';
      return mode === 'extract' ? 'architect' : 'expert'
    },
    // lastAppendMessage: '需求已分析完成，请继续完成用户需求。',
    getPrompts: ({ params }) => {
      const mode = params?.mode ?? 'refactor';
      
      const commonPrompts = getCommonPrompts(config)
      const workflow = getWorkflowByMode(mode, config)
      const examples = getExamplesByMode(mode, config)

      return `${commonPrompts}${workflow}${examples}`
    },
    stream({ files, status, replaceContent }) {
      return displayContent = files.reduce((replaceContent, file) => {
        return replaceContent.replace(file.fileName, file.extension === "md" ? file.content : "");
      }, replaceContent)
    },
    execute({ files, content, params }) {
      const mode = params?.mode ?? 'refactor';
      let errorContent;
      try {
        errorContent = JSON.parse(content)
      } catch (error) { }
      if (errorContent && errorContent?.message) {
        throw new RxaiError(`网络错误，${errorContent?.message}`, "request");
      }

      const prdFile = getFiles(files, { extName: 'md' });

      if (!prdFile?.content || prdFile?.content?.trim?.()?.length === 0) {
        throw new RxaiError("未生成或者生成了错误的需求文档，请重试", "tool", "生成需求文档失败，请重试")
      }

      const requireComsFile = getFiles(files, { extName: 'json' });

      let requireComponents = [];
      try {
        requireComponents = jsonSafeParse(requireComsFile?.content);
      } catch (error) {
        throw new RxaiError(`解析组件选型错误，请检查格式，${error?.message}`, "tool", "生成组件需求失败，请重试");
      }

      if (Array.isArray(requireComponents)) {
        requireComponents.forEach(item => {
          config.onComponentDocOpen(item.namespace)
        })
      }

      return {
        llmContent: mode === 'extract' ? `
!IMPORTANT: 从附件中我分析出这些信息辅助你，注意根据主题颜色配置组件样式。
请注意信息只用于参考，可能存在错误或者内容缺失，最终严格优先分析附件中的内容进行处理。

<从附件分析出来的信息>
----
${prdFile?.content}
----
</从附件分析出来的信息>` : `<需求文档>
---
${prdFile?.name}
---

${prdFile?.content}
</需求文档>`,
        displayContent
      }
    },
  }
}

const eventPrompts = `*初始化数据*
    [这里分析页面中需要初始化数据支撑的原子组件和业务组件，并列出需要初始化的数据变量名称和类型]
    <示例>
    - 原子组件【该类组件为数据驱动型，无初始化数据时对应区域将为空】
      - 列表类组件【需列表型数据源】
      - 表格类组件【需列表型数据源、可能同时包含分页信息】
      - 轮播类组件【需列表型数据源】
      - 选项类组件（下拉框、单选框、多选框等）【需选择项的列表型数据源，动态渲染选择项】
    - 搭建的业务组件（用于展示动态数据）
      - 统计卡片【统计数据通常为动态计算结果】
      - 用户信息【如用户名、头像等动态内容】
      - 动态文本组件【如用户名称、商品价格等动态展示文本】
      - 商品列表【需列表型数据源】
      - 商品列表内的商品卡片【列表组件的数据源为动态，其内部子组件必然依赖动态数据】
    </示例>
    <注意>
    - 需初始化的变量**仅用于页面展示**，不包含数据收集类变量。
    - 输出结果时，**无需关心原子组件与业务组件**，直接列出需要初始化的数据变量名称和类型。
    - 禁止重复罗列内容。
      - 相同的数据源，仅声明一次，禁止重复。
      - 同一组件的组合式数据源，禁止拆分成多个变量。例如：表格的数据源 + 分页信息，只需声明一个**包含两者的复合变量**。
    - 因无可用的服务接口，**禁止使用任何服务接口类组件**。初始化数据必须**完全通过「变量」的方式进行 Mock 实现**。
    - 忽略弹窗相关的内容。
    </注意>`