import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAgentFixtures } from './helpers/load-agent.mjs';

const { scanProjectResources } = await loadAgentFixtures();

test('rule discovery prunes excluded directories and stops at ten path components', async () => {
  const files = [
    '.lingchuang/agent.md', 'app/.lingchuang/agent.md',
    'node_modules/pkg/.lingchuang/agent.md', 'app/dist/.lingchuang/agent.md',
    `${Array(8).fill('dir').join('/')}/.lingchuang/agent.md`,
    `${Array(9).fill('dir').join('/')}/.lingchuang/agent.md`,
  ];
  const entries = new Map([['', new Map()]]);
  for (const file of files) {
    const parts = file.split('/');
    for (let i = 0; i < parts.length; i++) {
      const parent = parts.slice(0, i).join('/');
      const path = parts.slice(0, i + 1).join('/');
      if (!entries.has(parent)) entries.set(parent, new Map());
      entries.get(parent).set(path, { path, type: i === parts.length - 1 ? 'file' : 'directory' });
    }
  }
  const listed = [];
  const sandbox = { files: {
    async list(path = '', options) {
      assert.notEqual(options?.recursive, true);
      listed.push(path);
      return [...(entries.get(path)?.values() ?? [])];
    },
    async readFiles(paths) { return paths.filter(path => files.includes(path)).map(path => ({ path, content: path })); },
  } };
  const result = await scanProjectResources(sandbox, {
    candidates: ['.lingchuang/agent.md'], matches: path => path.endsWith('/.lingchuang/agent.md') || path === '.lingchuang/agent.md',
  });
  assert.deepEqual(result.map(file => file.path).sort(), [
    '.lingchuang/agent.md', 'app/.lingchuang/agent.md',
    `${Array(8).fill('dir').join('/')}/.lingchuang/agent.md`,
  ].sort());
  assert.equal(listed.includes('node_modules'), false);
  assert.equal(listed.includes('app/dist'), false);
  assert.equal(listed.includes(`${Array(9).fill('dir').join('/')}/.lingchuang`), false);
});
