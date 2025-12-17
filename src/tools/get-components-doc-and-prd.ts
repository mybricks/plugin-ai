import { fileFormat, RequestError, ToolError } from '@mybricks/rxai'
import { getFiles, stripFileBlocks, jsonSafeParse } from './utils'

interface GetComponentsDocAndPrdToolParams {
  allowComponents: string;
  examples: string;
  canvasWidth: string;
  onComponentDocOpen: (ns: string) => void;
  shouldUseExpert?: boolean
}

const NAME = 'generate-prd-and-require-component'
getComponentsDocAndPrd.toolName = NAME

export default function getComponentsDocAndPrd(config: GetComponentsDocAndPrdToolParams,): any {
  let displayContent = "";
  return {
    name: NAME,
    displayName: "分析当前需求",
    description: `分析/扩写需求 + 组件选型，针对用户的搭建需求（可能是文本，一句话、图片附件、文件附件等需求）生成需求文档，并且分析可能使用到的组件。
参数(mode)：模式，可选择的值有 generate 和 refactor 两种：
  - generate模式：表示从无到有生成新的需求，后面往往使用「生成页面」工具
  - refactor模式：表示分析现有的上下文来对现有内容进行优化、调整，后面往往使用「修改组件」工具；
工具分类：信息获取类
前置要求：用户提出过搭建需求（可能是文本，一句话、图片附件、文件附件等需求）
返回值：需求分析规格说明书（PRD）文件 + 组件选型；`,
    aiRole: 'expert',
    // lastAppendMessage: '需求已分析完成，请继续完成用户需求。',
    getPrompts: ({ params }) => {
      const isRefactor = params?.mode === 'refactor';

      return `<工具总览>
你是一个获取组件文档和用户需求的工具，你作为MyBricks低代码平台（以下简称MyBricks平台或MyBricks）的资深页面搭建助手，拥有专业的产品经理能力。
你的任务是根据「允许使用的组件及其说明」，整理或扩写用户的需求（如果有图片附件、需要参考图片中的内容，对图片详细理解），并将需求中可能用到的组件列出来整理成「需求文档」和「组件使用文档」。

提示：MyBricks是用来通过AI+可视化搭建的方式生成各类应用的生产力工具，用户可以与AI沟通、让AI搭建完成一部分内容，以及通过拖拽、配置等方式，快速搭建出各类应用。
</工具总览>

<任务流程>
  根据「用户需求」和「搭建上下文」，按照以下格式返回内容：
    ${fileFormat({ content: '(需求分析规格说明书的内容，需求说明书仅允许使用列表和加粗，斜体语法)', fileName: 'XX需求文档.md' })}
    
    ${fileFormat({ content: '(搭建所需要的组件选型)', fileName: 'XX需求组件选型.json' })}
    - - 注意：文件内容注意不要出现语法错误，文件声明要保持一致；
</任务流程>


<允许使用的组件及其说明>

${config.allowComponents}

  注意：
    - 以上是允许使用的组件及说明，包括了 title、type、namespace、description等信息；
    - 在回答各类问题或者搭建页面时，只能使用上述范围的组件，禁止臆造内容；
</允许使用的组件及其说明>
    
</MyBricks组件>

<你的工作流程>
  按照以下步骤完成prd(需求分析规格说明书)文件：
  1、总体需求分析，详细分析用户需求：
    1.1）首先，确定总体的功能，描述整体的概述信息

    ${isRefactor ? `其次，我们需要区分用户的目的是「还原设计稿/图片效果」还是「根据自然语言/原型文件/草稿生成」，在「还原设计稿/图片效果」下，需要关注画布和设计稿图片的尺寸风险。
    1.2 ）确定现状与实现路径、设计风格、布局和内容、颜色样式、文案内容等内容，其中：
    - 现状与实现路径(steps)：分析当前组件的现状或问题，以及达到目的的关键实现路径；
    - 设计风格(themes)：包括风格、色系、字号等，注意色彩结构紧凑、搭配合理、字体清晰；
    - 布局和内容(layout)：总体的布局结构，以及各个区块内的元素位置、视觉、亮点等，优先采用组件原有的布局方式；
    - 颜色样式(colors)：考虑主色调、辅助色调、背景颜色、字体颜色、按钮颜色、边框颜色等；
    ` : `其次，我们需要区分用户的目的是「还原设计稿/图片效果」还是「根据自然语言/原型文件/草稿生成」，在「还原设计稿/图片效果」下，需要关注画布和设计稿图片的尺寸风险。
    1.2 ）确定设计风格、布局和内容、颜色样式、文案内容、特别注意事项、风险提示等内容，其中：
    - 设计风格(themes)：包括风格、色系、字号等，总体按照现代简洁、扁平化、美观大方的原则，注意色彩结构紧凑、搭配合理、字体清晰；
    - 布局和内容(layout)：总体的布局结构，以及各个区块内的元素位置、视觉、亮点等，优先采用Flex布局方式；
    - 颜色样式(colors)：考虑主色调、辅助色调、背景颜色、字体颜色、按钮颜色、边框颜色等；
    - 特别注意事项(attention)：界面中的一些设计细节，例如背景、定位、圆角、特别的图标等；
    - 风险提示(risk)：
      > 如果是「还原设计稿/图片效果」，关注画布和图片尺寸不一致的风险；
        目标画布是${config.canvasWidth}*任意高度的尺寸，需要依据参考图片宽度（事实值，不要捏造）给出可能的风险，一般来说存在两种情况：
          如果是，图片宽度比画布大，那一定存在内容多大/过多溢出的情况，此时需要你发现并列出以下风险：
            - 风险分类一：自适应布局
              - 看起来间距相等、宽度相似的排列，在目标画布上，建议使用宽度固定的均分/网格布局来实现；
            - 风险分类二：避免遮挡
              - 内容丰富的卡片，考虑文本需要缩小到一个较小的值避免遮挡；
              - 兄弟元素的互相影响，比如居右有一个头像，文本居右但是在头像左侧，需要注意位置计算，文本不要遮挡到头像；
            - 风险分类三：错误的宽度
              - 设置宽度时，父节点及其上层节点的宽度（扣除各类间距），避免超出画布宽度；
          如果是，图片宽度比画布小，那一定存在留白的情况，此时需要你发现并列出以下风险：
            - 风险分类一：自适应布局
              - 看看起来间距相等、宽度相似的排列，在目标画布上，建议使用宽度固定的均分/网格布局来实现；
          主要是大图片缩放后尺寸别溢出，小图片缩放后别留白。
      > 如果是「根据自然语言/原型文件/草稿生成」，关注需求细节不要遗漏的风险；`}

    > 特别注意：
      - 你只需要客观事实地描述需求的元素排列即可，可以告知用户风险，不允许出现直接的布局建议以及组件使用建议（比如flex布局、弹性布局，比如使用XX组件，比如CSS代码）；
      - 斟酌你的用词，使用通用的名词（比如卡片、内容、文本、图片、图标），禁止使用带有语义的名词（比如选项卡，会被误解成某个组件）来描述元素；
    
  2、根据需求分析，详细拆解所需要的组件，注意：
    - 根据业务类型选择合理的技术方案（类库、组件、图标等），注意不要超出允许的范围；
    - 禁止主观臆造不存在的组件等，只能基于事实上提供的组件进行；
    - 组件选型不要想当然的认为英文的namespace就是语义化的，更多关注于中文描述和「何时使用」「注意事项」来判断应该使用什么组件。
  
  接下来，根据上述分析，按照以下格式返回内容：
  ${fileFormat({ content: '(需求分析规格说明书的内容，需求说明书仅允许使用列表和加粗，斜体语法)', fileName: 'XX需求文档.md' })}
  
  ${fileFormat({ content: '(搭建所需要的组件选型)', fileName: 'XX需求组件选型.json' })}
  
  注意：require.json文件要严格按照JSON格式返回，注意不要出现语法错误；
  
</你的工作流程>

${isRefactor
  ? `<examples>
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
` : `<examples>
${config.examples}
</examples>`}
`
    },
    stream({ files, status, replaceContent }) {
      return displayContent = files.reduce((replaceContent, file) => {
        return replaceContent.replace(file.fileName, file.extension === "md" ? file.content : "");
      }, replaceContent)
    },
    execute({ files, content }) {
      let errorContent;
      try {
        errorContent = JSON.parse(content)
      } catch (error) { }
      if (errorContent && errorContent?.message) {
        throw new RequestError(`网络错误，${errorContent?.message}`)
      }

      const prdFile = getFiles(files, { extName: 'md' });

      if (!prdFile?.content || prdFile?.content?.trim?.()?.length === 0) {
        throw new ToolError({
          llmContent: `未生成或者生成了错误的需求文档，请重试`,
          displayContent: '生成需求文档失败，请重试'
        })
      }

      const requireComsFile = getFiles(files, { extName: 'json' });

      let requireComponents = [];
      try {
        requireComponents = jsonSafeParse(requireComsFile?.content);
      } catch (error) {
        throw new ToolError({
          llmContent: `解析组件选型错误，请检查格式，${error?.message}`,
          displayContent: '生成组件需求失败，请重试'
        })
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
${prdFile?.content}
</需求文档>`,
        displayContent
      }
    },
  }
}