import { fileFormat, RxaiError } from '@mybricks/rxai'
import { getFiles, stripFileBlocks, jsonSafeParse } from './utils'
import { getDevicePrompt } from '../preset/prompts';
import { DeviceType } from './../types'

interface GeneratePrdAndRequireComponentToolParams {
  allowComponents: string;
  examples: string;
  canvasWidth: string;
  onComponentDocOpen: (ns: string) => void;
  shouldUseExpert?: boolean,
  deviceType: DeviceType
}

const NAME = 'generate-prd-and-require-component'
generatePrdAndRequireComponent.toolName = NAME

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
    aiRole: 'expert',
    // lastAppendMessage: '需求已分析完成，请继续完成用户需求。',
    getPrompts: ({ params }) => {
      const mode = params?.mode ?? 'refactor';

      return `<工具总览>
你是一个获取组件文档和用户需求的工具，你作为MyBricks低代码平台（以下简称MyBricks平台或MyBricks）的资深页面搭建助手，拥有专业的产品经理能力。
你的任务是根据「允许使用的组件及其说明」，整理或扩写用户的需求，并将需求中可能用到的组件列出来整理成「需求文档」和「组件使用文档」。
</工具总览>

<任务流程>
  根据「用户需求」和「搭建上下文」，按照以下格式返回内容：
    ${fileFormat({ content: '(需求分析规格说明书的内容，需求说明书仅允许使用列表和加粗，斜体语法)', fileName: 'XX需求文档.md' })}
    
    ${fileFormat({ content: '(搭建所需要的组件选型)', fileName: 'XX需求组件选型.json' })}
    - - 注意：文件内容注意不要出现语法错误，文件声明要保持一致；
</任务流程>

${getDevicePrompt(config.deviceType)}

${config.allowComponents}

${mode === 'generate' ? `<你的工作流程>
按照以下步骤完成prd(需求分析规格说明书)文件：
1、总体需求分析，详细分析用户需求，按以下格式进行整理
  <需求文档格式>
  *概述*
  [这里是对整体需求的概括和总结，用1-3句话来总结下内容]

  *设计规范*
  [这里定义设计风格，根据设计风格提供统一并且有层次感的设计token，比如颜色色值、圆角、间距、字体大小、边框、阴影等信息。
    注意：对于颜色的选取，遵循UI的取色方案，可以采用你知识库中常用的颜色集，比如莫兰迪色系、中国风色系、日本色系，以及各类ColorSpace这种取色网站的取色策略。
  ]
  
  *设计亮点*
  [这里根据设计风格，从样式和内容丰富度等角度来提供亮点建议。
    对于内容丰富度：在现有的UI区域展示更多的内容，体现丰富性。
      比如可以考虑左右不对称的信息展示，以及使用绝对定位添加一些标签、徽章来展示更多信息；
      比如可以多标题，图标和数字（数据）结合展示，提供更丰富的内容来源；
    对于样式丰富度：根据给定的设计风格，提供一些样式上的亮点。
      比如现代风，可以采用边框、毛玻璃、渐变色背景、幽灵按钮；
      比如科技风，可以采用渐变色背景、不同颜色文字；
      比如复古风格，可以采用无圆角、无边框体现厚重感；
      比如中国风，可以采用无边框无圆角提升厚重感，采用更符合中国风的宋体；
  ]

  *内容*
  [这里开始从上至下，从左到右来逐个区域拆解并分析内容，每一个区域的内容结构包含「功能、视觉、内容」三个部分]
  <单个区域示例>
  *顶部导航栏* [标题]
    *功能*：提供全站导航和快速入口，展示学校标识
    *视觉*：固定定位，左右通栏，不需要间距
    *内容*：[务必写清楚所有的区块内容，不可遗漏]
      - 左侧：学校logo（60*60px）+ 学校中英文名称（中文18px粗体、英文12px细体）
      - 中间：横向导航菜单，包含首页、学校概况、院系专业、招生就业、科学研究、校园生活、新闻动态等入口（字号14px、间距32px）
      - 右侧：搜索图标按钮 + 语言切换（中/EN）+ 登录入口按钮
    *交互*：[可能需要提供的组件间的交互逻辑]
  </单个区域示例>

  *参考风格*
  [这里提供一到两个相似产品的可参考建议]

  </需求文档格式>` : ''}
${mode === 'extract' ? `<你的工作流程>
按照以下步骤完成prd(需求分析规格说明书)文件：
  1、总体需求分析，详细分析用户需求，按以下格式进行整理<需求文档格式>
    *分析*[从顶级到叶子，分层级从上往下，从左到右，按照树状结构提取拆分需求中的事实信息，同时告知这只是辅助信息]
    注意：
    - 按照行列逻辑合理进行拆分，拆分内容*分点*展示，文档中不要提及行列相关字眼；
      - 拆分内容分为两部分，总览的「根组件结构」+ 详细的「分区域结构」；
      - 分点逻辑：1.1、1.1.1 的格式代表1.1 是 1.1.1 的父级，保持树状结构的拆分，逐层展开直到每一个叶子结点，不能扳平话任何内容；
    - 基于图片事实分析，一比一提取信息，不得遗漏任何内容；

    *注意事项*[关于需求中的一些细节注意事项，防止后续遗漏]

    *风险*：[关注画布和图片尺寸不一致的风险，保证所有内容和设计稿客观事实一致，不要自由发挥]
    目标画布是${config.canvasWidth}*任意高度的尺寸，需要依据参考图片宽度（事实值，不要捏造）给出可能的风险，一般来说存在两种情况：
    如果是，图片宽度比画布大，那一定存在内容多大/过多溢出的情况，此时需要你发现并列出以下风险：
      - 风险分类一：自适应布局
        - 看起来间距相等、宽度相似的排列，在目标画布上，建议使用宽度固定的均分/网格布局来实现；
      - 风险分类二：避免遮挡
        - 内容丰富的卡片，考虑文本需要缩小到一个较小的值避免遮挡；
        - 兄弟元素的互相影响，比如居右有一个头像，文本居右但是在头像左侧，需要注意位置计算，文本不要遮挡到头像；
      - 风险分类三：错误的宽度
        - 设置宽度时，父节点及其上层节点的宽度（扣除各类间距），避免超出画布宽度；
    核心是大图片缩放后尺寸别溢出，小图片缩放后别留白。

    注意：需求文档禁止提及具体组件namespace。
  </需求文档格式>` : ''}
${mode === 'refactor' ? `<你的工作流程>
按照以下步骤完成prd(需求分析规格说明书)文件：
  1、总体需求分析，详细分析用户需求：
    1.1）首先，确定总体的功能，描述整体的概述信息
    
    其次，我们需要区分用户的目的。
    1.2 ）确定现状与实现路径等内容，其中：
    - 现状与实现路径(steps)：分析当前组件的现状或问题，以及达到目的的关键实现路径；
    `: ''}

    特别注意：
      - 你只需要客观事实地描述需求的实现过程即可，不允许出现直接的组件使用建议；
      - 斟酌你的用词，使用通用的名词（比如接口、逻辑计算）；
    
  2、根据需求分析，详细拆解所需要的组件，注意：
    - 根据业务类型选择合理的技术方案（类库、组件等），注意不要超出允许的范围；
    - 禁止主观臆造不存在的组件等，只能基于事实上提供的组件进行；
    - 组件选型不要想当然的认为英文的namespace就是语义化的，更多关注于中文描述和「何时使用」「注意事项」来判断应该使用什么组件。
  
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

${mode === 'refactor' ? `<examples>
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
    - 过多的信息可能导致名片显得杂乱，需合理取舍信息内容。 `,
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
`: ''}
${mode === 'extract' ? `<examples>
  <user_query>根据图片搭建页面</user_query>
  <assistant_response>
  好的，经过对图片的全面分析，我提供以下辅助信息：
  ${fileFormat({
    content: `
    **分析**
    从图片中从顶层到底层分析，可以分析出以下内容

    根组件结构：顶部固定区域、内容区域、底部区域，从上到下垂直排列

    分区域结构：
    1. 顶部固定区域：通栏导航，包含左侧logo + 公告，右侧个人信息区域
      1.2 左侧logo + 公告信息（喇叭图标 + ”这是一条公告“）；
      1.3 右侧个人信息区域：蓝色边框的头像 + 昵称，提供退出登录按钮；
    2. 内容区域：拆分成左右双列，左边自适应内容区域 + 右侧固定宽度的侧边栏
      2.1 左侧内容区域：从上到下包含筛选区域、推荐列表区域
        2.1.1 筛选区域：从上到下的分类标签(地区列表、物流列表、评分列表) + 右侧搜索按钮
        2.1.2 推荐列表区域：垂直一行一列的推荐卡片列表
          2.1.2.1 推荐卡片：商品图片 + 价格（划线价 + 到手价）+ 补贴标签，右侧提供加购按钮
      2.2 右侧侧边栏区域：从上到下包含推荐热榜、个人信息区域
        2.2.1 推荐热榜：顶部的“大家都在搜” + “换一换”按钮，内容为各类商品的榜单列表，商品仅包含缩略图和到手价和实时热度小火苗；
        2.2.2 个人信息：包含浏览、收藏、关注等数据的数据卡片以及一个登录入口；
          2.2.2.1 数据卡片：核心指标 + 同比环比，以及上升下降的箭头；
          2.2.2.2 登录入口：包含gitub、google的图表列表 + 登录按钮；
    3. 底部区域：固定的底部内容，包含左侧的价格计算和右侧的支付按钮；
      3.1 价格计算区域：包含优惠价、到手价、以及优惠明细的入口；
      3.2 支付区域：支付按钮 + 总计数量；
    
    **注意事项**
    注意以下细节：
    - 截图中的总体背景没有意义，可以考虑去掉；
    - 注意各区块间距，顶部通栏就不要使用外间距了；
    - 卡片中字体内容较丰富，注意字体大小，不要换行和重叠；
    - 图片中的电话区域选择与输入手机号为一体设计、整体圆角；
    - 个人信息区域的登录按钮为蓝色，按钮文字为白色；

    **风险**
    参考图片宽度为720像素，目标画布宽度为375像素，我们需要对元素尺寸进行合理的缩放，所以在搭建时需要注意内容不要溢出画布，主要关注以下部分：
    1. 快捷入口区域为两行四列的网格均分布局，两行使用换行来实现，同时导航需要考虑固定宽度，避免超出画布；
    2. 套餐列表中卡片的内容信息较丰富，建议固定宽高，同时将文本字体减少至10px;
    3. “适合各种商业咨询的套餐”为动态内容，注意配置文本字体极小，并且配置溢出能力，避免换行；
    4. 底部居左部分内容宽度缩小后会超过一半，注意将字体调整至极小，避免遮挡右侧内容；
    5. 右侧图标 + 文本横向排列时，注意文本宽度，防止遮挡图标；`,
      fileName: '还原页面需求文档.json'
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
      "namespace": "mybricks.somelib.button"
    }
  ]`,
    fileName: '需要的组件信息.json'
  })}
    </assistant_response>
  </example>
</examples>` : ''}
${mode === 'generate' ? `<examples>
${config.examples}
<example>`: ''}

`
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
        llmContent: `<需求文档>
---
${prdFile?.name}
---
${mode === 'extract' ? '从图片中我分析出这些信息辅助搭建，请注意信息只用于概览和辅助，大概率有内容缺失，最终严格以图片的内容进行处理。' : ''}

${prdFile?.content}
</需求文档>`,
        displayContent
      }
    },
  }
}