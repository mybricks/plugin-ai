import { MyBricksParamsTools, MYBRICKS_TOOLS } from "../../tools";
import { context } from "../../context";
import { Rxai, IDB } from "@mybricks/rxai";

export { MyBricksParamsTools } from "../../tools";

type SystemAgentType = 'page' | 'uiCom' | 'app' | 'section';

type AgentType = SystemAgentType | string;

// 自定义工具格式（参考 answer.ts）
type CustomTool = {
  name: string;
  displayName?: string;
  description: string;
  getPrompts?: (params?: any) => string;
  execute: (params: { files?: any; content?: any }) => any;
  aiRole?: string;
};

export interface AgentConfigParams {
  /** ui展示名称 */
  name?: string
  /** 类型 */
  type?: AgentType
  /** 定义这是一个干什么用的Agent */
  goal?: string
  /** 背景知识补充 */
  backstory?: string,
  /** 重点关注的内容 */
  attentions?: string,
  /** 工具列表：系统类型使用 MyBricksParamsTools 的返回值，自定义类型使用 CustomTool 格式 */
  tools?: ReturnType<typeof MyBricksParamsTools[keyof typeof MyBricksParamsTools]>[] | CustomTool[];
  formatUserMessage?: (text: string, { focusParams }: { focusParams: AiServiceFocusParams }) => string;
}

export function Agent(config: AgentConfigParams) {
  const { name = '智能助手', type = 'page', tools = [], goal, backstory, attentions } = config;
  
  // 判断是否为系统类型
  const systemAgentTypes: SystemAgentType[] = ['page', 'uiCom', 'app', 'section'];
  const isSystemType = systemAgentTypes.includes(type as SystemAgentType);
  
  // 如果是系统类型，返回现有结构
  if (isSystemType) {
    return {
      name,
      type,
      goal,
      attentions,
      tools,
    };
  }
  
  // 如果是自定义类型，使用 BaseAgent 创建
  return BaseAgent({
    name,
    type,
    goal,
    backstory,
    tools,
  });
}

export function BaseAgent(config: AgentConfigParams) {
  const { name = '智能助手', type, goal, backstory, tools = [], formatUserMessage } = config;
  
  return {
    ...config,
    request(params: any) {
      return new Promise((resolve, reject) => {
        if (!context.rxai) {
          return reject('Rxai instance not initialized');
        }
        
        // 自定义工具的 tools 已经是工具对象格式，可以直接传给 requestAI
        const customTools = tools as CustomTool[];
        
        // 调用 requestAI
        // 注意：system prompt 在 createRxai 时已设置，如需自定义 system prompt，
        // 可以通过创建新的 Rxai 实例或使用 messages 参数传递
        context.rxai.requestAI({
          ...params,
          system: {
            title: name,
            prompt: backStoryPrompts({ goal, backstory }),
          },
          message: params?.message,
          formatUserMessage: (text: string) => {
            return formatUserMessage ? formatUserMessage(text, { focusParams: context.currentFocus as AiServiceFocusParams }) : text;
          },
          emits: {
            write: () => {},
            complete: () => {
              resolve('complete');
              params?.onProgress?.("complete");
            },
            error: (error: any) => {
              reject(error);
              params?.onProgress?.("error");
            },
            cancel: () => {
              params?.onProgress?.("complete");
            },
          },
          tools: customTools,
        });
      });
    },
  };
}

export function getAgentConfigs(agents: AgentConfigParams[], type: AgentType = 'page') {
  if (!Array.isArray(agents)) return null
  const targetAgent = agents.find(agent => agent.type === type);

  // 根据工具名称获取对应工具的完整参数
  const getToolParams = (toolName: string) => {
    const tools = targetAgent?.tools;
    const tool: any = tools?.find(t => t.name === toolName);
    return (tool?.params as any) || {};
  };

  return {
    system: backStoryPrompts({ goal: targetAgent?.goal, backstory: targetAgent?.backstory }),
    attentions: targetAgent?.attentions,
    getToolParams,
  };
}

/**
 * 根据类型获取 agent 实例
 * 如果是自定义类型，返回包含 request 方法的 agent 实例
 * 如果是系统类型，返回 null
 */
export function getAgentInstance(agents: AgentConfigParams[] | undefined, type: AgentType): ReturnType<typeof BaseAgent> | null {
  if (!Array.isArray(agents)) return null;
  
  const targetAgent = agents.find(agent => agent.type === type);
  if (!targetAgent) return null;
  
  // 判断是否为系统类型
  const systemAgentTypes: SystemAgentType[] = ['page', 'uiCom', 'app', 'section'];
  const isSystemType = systemAgentTypes.includes(type as SystemAgentType);
  
  // 如果是系统类型，返回 null（使用默认的 requestCommonAgent）
  if (isSystemType) return null;
  
  // 如果是自定义类型，使用 BaseAgent 创建实例
  return BaseAgent(targetAgent);
}

/**
 * 转换历史的 prompts 配置为新的 agents 配置
 * 用于兼容旧版本的 { prompts: { systemAppendPrompts, prdExamplesPrompts, generatePageActionExamplesPrompts } } 配置
 */
export function transformLegacyPromptsToAgents(prompts: any): AgentConfigParams[] {
  if (!prompts) return [];
  
  const tools: any[] = [];
  
  // 如果有 prdExamplesPrompts，说明需要 AnalyzeRequirementAndComponents 工具
  if (prompts.prdExamplesPrompts) {
    tools.push(MyBricksParamsTools.AnalyzeRequirementAndComponents({
      fewShots: prompts.prdExamplesPrompts
    }));
  }
  
  // 如果有 generatePageActionExamplesPrompts，说明需要 GenerateUiContent 工具
  if (prompts.generatePageActionExamplesPrompts) {
    tools.push(MyBricksParamsTools.GenerateUiContent({
      fewShots: prompts.generatePageActionExamplesPrompts
    }));
  }
  
  return [{
    type: 'page',
    attentions: prompts.systemAppendPrompts,
    tools
  }];
}

export function backStoryPrompts({ goal = '主要处理 MyBricks 低代码搭建页面相关的问题，帮助用户完成搭建需求', backstory }: { goal?: string, backstory?: string } = {}): string {
  return `<关于当前所处理的问题领域/>
  ${goal}。
  
  ${backstory ? `\n${backstory}` : `你对以下几个领域的知识都十分擅长并且专业，包含但不限于：
  <设计器领域>
    工具来自与设计器的交互，MyBricks设计器提供多画布的搭建系统用于快速搭建UI和逻辑，提供通过拖拉拽来完成IT需求的系统。
    设计器往往往包含丰富的工具，遵循人类的操作逻辑来完成工具调用，比如要生成一个页面，需要由聚焦到哪个页面来决定，生成的时候添加组件又需要组件的配置文档。

    你需要了解的定义：
    <聚焦元素>
    聚焦是指当前设计器中用户正在操作的画布(也可以说是页面/对话框)或者组件，聚焦决定了工具调用的作用域和目标，也决定了需求指向的目标和上下文。
    所以每一次用户咨询，都必须明确「当前聚焦」的是什么，聚焦多次则以最后一次为准。
    </聚焦元素>

    <搭建元素>
    搭建元素是设计器中的基本构建单元，可以是页面、对话框、组件、数据源、逻辑流、区块等。
      <组件>
        MyBricks 组件是搭建的基本单元之一，在搭建时，除了通用的尺寸、定位、位置等配置，其余必须参考组件配置文档来进行配置。
        如果要修改/新增组件：必须参考配置文档来配置。
      </组件>

      <页面>
        MyBricks 页面是构成APP的基本单元，支持切换不同页面进行搭建。
      </页面>

      <区块>
        MyBricks 区块是对一个区域的搭建，区块可以包含复合组件。
      </区块>
    </搭建元素>

    <布局>
      flex布局和智能布局，是MyBricks设计器提供的两大布局方式，当然还有固定布局和绝对定位布局。
    </布局>

    <事件流程>
      事件流程是MyBricks设计器中实现交互逻辑的核心机制。它让静态的界面元素能够响应用户操作或系统状态变化，执行预设的动作序列，从而实现动态的、智能的应用行为。

      事件流程由三个核心部分构成：
      1. 事件触发器：流程的起点。代表“当什么事情发生”。通常是用户的某个交互动作（如点击、输入、选择）或系统自动触发的时机（如页面加载完成、定时器到点、数据更新）。
      2. 处理动作：流程的执行步骤。代表“要做什么事情”。可以是：
          - 更新界面：例如，显示或隐藏某个区域、修改文本内容、调整样式。
          - 处理数据：执行计算、转换格式、发起网络请求。
          - 控制导航：跳转到其他页面、打开或关闭弹窗。
      3. 数据流向：连接各个步骤的数据通道。一个动作的执行结果可以作为下一个动作的输入，形成连贯的处理链条。

      类比理解：事件流程就像一套精心编排的“自动化剧本”。
      - 触发事件：是剧本的开场信号（例如，用户按下“提交”按钮）。
      - 处理动作：是剧本中一幕幕连贯的情节（例如：收集表单信息 -> 验证数据 -> 发送请求 -> 处理响应）。
      - 最终效果：是剧本的结局呈现（例如：显示成功提示并刷新列表）。

      在设计器中，你通过**可视化连接不同功能模块的端口**来编排这个“剧本”。整个过程无需编写复杂代码，通过拖拽和配置即可完成从简单交互到复杂业务逻辑的自动化处理。

      关键特性：
      - 可视化编排：逻辑以直观的流程图方式呈现，结构清晰，易于理解和维护。
      - 声明式配置：通过选择与配置来定义行为，降低技术门槛。
      - 模块化封装：每个功能模块（页面、组件）拥有独立的事件流程空间，保证逻辑清晰、互不干扰。
    </事件流程>
  </设计器领域>

  <软件工程领域>
    我们是低代码搭建系统，对于设计互联网产品的知识你同样非常了解，包含UI设计、产品、原型等知识，你都是极其了解的，对设计风格、美化、产品设计都不在话下。
    作为一名软件工程领域的专家，你拥有大量的专业知识可以将这些抽象概念转化为具体的、可执行的设计方案（如颜色、字体、布局、圆角等），而不是第一时间要求用户提供所有细节。只有在完全无法解读或用户时，才可进行追问。
  </软件工程领域>

  <图片领域>
    我们有大量的图片资源以供搜索，通过修改组件和生成UI可以通过特定的链接使用在线图片搜索服务。
  </图片领域>
  `}
</关于当前所处理的问题领域/>

<针对当前领域如何规划工具>
  工具的规划必须遵循工具的「参数」「作用」「前置依赖」「聚焦元素要求」等描述信息，合理提出思考，同时给出规划，对于不合理的要求及时纠正用户。

  <规则>
    关于附件：用户上传的图片和文件，能够同时作用于页面和组件；
    工具分类：目前主要有*信息获取类*和*操作执行类*，信息获取类作为最后一个工具被调用时，需要调用回答工具；
  </规则>

  ${
    // TODO：这里后续需要重新梳理，现在是特殊的hack，有backstory就不要这些信息了
    backstory ? '' : `<如何思考>
    1. 判断是否遵循规则，对于不遵循规则的不合理需求，给予用户合理的建议；
    2. 判断需求的分类；
    3. 规划工具
      3.1 如果当前需求是「修改组件/区块」；
        3.1.1 首先先获取「获取DSL」来获取上下文和组件配置文档；
        3.1.2 判断是否需要新增组件，如果需要新增，则还需要「需求分析和组件选型」来获取新增组件的配置文档；
        3.1.3 调用「修改/重构组件」来执行修改；
      3.2 如果当前需求是「生成UI」，生成UI会清空画布，所以无需关心上下文；
        3.2.1 调用「需求分析/组件选型」来获取组件配置文档和需求；
        3.2.2 调用「生成UI」来执行页面生成；
      3.3 如果当前需求是「咨询提问」类，则灵活决定是否需要先获取信息再回答用户；
        > 注意：聚焦信息默认每次都会提供，有时候问题通过聚焦信息就可以回答；
      3.4 如果当前需求是「追加提问」类，则需要根据上下文和工具灵活地咨询用户更多信息，比如不断提问“没实现”“没搞好”“搞错了”，由于你对当前的搭建效果的感知有限，可以向用户获取你通过工具无法知道的信息（比如截图等）；
      3.5 当需求涉及“开发、搭建”等操作性描述时，以当前聚焦的元素（页面、组件或区块）为判断依据；

      <思考示例>
      - 改成苹果风格：你对设计领域非常熟悉，有大量的设计知识，苹果风格你太了解了，可以直接修改，改风格需要修改样式，先获取相关DSL，接下来调用「重构UI」来修改UI；
      - 改成XX卡片：判断是不是完全重构内容，如果重构内容涉及组件的替换，为了防止出现缺失组件使用文档的情况，先获取DSL、再组件选型，最后调用「重构UI」来修改UI，同时注意逻辑修改需要添加逻辑编排节点；
      - 修改背景色 / 换个图标：修改样式和配置需要组件文档，所以先获取相关DSL，接下来调用「修改/重构组件」；
      - 总结下之前的操作：无需调用工具，通过历史对话总结下用户的操作；
      - 这是什么：通过工作空间的简略信息即可知道个大概，如果用户想知道样式等信息，需要获取DSL，再使用「分析回答」回答用户的问题；
      - 可以改颜色吗：先获取DSL，然后使用「分析回答」回答用户的问题；
      - 梳理这个页面的内容变成一个PRD文档：先获取DSL梳理内容，然后使用「分析回答」回答用户的问题；
      - 替换成XX组件：由于替换组件不确定要替换成什么，所以需要先获取DSL，然后调用「组件选型」，最后调用「修改/重构组件」；
      </思考示例>
  </如何思考>`
  }
  

  <如何处理用户的负面追问>
    当用户给出负面反馈时（例如“搞错了”、“效果不对”、“不是这样”），你**必须**遵循以下步骤：
    1. **自我反思**：在内部回顾你上一步规划是什么。
    2. **提出假设**：基于你上一步的规划，分析可能出错的几个点（例如：是理解错了目标？还是修改的细节不对？是工具选错了？）。
    3. **主动提问**：将你的反思和假设以简明扼要的选项或问题形式呈现给用户，引导用户做出具体判断，而不是被动地等待用户提供所有信息。
  </如何处理用户的负面追问>

  <如何处理用户的模糊提问>
  当收到模糊或不明确的指令时（例如“处理一下”、“优化它”），你【必须】遵循以下行动优先级，这与处理负面反馈的逻辑类似：
  1. **优先尝试规划**：首先，你必须基于当前上下文和你的专业能力，对用户的意图做出最合理的假设，并【直接制定一个完整的计划去执行】。这体现了你的主动性和专业性，是解决问题的首选路径。
  2. **引导式提问**：只有在你完全无法做出任何合理假设，导致制定任何有意义的规划都【彻底不可能】时，才能作为最终手段向用户提问。提问时，必须将你的思考和假设作为选项提供给用户，而不是宽泛地要求用户澄清。
  </如何处理用户的模糊提问>

</针对当前领域如何规划工具>
` }

interface SingleInstanceAgentOptions {
  name: string;
  type: string;
  goal: string;
  backstory: string;
  tools: (params: any) => ReturnType<typeof MyBricksParamsTools[keyof typeof MyBricksParamsTools]>[] | CustomTool[];
}
export class SingleInstanceAgent {
  system: any;
  tools: any;
  type: string;
  constructor(options: SingleInstanceAgentOptions) {
    this.system = backStoryPrompts({ goal: options.goal, backstory: options.backstory });
    this.tools = options.tools;
    this.type = options.type;
  }

  rxaiMap: Record<string, {
    rxai: Rxai;
    tools: ReturnType<typeof MyBricksParamsTools[keyof typeof MyBricksParamsTools]>[] | CustomTool[];
    focus: any;
  }> = {};

  getRxai(options: any) {
    const { key, focus } = options;
    if (!this.rxaiMap[key]) {
      this.rxaiMap[key] = {
        rxai: new Rxai({
          system: this.system,
          request: {
            maxRetries: 3,
            requestAsStream: context.pluginParams.requestAsStream
          },
          idb: new IDB({
            dbName: "@mybricks/plugin-ai/messages",
            key
          })
        }),
        tools: this.tools({ focus }),
        focus,
      }
    }
    return this.rxaiMap[key].rxai;
  }

  request(key: string, params: any) {
    return new Promise((resolve, reject) => {
      const { formatUserMessage } = params;
      const { rxai, tools, focus } = this.rxaiMap[key];
      rxai.requestAI({
        ...params,
        formatUserMessage: (text: string) => {
          return formatUserMessage ? formatUserMessage(text, { focusParams: focus as AiServiceFocusParams }) : text;
        },
        emits: {
          write: () => {},
          complete: () => {
            resolve('complete');
            params?.onProgress?.("complete");
          },
          error: (error: any) => {
            reject(error);
            params?.onProgress?.("error");
          },
          cancel: () => {},
        },
        tools,
      });
    })
  }
}

export abstract class AbstractAgent {
  type: string;
  system: any;
  rxaiMap: any = {};

  constructor(options: { type: string; goal: string; backstory: string; name: string }) {
    this.type = options.type
    this.system = {
      title: options.name,
      prompt: backStoryPrompts({ goal: options.goal, backstory: options.backstory })
    };
  }

  getRxai(params: { key: any }) {
    const { key } = params;
    if (!this.rxaiMap[key]) {
      this.rxaiMap[key] = new Rxai({
        system: this.system,
        request: {
          maxRetries: 3,
          requestAsStream: context.pluginParams.requestAsStream
        },
        idb: new IDB({
          dbName: "@mybricks/plugin-ai/messages",
          key
        })
      })
    }
    return this.rxaiMap[key];
  }

  abstract request(params: { key: any; params: any; focus: any; }): Promise<any>;
}

export class CustomAgent extends AbstractAgent {
  requestAI: any;
  constructor(options: any) {
    super(options);
    this.requestAI = options.request;
  }

  request(params: { key: any; params: any; focus: any; }): Promise<any> {
    const rxai = this.getRxai({ key: params.key });
    return this.requestAI({ rxai, ...params });
  }
}
