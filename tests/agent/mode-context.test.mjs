import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAgentFixtures } from './helpers/load-agent.mjs';

const { buildModeCatalogSection, buildModeStatusSection } = await loadAgentFixtures();

test('stable context lists modes while attachment contains only the current mode guide', async () => {
  const stable = buildModeCatalogSection({});
  assert.match(stable, /可用模式/);
  assert.doesNotMatch(stable, /计划文件建议结构|不允许创建、修改计划/);

  const getFiles = async () => [{ path: '.agent/plans/2026-10-28/example.md', content: '---\nstatus: active\n---\nplan' }];
  const plan = await buildModeStatusSection({ mode: 'plan', getFiles });
  assert.match(plan, /计划文件建议结构/);
  assert.match(plan, /\.agent\/plans\/2026-10-28\/example\.md/);
  assert.doesNotMatch(plan, /不允许创建、修改计划/);

  const build = await buildModeStatusSection({ mode: 'build', previousMode: 'plan', getFiles });
  assert.match(build, /不允许创建、修改计划/);
  assert.match(build, /当前已切换到「智能体模式」\(build\)。\n由于你现在处于智能体模式下/);
  assert.ok(build.indexOf('不允许创建、修改计划') < build.indexOf('## 计划状态'));
  assert.match(build, /上一轮是/);
  assert.match(build, /\.agent\/plans\/2026-10-28\/example\.md/);
  assert.doesNotMatch(build, /计划文件建议结构/);

  assert.equal(await buildModeStatusSection({ mode: 'build', disabledModes: ['plan'] }), '');
});
