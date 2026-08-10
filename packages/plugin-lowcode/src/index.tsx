import React, { useEffect, useMemo, useRef, useState } from "react";

import { CodeAgent, IDBHistory, AgentModeEnum } from "../../agent/src";
import type { AgentOptions, History, Sandbox, SkillFile, Tool, TurnSender } from "../../agent/src";
import { createRequestAsStream, createOnUpload } from "../../request/src";
import type { ProviderConfig, RequestAsStreamFn } from "../../request/src";
import { ChatPanel } from "../../plugin/src/ui/chat";
import type { ChatPanelRef } from "../../plugin/src/ui/chat/chat-panel";
import { context as pluginContext } from "../../plugin/src/context";
import { chipRegistry } from "../../plugin/src/sandbox/setup";

import type {
  LowCodeDesignerAPI,
  LowCodeDesignerRuntime,
  LowCodeFocusParams,
  LowCodeOperatorParams,
  LowCodeRequestParams,
} from "./designer";
import { buildLowCodeStableContext } from "./project";
import { lowCodePromptOptions } from "./prompt-options";
import { createLowCodeTools } from "./tools";
import { registerLowCodeMockActions } from "./designer/mock-actions";
import { createLowCodeFocusChip, lowCodeFocusChipDef } from "./focus-chip";

// ChatPanel 使用 plugin 的全局注册表渲染 chip；CodeAgent 创建后会再注册到实例。
chipRegistry.register(lowCodeFocusChipDef);

export type {
  LowCodeDesignerAPI,
  LowCodeFocusParams,
  LowCodeOperatorParams,
  LowCodeRequestParams,
} from "./designer";
export {
  getComlibsDocs,
  getComponentsDocs,
} from "./project";
export {
  LOWCODE_GREP_TOOL_NAME,
  LOWCODE_READ_TOOL_NAME,
  LOWCODE_GET_COMPONENT_DOC_TOOL_NAME,
  LOWCODE_GENERATE_PAGE_TOOL_NAME,
  LOWCODE_CLEAR_PAGE_TOOL_NAME,
  createLowCodeTools,
} from "./tools";

interface User {
  name?: string;
  avatar?: string;
}

export interface PluginLowCodeAIController {
  disable(): void;
  enable(): void;
  setDisabled(value: boolean): void;
  requestAI(params: LowCodeRequestParams): Promise<void>;
  getAgent(): CodeAgent | undefined;
}

export interface PluginLowCodeAIAPI {
  controller: PluginLowCodeAIController;
}

export interface PluginLowCodeAIParams {
  name?: string;
  user?: User;
  key: string;
  onRequest?: RequestAsStreamFn;
  onUpload?: (file: File) => Promise<string>;
  onDownload?: (params: { name: string; content: string }) => Promise<void> | void;
  llm?: {
    providers?: ProviderConfig[];
  };
  history?: History;
  sender?: TurnSender;
  disabledModes?: AgentOptions["disabledModes"];
  system?: string;
  /** 追加到低代码 Agent 的业务工具；内置低代码工具始终保留。 */
  tools?: Tool[];
  /** 按需加载的技能文件；CodeAgent 会自动提供 use_skill 工具。 */
  skills?: SkillFile[];
  getUserContextMessage?: () => string | null | undefined | Promise<string | null | undefined>;
  onOperatorActions?: (params: LowCodeOperatorParams) => void;
  /** 是否允许 updatePage action 向设计器传递 ignore/enhance 渲染优化标记，默认关闭。 */
  enableRenderingOptimization?: boolean;
}

const emptySandbox: Sandbox = {
  async getFiles() {
    return [];
  },
  async updateFiles() {
    throw new Error("pluginLowCodeAI does not expose file write tools.");
  },
  async deleteFiles() {
    throw new Error("pluginLowCodeAI does not expose file delete tools.");
  },
};

function defaultDownload({ name, content }: { name: string; content: string }) {
  const eleLink = document.createElement("a");
  eleLink.download = name;
  eleLink.style.display = "none";
  const blob = new Blob([content]);
  eleLink.href = URL.createObjectURL(blob);
  document.body.appendChild(eleLink);
  eleLink.click();
  document.body.removeChild(eleLink);
}

function normalizeAttachments(attachments: LowCodeRequestParams["attachments"] = []) {
  return attachments.map((attachment) => ({ ...attachment }));
}

function LowCodeAIView(props: {
  agent?: CodeAgent;
  runtime: LowCodeDesignerRuntime;
  user?: User;
  copilot?: User;
  title: string;
  disabled: boolean;
  onUpload?: (file: File) => Promise<string>;
}) {
  const { agent, runtime, user, copilot, title, disabled, onUpload } = props;
  const panelRef = useRef<ChatPanelRef>(null);
  const [focus, setFocus] = useState<LowCodeFocusParams | undefined>(() => runtime.focus);

  // 低代码只有一个 ChatPanel，直接订阅 focus 事件来驱动输入框的默认 chip。
  useEffect(() => pluginContext.events.on("focus", (nextFocus: LowCodeFocusParams | undefined) => {
    setFocus(nextFocus ? { ...nextFocus } : undefined);
  }), []);

  // 与 plugin-ai 的 ChatPanelList 一致：focus 变化后等待 Sender 挂载，再插入默认 chip。
  // 仅在输入框为空或仍是上一份低代码 focus chip 时替换，避免打断用户正在编辑的需求。
  useEffect(() => {
    if (!focus) return;
    const timer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const input = panel.getInput();
      const canReplace = !input.message.trim() || input.chips.some((chip: any) => chip.type === lowCodeFocusChipDef.type);
      if (!canReplace) return;
      const chip = createLowCodeFocusChip(runtime.api, focus);
      panel.replaceFocusContent({ message: `对于[[chip:${chip.id}]]`, meta: { chips: [chip] } });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [focus, runtime.api]);

  return (
    <ChatPanel
      ref={panelRef}
      agent={agent}
      user={user}
      copilot={copilot}
      title={title}
      disabled={disabled}
      onUpload={onUpload}
      header={true}
      size="small"
      placeholder={`您好，我是${title}，请描述要生成或修改的低代码页面`}
      defaultFocusPlaceholder="您可以描述当前页面或组件要如何调整"
      messagesRenderVariant="card"
      selectorRenderInTop={false}
    />
  );
}

export default function pluginLowCodeAI(params: PluginLowCodeAIParams): PluginLowCodeAIAPI & Record<string, any> {
  const {
    name = "低代码助手",
    user,
    key,
    onRequest,
    onUpload,
    onDownload,
    llm,
    history,
    sender,
    disabledModes,
    system,
    tools,
    skills,
    getUserContextMessage,
    onOperatorActions,
    enableRenderingOptimization = false,
  } = params;

  // 先设置 KV 命名空间，再恢复模型选择，避免读取到上一个 plugin 实例的状态。
  pluginContext.setPluginKey(key);
  const runtime: LowCodeDesignerRuntime = {};
  const agentKey = `${key}_lowcode`;
  pluginContext.configureLLMProvider(key, llm?.providers);
  const requestAsStream: RequestAsStreamFn =
    pluginContext.createLLMRequest(key, agentKey) ?? onRequest ?? createRequestAsStream();
  const upload = onUpload ?? createOnUpload();
  const download = onDownload ?? defaultDownload;
  const copilot = { name };
  let agentRef: CodeAgent | undefined;
  let disabled = false;
  const viewListeners = new Set<() => void>();

  const notifyView = () => viewListeners.forEach((listener) => listener());

  pluginContext.name = name;
  pluginContext.pluginParams = {
    ...(pluginContext.pluginParams ?? {}),
    name,
    user,
    onUpload: upload,
    onDownload: download,
  };

  const ensureAgent = () => {
    if (agentRef) return agentRef;

    const sandbox: Sandbox = {
      ...emptySandbox,
      getContext: async () => {
        const sections = [buildLowCodeStableContext(runtime)].filter(Boolean);
        return sections.length ? sections.join("\n\n") : null;
      },
      getSandboxMetaSection: async () => {
        return runtime.api ? "<canvas-info>\n当前在设计器画布中，只能通过 lowcode_generate_page、lowcode_clear_page 修改设计器画布中的内容。\n </canvas-info>" : null;
      },
    };

    agentRef = new CodeAgent({
      key: agentKey,
      history: history ?? new IDBHistory({ dbName: "@plugin-ai/plugin-lowcode/messages" }),
      request: requestAsStream,
      sandbox,
      builtinTools: false,
      promptOptions: lowCodePromptOptions,
      system,
      getAttachmentContextMessages: async () => {
        const sections = [await getUserContextMessage?.()].filter(Boolean) as string[];
        return sections;
      },
      tools: [...createLowCodeTools({ runtime, onOperatorActions, enableRenderingOptimization }), ...(tools ?? [])],
      ...(skills?.length ? { skills } : {}),
      disabledModes,
      ...(sender ? { sender } : {}),
      summary: { enabled: false },
      compact: { enabled: false },
    } as any);
    agentRef.chipRegistry.register(lowCodeFocusChipDef);
    pluginContext.agentMap.set(agentKey, agentRef);
    notifyView();
    return agentRef;
  };

  const requestAI = async (requestParams: LowCodeRequestParams) => {
    const agent = ensureAgent();
    const focusChip = runtime.focus ? createLowCodeFocusChip(runtime.api, runtime.focus) : undefined;
    const message = `${focusChip ? `对于[[chip:${focusChip.id}]]` : ""}${requestParams.message ?? ""}`;
    const attachments = normalizeAttachments(requestParams.attachments);
    pluginContext.aiQueue.send(
      agentKey,
      async () => {
        pluginContext.aiQueue.registerAbort(agentKey, () => agent.abort());
        await agent.requestAI({
          message,
          attachments,
          mode: AgentModeEnum.Build,
          meta: {
            ...(requestParams.meta ?? {}),
            ...(focusChip ? { chips: [...(requestParams.meta?.chips ?? []), focusChip] } : {}),
          },
        });
      },
      { message, attachments, ...(focusChip ? { meta: { chips: [focusChip] } } : {}) }
    );
  };

  const PluginView = () => {
    const [, setVersion] = useState(0);
    useEffect(() => {
      const listener = () => setVersion((value) => value + 1);
      viewListeners.add(listener);
      return () => {
        viewListeners.delete(listener);
      };
    }, []);

    const agent = useMemo(() => ensureAgent(), []);
    return (
      <LowCodeAIView
        agent={agent}
        runtime={runtime}
        user={user}
        copilot={copilot}
        title={name}
        disabled={disabled}
        onUpload={upload}
      />
    );
  };

  return {
    name: "@mybricks/plugins/lowcode-ai",
    title: name,
    author: "MyBricks",
    ["author.zh"]: "MyBricks",
    version: "0.0.1",
    description: "lowcode ai for MyBricks",
    controller: {
      disable() {
        disabled = true;
        pluginContext.setDisabled(true);
        notifyView();
      },
      enable() {
        disabled = false;
        pluginContext.setDisabled(false);
        notifyView();
      },
      setDisabled(value: boolean) {
        disabled = value;
        pluginContext.setDisabled(value);
        notifyView();
      },
      requestAI,
      getAgent() {
        return agentRef;
      },
    },
    contributes: {
      aiService: {
        init(api: LowCodeDesignerAPI) {
          runtime.api = api;
          registerLowCodeMockActions(runtime);
          ensureAgent();
          notifyView();

          return {
            focus(params: LowCodeFocusParams) {
              console.log('params', params)
              runtime.focus = params ? { ...params } : undefined;
              pluginContext.currentFocus = runtime.focus as any;
              pluginContext.events.emit("focus", runtime.focus as any);
              notifyView();
            },
            request(params: LowCodeRequestParams) {
              if (params.onProgress && runtime.focus) {
                runtime.focus.onProgress = params.onProgress;
              }
              void requestAI(params);
            },
          };
        },
      },
      aiView: {
        render(_api: any) {
          return <PluginView />;
        },
        display() {
          pluginContext.events.emit("aiViewDisplay", true);
        },
        hide() {},
      },
      aiStartView: {
        render(_api: any) {
          return <PluginView />;
        },
      },
    },
  };
}
