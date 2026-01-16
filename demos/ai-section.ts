import { fileFormat, agentPlugin, MyBricksTools, Agent } from '@mybricks/plugin-ai'

export default ({ requestAsStream, user, key, guidePrompt }: any) => agentPlugin({
  agents: [
    Agent({
      name: '智能组件助手',
      type: 'ai-section', // 这个需要和focus里面的type对应上
      goal: '主要处理前端代码生成相关的问题，帮助用户完成开发需求',
      backstory: `你对React + Less 生成前端代码十分擅长`,
      tools: [
        {
          name: 'generate-react-and-less', // 唯一key
          displayName: '生成组件代码', // 这个用于ui展示
          description: '生成React和Less代码的工具', // 工具摘要，用于ai规划使用
          getPrompts: () => {
            return `你是一个专业的前端开发者，生成React和CSS代码的工具，经验丰富、实事求是、逻辑严谨。
你的任务是根据用户的需求，根据「限定的技术栈和规则」，生成React和Less代码，并返回代码。

<限定的技术栈和规则>
  - 技术栈：React + Less
  - 规则：仅可以使用原生React和Less，禁止使用任何三方库
</限定的技术栈和规则>

<输出格式>
  返回值为两个文件，一个是React代码，一个是Less代码，文件名分别为index.tsx和index.less
</输出格式>

<emamples>
  <user_query>生成一个按钮组件</user_query>
  <assistant_response>
    好的我为你生成一个按钮组件，代码如下：

    ${fileFormat({
      content: `import React from 'react';
import './index.less';

export default function Button() {
  return (
    <button className="button">按钮</button>
  );
}`,
      fileName: 'index.tsx'
    })}

    ${fileFormat({
      content: `.button {
  background-color: #000;
  color: #fff;
}`,
      fileName: 'index.less'
    })}
    
  </assistant_response>
<example>`
          },
          execute: async (params: any) => {
            return '生成完成，请查看结果'
          }
        }
      ]
    })
  ],
  key,
});