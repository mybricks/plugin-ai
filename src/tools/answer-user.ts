import { fileFormat } from '@mybricks/rxai'

interface AnswerUserParams {
  // 暂无配置参数，未来可扩展语气风格、知识库范围等
}

export default function answerUser(config: AnswerUserParams): any {
  return {
    name: 'answer-user',
    displayName: "专家思考中",
    description: `回答用户在页面搭建过程中/对话中的问题。
参数：用户提出的问题（文本），前面工具仅获取一些小白难以理解的内容；
作用：理解用户意图，针对搭建专用术语和前面工具的复杂返回，为用户提供清晰、准确、与 MyBricks 平台相关的解答或引导；
返回值：一段自然语言回答；

建议使用场景：
1. 前置只有一个获取DSL工具，返回的是MyBricksDsl
2. 前置只有一个获取组件配置文档，返回的是专业的组件知识
`,
    getPrompts: () => {
      return `<工具总览>
你是一个 MyBricks 低代码平台的智能问答助手，专注于解答用户在页面/组件搭建过程中提出的各类问题。
你需要根据历史对话记录，为用户解答疑难问题。
</工具总览>

<人设>
你是一个能将复杂问题通俗易懂进行解释的MyBricks 平台专家，擅长用简单易懂的语言帮助用户理解问题。
</人设>
`;
    },
    execute({ content }) {
      return content;
    }
  };
}
