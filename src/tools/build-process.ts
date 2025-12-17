import { fileFormat } from "@mybricks/rxai";
import { jsonrepair } from 'jsonrepair'
import { getFiles, getComponentOperationSummary, stripFileBlocks } from './utils'
import { context } from './../context';

const NAME = 'build-event-flow'
// buildProcess.toolName = NAME

const buildProcess = () => {
  const streamActionsParser = createActionsParser();
  // 通过创建或获取进行赋值
  let diagramId: string | null = null;
  return {
    name: "build-event-flow",
    displayName: "搭建事件流程",
    description: `搭建组件事件响应流程 - 专处理"当...时，要..."类需求

明确调用时机：
当需求中出现以下任意特征时，请使用本工具：
1. 句式特征："点击/输入/选择...后，需要..." 
2. 关系特征：将组件A的某个事件与组件B的某个动作连接
3. 流程特征：为交互事件配置后续的响应链

典型适用案例：
• "点击提交按钮后，调用API接口"
• "输入框内容变化时，实时验证表单"
• "下拉选择变更时，更新相关组件"
• "页面加载完成后，初始化数据"

不适用情况：
• 仅修改单个组件属性（使用属性配置）
• 纯数据计算转换（使用数据处理）
• 样式或布局调整（使用样式工具）

关键识别模式：
需求 = [触发组件] + [事件类型] + [连接关系] + [目标组件] + [执行动作]
示例："表格组件的行点击事件 → 连接到详情弹窗的显示动作"

提示：如果需求描述了一个"因果链"，本工具就是正确选择。
`,
    getPrompts: () => {
      // TODO: <当前流程面板信息> 说明当前流程的起始节点
      // TODO: <可连接的组件> 罗列出可连接的ui组件、计算组件，输入输出信息
      return `<工具总览>
你是一个用于事件流程搭建的工具，你作为MyBricks低代码平台（以下简称MyBricks平台或MyBricks）的资深流程搭建专家，逻辑严谨，拥有专业的搭建能力。
你的任务是根据「用户需求」和「当前组件上下文」，生成actions，搭建流程完成用户的需求
注意：所有的action包含在唯一一份actions文件下。
</工具总览>

重要根据！：action的生成必须基于提供的可操作节点和组件IO文档，不允许捏造、猜测、基于客观事实进行生成。

<当前流程面板信息>
组件事件
</当前流程面板信息>

<可连接的组件>
当前画布下的所有组件
</可连接的组件>

<如何修改>
  通过一系列的action来分步骤完成对事件流程的搭建，请返回以下格式以驱动MyBricks对事件流程的搭建。
  
  <关于actions>
    actions.json文件由多个action构成，每个action在结构上存在一些差异。

    各action详细说明如下：
    <connectTo>
      连接到组件的输入端口
      该action在结构上严格遵循以下格式：[comId, outputId, "connectTo", type, targetComId, targetComInputId]
        - comId 代表当前需要搭建事件流程的组件的id
        - outputId 指的是当前事件对应的的输出端口
        - "connectTo" 当前action类型，是一个默认值
        - targetType 连接的目标类型，"component - 组件"
        - targetComId 连接的目标组件id
        - targetComInputId 连接的目标组件的输入id

      例如，当用户要求连接到组件u_comid的输入端口“inputId”，可以返回以下内容：
      ${fileFormat({
        content: `["u_comid", "click", "connectTo", "component", "u_comid2", "hide"]`,
        fileName: '连接到组件的输入端口.json'
      })}
    </connectTo>
  
    注意：actions文件每一行遵循 JSON 语法，禁止非法代码，禁止出现内容省略提示、单行注释、省略字符。
      - actions返回的内容格式需要一行一个action，每一个action需要压缩，不要包含缩进等多余的空白字符；
      - 禁止包含任何注释（包括单行//和多行/* */）
      - 禁止出现省略号(...)或任何占位符
      - 确保所有代码都是完整可执行的，不包含示例片段
      - 禁止使用{}、{{}}这类变量绑定语法，并不支持此语法
      - 禁止使用非法字符或特殊符号
      - 所有内容均为静态数据，禁止解构，禁止使用变量
   
    注意：
      - 返回actions文件内容时，务必注意操作步骤的先后顺序；
        - 有些操作需要在前面操作完成后才能进行；
      - 禁止重复使用相同的action；
  </关于actions>
</如何修改>

<examples>
  <example>
    <user_query>点击后隐藏xx按钮</user_query>
    <assistant_response>
      好的，我将为当前组件的点击事件搭建事件流程，点击后隐藏xx按钮
      
      ${fileFormat({
        content: `["u_comid", "click", "connectTo", "component", "u_comid2", "hide"]`,
        fileName: '当前组件的点击事件流程搭建.json'
      })}
    </assistant_response>
  </example>
</examples>
`
    },
    stream: (params: any) => {
      // console.log("[build-event-flow - stream]", params);
      const { files, status } = params;
      let actions: any = [];
      const actionsFile = getFiles(files, { extName: 'json' })

      if (actionsFile) {
        // console.log("[actionsFile]", actionsFile)
        actions = streamActionsParser(actionsFile.content ?? "");
        // console.log("[actions]", actions)
        // actions = fixActions(actions, {
        //   pageId
        // })
        // if (!fileNameToContent[actionsFile!.fileName]) {
        //   fileNameToContent[actionsFile!.fileName] = "";
        // }

        // if (actions?.[0]?.comId && !firstActionId) {
        //   firstActionId = actions?.[0]?.comId;
          
        //   if (firstActionId !== "_root_" && firstActionId !== pageId) {
        //     actionType = 'uiCom'
        //   }

        //   config.onActions([], 'start', actionType)
        // }
      }

      if (actions.length > 0 || status === 'complete') {
        try {
          let start = false;
          actions.forEach((action: any) => {
            if (!diagramId) {
              start = true;
              diagramId = context.api.diagram.api.createDiagram("comEvent", { comId: action.comId, outputId: action.outputId }).id;
            }
          })

          // diagram actions status
          context.api.diagram.api.updateDiagram(diagramId, actions, start ? "start" : status)
          // const copiedActions = JSON.parse(JSON.stringify(actions));
          // console.log("[actions]", actions)
          // config.onActions(actions, status, actionType)
          // const actionsContent = getComponentOperationSummary(copiedActions, config.componentIdToTitleMap)

          // if (actionsFile) {
          //   if (!fileNameToContent[actionsFile!.fileName]) {
          //     fileNameToContent[actionsFile!.fileName] = actionsContent.trim();
          //   } else {
          //     fileNameToContent[actionsFile!.fileName] += `\n${actionsContent.trim()}`;
          //   }
          // }
        } catch (error) {}
      }

      return "";

      // return displayContent = Object.entries(fileNameToContent).reduce((pre, [fileName, content]) => {
      //   return pre.replace(fileName, content);
      // }, replaceContent)
    },
    execute: (params: any) => {
      return {
        llmContent: "完成",
        displayContent: "完成"
      }
    }
  }
}

export default buildProcess;

const llmActionDemo = ["组件ID", "组件事件输出ID", "connectTo", "component", "目标组件ID", "输入ID"]

const actionDemo = {
  "comId": "aaa", // 组件
  "type": "connectTo", // 连接到
  "outputId": "待讨论", // 输入（事件）ID
  "params": {
    "target":{ // 目标
      "type": "component", // 类型
      "id": "组件ID", // 组件ID
      "inputId":"" // 输入ID
    }
  }
}

export function createActionsParser() {
  const processedLines = new Set();

  return function parseActions(text: string) {
    const newActions = [];
    const lines = text.split("\n").filter(line => line.trim() !== '');

    // 只处理除了最后一行之外的所有行（最后一行可能不完整）
    const linesToProcess = lines.slice(0, -1);
    const lastLine = lines[lines.length - 1];

    // 处理完整的行
    for (const line of linesToProcess) {
      const trimmedLine = line.trim();

      // 跳过空行和已处理的行
      if (!trimmedLine || processedLines.has(trimmedLine)) {
        continue;
      }

      try {
        const parsedAction = formatAction(trimmedLine);
        if (parsedAction.comId) {
          newActions.push(parsedAction);
          processedLines.add(trimmedLine);
        }
      } catch (error) {
        // 这是真正的解析错误（完整的行但格式错误）
        processedLines.add(trimmedLine); // 标记为已处理，避免重复尝试
      }
    }

    // 处理最后一行
    if (lastLine && lastLine.trim()) {
      const trimmedLastLine = lastLine.trim();

      // 如果文本以换行符结尾，说明最后一行是完整的
      if ((text.endsWith("\n")) && !processedLines.has(trimmedLastLine)) {
        try {
          const parsedAction = formatAction(trimmedLastLine);
          if (parsedAction.comId) {
            newActions.push(parsedAction);
            processedLines.add(trimmedLastLine);
          }
        } catch (error) {
          processedLines.add(trimmedLastLine);
        }
      }
    }

    return newActions;
  };
}

const formatAction = (_action: string) => {
  let action;
  try {
    action = JSON.parse(_action);
  } catch (error) {
    try {
      const repairedAction = jsonrepair(_action)
      action = JSON.parse(repairedAction)
    } catch (error) {
      console.error("repair action error", error);
    }
  }

  if (!Array.isArray(action)) {
    return action;
  }

  const [comId, outputId, type, targetType, targetComId, targetComInputId] = action;
  const newAct = {
    comId,
    type,
    outputId,
    params: {
      target: {
        type: targetType,
        id: targetComId,
        inputId: targetComInputId
      }
    }
  };

  return newAct;
};
