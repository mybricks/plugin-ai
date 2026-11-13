import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollup } from 'rollup';
import { transformAsync } from '@babel/core';
import { existsSync } from 'node:fs';
import path from 'node:path';

const bundle = await rollup({
  input: 'skill-locale-test',
  plugins: [{
    name: 'skill-locale-source',
    resolveId(source, importer) {
      if (source === 'skill-locale-test') return '\0skill-locale-test';
      if (source.startsWith('.') && importer && !path.extname(source)) {
        const base = path.resolve(path.dirname(importer), source);
        return existsSync(`${base}.ts`) ? `${base}.ts` : path.join(base, 'index.ts');
      }
      return null;
    },
    load(id) {
      if (id === '\0skill-locale-test') return `export { resolveLocalizedSkill, renderSkillContent, shouldAlwaysLoadSkill } from ${JSON.stringify(path.resolve('packages/agent/src/code-agent/skills.ts'))}; export { createSkillTool } from ${JSON.stringify(path.resolve('packages/agent/src/code-agent/tools/skill/index.ts'))}; export { resolveSubAgentConfig } from ${JSON.stringify(path.resolve('packages/agent/src/sub-agent/config.ts'))};`;
      return null;
    },
    async transform(code, id) {
      return id.endsWith('.ts') ? transformAsync(code, { filename: id, presets: ['@babel/preset-typescript'] }) : null;
    },
  }],
});
const { output } = await bundle.generate({ format: 'es' });
await bundle.close();
const { resolveLocalizedSkill, renderSkillContent, shouldAlwaysLoadSkill, createSkillTool, resolveSubAgentConfig } = await import(`data:text/javascript;base64,${Buffer.from(output[0].code).toString('base64')}`);

const skill = {
  name: 'example', displayName: '默认名称', files: [
    { path: 'SKILL.md', content: '---\nname: 默认名称\ndescription: 默认说明\nactivation: always\n---\n默认正文' },
    { path: 'SKILL.en.md', content: '---\ndisplayName: English name\ndescription: English description\nactivation: disabled\n---\nEnglish body' },
    { path: 'SKILL.en-GB.md', content: '---\ndisplayName: British name\n---' },
  ],
};

test('skill locale resolves name, metadata, content and default activation', async () => {
  assert.equal(resolveLocalizedSkill(skill, 'en-US').displayName, 'English name');
  assert.equal(resolveLocalizedSkill(skill, 'en-US').description, 'English description');
  assert.match((await renderSkillContent(skill, '.agent', 'en-US')).output, /English body/);
  assert.equal(resolveLocalizedSkill(skill, 'en-GB').displayName, 'British name');
  assert.match(resolveLocalizedSkill(skill, 'en-GB').content, /默认正文/);
  assert.equal(resolveLocalizedSkill(skill, 'fr').displayName, '默认名称');
  assert.equal(shouldAlwaysLoadSkill(skill), true);
  assert.equal((await renderSkillContent(skill, '.agent', 'en')).hasSupportFiles, false);
});

test('skill tool and sub-agent receive localized names and instructions', async () => {
  const tool = createSkillTool([skill], '.agent', 'en-US');
  const result = await tool.execute({ skill: 'example' });
  assert.equal(result.metadata.displayName, 'English name');
  assert.match(result.output, /English body/);
  const resolved = resolveSubAgentConfig({ locale: 'en-US', getTools: () => [] }, { name: 'test', description: '', skills: ['example'] }, [skill]);
  assert.match(resolved.system, /English body/);
});
