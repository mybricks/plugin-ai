import type { SkillFile } from '../../../agent/src';
import { resolveSkillMeta } from '../../../agent/src/code-agent/skills';

const OVERVIEW = 'plugin-ai://overview';
const GUIDE = 'plugin-ai://development-guide';

type Resource = { uri: string; name: string; description: string; mimeType: string };
export interface McpResourceProvider {
  getSkills(): SkillFile[];
  getDevelopmentGuide(): Promise<string | null>;
}

/** Builds a fresh catalog so runtime-injected skills and guide changes remain visible. */
export async function createMcpResourceCatalog(provider: McpResourceProvider) {
  const resources: Resource[] = [
    { uri: OVERVIEW, name: 'PluginAI resource overview', description: 'Index of the development guide and available skills.', mimeType: 'text/markdown' },
    { uri: GUIDE, name: 'Frontend development guide', description: 'Current MyBricks frontend, design, library and project development rules.', mimeType: 'text/markdown' },
  ];
  const entries = new Map<string, { skill: SkillFile; path: string }>();
  const skillSummaries: string[] = [];
  const seen = new Set<string>();
  for (const skill of provider.getSkills()) {
    if (seen.has(skill.name)) continue;
    seen.add(skill.name);
    await skill.updateContent?.();
    const main = skill.files.find(file => file.path === 'SKILL.md');
    if (!main) continue;
    const meta = resolveSkillMeta(main.content, skill.name);
    if (meta.activation === 'disabled') continue;
    const root = `plugin-ai://skills/${encodeURIComponent(skill.name)}`;
    const mainUri = `${root}/SKILL.md`;
    skillSummaries.push(`- ${skill.name}: ${meta.description}${meta.whenToUse ? ` (适用：${meta.whenToUse})` : ''}${meta.activation === 'manual' ? '（仅用户明确要求时使用）' : ''}${meta.activation === 'always' ? '（默认启用）' : ''} — ${mainUri}`);
    for (const file of skill.files) {
      const parts = file.path.split('/');
      if (parts.some(part => !part || part === '.' || part === '..')) continue;
      const uri = `${root}/${parts.map(encodeURIComponent).join('/')}`;
      if (entries.has(uri)) continue;
      entries.set(uri, { skill, path: file.path });
      resources.push({ uri, name: `${skill.name}/${file.path}`, description: file.path === 'SKILL.md' ? meta.description : `Supporting file for skill ${skill.name}`, mimeType: file.path.endsWith('.md') ? 'text/markdown' : 'text/plain' });
    }
  }
  return {
    resources,
    async read(uri: string): Promise<{ uri: string; mimeType: string; text: string }> {
      if (uri === OVERVIEW) return { uri, mimeType: 'text/markdown', text: [
        '# PluginAI 工作总纲',
        '先理解本总纲，再根据当前任务阅读开发规范和匹配的 Skill，最后使用工作区工具。完成任务后调用 exit_workspace。',
        `前端开发、设计或修改文件时，按需读取开发规范：${GUIDE}`,
        '使用设计器前读取默认启用的 Skill；任务匹配时读取对应 SKILL.md，并按需读取其支持文件。标记为仅用户明确要求时使用的 Skill 不应自行启用。',
        ...skillSummaries,
      ].join('\n\n') };
      if (uri === GUIDE) return { uri, mimeType: 'text/markdown', text: await provider.getDevelopmentGuide() ?? '当前没有前端开发规范。' };
      const entry = entries.get(uri);
      if (!entry) throw new Error(`Resource not found: ${uri}`);
      const file = entry.skill.files.find(item => item.path === entry.path);
      if (!file) throw new Error(`Resource not found: ${uri}`);
      return { uri, mimeType: entry.path.endsWith('.md') ? 'text/markdown' : 'text/plain', text: file.content };
    },
  };
}
