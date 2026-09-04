import { CodeAgent, IDBHistory, isFileExcluded } from "../../../agent/src";
import type { AgentSandbox, AgentSandboxFileEntry, AgentSandboxListOptions, Tool, CodeAgentPlugin, History, TurnSender, SkillFile, UnifiedFile, AgentOptions } from "../../../agent/src";
import { getCodeAgentSystemPrompt } from "../../../agent/src/code-agent/prompt";
import type { PromptSections } from "../../../kit/src";
import { buildDirectoryInfoSection, buildProjectInfoSection, promptSectionsAdaptToPromptOption } from "../../../kit/src";
import type { RequestAsStreamFn } from "../../../request/src";
import type { Hooks, SandboxChipsConfig } from "./types";
import { context } from "../context";
import {
  type ConnectToAIResult,
  type PluginParams,
  type AgentRuntimeRef,
  type SkillRuntimeContext,
  injectSkillRuntimeContext,
  injectPluginRuntimeContext,
  PROJECT_CONTEXT_EXCLUDE,
  registerChips,
} from "./connect-shared";

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function createReadonlyVirtualEntry(file: UnifiedFile): AgentSandboxFileEntry {
  return {
    path: normalizePath(file.path),
    type: "file",
    permissions: { read: true, write: false, delete: false },
    lineCount: file.content ? file.content.split(/\r\n|\r|\n/).length : 0,
  };
}

function mergeVirtualFileEntries(
  realEntries: AgentSandboxFileEntry[],
  virtualFiles: UnifiedFile[],
  directory = "",
  options: AgentSandboxListOptions = {},
): AgentSandboxFileEntry[] {
  const normalizedDirectory = normalizePath(directory);
  const entries = new Map(realEntries.map((entry) => [normalizePath(entry.path), entry]));

  for (const virtualFile of virtualFiles) {
    const virtualPath = normalizePath(virtualFile.path);
    const relativePath = normalizedDirectory
      ? virtualPath.startsWith(`${normalizedDirectory}/`) ? virtualPath.slice(normalizedDirectory.length + 1) : ""
      : virtualPath;
    if (!relativePath) continue;

    const segments = relativePath.split("/");
    const visibleSegments = options.recursive ? segments : segments.slice(0, 1);
    for (let index = 1; index < visibleSegments.length; index++) {
      const relativeDirectory = visibleSegments.slice(0, index).join("/");
      const path = normalizedDirectory ? `${normalizedDirectory}/${relativeDirectory}` : relativeDirectory;
      entries.set(path, {
        path,
        type: "directory",
        permissions: { read: true, write: false, delete: false },
      });
    }

    if (options.recursive || segments.length === 1) {
      entries.set(virtualPath, createReadonlyVirtualEntry(virtualFile));
    } else {
      const path = normalizedDirectory ? `${normalizedDirectory}/${segments[0]}` : segments[0];
      entries.set(path, {
        path,
        type: "directory",
        permissions: { read: true, write: false, delete: false },
      });
    }
  }

  return Array.from(entries.values()).sort((a, b) => normalizePath(a.path).localeCompare(normalizePath(b.path)));
}

export function connectToAIFromSandbox(
  comId: string,
  { agentSandbox, hooks, chips }: { agentSandbox: AgentSandbox; hooks?: Hooks; chips?: SandboxChipsConfig },
  {
    requestAsStream, llmPluginKey, virtualFiles, skills, plugins, promptSections, tools,
    getUserContextMessage, projectContext, formatUserMessage, disabledModes,
    disabledHandler, history, sender, agentRuntimeRefs, localAgent,
  }: Omit<PluginParams, "initialFiles" | "codeRules" | "designRules" | "remoteAgent">
): ConnectToAIResult {
  const agentKey = context.getAgentKey(comId);
  registerChips(agentKey, chips);
  const runtimeRef: AgentRuntimeRef = agentRuntimeRefs.get(agentKey) ?? { current: undefined };
  agentRuntimeRefs.set(agentKey, runtimeRef);
  const runtime = runtimeRef.current;
  const getRuntimePromptSections = (config = runtimeRef.current) => config?.promptSections ?? promptSections;
  const getRuntimeTools = (config = runtimeRef.current) => config?.tools ?? tools;
  const activeTools = getRuntimeTools(runtime);
  const promptOptions = promptSectionsAdaptToPromptOption(getRuntimePromptSections(runtime));
  const runtimeContext: SkillRuntimeContext = { agentSandbox };
  const getRuntimeSkills = (config = runtimeRef.current) =>
    (config?.skills ?? skills)?.map((skill) => injectSkillRuntimeContext(skill, runtimeContext));
  const getRuntimeVirtualFiles = () => runtimeRef.current?.virtualFiles ?? virtualFiles;
  const runtimeSkills = getRuntimeSkills(runtime);
  const runtimePlugins = plugins?.map((plugin) => injectPluginRuntimeContext(plugin, runtimeContext));
  const effectivePlugins = context.applyPluginEnabledOverrides(runtimePlugins);
  const requestGuard = { disabledHandler };

  if (context.agentMap.has(agentKey)) {
    const existingAgent = context.agentMap.get(agentKey)!;
    context.aiQueue.setRequestGuard(existingAgent, requestGuard);
    return { history: existingAgent.getHistory(), disabledHandler, isRemoteAgent: false };
  }

  const getProjectContextFiles = async (): Promise<{
    files: UnifiedFile[];
    directEntries: AgentSandboxFileEntry[];
  }> => {
    const scope = projectContext?.type ?? "project";
    const entries: AgentSandboxFileEntry[] = [];
    const directEntries: AgentSandboxFileEntry[] = [];
    const visit = async (path = ""): Promise<void> => {
      const children = await agentSandbox.files.list(path);
      for (const entry of children) {
        if (isFileExcluded({ path: entry.path, content: "" }, PROJECT_CONTEXT_EXCLUDE)) continue;
        if (!path) directEntries.push(entry);
        if (entry.type === "directory") {
          if (scope === "project") await visit(entry.path);
        } else {
          entries.push(entry);
        }
      }
    };
    await visit();
    return {
      files: entries.map((entry) => ({
        path: entry.path,
        content: entry.lineCount && entry.lineCount > 1 ? "\n".repeat(entry.lineCount - 1) : "",
      })),
      directEntries,
    };
  };

  const getVirtualFiles = async (): Promise<UnifiedFile[]> => {
    const fn = getRuntimeVirtualFiles();
    if (!fn) return [];
    return fn({ getEffectiveLibrariesSection: async () => "" });
  };
  let virtualFilesSnapshot: Promise<UnifiedFile[]> | undefined;
  const getVirtualFilesSnapshot = () => virtualFilesSnapshot ??= getVirtualFiles();
  const refreshVirtualFilesSnapshot = async () => {
    virtualFilesSnapshot = getVirtualFiles();
    await virtualFilesSnapshot;
  };

  const sandboxHooks: Hooks = {
    ...hooks,
    async beforeTurn(params) {
      await refreshVirtualFilesSnapshot();
      await hooks?.beforeTurn?.(params);
    },
  };

  const codeAgentSandbox: AgentSandbox = {
    files: {
      list: async (path = "", options = {}) => mergeVirtualFileEntries(
        await agentSandbox.files.list(path, options),
        await getVirtualFilesSnapshot(),
        path,
        options,
      ),
      read: async (path) => {
        const normalizedPath = path.replace(/^\/+/, "");
        const vfs = await getVirtualFilesSnapshot();
        const vf = vfs.find((f) => f.path.replace(/^\/+/, "") === normalizedPath);
        if (vf) return { ...vf, permissions: { read: true, write: false, delete: false } };
        return agentSandbox.files.read(path);
      },
      readFiles: async (paths) => {
        const vfs = await getVirtualFilesSnapshot();
        const vfMap = new Map(vfs.map((f) => [f.path.replace(/^\/+/, ""), f]));
        const realPaths = paths.filter((path) => !vfMap.has(path.replace(/^\/+/, "")));
        // Preserve the host's bulk-read contract. Calling read(path) here
        // turns one grep/files request into one HTTP request per file.
        const realFiles = await agentSandbox.files.readFiles(realPaths);
        const realFileMap = new Map(realFiles.map((file) => [file.path.replace(/^\/+/, ""), file]));
        return paths.flatMap((path) => {
          const normalizedPath = path.replace(/^\/+/, "");
          const vf = vfMap.get(normalizedPath);
          if (vf) return [{ ...vf, permissions: { read: true, write: false, delete: false } } as UnifiedFile];
          const realFile = realFileMap.get(normalizedPath);
          return realFile ? [realFile] : [];
        });
      },
      write: agentSandbox.files.write.bind(agentSandbox.files),
      writeFiles: agentSandbox.files.writeFiles.bind(agentSandbox.files),
      remove: agentSandbox.files.remove.bind(agentSandbox.files),
      removeFiles: agentSandbox.files.removeFiles.bind(agentSandbox.files),
    },
    commands: agentSandbox.commands,
  };

  const agent = new CodeAgent({
    key: agentKey,
    history: history ?? new IDBHistory({ dbName: "@plugin-ai/plugin/messages" }),
    request: (llmPluginKey ? context.createLLMRequest(llmPluginKey, agentKey) : undefined) ?? requestAsStream,
    sandbox: codeAgentSandbox,
    tools: [...(activeTools ?? [])],
    promptOptions,
    hooks: sandboxHooks,
    skills: runtimeSkills,
    plugins: effectivePlugins,
    subAgents: [],
    disabledModes,
    ...(localAgent ? { mask: { maxTurns: 20 } } : {}),
    getAttachmentContextMessages: async () => {
      const sections: string[] = [];
      const { files, directEntries } = await getProjectContextFiles();
      const projectInfo = projectContext?.type === "directory"
        ? buildDirectoryInfoSection({
          workingDirectory: projectContext.directory,
          entries: directEntries.map((entry) => `${entry.path}${entry.type === "directory" ? "/" : ""}`),
        })
        : buildProjectInfoSection(files);
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
      return { ...sandboxFormattedParams, message: userFormattedParams.message };
    },
  });

  context.aiQueue.setRequestGuard(agent, requestGuard);

  const baseTools = (agent as any)._base.tools as Tool[];
  const builtinTools = baseTools.slice(0, baseTools.length - (activeTools?.length ?? 0));
  runtimeRef.apply = (config) => {
    const nextTools = getRuntimeTools(config) ?? [];
    const nextSkills = getRuntimeSkills(config) ?? [];
    (agent as any)._base.skills = nextSkills;
    (agent as any)._base.tools = [...builtinTools, ...nextTools];
    (agent as any)._rebuildDynamicTools();
    (agent as any).options.system = getCodeAgentSystemPrompt(
      promptSectionsAdaptToPromptOption(getRuntimePromptSections(config))
    );
  };

  context.agentMap.set(agentKey, agent);
  context.sandboxMap.set(agentKey, codeAgentSandbox);
  context.registerAgentComId(comId);

  return { history: agent.getHistory(), disabledHandler, isRemoteAgent: false };
}
