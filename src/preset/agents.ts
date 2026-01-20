import { fileFormat } from "@mybricks/rxai";
import { SingleInstanceAgent } from "../agents/utils/config";
import { MYBRICKS_TOOLS } from "./../tools";
import { context } from "../context";
import { PromiseStack } from "../tools/utils";

export const agents = [
  new SingleInstanceAgent({
    name: '智能组件助手',
    type: 'mybricks.basic-comlib.ai-mix', // 这个需要和focus里面的type对应上
    goal: '根据用户需要，开发可运行在MyBricks平台的组件',
    backstory: `基于React + Less`,
    tools: (params: any) => {
      const promiseStack = new PromiseStack();
      const { focus } = params;
      return [
        {
          name: 'generate-mybricks-component', // 唯一key
          displayName: '生成组件代码', // 这个用于ui展示
          description: '生成MyBricks平台的组件代码', // 工具摘要，用于ai规划使用
          getPrompts: () => {
            return `你是一个专业的前端开发者，擅长使用各种技术栈开发组件，完成用户需求。

<限定技术栈>
只能使用 React + Less 来完成组件开发，禁止使用任何三方库。
<限定技术栈>

<MyBricks组件开发规范>

</MyBricks组件开发规范>

<如何编写MyBricks组件>
  <编写组件runtime代码>
  - 基于React框架编写组件的运行时代码
  - 返回组件runtime代码字符串示例
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
  </编写组件runtime代码>

  <编写组件样式代码>
  - 基于Less框架编写组件的样式代码
  - 返回组件样式代码字符串示例
  ${fileFormat({
    content: `.button {
background-color: #000;
color: #fff;
}`,
    fileName: 'index.less'
  })}
  </编写组件样式代码>

  <更新组件的输入项>
  - 输入项用于外部调用组件的各类api
  - 返回内容格式以Typescript的形式说明如下
  \`\`\`typescript
  interface Params {
    id: string; // 输入项id
    title: string; // 输入项语义化名称
    /**
     * 操作类型
     * undefined - 根据是否存在id判断是添加或更新
     * delete - 删除id对应的输入项
     */
    updateType: "delete" | undefined;
  }
  \`\`\`
  - 返回内容示例示例
  ${fileFormat({
    content: `{"id":"语义化的输入项id","title":"语义化的输入项标题"}`,
    fileName: 'inputs.json'
  })}
  - 更新输入项后按需同步<编写组件runtime代码>
  </更新组件的输入项>

  <更新组件的输出项>
  - 添加组件的输出项，用于内部触发组件的各类事件
  - 返回内容格式以Typescript的形式说明如下
  \`\`\`typescript
  interface Params {
    id: string; // 输出项id
    title: string; // 输出项语义化名称
    /**
     * 操作类型
     * undefined - 根据是否存在id判断是添加或更新
     * delete - 删除id对应的输出项
     */
    updateType: "delete" | undefined;
  }
  \`\`\`
  - 返回内容示例示例
  ${fileFormat({
    content: `{"id":"语义化的输出项id","title":"语义化的输出项标题"}`,
    fileName: 'outputs.json'
  })}
  - 更新输出项后按需同步<编写组件runtime代码>
  </更新组件的输出项>

  <更新组件的配置项>
  - 配置项用于组件的配置编辑，可以理解为是组件的props
  - 返回内容格式以Typescript的形式说明如下
  \`\`\`typescript
  type Params = TextParams | StyleParams;
  /**
   * 操作类型
   * undefined - 根据是否存在key判断是添加或更新
   * delete - 删除key对应的配置项
   */
  type UpdateType = "delete" | undefined;

  interface ConfigBase {
    /** 配置项的语义化标题 */
    title: string;
    /** 需要配置的语义化字段，对应到组件的入参的data[fieldName] */
    fieldName: string;
    /** 唯一的key，没有业务语义，用于查询对应的配置项 */
    key: string;
    updateType: UpdateType;
  }

  /** 
   * 文本类型配置
   */
  interface TextParams extends ConfigBase {
    type: "text";
  }

  /**
   * 样式配置
   */
  interface StyleParams {
    /** 配置项的语义化标题 */
    title: string;
    type: "style";
    /** 样式编辑器配置 */
    option: {
      /**
       * 需要支持的配置内容
       * font - 字体配置
       * background - 背景配置
       */
      options: string[];
      /** 样式作用于目标元素的 css selector，多个target代表样式同时作用于多个目标元素 */
      target: string[];
    };
    /** 唯一的key，没有业务语义，用于查询对应的配置项 */
    key: string;
    updateType: UpdateType;
  }
  \`\`\`
  - 返回内容示例示例
  ${fileFormat({
    content: '{"type":"配置项类型","title":"语义化的配置项标题","fieldName":"fieldName","key":"key"}',
    fileName: 'configs.json'
  })}
  - 更新配置项后按需同步<编写组件runtime代码>
  </更新组件的配置项>

  注意：
  - 按需完成用户需求，不需要的部分禁止返回。
</如何编写MyBricks组件>

<examples>
  <example>
    <user_query>开发一个按钮组件</user_query>
    <assistant_response>
    </assistant_response>
  </example>
</examples>
`
          },
          execute: async (params: any) => {
            console.log("[生成组件代码 - execute]", params);
            console.log("[focus]", focus)
            const { files } = params;
            const actions: any[] = [];
            const { comId, pageId } = focus;

            files.forEach((file: any) => {
              const { fileName, content } = file;
              switch (file.fileName) {
                case "index.tsx":
                  actions.push({
                    comId,
                    type: "doConfig",
                    target: ":root",
                    params: {
                      path: "组件runtime代码",
                      value: content
                    }
                  })
                  break
                case "index.less":
                  actions.push({
                    comId,
                    type: "doConfig",
                    target: ":root",
                    params: {
                      path: "组件样式代码",
                      value: content
                    }
                  })
                  break
                case "inputs.json":
                  actions.push({
                    comId,
                    type: "doConfig",
                    target: ":root",
                    params: {
                      path: "更新输入项",
                      value: JSON.parse(content)
                    }
                  });
                  break;
                case "outputs.json":
                  actions.push({
                    comId,
                    type: "doConfig",
                    target: ":root",
                    params: {
                      path: "更新输出项",
                      value: JSON.parse(content)
                    }
                  });
                  break;
                case "configs.json":
                  actions.push({
                    comId,
                    type: "doConfig",
                    target: ":root",
                    params: {
                      path: "更新配置项",
                      value: JSON.parse(content)
                    }
                  });
                  break;
                default:
                  break;
              }
            })

            promiseStack.add(() => {
              context.designer?.updatePage?.(pageId, [], 'start');
            })
            promiseStack.add(() => {
              context.designer?.updatePage?.(pageId, actions, 'ing');
            })
            promiseStack.add(() => {
              context.designer?.updatePage?.(pageId, [], 'complete');
            })

            return '已完成组件代码的更新'
          }
        },
        MYBRICKS_TOOLS.Answer({})
      ]
    },
  })
]