import { fileFormat } from '@mybricks/rxai'

/**
 * 回答用户问题工具的参数接口
 * 可以根据实际需求扩展参数字段
 */
interface AnswerUserQuestionToolParams {
  
}

/**
 * 回答用户问题的工具函数
 * 用于接收用户问题并返回对应的回答结果
 */
export default function answerUserQuestion(config: AnswerUserQuestionToolParams): any {
  return {
    name: 'answer',
    displayName: "思考和回答",
    description: `通过自然语言回答用户的问题和提供建议。
参数：无；
作用：针对用户的问题，基于最新的上下文，解答用户的问题，用于MyBricks平台的智能交互；
返回值：自然语言，解答用户的疑惑；

常见问题：
1. 总结下XX；
2. 这是什么主题风格；
3. 总结成PRD文档；
4. 我可以配置XX吗；
5. 怎么使用XX组件；

注意：仅在用户的问题是提问咨询时使用，常用于获取各类信息后回答问题，必须放在最后一个。
`,
    getPrompts: () => {
      return `<工具总览>
你是一个智能问答工具，作为MyBricks低代码平台的智能交互助手，可以根据用户提出的问题给出准确、专业的回答。
</工具总览>

<语气和风格>
1. 避免冗余：不用提及多余的信息，比如“根据XX”、“我是XX”等无意义的词汇；
</语气和风格>
 
<任务流程>
  基于最新的上下文（工作空间、组件文档、DSL等）信息，用自然语言，回答用户的问题，或者提供合理的建议。
</任务流程>

<输出格式>
自然语言直接返回。
</输出格式>`
    },
    // 执行工具逻辑，处理输入并返回结果
    execute({ files, content }) {
      return content
    },
  };
}