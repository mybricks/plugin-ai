import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { rollup } from 'rollup';
import { transformAsync } from '@babel/core';

const bundle = await rollup({
  input: '\0grep-test-entry',
  plugins: [{
    name: 'typescript',
    resolveId(source, importer) {
      if (source === '\0grep-test-entry') return source;
      if (source.startsWith('.') && importer && !path.extname(source)) {
        const base = path.resolve(path.dirname(importer), source);
        return existsSync(`${base}.ts`) ? `${base}.ts` : path.join(base, 'index.ts');
      }
    },
    load(id) {
      if (id === '\0grep-test-entry') return [
        `export { createFileSystemGrepCommandProxy, createNativeGrepCommandProxy } from ${JSON.stringify(path.resolve('packages/agent/src/agent-sandbox/commands/grep.ts'))};`,
        `export { createAgentSandboxCommandExecutor } from ${JSON.stringify(path.resolve('packages/agent/src/agent-sandbox/commands/index.ts'))};`,
        `export { createGrepTool } from ${JSON.stringify(path.resolve('packages/agent/src/code-agent/tools/grep/index.ts'))};`,
      ].join('\n');
    },
    async transform(code, id) {
      if (id.endsWith('.ts')) return transformAsync(code, { filename: id, presets: ['@babel/preset-typescript'] });
    },
  }],
});
const { output } = await bundle.generate({ format: 'es' });
await bundle.close();
const { createFileSystemGrepCommandProxy, createNativeGrepCommandProxy, createAgentSandboxCommandExecutor, createGrepTool } = await import(`data:text/javascript;base64,${Buffer.from(output[0].code).toString('base64')}`);

const paths = ['apps/settle-in/src/a.ts', 'apps/settle-in/src/nested/b.tsx', 'apps/settle-in/src/c.js'];
const input = { pattern: 'TopFilter', glob: 'apps/settle-in/src/**/*.{ts,tsx}', outputMode: 'count', headLimit: 1, offset: 1 };
const request = { name: 'grep', input };

test('files-backed grep supports brace alternatives with pagination', async () => {
  const files = {
    list: async () => paths.map(path => ({ path, type: 'file' })),
    readFiles: async requested => requested.map(path => ({ path, content: 'TopFilter' })),
  };
  const result = await createFileSystemGrepCommandProxy(files).execute(request, () => {}, {});
  assert.equal(result.structured.totalCount, 2);
  assert.deepEqual(result.structured.matches, [{ path: paths[1], count: 1 }]);
});

test('native grep fallback filters brace alternatives before pagination', async () => {
  let calls = 0;
  const result = await createNativeGrepCommandProxy().execute(request, async () => ++calls === 1
    ? { exitCode: 127, stderr: 'rg: command not found', stdout: '' }
    : { exitCode: 0, stdout: paths.map(path => `./${path}:1:TopFilter`).join('\n') }, {});
  assert.equal(result.structured.totalCount, 2);
  assert.deepEqual(result.structured.matches, [{ path: paths[1], count: 1 }]);
});

test('local-iframe-style sandbox dispatches grep_search to the files proxy', async () => {
  const files = {
    list: async () => paths.map(path => ({ path, type: 'file' })),
    readFiles: async requested => requested.map(path => ({ path, content: 'TopFilter' })),
  };
  const commands = createAgentSandboxCommandExecutor({
    execute: async () => { throw new Error('grep must not reach the raw shell'); },
  }, files);
  const result = await createGrepTool({ files, commands }).execute({
    pattern: 'TopFilter', glob: input.glob, output_mode: 'files_with_matches',
  });
  assert.equal(result.metadata.totalCount, 2);
  assert.match(result.output, /src\/a\.ts/);
  assert.match(result.output, /src\/nested\/b\.tsx/);
  assert.doesNotMatch(result.output, /c\.js/);
});

const regressionFiles = [
  { path: 'apps/settle-in/src/a.tsx', content: 'TopFilter\nTopSelect\nhandleSearch\nhandleSearchMore\nsetSelectOption(searchParam);\n中文搜索\nbutton\nbutton' },
  { path: 'apps/settle-in/src/nested/b.ts', content: 'TopFilter\nBUTTON\nother' },
  { path: 'apps/settle-in/src/c.js', content: 'TopFilter\nbutton' },
];
const regressionSandboxFiles = {
  list: async () => regressionFiles.map(({ path }) => ({ path, type: 'file' })),
  readFiles: async requested => regressionFiles.filter(({ path }) => requested.includes(path)),
};
const regressionCommands = createAgentSandboxCommandExecutor({
  execute: async () => { throw new Error('grep must not reach the raw shell'); },
}, regressionSandboxFiles);
const grep = createGrepTool({ files: regressionSandboxFiles, commands: regressionCommands });

test('grep preserves text, regex groups, anchors, word boundaries and escaped characters', async () => {
  const cases = [
    ['TopFilter', '1: TopFilter'],
    ['Top(Filter|Select)', '2: TopSelect'],
    ['^中文搜索$', '6: 中文搜索'],
    ['setSelectOption\\(searchParam\\);', '5: setSelectOption(searchParam);'],
    ['\\bhandleSearch\\b', '3: handleSearch'],
  ];
  for (const [pattern, expected] of cases) {
    const result = await grep.execute({ pattern, glob: 'apps/settle-in/src/**/*.tsx', output_mode: 'content' });
    assert.equal(result.metadata.totalCount, 1, pattern);
    assert.ok(result.output.includes(expected), pattern);
    if (pattern.includes('handleSearch')) assert.doesNotMatch(result.output, /handleSearchMore/);
  }
});

test('grep preserves case-insensitive content, file and count modes with pagination', async () => {
  const content = await grep.execute({ pattern: 'BUTTON', case_insensitive: true, glob: '*.tsx', output_mode: 'content' });
  assert.equal(content.metadata.totalCount, 1);
  assert.match(content.output, /7: button\n8: button/);

  const files = await grep.execute({ pattern: 'TopFilter', glob: 'apps/settle-in/src/**/*.{ts,tsx}' });
  assert.equal(files.metadata.totalCount, 2);
  assert.match(files.output, /^Found 2 files\n/);
  assert.doesNotMatch(files.output, /c\.js/);

  const count = await grep.execute({ pattern: 'button', case_insensitive: true, output_mode: 'count', head_limit: 1, offset: 1 });
  assert.equal(count.metadata.totalCount, 3);
  assert.equal(count.metadata.returned, 1);
  assert.equal(count.metadata.hasMore, true);
  assert.match(count.output, /apps\/settle-in\/src\/nested\/b\.ts:1/);
});

test('grep preserves empty results and pattern validation', async () => {
  const result = await grep.execute({ pattern: 'not-present' });
  assert.equal(result.output, 'No matches found');
  assert.equal(result.metadata.totalCount, 0);
  assert.throws(() => grep.validate({ pattern: '' }), /pattern is required/);
  await assert.rejects(grep.execute({ pattern: '[' }), /Invalid regex pattern/);
});
