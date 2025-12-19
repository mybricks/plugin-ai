import { fileFormat, RequestError } from '@mybricks/rxai'
import { getFiles } from './utils'
import { getDevicePrompt } from './../preset/prompts'
import { DeviceType } from './../types'

interface AnalyzeAndExpandPrdParams {
  onProjectCreate: (projectJson: any) => void,
  demo?: any,
  deviceType: DeviceType
}

const NAME = 'analyze-and-expand-prd'
analyzeAndExpandPrd.toolName = NAME

export default function analyzeAndExpandPrd(config: AnalyzeAndExpandPrdParams): any {
  return {
    name: NAME,
    displayName: "对原始产品需求文档分析并扩写",
    description: `对用户提供的原始产品需求文档进行需求分析与扩写，最后拆分成不同的页面，输出结构化的结果。
参数：原始需求文档（可能是一句话、一个图片、甚至各种类型附件）
作用：将模糊、简略的需求转化为清晰、具体到每个页面、以及每个页面自上而下都有哪些具体的功能的详细描述，用于指导后续低代码搭建；
返回值：扩写后的结构化文档；`,
    getPrompts: () => {
      return `<工具总览>
你是MyBricks低代码平台（以下简称MyBricks平台或MyBricks）的资深搭建助手，经验丰富、实事求是、逻辑严谨。
  
  你需要根据用户提出的问题或需求，切换不同的身份，完成以下任务

  任务一：根据【用户需求】，作为产品经理，为用户合理整理或者拓展需求，返回整理好的需求；
  任务二：根据【用户需求】，作为产品经理，为用户提供一个应用的标题，言简意赅，不多于10个字；
  任务三：根据【用户需求】和【拓展需求】，作为设计师，为用户提供样式设计参考；
</工具总览>

<特别注意>
  - 对话可能由多轮构成，每轮对话中，用户会提出不同的问题或给与信息补充，你需要根据用户的问题、逐步分析处理。
  - 你所面向的用户是MyBricks平台上的用户，这些用户不是专业的开发人员，因此你需要以简洁、易懂的方式，回答用户的问题。
  - 如果附件中有图片，请在设计开发中作为重要参考，进行详细的需求及设计分析，当作用户的需求。
  - 你的回答面向的是非专业开发人员，请务必使用**简洁、易懂、口语化**的语言。
</特别注意>

${getDevicePrompt(config.deviceType)}

<遵循原则>
你要切换不同的角色来完成一个需求的设计和开发，同时特别注意，生成的页面数量不得超过3个。
</遵循原则>

<处理流程>
  根据你的角色定义来完成以下任务，汇总给出一个Json
  <任务一>
  角色：产品经理
  工作任务：梳理需求，并且分析总共需要几个页面来承接这个系统
  返回内容：每个页面的名称以及需求
  对应字段：页面字段中的title以及prd
  返回规则：
    - 如果是一句话需求，从上到下梳理并拓展需求，并整理成页面维度的需求
      - 如何定义一句话需求？例如 "一个简历页面" "实现用户管理系统" "一个首页"
      - 如何拓展？拓展是仅分析功能模块就行，不要具体到细节，同时补充一下“不止于这些模块”的描述性词汇，告知这只是简略的需求，可以补充更多内容
        - "一个简历页面" -> "一个个人简历页面，包含个人介绍、技能特长、项目经历、联系我等模块的页面"
        - "实现用户管理系统" -> "
          一个用户管理系统，包含以下页面：
          - 登录页面
          - 用户列表页面
          - 新增用户页面
          - 删除用户页面"
    - 如果需求较为详实，比如附件中图片和文档可以提取出完整的需求，则整理之后，在满足用户需求的基础上，适当补充细节并整理成页面维度的需求
      - 如何定义需求较为详实？例如 "一个包含导航、公司介绍、公司优势、页脚的公司官网"，这种对内容有定义的需求就无需拓展
    注意：
    - 由于我们不能实现太复杂的需求，需要控制拓展需求的规模，拓展不要超过3个页面
    - 需求仅围绕UI的实现来拓展，不要涉及多语言、服务端、逻辑、SEO、打印、截图、动画，以及一些复杂交互的周边能力，我们仅关注UI部分
  </任务一>

  <任务二>
  角色：产品经理
  返回内容：总结的应用标题，言简意赅，不超过10个字
  对应字段：title
  </任务二>

  <任务三>
  角色：设计师
  返回内容：给出设计规范的建议，范围局限于颜色和样式，和参考建议。不提供任何需求和布局方面的信息，风格化信息是给到下一轮大模型的提示词，提供建议即可。
  对应字段：style
  返回规则：
    - 颜色系统很重要，需要给出主色、背景色、文本颜色、二级颜色的建议，并给出具体的颜色值。禁止使用太鲜艳或者太浅的颜色值。不要把点缀色或者操作色用于大面积的元素，例如按钮、卡片背景等。
    - 样式系统很重要，需要给出圆角、间距的建议，并给出具体的数值
    - 参考建议很重要，可以给出一些风格化参考，借鉴市面上成熟项目的设计风格
    - 范围：目前限制在颜色、字体样式（不包含字体）、阴影和圆角这些基础UI细节，不要考虑视差滚动这类复杂样式
    - 不要提供针对组件维度的样式建议，要从需求维度去建议
    - 如果用户自己提了风格化主题相关需求，整理扩展即可
  </任务三>
</处理流程>

<回答、输出流程>
**第一步：深度思考与需求分析（以Markdown格式呈现）**
在给出正式方案前，你必须先输出一个详细的“**思考过程**”部分。这部分的目标是让用户完全理解你的设计思路。请按照以下结构组织：
1.  **需求解读**：用一两句话复述并理解用户的核心意图。
2.  **页面规划逻辑**：
    *   说明你计划设计哪几个页面（如首页、详情页、个人中心）。
    *   **为每个页面解释“为什么”**：例如，“因为电商项目的核心流程是‘浏览->查看->购买’，所以我们需要首页（用于浏览发现）、商品详情页（用于决策）、个人中心页（用于管理订单和购物车）”，同时可以列出目的和需求，最好能与最终的json结构保持一致。
    *   可以制作一个简单的表格来对比各页面的核心目标和主要功能。
    *   内容尽量丰富
3.  **设计风格构思**：
    *   简要说明你为这个应用设定了怎样的视觉风格（如“现代简约的科技感”、“温暖亲和的社区感”）。
    *   解释颜色选择的原因（如“主色选用蓝色，传递信任与专业感”）。
    *   内容尽量丰富

**第二步：输出结构化方案（以JSON格式呈现）**
在“思考过程”之后，输出一个名为\`“【应用标题】项目需求文档.json”\`的JSON代码块。json格式参考<examples>提供的格式。

**注意**：
 - “思考过程”直接输出即可，不要以一个标题的形式展现出来，否则对话比较割裂，不自然。
</回答、输出流程>

<examples>
  ${getExampleByDeviceType(config.deviceType)}
</examples>`;
    },
    aiRole: 'architect',
    // aiRole: "expert",
    stream(params: any) {
      const { files, replaceContent } = params;
      const file = files[0];
      if (file) {
        return replaceContent.replace(file.fileName, "正在编写需求文档...");
      }
      return replaceContent;
    },
    execute(params: any) {
      const { files, content, replaceContent } = params;
      let errorContent;
      try {
        errorContent = JSON.parse(content)
      } catch (error) { }
      if (errorContent && errorContent?.message) {
        throw new RequestError(`网络错误，${errorContent?.message}`)
      }

      const projectFile: any = getFiles(files, { extName: 'json' });
      let projectJson: any = {}
      try {
        projectJson = JSON.parse(projectFile?.content)

        if (projectJson?.pages?.length) {
          projectJson.pages = projectJson.pages.map(page => {
            return {
              ...page,
              prd: page.prd + '\n' + '注意：当前需求仅为功能点概述，分析和实现时请多补充内容和细节。'
            }
          })
        }
      } catch (error) {

      }

      config.onProjectCreate(projectJson);

      if (!projectFile) {
        return content;
      } else if (!projectJson.title) {
        return replaceContent + `\n未生成合法项目文件。`
      }
      return replaceContent.replace(projectFile.fileName, "");
    },
  };
}

function getExampleByDeviceType(deviceType: DeviceType) {
  if (deviceType === DeviceType.Desktop) {
    return `
  <example>
    <user_query>一个本地生活APP</user_query>
    <assistant_response>
      好的，即将为你生成一个关于一个本地生活APP的项目需求文档。

      这是我的思考结果：
      由于当前信息较少，我们来分析下需求，一个本地生活APP，一般包含「首页」、「精选活动」、「商品详情」、「我的」等界面。

      从需求来看，我觉得可以给应用起「本地生活APP」这个标题。

      同时作为我也会给出设计规范。

      最终我们应该返回这样的结构
      ${fileFormat({
      content: JSON.stringify({
        title: '本地生活APP',
        pages: [
          {
            title: '首页',
            prd: `目的：诱导用户进行点击，完成商品转化
        功能点：包含搜索功能、导航入口、活动轮播和商品推荐等模块`,
          },
          {
            title: '精选活动',
            prd: `目的：展示平台的优惠活动，吸引用户进行购买
        功能点：包含一级分类、优惠活动、限时秒杀和商品列表等模块`,
          },
          {
            title: '商品详情',
            prd: `目的：展示的详细信息，诱导用户进行下单购买
        功能点：包含商品图片、价格模块、规格选择、评价和推荐等模块`,
          },
          {
            title: '我的',
            prd: `目的：提供对个人信息的查看以及修改界面
        功能点：包含个人信息、会员信息、订单模块、导航入口等模块`,
          }
        ],
        style: `使用美团成熟的颜色系统是一个不错的选择
        - 颜色
        - 主颜色：美团黄 #FFD100
        - 背景色：浅灰色 #F7F7F7
        - 文本颜色：不全黑的黑色 #272727 可用于主要的文本（禁止使用 #000000，会导致无设计感）
        - 二级颜色：灰色 #A6A6A6 可用于边框或者浅色文本
        - 样式
        - 圆角：12px，增加柔和感
        - 间距：16px
        同样的，你也可以参考一些常见的软件，比如美团和饿了么的元素设计。注意颜色不要太浅，也不要太鲜艳，按钮等比较大块的元素禁止使用点缀色`
      }, null, 2),
      fileName: '本地生活APP项目需求文档.json'
    })}
    </assistant_response>
  </example>`
  } else if (deviceType === DeviceType.Mobile) {
    return `
  <example>
    <user_query>一个问答社区网站</user_query>
    <assistant_response>
      好的，即将为你生成一个关于一个问答社区网站的项目需求文档。

      这是我的思考结果：
      由于当前信息较少，我们来分析下需求，一个问答社区网站，一般包含「首页」、「问答详情」、「我的主页」等界面。

      从需求来看，我觉得可以给应用起「问答社区网站」这个标题。

      同时作为我也会给出设计规范。

      最终我们应该返回这样的结构
      ${fileFormat({
      content: JSON.stringify({
        title: '问答社区网站',
        pages: [
          {
            title: '首页',
            prd: `目的：引导用户进行问答内容的互动，推荐用户喜欢的问答内容
        功能点：包含搜索、导航、热榜、推荐等模块`,
          },
          {
            title: '问答详情',
            prd: `目的：展示问答的详细信息，引导用户进行互动，并且对不同对回答进行点赞
        功能点：包含问题、不同用户回答、是否赞同等核心模块`,
          },
          {
            title: '我的主页',
            prd: `目的：提供对个人信息的查看以及互动界面
        功能点：包含个人信息、会员信息、我的回答、点赞、创作数据等核心功能`,
          }
        ],
        style: `使用知乎成熟的颜色系统是一个不错的选择
        - 颜色
        - 主颜色：知乎蓝 #1772f6
        - 背景色：浅灰蓝色 #f4f6f9
        - 文本颜色：不全黑的黑色 #272727 可用于主要的文本（禁止使用 #000000，会导致无设计感）
        - 二级颜色：灰色 #A6A6A6 可用于边框或者浅色文本
        - 样式
        - 圆角：2px，严谨又不失柔弱
        - 间距：16px
        同样的，你也可以参考一些其他常见的网站，比如知乎和思否的设计。注意取色和设计必须有设计感`
      }, null, 2),
      fileName: '问答社区网站需求文档.json'
    })}
    </assistant_response>
  </example>`
  }
}