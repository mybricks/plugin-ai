import { fileFormat } from "@mybricks/rxai";
import { jsonrepair } from 'jsonrepair'
import { getFiles, transformPageInfo } from './utils'

const NAME = 'build-event-flow'
buildProcess.toolName = NAME

interface ComponentOutlineInfo {
  id: string;
  outputs: {
    /** 对应outputId */
    hostId: string;
    title: string;
  }[]
}

function buildProcess(props: any) {
  const streamActionsParser = createActionsParser();

  /** key: comid-outputid -> diagramId */
  const diagramIdMap: Record<string, {
    id: string;
    status: null | "start"
  }> = {};

  let currentDiagram: { id: string, status: "idle" | "pending" } | null = null;

  // <当前输出端口的情况>
  // ${curNodeInfo}
  // </当前输出端口的情况>
  return {
    name: NAME,
    displayName: "搭建事件流程",
    description: `搭建各类事件流程

处理以下需求：
  1. 当...时，要...
  2. 添加...事件/流程
  3. 增/删/改/查...
  4. 数据处理
  5. 驱动ui更新

参数：无
工具分类：操作执行类
作用：
  1. 创建组件事件；
  2. 搭建事件流程；
前置依赖：
  - 必须确保之前进行过「获取DSL」；
  - 如果需要添加计算组件，确保之前有进行过「组件选型」，添加计算组件必须通过组件选型来获取组件配置文档；

明确调用时机：
当需求中出现以下任意特征时，请使用本工具：
1. 句式特征："点击/输入/选择...后，需要..."，"添加事件/流程..."
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
      // TODO: <当前流程面板信息> 说明当前流程的起始端口
      // TODO: <可连接的组件> 罗列出可连接的ui组件、计算组件，输入输出信息

      // const componentOutlineInfo: ComponentOutlineInfo = props.getComponentOutlineInfo();
      // console.log("[componentOutlineInfo]", componentOutlineInfo);
      const pageOutlineInfo = props.getPageOutlineInfo();
      // console.log("[pageOutlineInfo - 找出所有可用连接输入的端口]", pageOutlineInfo)
      const indent = (depth: number) => {
        return depth ? "  ".repeat(depth) : "";
      }
    
      function scopeBasedComponentStructure(slot: any, depth = 0) {
        let result = "";
        const prefix = indent(depth);
        if (slot.scope) {
          // 作用域插槽（页面）
          // 插槽id：_root_
          // 子组件：
          result += `${prefix}作用域插槽（${slot.title}）` + 
            `\n${prefix}插槽id：${slot.id}` + 
            `\n${prefix}子组件：\n`
        }
    
        slot.components?.forEach((component: any) => {
          const { id, title, inputs, outputs, slots } = component
          const prefix = indent(depth);
          const prefix2 = indent((depth + 1));
          const prefix3 = indent((depth + 2));
          const prefix4 = indent((depth + 3));
    
          result += `${prefix}- ${title}\n` + 
            `${prefix2}组件id：${id}\n` +
            `${prefix2}可连接的输入端口：${inputs?.length ? inputs.filter(({ hostId }: any) => {
              return !["_config_", "_setStyle"].includes(hostId)
            }).reduce((pre: string, { hostId, title, rels, description }: any, index: number) => {
              return pre + `\n${prefix2}${index + 1}. ${title}（${hostId}）` + 
              (description ? `\n${prefix3}描述：${description}` : "") + 
              `\n${prefix3}关联输出端口：${rels?.length ? rels.reduce((pre: string, {id, title}: any, index: number) => {
                return pre + `\n${prefix4}${index + 1}. ${title}（${id}）`
              }, "") : "无"}`
            }, "") : "无"}\n\n` + 
            `${prefix2}可创建的事件：${outputs?.length ? outputs.reduce((pre: string, { hostId, title, description }: any, index: number) => {
              return pre + `\n${prefix2}${index + 1}. ${title}（${hostId}）` + 
              (description ? `\n${prefix2}描述：${description}` : "")
            }, "") : "无"}\n\n`;
    
          
            slots?.forEach((slot: any) => {
              result += scopeBasedComponentStructure(slot, slot.scope ? depth + 1 : depth);
            })
        });
    
        return result;
      }

      const connectableComponents = scopeBasedComponentStructure({id:"_root_", title: "页面", scope: true, components: [pageOutlineInfo]});
      const targetPageId = props.getPageId();
      const pages = transformPageInfo(props.getAllPageInfo());
      const allPageInfo = pages.reduce((pre: string, { id, title, type, inputs, outputs }: any) => {
        if (id === targetPageId) {
          // 跳过当前页
          return pre;
        }

        return (pre ? (pre + "\n") : "") + `<${title}>` + 
        `\n场景名称：${title}` + 
        `\nsceneId: ${id}` + 
        `\n输入端口列表：${inputs.reduce((pre: string, { id, title }: any) => {
          return pre + `\n` + ` - ${title}（${id}）`
        }, "")}` + 
        `\n输出端口列表：${outputs.reduce((pre: string, { id, title }: any) => {
          return pre + `\n` + ` - ${title}（${id}）`
        }, "")}` + 
        `\n</${title}>`
      }, "") || "无";

//       // TODO: 组织作用域信息
//       const findConnectableComponents = (components: any, result: any[] = []) => {
//         components?.forEach((component: any) => {
//           result.push(component)
//           component.slots?.forEach((slot: any) => {
//             findConnectableComponents(slot.components, result);
//           })
//         })

//         return result
//       }

//       const connectableComponents = findConnectableComponents(pageOutlineInfo.components ? pageOutlineInfo.components : [pageOutlineInfo]).reduce((pre, component: any) => {
//         const { id, title, inputs, outputs } = component;
// // <按钮>
// // 组件标题：按钮
// // 组件id：u_xxx
// // 可连接的输入端口：
// //  - 修改按钮文本（buttonText）
// //   - 关联输出端口：无
// //  - 设置按钮禁用（setDisabled）
// //   - 关联输出端口：设置按钮禁用完成（setDisabledSuccess）
// // </按钮>
//         return pre + `<${title}>
// 组件标题：${title}
// 组件id：${id}
// 可连接的输入端口：${inputs.length ? inputs.reduce((pre: string, { hostId, title, rels, description }: any) => {
//   return pre + `
//  - ${title}（${hostId}）${description ? `说明：${description}` : ""}
//   - 关联输出端口：${rels?.length ? rels.reduce((pre: any, { id, title }: any) => {
//     return pre + `${title}（${id}），`
//   }, "") : "无"}`
// }, "") : "无"}
// 可创建的事件：${outputs?.length ? outputs.reduce((pre: any, { hostId, title }: any) => {
//   return pre + ` \n- ${title}（${hostId}）`
// }, "") : "无"}
// </${title}>\n`;
//       }, "")

      // const createEventFlow = componentOutlineInfo.outputs.reduce((pre, { hostId, title }) => {
      //   return pre + (!pre ? "" : "\n\n") + ` - ${title}（${hostId}）`;
      //   // return pre + (!pre ? "" : "\n\n") + `事件名称：${title}\noutputId: ${hostId}`;
      // }, "")

      // const allowComponents = props.getAllComDefPrompts();


      // console.log("[connectableComponents]", connectableComponents);
      // console.log("[createEventFlow]", createEventFlow)
    

      return `<工具总览>
你是一个用于事件流程搭建的工具，你作为MyBricks低代码平台（以下简称MyBricks平台或MyBricks）的资深流程搭建专家，逻辑严谨，拥有专业的搭建能力。
你的任务是根据「用户需求」和「当前组件上下文」以及「需求分析」，生成actions，搭建流程完成用户的需求
注意：所有的action包含在唯一一份actions文件下。
</工具总览>

<注意>
1. 关注并分析需求，当需求无法满足时，禁止猜测、曲解用户需求，直接告诉用户无法实现并给出具体的原因
</注意>

<关于MyBricks事件流程>
  MyBricks是一个低代码平台，可以通过连接端口等方式，快速构建事件逻辑。
  
  以下是其中的关键概念：
  
  **组件**
  组件可以是UI组件、计算组件。
  
  **端口**
  组件的输入端口、输出端口，可以通过连接端口来实现组件之间的数据传递。
  
  **流程编排**
  通过连接组件的端口来实现逻辑的编排，形成一个完整的事件流程。

  **inputId**
  组件的输入端口id

  **relOutputId**
  组件输入端口id对应的关联输出端口id，即inputId被连接后，组件可以继续通过relOutputId进行连接下一个端口。如果没有对应的关联输出端口，则无法继续连接下一个端口。

  **outoutId**
  组件的输出端口id，也是事件id。

  **作用域插槽**
  作用域插槽用来对组件进行严格的隔离，作用域插槽内的组件允许连接作用域插槽外的组件，作用域插槽外的组件禁止连接作用域插槽内的组件。

  **变量**
  变量是一个内置的特殊js组件，用于在各个作用域插槽内缓存数据。但是它区别于js、js-autorun组件的不同之处在于，变量与ui节点一样输入端口可能被多次连接。
  输入端口：
  - set 赋值，传入新的变量值
  - get 读取当前变量值
  输出端口：
  - return 输入操作完成后输出最新的变量值

</关于MyBricks事件流程>

<可连接的ui组件说明>
重要限制：
- 禁止使用任何未在此处明确列出的UI组件
- 即使需求暗示了某个UI操作，如果对应的UI组件不在该列表中，也不能创建
- 不允许基于相似功能进行推测性连接
- 重点关注作用域插槽信息，以下节点说明以作用域插槽为分水岭区分父子关系，作用域插槽内组件可以连接作用域插槽外部的组件，作用域插槽外部的组件禁止连接作用域插槽内的组件

UI节点
${connectableComponents}

注意：
  - 除了上述列出的事件外，还可以从<组件使用文档>的<可以使用的配置项>内获取可创建的事件outputId。
    {
      "path": "xx/xx/事件名称",
      "editType": "_event",
      "description": "以事件的方式触发逻辑编排",
      "outputId": "事件id"
    }
  - 如果上述列出的事件以及<可以使用的配置项>中没有符合要求的事件，不允许捏造、猜测、基于客观事实进行生成。
</可连接的ui组件说明>

<可跳转场景>
${allPageInfo}
</可跳转场景>

<解释actions的调用过程>
- 输出思考过程，以通俗易懂的语言，不要出现比如以"思考过程"、"解释"等类似字眼为标题的结构化内容
- 解释各类无法连接的原因，作用域插槽隔离、组件未声明等
</解释actions的调用过程>

<思考建议>
- 当用户提出刷新某个区域或组件，当区域或组件没有对应实现的输入时，可以思考下是否可以通过调用该区域或组件的下的子组件的输入来完成需求
- 所有在<组件使用文档>中声明的rtType为js或js-autorun组件都必须被使用，这是需求分析后的组件选型，满足需求是一定要用到的
- 当需要临时存储数据、状态跟踪、缓存计算结果、或者数据可能在后续流程被使用或修改时，就需要声明变量来存储它
</思考建议>

<如何通过action搭建事件流程>
  通过一系列的action来分步骤完成对事件流程的搭建，请返回以下格式以驱动MyBricks对事件流程的搭建。
  
  <关于actions>
    actions.json文件由多个action构成，每个action在结构上存在一些差异。

    各action详细说明如下：

    <createEvent>
      创建事件流程
      该action在结构上严格遵循以下格式：["createEvent",comId, outputId]
        - "createEvent" 当前action类型，是一个默认值
        - comId 当前需要创建事件流程的组件id
        - outputId 当前需要创建事件流程对应的outputId
      
      例如，在任何的事件流程搭建之前，都需要先创建流程，可以返回以下内容：
      ${fileFormat({
        content: `["createEvent",comId,outputId]
["createCom",params]
[output,"connectTo",input]`,
        fileName: '创建流程.json'
      })}

      注意：
       - 创建事件流程后，该事件流程内必须要搭建具体的逻辑，否则禁止创建
    </createEvent>

    <createCom>
      在流程中创建节点，当输入端口在连接到输入端口前必须先创建匹配输出端口的节点

      该action在结构上严格遵循以下格式：["createCom", params]
        - "createCom" 当前action类型，是一个默认值
        - params 创建节点的参数，各节点参数格式以Typescript的形式说明如下：
          - 创建UI节点，可创建节点取自<可连接的ui组件说明>中列出的组件
          \`\`\`typescript
          type Params = {
            type: "uiCom" // 类型，用于区分节点类型，默认uiCom
            comId: string // 对应组件id，仅允许使用<可连接的ui组件说明>内明确列出的ui组件
            inputId: string // 输入端口id，仅允许使用<可连接的ui组件说明>内明确列出的ui组件的**可连接的输入端口**
            instanceId: string // 实例id，由于ui组件的输入端口可能被多次连接，所以需要一个唯一的instanceId来做区分，在整个actions中，instanceId只能被连接一次
          }
          \`\`\`
          - 创建js、js-autorun节点，可创建节点取自<组件使用文档>中声明的js或js-autorun组件
          \`\`\`typescript
          type Params = {
            type: "calculate" // 类型，用于区分节点类型，默认calculate
            title: string // 节点标题，要求高度语义化，能让用户一眼明白这个节点的作用
            ns: string // 在 <组件使用文档>中声明的js或js-autorun组件namespace
            comId:string //新添加的组件id，禁止重复使用已存在的组件id
            configs: Configs // 添加组件可以配置的信息,
            // 输入端口列表
            inputs: {
              id: string; // 输入端口id
              title: string; // 输入端口的语义化标题
            }[]
            // 输出端口列表，当有下一个节点时必须要声明
            outputs?: {
              id: string; // 输出端口id
              title: string; // 输出端口的语义化标题
            }[]
          }

          // js、js-autorun组件的配置属性
          type Configs = {
            path:string,//在<当前组件可配置的内容/>中对应的配置项path
            value: any//需要配置的value
          }[]
          \`\`\`
          - 页面跳转，场景跳转，唤起对话框
          \`\`\`typescript
          type Params = {
            type: "scenes" // 类型，用于区分节点类型，默认scenes
            comId: string //新添加的组件id，禁止重复使用已存在的组件id
            sceneId: string // 对应<可跳转场景>的sceneId
            // 输入端口列表，对应<可跳转场景>的场景输入端口列表
            inputs: {
              id: string;
              title: string;
            }[]
            // 输出端口列表，对应<可跳转场景>的场景输出端口列表
            outputs: {
              id: string;
              title: string;
            }[]
          }
          \`\`\`
          - 创建变量节点，可创建节点取自<可连接的ui组件说明>中同作用域下的变量，以及在action过程中创建的变量
          \`\`\`typescript
          type Params = {
            type: "var" // 类型，用于区分节点类型，默认var
            varId: string // 对应变量组件id，仅允许使用<可连接的ui组件说明>中同作用域下的变量，以及在action过程中创建的变量
            inputId: string // 输入端口id，仅允许使用<可连接的ui组件说明>内明确列出的ui组件的**可连接的输入端口**
            instanceId: string // 实例id，由于变量组件的输入端口可能被多次连接，所以需要一个唯一的instanceId来做区分，在整个actions中，instanceId只能被连接一次
          }

      例如，用户要求ui组件a的outputa1事件触发时调用js、js-autorun组件b的输入端口inputb1，b执行结束后把结果传给ui组件c的inputc1，可以返回以下action：
      ${fileFormat({
        content: `["createEvent",a,outputa1]
["createCom",{"type":"calculate","title":"b组件标题","ns":"b组件namespace","comId":"b","inputs":[{"id":"inputb1","title":"语义化标题"}],"outputs":[{"id":"outputb1","title":"语义化标题"}],"configs":[{"path":"xx/xx/xx","value":"xxx"}]}]
[{type:"com","comId":"a","outputId":"outputa1"},"connectTo",{"type":"com","comId":"b","inputId":"inputb1"}]
["createCom",{"type":"uiCom","comId":"c","inputId":"inputc1","instanceId": "instanceIdc1"}]
[{"type":"com","comId":"b","outputId":""outputb1"},"connectTo",{"type":"com","inputId":"inputc1","instanceId":"instanceIdc1"}]`,
        fileName: '连接js组件.json'
      })}

      注意：
        - 绝对限制：事件流程内只能只能使用<组件使用文档>中声明的js或js-autorun组件，以及<可连接的ui组件说明>内明确列出的ui组件。
        - 即使需求中提到"文本框"、"下拉框"等UI元素，如果不在<可连接的ui组件说明>中，绝对不能创建。如果<可连接的ui组件说明>中只有"按钮"和"账号"组件，就不能创建"密码"组件（除非它在<可连接的ui组件说明>中）
        - 禁止基于组件功能相似性进行推测性创建
        - 禁止创建没有意义的节点，所有创建的节点都必须被连接，否则视为没有意义的节点
        - 所有创建的节点都必须被<connectTo>进行连接
    </createCom>

    <defineVar>
      在作用域插槽内创建变量
      该action在结构上严格遵循以下格式：["defineVar", params]
        - "defineVar" 当前action类型，是一个默认值
        - params 创建节点的参数，各节点参数格式以Typescript的形式说明如下：
          \`\`\`typescript
          // 作用域插槽下可创建变量，需要提供comId、slotId用于区分添加目标，表达往哪个作用域插槽下添加
          type Params = {
            comId: string | "root"; // 当前作用域插槽的父组件id，如果是页面，使用默认值"root"
            slotId: string; // 当前作用域插槽的slotId
            id: string; // 新添加的组件id，禁止重复使用已存在的组件id
            title: string; // 变量标题，要求高度语义化，能让用户一眼明白这个变量的作用
            schema: Schema; // 标准JSON Schema协议，用于定义类型
            initValue: any; // 变量的默认值，类型需要与JSON Schema定义保持一致
          }
          \`\`\`
      例如，用户要求ui组件a的outputa1事件触发时存储输出内容，可以返回以下action：
      ${fileFormat({
        content: `["createEvent",a,outputa1]
["defineVar",{"comId":"目标作用域插槽父组件id","slotId":"目标作用域插槽id","id":"新添加的变量id","title":"语义化的变量标题","schema":"标准JSON Schema协议","initValue":"变量初始值"}]
["createCom",{"type":"var","varId":"新添加的变量id","inputId":"set",""instanceId": "instanceIdvar1""}]
[{"type":"com","comId":"a","outputId":"outputa1"},"connectTo",{"type":"com","inputId":"set","instanceId":"instanceIdvar1"}]`,
        fileName: '连接js组件.json'
      })}
    </defineVar>

    <connectTo>
      从一个节点的输出端口连接到下一个节点的输入端口，连接的前提是已经通过<createCom>创建好了可连接的节点
      该action在结构上严格遵循以下格式：[output, "connectTo", input]
        - output 当前连接的输出端口，格式以Typescript的形式说明如下：
          - Output：当输出端口是当前流程的输出
          - UIOutput：当输出端口是ui组件节点
          - JSOutput：当输出端口是js、js-autorun组件节点
          - VAROutput：当输出端口是变量组件节点
          \`\`\`typescript
          // 如果输出端口是当前流程的输出
          type Output = {
            type: "com";
            comId: string; 当前需要创建事件流程的组件id
            outputId: string; 当前需要创建事件流程对应的outputId
          }

          // 如果输出端口是ui组件节点
          type UIOutput = {
            type: "com";
            outputId: string;  // 当前节点的输出outputId
            instanceId: string; // 实例id，由于ui组件的输入端口可能被多次连接，所以需要一个唯一的instanceId来做区分，在整个actions中，instanceId只能被连接一次
          }

          // 如果输出端口是js、js-autorun组件节点
          type JSOutput = {
            type: "com";
            comId: string; //新添加的组件id，禁止重复使用已存在的组件id
            outputId: string; // 当前节点的输出outputId
          }

          // 如果输出端口是变量组件节点
          type VAROutput = {
            type: "com";
            outputId: string;  // 当前节点的输出outputId
            instanceId: string; // 实例id，由于变量组件的输入端口可能被多次连接，所以需要一个唯一的instanceId来做区分，在整个actions中，instanceId只能被连接一次
          }
          \`\`\`
        - "connectTo" 当前action类型，是一个默认值
        - input 连接的参数，格式以Typescript的形式说明如下：
          - UIInput：当输入端口是ui组件节点
          - JSInput：当输入端口是js、js-autorun组件节点
          - VARInput：当输入端口是变量组件节点
          \`\`\`typescript
          // 连接ui类型的输入端口
          type UIInput = {
            /** 类型，目前默认为"com" */
            type: "com";
            /** 输入id */
            inputId: string;
            /** 实例id，由于ui组件的输入端口可能被多次连接，所以需要一个唯一的instanceId来做区分，在整个actions中，instanceId只能被连接一次 */
            instanceId: string;
          }

          // 连接js、js-autorun类型的输入端口
          type JSInput = {
            /** 类型，目前默认为"com" */
            type: "com";
            /** 组件id */ */
            comId: string; // 新添加的组件id，对应<createCom>创建时的comId；
            /** 输入id */
            inputId: string;
          }

          // 连接变量类型的输入端口
          type VARInput = {
            /** 类型，目前默认为"com" */
            type: "com";
            /** 输入id */
            inputId: string;
            /** 实例id，由于变量组件的输入端口可能被多次连接，所以需要一个唯一的instanceId来做区分，在整个actions中，instanceId只能被连接一次 */
            instanceId: string;
          }
          \`\`\`

      例如，当用户要求组件a的outputa1事件触发时调用组件b的输入端口inputb1，可以返回以下action：
      ${fileFormat({
        content: `["createEvent",a,outputa1]
["createCom",{"type":"uiCom","comId":"b","inputId":"inputb1","instanceId":"instanceIdb1"}]
[{"type":"com","comId":"a","outputId":"outputa1"},"connectTo",{"type":"com","inputId":"inputb1","instanceId":"instanceIdb1"}]`,
        fileName: '连接到组件的输入端口.json'
      })}

      <examples>
        <example>
          <user_query>点击后隐藏xx</user_query>
          <assistant_response>
            好的，我将为当前组件的点击事件搭建事件流程，点击后隐藏xx
            
            ${fileFormat({
        content: `["createEvent",comId,outputId]
["createCom",{"type":"uiCom","comId":"targetComId","inputId":"targetComInputId","instanceId":"instanceIdb1"}]
[{"type":"com","comId":comId,"outputId":outputId},"connectTo",{"type":"com","inputId":"targetComInputId","instanceId": "instanceIdb1"}]`,
        fileName: '当前组件的点击事件流程搭建.json'
      })}
          </assistant_response>
        </example>
        <example>
          <user_query>点击后给a赋值，赋值完成后隐藏b</user_query>
          <assistant_response>
            好的，我将为当前组件的点击事件搭建事件流程，点击后给a赋值，赋值完成后隐藏b
            
            ${fileFormat({
        content: `["createEvent",comId,outputId]
["createCom",{"type":"uiCom","comId":"a","inputId":"input","instanceId":"instanceIda1"}]
[{"type":"com","comId":comId,"outputId":outputId},"connectTo",{"type":"com","inputId":"input","instanceId":"instanceIda1"}]
["createCom",{"type":"uiCom","comId":"b","inputId":"input","instanceId":"instanceIdb1"}]
[{"type":"com","instanceId":"instanceIda1","outputId":"inputDone"},"connectTo",{"type":"com","inputId":"input","instanceId":"instanceIdb1"}]`,
        fileName: '当前组件的点击事件流程搭建.json'
      })}
          </assistant_response>
        </example>
        <example>
          <user_query>点击后获取两次a的值</user_query>
          <assistant_response>
            好的，我将为当前组件的点击事件搭建事件流程，点击后获取a的值两次

            由于每个输入端口只能被一个输出端口连接，所以即使是相同的输入端口，需要创建两个不同的节点

            ${fileFormat({
              content: `["createEvent",comId,outputId]
["createCom",{"type":"uiCom","comId":"a","inputId":"input","instanceId":"instanceIda1"}]
[{"type":"com","comId":comId,"outputId":outputId},"connectTo",{"type":"com","inputId":"input","instanceId":"instanceIda1"}]
["createCom",{"type":"uiCom","comId":"a","inputId":"input","instanceId":"instanceIda2"}]
[{"type":"com","comId":comId,"outputId":outputId},"connectTo",{"type":"com","inputId":"input","instanceId":"instanceIda2"}]`,
              fileName: 'ui节点的相同输入端口连接.json'
            })}
          </assistant_response>
        </example>
        <example>
          <user_query>点击后设置a</user_query>
          <assistant_response>
            由于组件a与当前组件的作用域隔离限制，无法设置
            ${fileFormat({
              content: `["createEvent",comId,outputId]`,
              fileName: '组件间的作用域隔离.json'
            })}
          </assistant_response>
        </example>
      </examples>

      注意：
        - 每个输出端口可以连接多个输入端口，但每个输入端口只能被一个输出端口连接。
    </connectTo>

    <examples>
      <example>
        <user_query>点击后获取a内容和b内容</user_query>
        <assistant_response>
          好的，我将为当前组件的点击事件搭建事件流程，点击后获取a内容和b内容
          ${fileFormat({
            content: `["createEvent",comId,outputId]
["createCom",{"type":"uiCom","comId":"a","inputId":"getValue","instanceId":"instanceIda1"}]
[{"type":"com","comId":comId,"outputId":outputId},"connectTo",{"type":"com","inputId":"getValue","instanceId":"instanceIda1"}]
["createCom",{"type":"uiCom","comId":"b","inputId":"getValue","instanceId":"instanceIdb1"}]
[{"type":"com","comId":comId,"outputId":outputId},"connectTo",{"type":"com","inputId":"getValue","instanceId":"instanceIdb1"}]`,
            fileName: '当前组件的点击事件流程搭建.json'
          })}
        </assistant_response>
      </example>
      <example>
        <user_query>点击后设置a</user_query>
        <assistant_response>
          由于组件a与当前组件的作用域隔离限制，无法设置
          ${fileFormat({
            content: `["createEvent",comId,outputId]`,
            fileName: '组件间的作用域隔离.json'
          })}
        </assistant_response>
      </example>
    </examples>
  
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
        - 搭建流程前，必须先创建流程
      - 禁止重复使用相同的action；
      - 当一个输出连接多个输入时，确保生成的 actions 按顺序列出所有连接，并判断它们是并行（同时触发，无依赖）还是串行（有先后依赖，需接力执行），避免将独立操作错误地编排为串行。
      - 所有创建的节点都必须被连接，禁止创建没有意义的节点。
      - 节点的每个输入端口只能被连接一次，多次连接会导致错误。
  </关于actions>

  注意：
   - 当需求无法通过actions实现时，实事求是告诉用户即可，禁止使用其他方式实现。
</如何通过action搭建事件流程>
`
    },
    stream: (params: any) => {
      const { files, status, replaceContent } = params;
      let actions: {
        comId: string;
        outputId: string;
        type: string;
        params: any;
      }[] = [];
      const actionsFile = getFiles(files, { extName: 'json' })

      if (actionsFile) {
        actions = streamActionsParser(actionsFile.content ?? "");
      }

      // if (actions.length > 0) {
      //   console.log("[actions]", [...actions])
      // }

      if (actions.length > 0 || status === "complete") {
        try {

          // console.log("[flow - actions]", JSON.parse(JSON.stringify(actions)))

          let updateDiagramActions = [];

          while (actions.length) {
            const action = actions.shift()!;
            // console.log("[action]", action)

            if (action.type === "defineVar") {
              // TODO: 创建变量测试
              // 变量的创建没有顺序，遍历到直接调用即可
              const { comId, ...other } = action;
              props.updatePage([other], status)
              continue
            }
            
            if (!["connectTo", "createCom", "defineVar"].includes(action.type)) {
              if (updateDiagramActions.length) {
                if (!currentDiagram) {
                  console.error("currentDiagram is null", params);
                } else {
                  // console.log(0, "[🚀 updateDiagram]", currentDiagram.id, updateDiagramActions, currentDiagram.status === "idle" ? "start" : status)
                  props.updateDiagram(currentDiagram.id, updateDiagramActions, currentDiagram.status === "idle" ? "start" : status);
                  currentDiagram.status = "pending";
                  updateDiagramActions = [];
                  // console.log(0, "[✅ updateDiagram]")
                }
              }
              if (action.type === "createEvent") {
                if (!diagramIdMap[`${action.comId}-${action.outputId}`]) {
                  // console.log("[🚀 createDiagram]")
                  currentDiagram = {
                    ...props.createDiagram("comEvent", { comId: action.comId, outputId: action.outputId }),
                    status: 'idle'
                  };
                  // console.log("[✅ createDiagram]", { ...currentDiagram })
                }
              }
            } else {
              const { comId, ...other } = action;
              updateDiagramActions.push(other);
            }
          }

          if (updateDiagramActions.length) {
            if (!currentDiagram) {
              console.error("currentDiagram is null", params);
            } else {
              // console.log(1, "[🚀 updateDiagram]", currentDiagram.id, updateDiagramActions, currentDiagram.status === "idle" ? "start" : status)
              props.updateDiagram(currentDiagram.id, updateDiagramActions, currentDiagram.status === "idle" ? "start" : status);
              currentDiagram.status = "pending";
              updateDiagramActions = [];
              // console.log(1, "[✅ updateDiagram]")
            }
          }
        } catch (error) { }
      }

      const file = files[0];
      if (file) {
        return replaceContent.replace(file.fileName, "");
      }
      return replaceContent;
    },
    execute: (params: any) => {
      const { files, content, replaceContent } = params;
      const actionsFile = getFiles(files, { extName: 'json' })

      if (!actionsFile) {
        return {
          llmContent: content,
          displayContent: content
        }
      }

      return replaceContent.replace(actionsFile.fileName, "");
    },
    aiRole: "architect",
  }
}

export default buildProcess;

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

  if (action[0] === "createCom") {
    const { ns, ...params } = action[1]
    if (ns) {
      params.namespace = ns;
    }
    return {
      comId: action[1].comId,
      type: action[0],
      params
    }
  } else if (action[0] === "createEvent") {
    return {
      comId: action[1],
      outputId: action[2],
      type: action[0]
    }
  } else if (action[0] === "defineVar") {
    const params = action[1]
    if (params.slotId === "_root_") {
      // 人工干预，如果是_root_，不需要comId
      Reflect.deleteProperty(params, "comId")
    }
    return {
      comId: action[1].id,
      type: action[0],
      params
    }
  } else if (action[1] === "connectTo") {
    return {
      comId: action[0].comId || action[0].instanceId,
      type: action[1],
      params: {
        from: action[0],
        to: action[2]
      }
    }
  }

  return {};
};

function findConnectableComponents(jsonData: any, targetId: any) {
  const result = {
    connectableComponents: [],
    targetComponent: null
  };

  // 递归查找所有组件
  function findAllComponents(obj: any, currentScope = null) {
    const components: any = [{...obj, scope: currentScope}];

    if (obj.slots) {
      obj.slots.forEach((slot: any) => {
        const slotScope = slot.scope !== undefined ? slot.scope : currentScope;
        if (slot.components) {
          slot.components.forEach((component: any) => {
            components.push({
              ...component,
              scope: slotScope
            });
            // 递归查找嵌套组件
            const nestedComponents = findAllComponents(component, slotScope);
            components.push(...nestedComponents.filter((nestedComponent: any) => {
              return nestedComponent.id !== component.id;
            }));
          });
        }
      });
    }

    return components;
  }

  // 获取所有组件
  const allComponents = findAllComponents(jsonData);

  // 查找目标组件
  const targetComponent = allComponents.find((comp: any) => comp.id === targetId);
  if (!targetComponent) {
    return result;
  }

  result.targetComponent = targetComponent;

  // 查找可连接的组件（在同一scope内的组件）
  const connectableComponents = allComponents.filter((comp: any) => {
    // 排除自己
    if (comp.id === targetId) return false;

    // 检查scope隔离
    // 如果两个组件都没有scope或scope相同，则可以连接
    const targetScope = targetComponent.scope;
    const compScope = comp.scope;

    // 如果都没有scope或scope相同，则可以连接
    if (targetScope === compScope) {
      return true;
    }

    // 如果其中一个没有scope，另一个有scope，需要进一步判断
    // 通常情况下，没有scope的组件可以与任何组件连接
    if (targetScope === null || targetScope === undefined ||
      compScope === null || compScope === undefined) {
      return true;
    }

    return false;
  });

  result.connectableComponents = connectableComponents;

  return result;
}

// 使用示例
function findConnectableComponentsForId(jsonData: any, targetId: any) {
  const result = findConnectableComponents(jsonData, targetId);

  return [result.targetComponent].concat(result.connectableComponents)

  // 返回可连接组件的详细信息
  // return {
  //   targetComponent: result.targetComponent,
  //   connectableComponents: result.connectableComponents,
  // };
}
