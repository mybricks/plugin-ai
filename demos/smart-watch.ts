import { fileFormat, agentPlugin, MyBricksTools, Agent } from '@mybricks/plugin-ai'

export default ({ requestAsStream, user, key, guidePrompt }: any) => agentPlugin({
  name: '智能表盘助手',
  agents: [
    Agent({
      goal: '主要处理智能穿戴设备表盘搭建相关的问题，帮助用户完成表盘设计需求',
      attentions: `<对于当前搭建有以下特殊上下文>
<搭建画布信息>
  当前正在搭建各类智能穿戴设备的表盘，画布的宽度和高度我们限制为466*466，所有内容必须使用*绝对定位*布局绘制到画布上。
  
  注意：搭建时，必须先将画布根组件设置为绝对定位和具体的宽高。
</搭建画布信息>
</对于当前搭建有以下特殊上下文>`,
      tools: [
        MyBricksTools.AnalyzeRequirementAndComponents(),
        MyBricksTools.GenerateUiContent({
          fewShots: generateFewShots(),
        })
      ]
    })
  ],
  key,
});

function generateFewShots() {
  return `<example>
  <user_query>搭建一个科技风表盘</user_query>
  <assistant_response>
    好的，我们来实现一个科技风的表盘，搭建过程如下：
    1. 首先，必须配置合理的表盘宽度和高度、标题、布局以及样式；
    2. 其次搭建各类元素，将各类表盘元素放置到合适的位置；

    ${fileFormat({
      content: `["_root_",":root","setLayout",{"height": 466, "width": "466"}]
    ["_root_",":root","doConfig",{"path":"root/标题","value":"科技风表盘"}]
    ["_root_",":root","doConfig",{"path":"root/布局","value":{"position": "absolute"}}]
    ["_root_",":root","doConfig",{"path":"root/样式","value":{"background":"linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 50%, #16213e 100%)"}}]
    ["_root_","_rootSlot_","addChild",{"title":"电池图标显示","ns":"somelib.battery","comId":"u_digital_time","layout":{"position":"absolute","top":10,"left":300},"configs":[]}]
    `,
      fileName: '生成科技风表盘操作步骤.json'
    })}

    注意：
    - 表盘所有元素必须由自由布局绘制而成；
    - 所有定位都直接计算，不允许使用transform；
  </assistant_response>
  </example>`
}