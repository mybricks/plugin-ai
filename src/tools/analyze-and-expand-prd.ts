import { fileFormat, RequestError } from '@mybricks/rxai'
import { getFiles } from './utils'

interface AnalyzeAndExpandPrdParams {
  onProjectCreate: (projectJson: any) => void,
  demo?: any,
  deviceType?: 'desktop' | 'mobile'
}

const NAME = 'analyze-and-expand-prd'
analyzeAndExpandPrd.toolName = NAME

export default function analyzeAndExpandPrd(config: AnalyzeAndExpandPrdParams): any {
  const {
    demo = {
      title: '本地生活APP',
      pages: [
        {
          title: '首页',
          prd: `目的：诱导用户进行点击，完成商品转化
        需求概述：包含搜索功能、导航入口、活动轮播和商品推荐等模块`,
        },
        {
          title: '精选活动',
          prd: `目的：展示平台的优惠活动，吸引用户进行购买
        需求概述：包含一级分类、优惠活动、限时秒杀和商品列表等模块`,
        },
        {
          title: '商品详情',
          prd: `目的：展示的详细信息，诱导用户进行下单购买
        需求概述：包含商品图片、价格模块、规格选择、评价和推荐等模块`,
        },
        {
          title: '我的',
          prd: `目的：提供对个人信息的查看以及修改界面
        需求概述：包含个人信息、会员信息、订单模块、各类导航入口等模块`,
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
    }
  } = config ?? {}
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
</特别注意>

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
      - 如何拓展？
        - "一个简历页面" -> "一个个人简历页面，包含个人介绍、技能特长、项目经历、联系方式等模块的页面"
        - "实现用户管理系统" -> "
          一个用户管理系统，包含以下页面：
          - 登录页面
          - 用户列表页面
          - 新增用户页面
          - 删除用户页面"
    - 如果需求较为详实，则整理之后，在满足用户需求的基础上，适当补充细节并整理成页面维度的需求
      - 如何定义需求较为详实？例如 "一个包含导航、公司介绍、公司优势、页脚的公司官网"，这种对内容有定义的需求就无需拓展
    注意：
    - 由于我们不能实现太复杂的需求，需要控制拓展需求的规模，拓展不要超过7个页面
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
    - 参考建议很重要，可以给出一些常见APP的风格化参考，借鉴市面上成熟应用的设计风格
    - 范围：目前限制在颜色、字体样式（不包含字体）、阴影和圆角这些基础UI细节，不要考虑视差滚动这类复杂样式
    - 不要提供针对组件维度的样式建议，要从需求维度去建议
    - 如果用户自己提了风格化主题相关需求，整理扩展即可
  </任务三>
</处理流程>

<examples>
  <example>
    <user_query>一个本地生活APP</user_query>
    <assistant_response>
      好的，即将为你生成一个关于一个本地生活APP的页面。

      这是我的思考结果：
      由于当前信息较少，我们来扩写下需求，一个本地生活APP，一般包含「首页」、「分类页」、「商家详情页」、「个人中心页」等界面。

      从需求来看，我觉得可以给应用起「本地生活APP」这个标题。

      同时作为我也会给出我的组件建议和设计规范。

      最终我们应该返回这样的结构
      ${fileFormat({
        content: JSON.stringify(demo, null, 2),
        fileName: '本地生活APP项目需求文档.json'
      })}
    </assistant_response>
  </example>
</examples>`;
    },
    aiRole: 'architect',
    // aiRole: "expert",
    execute({ files, content }) {
      let errorContent;
      try {
        errorContent = JSON.parse(content)
      } catch (error) {}
      if (errorContent && errorContent?.message) {
        throw new RequestError(`网络错误，${errorContent?.message}`)
      }
      
      const projectFile = getFiles(files, { extName: 'json' });
      let projectJson = {}
      try {
        projectJson = JSON.parse(projectFile?.content)

        if (projectJson?.pages?.length) {
          projectJson.pages = projectJson.pages.map(page => {
            return {
              ...page,
              prd: page.prd + '\n' + '注意：当前需求仅为需求概述，分析和实现时请多补充内容和细节。'
            }
          })
        }
      } catch (error) {

      }
      config.onProjectCreate(projectJson)
      return content;
    },
    streamThoughts: true
  };
}