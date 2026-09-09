/** Default virtual/configuration directory used by CodeAgent. */
export const DEFAULT_CONFIG_DIR_NAME = ".agent";

/**
 * Normalizes the directory name used for CodeAgent-owned project resources.
 * It is intentionally one path segment: callers configure a directory name,
 * not an arbitrary project-relative path.
 */
export function normalizeConfigDirName(value?: string): string {
  const name = (value ?? DEFAULT_CONFIG_DIR_NAME).trim().replace(/\\/g, "/");
  if (!name || name === "." || name === ".." || name.includes("/")) {
    throw new Error(
      `configDirName must be a non-empty directory name without path separators; received: ${JSON.stringify(value)}`,
    );
  }
  return name;
}

/** Read the normalized config directory from a CodeAgent-like object. */
export function getConfigDirNameFromAgent(agent?: object | null): string {
  if (!agent || !("configDirName" in agent)) return normalizeConfigDirName();
  const value = (agent as { configDirName?: unknown }).configDirName;
  return normalizeConfigDirName(typeof value === "string" ? value : undefined);
}

export function getConfigDirPath(configDirName?: string): string {
  return `${normalizeConfigDirName(configDirName)}/`;
}

export function getPlanDir(configDirName?: string): string {
  return `${getConfigDirPath(configDirName)}plans/`;
}

export function getSkillsDir(configDirName?: string): string {
  return `${getConfigDirPath(configDirName)}skills/`;
}

export function getSkillDir(skillName: string, configDirName?: string): string {
  return `${getSkillsDir(configDirName)}${skillName}/`;
}

export function getAgentMdPath(configDirName?: string): string {
  return `${normalizeConfigDirName(configDirName)}/agent.md`;
}

export function isAgentRulePath(path: string, configDirName?: string): boolean {
  const agentMdPath = getAgentMdPath(configDirName);
  return path === agentMdPath || path.endsWith(`/${agentMdPath}`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getConfigDirPattern(configDirName?: string): string {
  return escapeRegExp(normalizeConfigDirName(configDirName));
}

export function getAgentInternalFileExclude(configDirName?: string): RegExp {
  return new RegExp(`(^|/)(?:${getConfigDirPattern(configDirName)}|\\.tmp)(/|$)`);
}

export function getPlanFilePattern(configDirName?: string): RegExp {
  return new RegExp(`^${escapeRegExp(getPlanDir(configDirName))}\\d{4}-\\d{2}-\\d{2}/[^/]+\\.md$`);
}
