import { fileFormat } from '@mybricks/rxai'

interface GetComponentsDocAndPrdToolParams {
  allowComponents: string;
  examples: string;
  canvasWidth: string;
  queryComponentsDocsByNamespaces: (
    namespaces: [{ namespace: string }],
  ) => string;
}

export default function getComponentsDocAndPrd(config: GetComponentsDocAndPrdToolParams, ): Tool {
  return {
    name: 'get-components-doc-and-prd',
    description: `整理或扩写需求 + 按需获取组件文档，是各类组件操作（页面搭建、页面修改）的前置操作。
前置要求：用户提出过需求
参数：用户需求
返回值：需求分析规格说明书（PRD）文件 + 组件使用/配置文档；`,
    aiRole: "expert",
    getPrompts: () => {
        return `<工具总览>
你是一个获取组件文档和用户需求的工具，你作为MyBricks低代码平台（以下简称MyBricks平台或MyBricks）的资深页面搭建助手，拥有专业的产品经理能力。
你的任务是根据「允许使用的组件及其说明」，整理或扩写用户的需求（如果有图片附件、需要参考图片中的内容，对图片详细理解），并将需求中可能用到的组件列出来整理成「需求文档」和「组件使用文档」。

提示：MyBricks是用来通过AI+可视化搭建的方式生成各类应用的生产力工具，用户可以与AI沟通、让AI搭建完成一部分内容，以及通过拖拽、配置等方式，快速搭建出各类应用。
</工具总览>

<任务流程>
  根据「用户需求」和「搭建上下文」，按照以下格式返回内容：
    ${fileFormat({ content: '(需求分析规格说明书的内容)', fileName: 'XX需求文档.md' })}
    
    ${fileFormat({ content: '(搭建所需要的组件选型)', fileName: 'XX需求组件选型.json' })}
    - 注意：require类型文件要严格按照JSON格式返回，注意不要出现语法错误；
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

    其次，我们需要区分用户的目的是「还原设计稿/图片效果」还是「根据自然语言/原型文件/草稿生成应用」，在「还原设计稿/图片效果」下，需要关注画布和设计稿图片的尺寸风险。
    1.2 ）确定设计风格、布局和内容、颜色样式、文案内容、特别注意事项、风险提示等内容，其中：
    - 设计风格(themes)：包括风格、色系、字号等，总体按照现代简洁、扁平化、美观大方的原则，注意色彩结构紧凑、搭配合理、字体清晰；
    - 布局和内容(layout)：总体的布局结构，以及各个区块内的元素位置、视觉、亮点等；
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
      > 如果是「根据自然语言/原型文件/草稿生成应用」，关注需求细节不要遗漏的风险；

    > 特别注意：
      - 你只需要客观事实地描述需求的元素排列即可，可以告知用户风险，不允许出现直接的布局建议以及组件使用建议（比如flex布局、弹性布局，比如使用XX组件，比如CSS代码）；
      - 斟酌你的用词，使用通用的名词（比如卡片、内容、文本、图片、图标），禁止使用带有语义的名词（比如选项卡，会被误解成某个组件）来描述元素；
    
  2、根据需求分析，详细拆解所需要的组件，注意：
    - 根据业务类型选择合理的技术方案（类库、组件、图标等），注意不要超出允许的范围；
    - 禁止主观臆造不存在的组件等，只能基于事实上提供的组件进行；
    - 组件选型不要想当然的认为英文的namespace就是语义化的，更多关注于中文描述和「何时使用」「注意事项」来判断应该使用什么组件。
  
  接下来，根据上述分析，按照以下格式返回内容：
  \`\`\`md type="prd" file="XX需求文档.md"
    (需求分析规格说明书的内容)
  \`\`\`
  
  \`\`\`json type="require" file="XX需求组件选型.json"
    (搭建所需要的组件选型)
  \`\`\`
  
  注意：require.json文件要严格按照JSON格式返回，注意不要出现语法错误；
  
</你的工作流程>


<examples>
${config.examples}
</examples>
`
      },
    execute({ files, content }) {
      let prdFile: File | undefined = undefined, requireComsFile: File | undefined = undefined;
      Object.keys(files).forEach((fileKey) => {
        const file: File = files[fileKey] as File;
        if (file.extension === 'md') {
          prdFile = file
        }

        if (file.extension === 'json') {
          requireComsFile = file
        }
      })

      let requireComponents = [];
      try {
        requireComponents = JSON.parse(requireComsFile?.content);
      } catch (error) {}
      const requireComponentsDocs = config.queryComponentsDocsByNamespaces(requireComponents);
        return `<需求文档>
---
${prdFile?.name}    
---

${prdFile?.content}
</需求文档>

<允许使用的组件知识库文档>
---
${requireComsFile?.name}    
---

${requireComponentsDocs}

</允许使用的组件知识库文档>`
    },
  }
}