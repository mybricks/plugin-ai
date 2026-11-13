import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { transformAsync } from '@babel/core';

const initialPath = new URL('../../packages/plugin/src/sandbox/initial-files.ts', import.meta.url);
const hmrPath = new URL('../../packages/plugin/src/ui/chat/chat-panel/workspace-bridge/file-hmr.ts', import.meta.url);
const compile = async (source, file) => (await transformAsync(source, { filename: file.pathname, presets: ['@babel/preset-typescript'] })).code;
const initial = await compile(await readFile(initialPath, 'utf8'), initialPath);
const initialUrl = `data:text/javascript;base64,${Buffer.from(initial).toString('base64')}`;
const hmr = await compile((await readFile(hmrPath, 'utf8')).replace('"../../../../sandbox/initial-files"', JSON.stringify(initialUrl)), hmrPath);
const { FileHmr } = await import(`data:text/javascript;base64,${Buffer.from(hmr).toString('base64')}`);
const hash = (content) => createHash('sha256').update(content).digest('hex');

test('syncs remote changes into the host AgentSandbox and waits for the requested version', async () => {
  const local = new Map([['TASKS.md', 'old']]);
  let version = 1;
  let content = 'old';
  const sandbox = { files: {
    list: async () => [...local.keys()].map(path => ({ path, type: 'file' })),
    readFiles: async paths => paths.filter(path => local.has(path)).map(path => ({ path, content: local.get(path) })),
    writeFiles: async files => files.forEach(file => local.set(file.path, file.content)),
    write: async file => local.set(file.path, file.content),
    remove: async path => local.delete(path),
    removeFiles: async paths => paths.forEach(path => local.delete(path)),
  }, commands: {} };
  const fileHmr = new FileHmr({ workspaceId: 'w', requestJson: async path => {
    if (path.endsWith('/files')) return { version: 1, files: [{ path: 'TASKS.md', hash: hash('old') }] };
    if (path.includes('/files/changes')) return { currentVersion: version, changes: [{ version, ops: [{ type: 'write', path: 'TASKS.md', hash: hash(content) }] }] };
    if (path.includes('/files/content')) return { path: 'TASKS.md', content };
    throw new Error(`unexpected ${path}`);
  } });
  await fileHmr.bindSandbox(sandbox);
  content = 'done'; version = 2;
  await fileHmr.syncToVersion(2);
  assert.equal(local.get('TASKS.md'), 'done');
  await assert.rejects(fileHmr.syncToVersion(3), /did not reach version 3/);
});

test('requires an initialized host before claiming synchronization', async () => {
  const fileHmr = new FileHmr({ workspaceId: 'w', requestJson: async () => ({}) });
  await assert.rejects(fileHmr.syncToVersion(1), /not initialized/);
});
