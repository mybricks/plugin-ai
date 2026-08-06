import React, { useEffect, useMemo, useState } from "react";

import { CodeAgent, IDBHistory, AgentModeEnum } from "../../agent/src";
import type { AgentOptions, History, Sandbox, TurnSender } from "../../agent/src";
import { createRequestAsStream, createOnUpload } from "../../request/src";
import type { ProviderConfig, RequestAsStreamFn } from "../../request/src";
import { ChatPanel } from "../../plugin/src/ui/chat";
import { context as pluginContext } from "../../plugin/src/context";

import type {
  LowCodeDesignerAPI,
  LowCodeDesignerRuntime,
  LowCodeFocusParams,
  LowCodeOperatorParams,
  LowCodeRequestParams,
} from "./designer";
import { buildLowCodeDesignerContext, buildLowCodeStableContext } from "./outline";
import { getLowCodeSystemPrompt } from "./prompt";
import { createLowCodeTools } from "./tools";
import { registerLowCodeMockActions } from "./tools/mock-actions";

export type {
  LowCodeDesignerAPI,
  LowCodeFocusParams,
  LowCodeOperatorParams,
  LowCodeRequestParams,
} from "./designer";
export {
  getComlibsDocs,
  getComponentsDocs,
} from "./outline";
export {
  LOWCODE_GET_PROJECT_CONTEXT_TOOL_NAME,
  LOWCODE_GET_COMPONENT_DOC_TOOL_NAME,
  LOWCODE_UPDATE_PAGE_TOOL_NAME,
  LOWCODE_CREATE_PAGE_TOOL_NAME,
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
  user?: User;
  copilot?: User;
  title: string;
  disabled: boolean;
  onUpload?: (file: File) => Promise<string>;
}) {
  const { agent, user, copilot, title, disabled, onUpload } = props;
  return (
    <ChatPanel
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
    getUserContextMessage,
    onOperatorActions,
    enableRenderingOptimization = false,
  } = params;

  const runtime: LowCodeDesignerRuntime = {};
  const agentKey = `${key}_lowcode`;
  const requestAsStream: RequestAsStreamFn = llm?.providers?.length
    ? createRequestAsStream()
    : (onRequest ?? createRequestAsStream());
  const upload = onUpload ?? createOnUpload();
  const download = onDownload ?? defaultDownload;
  const copilot = { name };
  let agentRef: CodeAgent | undefined;
  let disabled = false;
  const viewListeners = new Set<() => void>();

  const notifyView = () => viewListeners.forEach((listener) => listener());

  pluginContext.name = name;
  pluginContext.setPluginKey(key);
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
        return runtime.api ? "<canvas-info>\n当前在设计器画布中，只能通过 lowcode_update_page、lowcode_create_page、lowcode_clear_page 修改设计器画布中的内容。\n </canvas-info>" : null;
      },
    };

    agentRef = new CodeAgent({
      key: agentKey,
      history: history ?? new IDBHistory({ dbName: "@plugin-ai/plugin-lowcode/messages" }),
      request: requestAsStream,
      llm,
      sandbox,
      builtinTools: false,
      promptOptions: false,
      system: [getLowCodeSystemPrompt(), system].filter(Boolean).join("\n\n"),
      getAttachmentContextMessages: async () => {
        const sections = [
          buildLowCodeDesignerContext(runtime.api, runtime.focus),
          await getUserContextMessage?.(),
        ].filter(Boolean) as string[];
        return sections;
      },
      tools: createLowCodeTools({ runtime, onOperatorActions, enableRenderingOptimization }),
      disabledModes,
      ...(sender ? { sender } : {}),
      summary: { enabled: false },
      compact: { enabled: false },
    } as any);
    pluginContext.agentMap.set(agentKey, agentRef);
    notifyView();
    return agentRef;
  };

  const requestAI = async (requestParams: LowCodeRequestParams) => {
    const agent = ensureAgent();
    const message = requestParams.message ?? "";
    const attachments = normalizeAttachments(requestParams.attachments);
    pluginContext.aiQueue.send(
      agentKey,
      async () => {
        pluginContext.aiQueue.registerAbort(agentKey, () => agent.abort());
        await agent.requestAI({
          message,
          attachments,
          mode: AgentModeEnum.Build,
          ...(requestParams.meta ? { meta: requestParams.meta } : {}),
        });
      },
      { message, attachments }
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
              runtime.focus = params ? { ...params } : undefined;
              pluginContext.currentFocus = runtime.focus as any;
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
