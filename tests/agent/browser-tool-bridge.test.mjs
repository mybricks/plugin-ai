import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformAsync } from '@babel/core';

const path = new URL('../../packages/plugin/src/ui/chat/chat-panel/workspace-bridge/browser-tool-bridge.ts', import.meta.url);
const compiled = await transformAsync(await readFile(path, 'utf8'), { filename: path.pathname, presets: ['@babel/preset-typescript'] });
const { BrowserToolBridge } = await import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString('base64')}`);

function createBridge(execute) {
  const posts = [];
  const bridge = new BrowserToolBridge({
    workspaceId: 'workspace',
    requestJson: async (path, init) => { posts.push({ path, body: JSON.parse(init.body) }); },
    agent: { abort: () => assert.fail('expired interactions must not abort the agent') },
    tools: [{ name: 'interactive_tool', execute }],
    getSandbox: () => undefined,
    getMode: () => 'build',
    setMode: () => {},
  });
  const request = (requestId) => bridge.handleRequest({ requestId, name: 'interactive_tool', input: {} });
  return { bridge, posts, request };
}

test('tool result clears an earlier pending wait so a later call works', async () => {
  const { bridge, posts, request } = createBridge(async (_input, ctx) => ({ output: await ctx.waitUIRender() }));
  const old = request('old');
  await request('failed');
  assert.match(posts[0].body.error, /already waiting for UI input: old/);
  bridge.clearPending('interactive_tool', 'failed-call');
  await old;
  const next = request('next');
  assert.equal(await bridge.getToolUI().respond('next-call', 'answer'), true);
  await next;
  assert.equal(posts.length, 2);
  assert.match(posts[1].path, /\/next$/);
  assert.equal(posts[1].body.output, 'answer');
});

test('browser task executes before tool:call and accepts the later answer', async () => {
  const { bridge, posts, request } = createBridge(async (_input, ctx) => ({ output: await ctx.waitUIRender() }));
  const task = request('early-task');
  assert.equal(await bridge.getToolUI().respond('later-tool-call', 'answer'), true);
  await task;
  assert.equal(posts[0].body.output, 'answer');
});

test('early UI submission is preserved until the browser task consumes it', async () => {
  const { bridge, posts, request } = createBridge(async (_input, ctx) => ({ output: await ctx.waitUIRender() }));
  const submitted = bridge.getToolUI().respond('call', 'early answer');
  const task = request('request');
  assert.equal(await submitted, true);
  await task;
  assert.equal(posts[0].body.output, 'early answer');
});

test('user cancellation still reaches the tool as null', async () => {
  const { bridge, posts, request } = createBridge(async (_input, ctx) => ({
    output: (await ctx.waitUIRender()) === null ? 'cancelled' : 'unexpected',
  }));
  const task = request('request');
  assert.equal(await bridge.getToolUI().cancel('call'), true);
  await task;
  assert.equal(posts[0].body.output, 'cancelled');
});

test('expiration clears matching buffered submissions, but not another call', async () => {
  const { bridge, request } = createBridge(async (_input, ctx) => ({ output: await ctx.waitUIRender() }));
  const submitted = bridge.getToolUI().respond('next-call', 'answer');
  bridge.clearPending('other_tool', 'other-call');
  const next = request('next');
  assert.equal(await submitted, true);
  await next;
  const discarded = bridge.getToolUI().respond('expired-call', 'stale');
  bridge.clearPending('interactive_tool', 'expired-call');
  assert.equal(await discarded, false);
});

test('tool completion prevents a delayed wait and its result from being sent', async () => {
  let resume;
  const gate = new Promise(resolve => { resume = resolve; });
  const { bridge, posts, request } = createBridge(async (_input, ctx) => {
    await gate;
    return { output: await ctx.waitUIRender() };
  });
  const old = request('old');
  bridge.clearPending('interactive_tool', 'old-call');
  resume();
  await old;
  assert.equal(posts.length, 0);
});

test('unrelated tool result does not invalidate an active browser task', async () => {
  const { bridge, posts, request } = createBridge(async (_input, ctx) => ({ output: await ctx.waitUIRender() }));
  const task = request('active');
  bridge.clearPending('other_tool', 'other-call');
  assert.equal(await bridge.getToolUI().respond('active-call', 'answer'), true);
  await task;
  assert.equal(posts[0].body.output, 'answer');
});

test('turn end clears a pending wait without aborting the agent', async () => {
  const { bridge, posts, request } = createBridge(async (_input, ctx) => ({ output: await ctx.waitUIRender() }));
  const task = request('old');
  bridge.clearPending();
  await task;
  assert.equal(posts.length, 0);
});
