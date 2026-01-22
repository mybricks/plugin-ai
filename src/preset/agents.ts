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
      const FILENAME_TO_ACTION: Record<string, string> = {
        "index.jsx": "编写组件runtime代码",
        "index.less": "编写组件样式代码",
        "inputs.json": "更新组件输入项",
        "outputs.json": "更新组件输出项",
        "configs.json": "更新组件配置项"
      };

      return [
        {
          name: 'generate-mybricks-component', // 唯一key
          displayName: '编写组件代码', // 这个用于ui展示
          description: '编写MyBricks平台的组件代码', // 工具摘要，用于ai规划使用
          getPrompts: (params: any) => {
            const comInfo = context.api.uiCom.api.getOutlineInfo(focus.comId);
            return `你是一个专业的前端开发者，专注于MyBricks生态的组件开发，精通React + Less技术栈，熟练使用echarts-for-react三方库，能够严格遵循规范完成组件的运行时、样式、输入项、输出项、配置项的开发，精准响应用户的组件开发需求。

<限制使用的技术栈和三方库>
技术栈
- React
- Less

三方库
- echarts-for-react

除上述技术栈和三方库外，禁止使用其他任何技术栈和三方库。
</限制使用的技术栈和三方库>

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
    fileName: 'index.jsx'
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
  - 输入项用于外部调用组件的各类api，实现外部对组件的动态修改
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
    1. 添加
    ${fileFormat({
      content: `[{"id":"语义化的输入项id","title":"语义化的输入项标题"}]`,
      fileName: 'inputs.json'
    })}
    2. 修改，除了id以外的字段均为可选项
    ${fileFormat({
      content: `[{"id":"需要修改的输入项id","title":"修改的输入项标题"}]`,
      fileName: 'inputs.json'
    })}
    3. 删除，只需要id和updateType
    ${fileFormat({
      content: `[{"id":"需要删除的输入项id","updateType":"delete"}]`,
      fileName: 'inputs.json'
    })}
  - 更新输入项后按需同步<编写组件runtime代码>
  </更新组件的输入项>

  <更新组件的输出项>
  - 添加组件的输出项，用于组件内各类事件触发时向外输出内容
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
    1. 添加
    ${fileFormat({
      content: `[{"id":"语义化的输出项id","title":"语义化的输出项标题"}]`,
      fileName: 'outputs.json'
    })}
    2. 修改，除了id以外的字段均为可选项
    ${fileFormat({
      content: `[{"id":"需要修改的输出项id","title":"修改的输出项标题"}]`,
      fileName: 'outputs.json'
    })}
    3. 删除，只需要id和updateType
    ${fileFormat({
      content: `[{"id":"需要删除的输出项id","updateType":"delete"}]`,
      fileName: 'outputs.json'
    })}
  - 更新输出项后按需同步<编写组件runtime代码>
  </更新组件的输出项>

  <更新组件的配置项>
  - 配置项用于组件的静态数据配置编辑，渲染时通过组件入参*data*读取配置内容
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
    /** 唯一的key，没有业务语义，用于查询对应的配置项 */
    key: string;
    updateType: UpdateType;
    /** 
     * css选择器，表达需要对哪一块区域进行编辑。
     * 如果是对组件整体配置，默认使用*:root*，需要与元素的className对应。
     * 注意只能使用*类选择器*，禁止其它任何形式的选择器。
     */
    selector: string;
  }

  /** 
   * 文本类型配置
   */
  interface TextParams extends ConfigBase {
    type: "text";
    /** 需要配置的语义化字段，对应到组件的入参的*data[fieldName]* */
    fieldName: string;
  }

  /**
   * 样式配置
   */
  interface StyleParams extends ConfigBase {
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
  }
  \`\`\`
  - 返回内容示例示例
    1. 添加
      ${fileFormat({
      content: '[{"type":"配置项类型","title":"语义化的配置项标题","fieldName":"fieldName","key":"key","selector":"selector"}]',
      fileName: 'configs.json'
    })}
    2. 修改，除了key以外的字段均为可选项
    ${fileFormat({
      content: '[{"type":"配置项类型","title":"语义化的配置项标题","fieldName":"fieldName","key":"key","selector":"selector"}]',
      fileName: 'configs.json'
    })}
    3. 删除，只需要key和updateType
    ${fileFormat({
      content: '[{"key":"需要删除的配置项key","updateType":"delete"}]',
      fileName: 'configs.json'
    })}
  - 更新配置项后按需同步<编写组件runtime代码>
  </更新组件的配置项>

  注意：
  - 当没有数据类型的配置项（非样式配置）时，禁止使用入参*data*，只有配置项才需要从*data*中获取对应的值
  - 无论修改了什么内容，都要分析是否有相关的内容需要改造，例如runtime代码内没有调用outputs了，是否同步删除组件的输出项
</如何编写MyBricks组件>

<当前组件内容>
runtime代码：
${fileFormat({
  content: `${decodeURIComponent(comInfo.data._sourceRenderCode || "")}`,
  fileName: 'index.jsx'
})}

样式代码：
${fileFormat({
  content: `${decodeURIComponent(comInfo.data._sourceStyleCode || "")}`,
  fileName: 'index.less'
})}

输入项：
${fileFormat({
  content: `${JSON.stringify(comInfo.data.inputs || [])}`,
  fileName: 'inputs.json'
})}

输出项：
${fileFormat({
  content: `${JSON.stringify(comInfo.data.outputs || [])}`,
  fileName: 'outputs.json'
})}

配置项：
${fileFormat({
  content: `${JSON.stringify(comInfo.data.configs || [])}`,
  fileName: 'configs.json'
})}
</当前组件内容>

<开发须知>
- 对于开发过程中使用到的占位图片，可以使用以下服务，根据其用途选择合适的来源
  - https://placehold.co/600x400/orange/ffffff?text=hello，可以配置一个橙色背景带白色hello文字的色块占位图片。
  - https://ai.mybricks.world/image-search?term=搜索词&w=宽&h=高，可以配置一个高质量的摄影图片。
- 当要求根据附件中的图片进行开发、还原时，需要分析元素结构、区块结构、布局、颜色、文字、内边距、外边距、圆角等视觉信息，并输出分析结果，为后续的代码编写提供依据。
- 编辑任何内容前，都需要说明原因以及即将修改的内容是什么。
</开发须知>

<输出规范>
- 无需添加修改说明类表述，如「以下是修改后的内容」「根据要求修改如下」「根据要求新增如下」等。
- 禁止出现文件名，代码块标识等与文件无关的内容。
</输出规范>

<注意>
- 按需开发，保持最简实现。
  - 当需求不涉及样式修改时，禁止返回<编写组件样式代码>内容。
  - 当需求修改不涉及元素变更、样式名称变更、输入、输出、配置时，禁止返回<编写组件runtime代码>内容。
  - 当需求中没有提及输入项，禁止返回<更新组件的输入项>内容。
  - 当需求中没有提及输出项，禁止返回<更新组件的输出项>内容。
  - 当需求中没有提及配置项，禁止返回<更新组件的配置项>内容。
</注意>
`
          },
          stream(params: any) {
            const { files, replaceContent, status } = params;
            const filesLastIndex = files.length - 1;
            let result = replaceContent;
            files.forEach((file: any, index: number) => {
              const { fileName } = file;
              if (index === filesLastIndex && status !== 'complete') {
                if (result.endsWith(fileName)) {
                  result = result.replace(fileName, "正在" + FILENAME_TO_ACTION[fileName] + "...");
                  return;
                }
              }
              result = result.replace(fileName, FILENAME_TO_ACTION[fileName] + "完成");
            })
            return result;
          },
          execute: async (params: any) => {
            console.log("[生成组件代码 - execute]", params);
            console.log("[focus]", focus)
            const { files, replaceContent } = params;
            const actions: any[] = [];
            const { comId, pageId } = focus;

            files.forEach((file: any) => {
              const { fileName, content } = file;
              switch (file.fileName) {
                case "index.jsx":
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

            return files.reduce((pre: string, file: any) => {
              return pre.replace(file.fileName, FILENAME_TO_ACTION[file.fileName] + "完成");
            }, replaceContent)
          },
          // aiRole: "expert",
          // aiRole: "architect",
        },
        MYBRICKS_TOOLS.Answer({})
      ]
    },
  })
]