import { CodeAgent, DEFAULT_CONFIG_DIR_NAME, IDBHistory, isFileExcluded } from "../../../agent/src";
import type { AgentOptions, Tool, CodeAgentPlugin, History, TurnSender, SkillFile, UnifiedFile } from "../../../agent/src";
import { createInitProjectTool } from "../../../agent/src/code-agent/tools";
import { getCodeAgentSystemPrompt } from "../../../agent/src/code-agent/prompt";
import type { Sandbox } from "../../../agent/src";
import type { PromptSections } from "../../../kit/src";
import { buildDevelopmentGuideContext, buildDirectoryInfoSection, buildProjectInfoSection, promptSectionsAdaptToPromptOption } from "../../../kit/src";
import type { RequestAsStreamFn } from "../../../request/src";
import type { Hooks, SandboxChipsConfig } from "./types";
import { attachFiles, hasInitialFiles } from "./initial-files";
import { createCheckStatusTool } from "./tools/check-status";
import { HttpAgent } from "../ui/chat/chat-panel/http-agent";
import { context } from "../context";
import type { Designer } from "./types";
import {
  type ConnectToAIResult,
  type PluginParams,
  type AgentRuntimeRef,
  type SkillRuntimeContext,
  type VirtualFilesRuntimeContext,
  injectSkillRuntimeContext,
  injectPluginRuntimeContext,
  formatLibraryDocs,
  getProjectContextExclude,
  registerChips,
} from "./connect-shared";

function collectBrowserTools(params: { baseTools: Tool[]; plugins?: CodeAgentPlugin[] }): Tool[] {
  const enabledPlugins = params.plugins?.filter((plugin) => plugin.enabled !== false) ?? [];
  return [
    ...params.baseTools,
    ...enabledPlugins.flatMap((plugin) => plugin.tools ?? []),
  ];
}

export function connectToAIFromV1(
  comId: string,
  { designer, hooks, chips }: { designer: Designer; hooks?: Hooks; chips?: SandboxChipsConfig },
  {
    requestAsStream, llmPluginKey, virtualFiles, configDirName, initialFiles, skills, plugins, promptSections, tools,
    codeRules, designRules, getUserContextMessage, projectContext, formatUserMessage, disabledModes,
    disabledHandler, history, remoteAgent, sender, agentRuntimeRefs, localAgent,
  }: PluginParams
): ConnectToAIResult {
  const resolvedConfigDirName = configDirName ?? DEFAULT_CONFIG_DIR_NAME;
  const agentKey = context.getAgentKey(comId);
  registerChips(agentKey, chips);
  const runtimeRef: AgentRuntimeRef = agentRuntimeRefs.get(agentKey) ?? { current: undefined };
  agentRuntimeRefs.set(agentKey, runtimeRef);
  const runtime = runtimeRef.current;
  const getRuntimePromptSections = (config = runtimeRef.current) => config?.promptSections ?? promptSections;
  const getRuntimeTools = (config = runtimeRef.current) => config?.tools ?? tools;
  const activePromptSections = getRuntimePromptSections(runtime);
  const activeTools = getRuntimeTools(runtime);
  const promptOptions = promptSectionsAdaptToPromptOption(activePromptSections);
  const runtimeContext: SkillRuntimeContext = { designer, codeRules, designRules };
  const getRuntimeSkills = (config = runtimeRef.current) =>
    (config?.skills ?? skills)?.map((skill) => injectSkillRuntimeContext(skill, runtimeContext));
  const getRuntimeVirtualFiles = () => runtimeRef.current?.virtualFiles ?? virtualFiles;
  const runtimeSkills = getRuntimeSkills(runtime);
  const runtimePlugins = plugins?.map((plugin) => injectPluginRuntimeContext(plugin, runtimeContext));
  const effectivePlugins = context.applyPluginEnabledOverrides(runtimePlugins);
  const requestGuard = { disabledHandler };
  const isRemoteAgent = Boolean(remoteAgent);

  if (context.agentMap.has(agentKey)) {
    const existingAgent = context.agentMap.get(agentKey)!;
    context.aiQueue.setRequestGuard(existingAgent, requestGuard);
    if (isRemoteAgent) {
      return {
        history: existingAgent.getHistory(),
        disabledHandler,
        isRemoteAgent: true,
        remoteFs: existingAgent.remoteFs,
      };
    }
    return {
      history: existingAgent.getHistory(),
      disabledHandler,
      isRemoteAgent: false,
    };
  }

  const designerRef: { current: Designer | undefined } = { current: designer };

  const getVirtualFiles = async (): Promise<UnifiedFile[]> => {
    const fn = getRuntimeVirtualFiles();
    if (!fn) return [];
    return fn({
      configDirName: resolvedConfigDirName,
      getEffectiveLibrariesSection: async (_options) => {
        const libraries = await designerRef.current?.getEffectiveLibraries() ?? [];
        return formatLibraryDocs(libraries);
      },
    });
  };

  const sandbox: Sandbox = {
    getFiles: async (options?) => {
      const mainFiles = await designer.getFiles();
      const realMainFiles: UnifiedFile[] = mainFiles.map((f) => ({
        path: f.path,
        content: f.content,
        permissions: { read: true, write: true, delete: true },
      }));
      const promptVirtualFiles = await getVirtualFiles();
      const readonlyTopFiles: UnifiedFile[] = promptVirtualFiles.map((f) => ({
        path: f.path,
        content: f.content,
        permissions: { read: true, write: false, delete: false },
      }));
      const normPath = (p: string) => p.replace(/^\/+/, "");
      const merged = new Map<string, UnifiedFile>(realMainFiles.map((f) => [normPath(f.path), f]));
      readonlyTopFiles.forEach((f) => merged.set(normPath(f.path), f));
      const all = Array.from(merged.values());
      return options?.exclude ? all.filter((f) => !isFileExcluded(f, options.exclude)) : all;
    },
    updateFiles: async (files) => designer.updateFiles(files),
    deleteFiles: async (paths) => designer.deleteFiles(paths),
    getContext: async () => {
      const d = designerRef.current;
      if (!d) return null;
      const libraries = await d.getEffectiveLibraries();
      return buildDevelopmentGuideContext({
        promptSections: getRuntimePromptSections(),
        codeRules,
        designRules,
        libraries,
      });
    },
  };

  const getProjectContextSnapshot = async (): Promise<{ files: UnifiedFile[]; directories: string[] }> => {
    const files = await sandbox.getFiles({ exclude: getProjectContextExclude(resolvedConfigDirName) });
    if ((projectContext?.type ?? "project") === "project") return { files, directories: [] };
    const rootPrefix = "";
    const directories = new Set<string>();
    const directFiles = files.filter((file) => {
      const path = file.path.replace(/^\/+/, "");
      if (root && !path.startsWith(rootPrefix)) return false;
      const relative = root ? path.slice(rootPrefix.length) : path;
      const slashIndex = relative.indexOf("/");
      if (slashIndex < 0) return true;
      directories.add(`${rootPrefix}${relative.slice(0, slashIndex)}`);
      return false;
    });
    return { files: directFiles, directories: Array.from(directories).sort() };
  };

  const checkStatusTool = createCheckStatusTool(designerRef);
  const initProjectTool = createInitProjectTool(sandbox);
  const browserTools = collectBrowserTools({
    baseTools: [checkStatusTool, initProjectTool, ...(activeTools ?? [])],
    plugins: effectivePlugins,
  });

  if (remoteAgent) {
    const agent = new HttpAgent(
      { baseUrl: remoteAgent.baseUrl, workspaceId: remoteAgent.workspaceId, agentId: remoteAgent.agentId },
      { disabledHandler, ...(disabledModes ? { disabledModes } : {}), browserTools, hooks }
    );
    if (llmPluginKey) context.createLLMRequest(llmPluginKey, agent.key);
    context.aiQueue.setRequestGuard(agent, requestGuard);
    const workspaceReady = !hasInitialFiles(initialFiles)
      ? agent.files.bindSandbox(sandbox)
      : attachFiles(agent, {
          sandbox,
          initialFiles,
          syncWorkspace: () => agent.files.bindSandbox(sandbox),
        });
    context.agentMap.set(agentKey, agent);
    context.sandboxMap.set(agentKey, sandbox);
    context.registerAgentComId(comId);
    return {
      history: agent.getHistory(),
      disabledHandler,
      isRemoteAgent: true,
      workspaceReady,
      remoteFs: agent.remoteFs,
    };
  }

  const agent = new CodeAgent({
    key: agentKey,
    history: history ?? new IDBHistory({ dbName: "@plugin-ai/plugin/messages" }),
    request: (llmPluginKey ? context.createLLMRequest(llmPluginKey, agentKey) : undefined) ?? requestAsStream,
    sandbox,
    configDirName: resolvedConfigDirName,
    tools: [checkStatusTool, initProjectTool, ...(activeTools ?? [])],
    promptOptions,
    hooks,
    skills: runtimeSkills,
    plugins: effectivePlugins,
    subAgents: [],
    disabledModes,
    ...(localAgent ? { mask: { maxTurns: 20 } } : {}),
    getAttachmentContextMessages: async () => {
      const sections: string[] = [];
      const { files, directories } = await getProjectContextSnapshot();
      const projectInfo = projectContext?.type === "directory"
        ? buildDirectoryInfoSection({
          workingDirectory: projectContext.directory,
          entries: [...directories.map((directory) => `${directory}/`), ...files.map((file) => file.path)].sort(),
        })
        : buildProjectInfoSection(files, { ignoredDirectories: [resolvedConfigDirName] });
      if (projectInfo) sections.push(projectInfo);
      const custom = await getUserContextMessage?.();
      if (custom) sections.push(custom);
      return sections;
    },
    formatUserMessage: async (params) => {
      const sandboxFormattedParams = {
        message: params.message,
        attachments: params.attachments,
        ...(params.meta ? { meta: params.meta } : {}),
        ...(params.extra ? { extra: params.extra } : {}),
        ...(sender ? { sender } : {}),
      };
      if (!formatUserMessage) return sandboxFormattedParams;
      const userFormattedParams = await formatUserMessage(sandboxFormattedParams);
      return {
        ...sandboxFormattedParams,
        message: userFormattedParams.message,
      };
    },
  });

  const workspaceReady = attachFiles(agent, { sandbox, initialFiles });
  context.aiQueue.setRequestGuard(agent, requestGuard);

  const baseTools = (agent as any)._base.tools as Tool[];
  const builtinTools = baseTools.slice(0, baseTools.length - 2 - (activeTools?.length ?? 0));
  runtimeRef.apply = (config) => {
    const nextTools = getRuntimeTools(config) ?? [];
    const nextSkills = getRuntimeSkills(config) ?? [];
    (agent as any)._base.skills = nextSkills;
    (agent as any)._base.tools = [...builtinTools, checkStatusTool, initProjectTool, ...nextTools];
    (agent as any)._rebuildDynamicTools();
    (agent as any).options.system = getCodeAgentSystemPrompt(
      promptSectionsAdaptToPromptOption(getRuntimePromptSections(config))
    );
  };

  context.agentMap.set(agentKey, agent);
  context.sandboxMap.set(agentKey, sandbox);
  context.registerAgentComId(comId);

  return { history: agent.getHistory(), disabledHandler, isRemoteAgent: false, workspaceReady };
}
