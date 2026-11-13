import {
  DEFAULT_CONFIG_DIR_NAME,
  MergedHistory,
  SessionHTTPHistory,
  isFileExcluded,
  type AgentSandbox,
  type CodeAgentPlugin,
  type CodeAgentPluginFactory,
  type Sandbox as SandboxV1,
  type Tool,
  type TurnRecord,
  type UnifiedFile,
} from "../../../agent/src";
import {
  createBashTool,
  createDeleteTool,
  createEditTool,
  createGrepTool,
  createInitProjectTool,
  createMultiEditTool,
  createMultiWriteTool,
  createReadTool,
  createSkillTool,
  createWriteTool,
  INIT_PROJECT_TOOL_NAME,
} from "../../../agent/src/code-agent/tools";
import { buildAlwaysLoadedSkillsSection, buildEnvironmentSection } from "../../../agent/src/code-agent";
import { AgentModeEnum, buildModeStatusSection } from "../../../agent/src/mode-manager";
import type { AuditPowerImplementation, DomainAuditImplementation } from "../../../kit/src";
import { buildDevelopmentGuideContext, buildProjectInfoSection } from "../../../kit/src";
import { context } from "../context";
import { getPluginLocale, lang } from "../i18n";
import { HttpAgent } from "../ui/chat/chat-panel/remote/http-agent";
import { WebSocketAgent } from "../ui/chat/chat-panel/websocket-agent";
import { createBuiltInSandboxPlugins } from "./plugins";
import { createCheckStatusTool } from "./tools/check-status";
import type { Designer, Hooks, MentionProvider, SandboxChipsConfig } from "./types";
import {
  getProjectContextExclude,
  injectPluginRuntimeContext,
  injectSkillRuntimeContext,
  registerChips,
  registerMentions,
  type AgentRuntimeRef,
  type ConnectToAIResult,
  type PluginParams,
  type RemoteFileSystem,
  type SkillRuntimeContext,
} from "./connect-shared";

interface RemoteSandboxRegistration {
  agentSandbox: AgentSandbox;
  pageAnalysis?: AuditPowerImplementation;
  designer?: Designer;
  domainAudit?: DomainAuditImplementation;
  tasksManager?: any;
  hooks?: Hooks;
  chips?: SandboxChipsConfig;
  mentions?: MentionProvider[];
}

function collectBrowserTools(params: { baseTools: Tool[]; plugins: CodeAgentPlugin[] }): Tool[] {
  return [
    ...params.baseTools,
    ...params.plugins.flatMap((plugin) => plugin.tools ?? []),
    // 服务端也可能将子 Agent 的工具调用代理到浏览器。
    ...params.plugins.flatMap((plugin) => (plugin.agents ?? []).flatMap((agent) => agent.tools ?? [])),
  ];
}

// ─── onBackendComplete 回调 ──────────────────────────────────────────────────
// 通过关键词判断 AI 回复是否表达「已完成」，供宿主的 onBackendComplete 回调使用（如自动跟进提问）。

const BACKEND_COMPLETE_KEYWORDS = ["已完成", "全部完成", "是"];
const BACKEND_INCOMPLETE_KEYWORDS = [
  "未完成",
  "未建成",
  "未开发",
  "未发布",
  "未就绪",
  "未通过",
  "暂缓",
  "失败",
  "异常",
  "中断",
  "阻塞",
  "平台侧问题",
];

function isBackendComplete(answer: string, keywords: string[] = BACKEND_COMPLETE_KEYWORDS): boolean {
  const normalized = answer.toLowerCase();
  const hasIncomplete = BACKEND_INCOMPLETE_KEYWORDS.some((keyword) =>
    normalized.includes(keyword.toLowerCase())
  );
  if (hasIncomplete) return false;
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function getTurnAnswer(turn: TurnRecord): string {
  return turn.iterations
    .filter((iter: any): iter is Exclude<typeof iter, { type: "warmup" }> => !("type" in iter))
    .map((iter: any) => iter.content)
    .join("")
    .trim();
}

function createBackendCompleteHook(existingHooks?: Hooks): NonNullable<Hooks["afterTurn"]> {
  return async (turn) => {
    await existingHooks?.afterTurn?.(turn);

    if (turn.status !== "success") return;

    const onBackendComplete = context.pluginParams.onBackendComplete as
      | ((complete: boolean, answer: string) => void)
      | undefined;
    if (!onBackendComplete) return;

    const answer = getTurnAnswer(turn);
    try {
      onBackendComplete(isBackendComplete(answer), answer);
    } catch (error) {
      console.error("[plugin-ai] onBackendComplete callback failed:", error);
    }
  };
}

/** WebSocket Agent 走 MCP 工具在本地 sandbox 上操作文件，没有服务端 workspace 文件系统。 */
const unsupportedRemoteFs: RemoteFileSystem = {
  async applyOperations() {
    throw new Error("[plugin-ai] WebSocket agent does not expose a remote file system.");
  },
};

/** HTTP Agent 绑定宿主的本地视图，并将远端文件操作交给 AgentSandbox。 */
export function connectToRemoteAI(
  comId: string,
  registration: RemoteSandboxRegistration,
  params: PluginParams & { remoteAgent: NonNullable<PluginParams["remoteAgent"]> },
): ConnectToAIResult {
  const { remoteAgent, disabledHandler, disabledModes, sender, plugins, tools, configDirName, llmPluginKey, agentRuntimeRefs, codeRules, designRules } = params;
  const resolvedConfigDirName = configDirName ?? DEFAULT_CONFIG_DIR_NAME;
  const agentKey = context.getAgentKey(comId);
  const { agentSandbox, pageAnalysis, designer, domainAudit, tasksManager, hooks, chips, mentions } = registration;
  registerChips(agentKey, chips);
  registerMentions(agentKey, mentions);
  const runtimeRef: AgentRuntimeRef = agentRuntimeRefs.get(agentKey) ?? { current: undefined };
  agentRuntimeRefs.set(agentKey, runtimeRef);
  const activeTools = runtimeRef.current?.tools ?? tools;
  const runtimePlugins = [
    ...createBuiltInSandboxPlugins({ configDirName: resolvedConfigDirName, pageAnalysis }),
    ...(plugins ?? []),
  ].map((plugin) => {
    const withSandbox = typeof plugin === "function" && (tasksManager || domainAudit)
      ? ((ctx: Parameters<typeof plugin>[0]) => plugin({ ...ctx, sandbox: Object.assign({}, ctx.sandbox, { tasksManager, domainAudit }) }))
      : plugin;
    return injectPluginRuntimeContext(withSandbox, { agentSandbox, designer, codeRules, designRules });
  });
  const requestGuard = { disabledHandler };
  if (context.agentMap.has(agentKey)) {
    const existingAgent = context.agentMap.get(agentKey)!;
    context.aiQueue.setRequestGuard(existingAgent, requestGuard);
    // WebSocket Agent 没有 remoteFs，用 unsupported 实现兜底，保持返回类型完整。
    return { history: existingAgent.getHistory(), disabledHandler, isRemoteAgent: true, remoteFs: existingAgent.remoteFs ?? unsupportedRemoteFs };
  }

  const staticPlugins = runtimePlugins.filter((plugin): plugin is CodeAgentPlugin => typeof plugin !== "function");
  const browserTools = collectBrowserTools({
    baseTools: [
      ...(designer ? [createCheckStatusTool({ current: designer }), createInitProjectTool(agentSandbox)] : []),
      ...(activeTools ?? []),
    ],
    plugins: staticPlugins,
  });
  // 宿主的 onBackendComplete 回调通过 afterTurn hook 实现，两种远程 Agent 类型都接入。
  const autoFollowUpHook = createBackendCompleteHook(hooks);
  const wrappedHooks: Hooks = { ...hooks, afterTurn: autoFollowUpHook };

  if ((remoteAgent.type ?? "http") === "websocket") {
    // 创建 WebSocket Agent（新的 MCP 方式）
    const wsToken = remoteAgent.token;
    const wsSession = remoteAgent.session;
    if (!wsToken || !wsSession) {
      throw new Error("[plugin-ai] WebSocket agent requires token and session");
    }

    // 远程智能体通过 WS 通道调用的工具由本插件在本地 AgentSandbox 上执行。
    // 与本地 CodeAgent 一致，用同一 sandbox 现造文件工具集，使 read_file/write_file/... 落到本地虚拟 FS。
    const runtimeContext: SkillRuntimeContext = { agentSandbox, designer, codeRules, designRules };
    const getRuntimeSkills = (config = runtimeRef.current) =>
      (config?.skills ?? params.skills)?.map((skill) => injectSkillRuntimeContext(skill, runtimeContext));
    const runtimeSkills = getRuntimeSkills();
    const skillTool = runtimeSkills?.length
      ? createSkillTool(runtimeSkills, resolvedConfigDirName, getPluginLocale())
      : null;
    // WS 无本地推理循环，本地 init-project（依赖 createFork）不可用；
    // 从 browserTools 里剔除本地 init-project，稍后换成走平台子智能体的远程版。
    const browserToolsWithoutInit = browserTools.filter((tool) => tool.name !== INIT_PROJECT_TOOL_NAME);
    const localExecTools: Tool[] = [
      createReadTool(agentSandbox),
      createWriteTool(agentSandbox),
      createMultiWriteTool(agentSandbox),
      createEditTool(agentSandbox),
      createMultiEditTool(agentSandbox),
      createDeleteTool(agentSandbox),
      createGrepTool(agentSandbox),
      createBashTool(agentSandbox.commands),
      ...(skillTool ? [skillTool] : []),
      ...browserToolsWithoutInit,
    ];

    // 计划模式读写（getPlanFile / abandonPlan）需要 Sandbox V1 视图，从 AgentSandbox 适配。
    const planSandbox: SandboxV1 = {
      getFiles: async () => {
        const entries = await agentSandbox.files.list("", { recursive: true });
        return agentSandbox.files.readFiles(
          entries.filter((entry) => entry.type !== "directory").map((entry) => entry.path),
        );
      },
      updateFiles: (files) => agentSandbox.files.writeFiles(files),
      deleteFiles: (paths) => agentSandbox.files.removeFiles(paths),
    };

    const agentRef: { current?: WebSocketAgent } = {};
    const sessionHistory = new SessionHTTPHistory({
      baseUrl: remoteAgent.baseUrl ?? "http://112.17.139.222:8106",
      token: wsToken,
      session: wsSession,
      getSessionId: () => agentRef.current?.sessionId,
    });
    // 历史附件 blob 下载完成后重新 emit ready，让 use-session 的订阅回调
    // 重新 getTurns + commit，把 uploading 占位刷新为图片
    sessionHistory.onAttachmentsResolved = () => {
      agentRef.current?.historyManager.markReady();
    };
    const wsHistory = params.history ? new MergedHistory(sessionHistory, params.history) : sessionHistory;

    // seed 对应 prompt.js 中 system 之后、用户输入之前的两条动态 user 内容（系统提示词由平台侧固定配置，不重复注入）：
    //   user[1] = 前端开发指南（getContext），本地 CodeAgent 由 getStableContextMessages 注入；
    //   user[2] = 环境信息(skills/日期/模式) + 项目空间元信息，本地由 getAttachmentContextMessages 注入。
    // 这里在无 history 的新会话首轮之前，用同一套 builder 复刻这两条并追加到远程会话。
    const getRuntimePromptSections = (config = runtimeRef.current) => config?.promptSections ?? params.promptSections;
    const getContext = designer
      ? async () => buildDevelopmentGuideContext({
        promptSections: getRuntimePromptSections(),
        codeRules,
        designRules,
        libraries: await designer.getEffectiveLibraries(),
      })
      : agentSandbox.getContext?.bind(agentSandbox);
    const buildSeedMessages = async (): Promise<string[]> => {
      const messages: string[] = [];
      // 第一条：开发指南
      try {
        const guide = await getContext?.();
        if (guide) messages.push(guide);
      } catch (error) {
        console.warn("[plugin-ai] build dev guide seed failed", error);
      }
      // 第二条：环境信息 + 项目空间元信息，拼接顺序与本地 CodeAgent 的 getAttachmentContextMessages 对齐。
      try {
        const sections: string[] = [];
        const seedSkills = getRuntimeSkills() ?? [];
        const seedSubAgents = staticPlugins.flatMap((plugin) => plugin.agents ?? []);
        const envSection = buildEnvironmentSection(
          seedSkills.length ? seedSkills : undefined,
          seedSubAgents.length ? seedSubAgents : undefined,
        );
        const alwaysSkillsSection = await buildAlwaysLoadedSkillsSection(seedSkills);
        const modeSection = await buildModeStatusSection({
          mode: AgentModeEnum.Build,
          disabledModes,
          getFiles: planSandbox.getFiles,
        });
        const envText = [envSection, alwaysSkillsSection, modeSection].filter(Boolean).join("\n\n");
        if (envText) sections.push(envText);
        // 项目空间元信息：与本地 CodeAgent 的 getAttachmentContextMessages 构造方式一致。
        const projectEntries = await agentSandbox.files.list("", { recursive: true });
        const exclude = getProjectContextExclude(resolvedConfigDirName);
        const projectFiles: UnifiedFile[] = projectEntries
          .filter((entry) => entry.type !== "directory" && !isFileExcluded({ path: entry.path, content: "" }, exclude))
          .map((entry) => ({
            path: entry.path,
            content: entry.lineCount && entry.lineCount > 1 ? "\n".repeat(entry.lineCount - 1) : "",
          }));
        const projectInfo = buildProjectInfoSection(projectFiles, { ignoredDirectories: [resolvedConfigDirName] });
        if (projectInfo) sections.push(projectInfo);
        if (sections.length) messages.push(sections.join("\n\n"));
      } catch (error) {
        console.warn("[plugin-ai] build project info seed failed", error);
      }
      return messages;
    };

    const agent = new WebSocketAgent({
      baseUrl: remoteAgent.baseUrl ?? "http://112.17.139.222:8106",
      token: wsToken,
      session: wsSession,
      workspaceId: remoteAgent.workspaceId,
      agentCode: remoteAgent.agentCode,
      projectId: remoteAgent.projectId,
      appType: remoteAgent.appType,
      clientType: remoteAgent.clientType,
      meta: remoteAgent.meta,
      sessionId: remoteAgent.sessionId,
    }, {
      // disabled 状态由统一的 DisabledHandler 判断，与 HttpAgent / CodeAgent 保持一致。
      disabled: () => disabledHandler.isDisabled(),
      onDisabledRequest: () => disabledHandler.message(lang.common.noPermission()),
      ...(disabledModes ? { disabledModes } : {}),
      tools: localExecTools,
      sandbox: planSandbox,
      hooks: wrappedHooks,
      history: wsHistory,
      historyKey: agentKey,
      getSeedMessages: buildSeedMessages,
      onSessionReset: remoteAgent.onSessionReset,
    });
    agentRef.current = agent;
    agent.start(); // 依赖绑定完成后再触发历史加载

    if (llmPluginKey) {
      context.createLLMRequest(llmPluginKey, agent.key);
    }
    context.aiQueue.setRequestGuard(agent, requestGuard);
    context.agentMap.set(agentKey, agent);
    context.sandboxMap.set(agentKey, agentSandbox);
    context.registerAgentComId(comId);
    return { history: agent.getHistory(), disabledHandler, isRemoteAgent: true, remoteFs: unsupportedRemoteFs };
  }

  const agent = new HttpAgent(
    { baseUrl: remoteAgent.baseUrl, workspaceId: remoteAgent.workspaceId, agentId: remoteAgent.agentId },
    {
      disabledHandler, disabledModes, browserTools, hooks: wrappedHooks, plugins: staticPlugins,
      onVersionSaved: remoteAgent.onVersionSaved,
      pluginFactories: runtimePlugins.filter((plugin): plugin is CodeAgentPluginFactory => typeof plugin === "function"),
      pluginContext: { sandbox: agentSandbox, configDirName: resolvedConfigDirName },
      sender,
    },
  );
  const workspaceReady = agent.files.bindSandbox(agentSandbox);
  if (llmPluginKey) context.createLLMRequest(llmPluginKey, agent.key);
  context.aiQueue.setRequestGuard(agent, requestGuard);
  context.agentMap.set(agentKey, agent);
  context.sandboxMap.set(agentKey, agentSandbox);
  context.registerAgentComId(comId);
  return { history: agent.getHistory(), disabledHandler, isRemoteAgent: true, workspaceReady, remoteFs: agent.remoteFs };
}
