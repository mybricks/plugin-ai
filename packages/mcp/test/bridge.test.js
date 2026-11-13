import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import WebSocket from 'ws';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createPluginAiMcp } from '../src/index.js';

test('workspace workflow requires entry and overview before executing tools', async t => {
  let mcp;
  const http = createServer((req, res) => { if (!mcp.handleRequest(req, res)) res.writeHead(404).end(); });
  http.on('upgrade', (req, socket, head) => { if (!mcp.handleUpgrade(req, socket, head)) socket.destroy(); });
  http.listen(0, '127.0.0.1'); await once(http, 'listening');
  const port = http.address().port;
  mcp = createPluginAiMcp({ allowedOrigins: [`http://127.0.0.1:${port}`] });
  t.after(() => { mcp.close(); http.close(); });
  const browser = new WebSocket(`ws://127.0.0.1:${port}/__plugin-ai/bridge`, { origin: `http://127.0.0.1:${port}` });
  const ready = once(browser, 'message');
  await once(browser, 'open'); await ready;
  browser.send(JSON.stringify({ type: 'register', workspaceId: 'demo', tools: [{ name: 'read_file', description: 'read', inputSchema: { type: 'object', properties: {} } }] }));
  browser.on('message', raw => {
    const msg = JSON.parse(raw);
    if (msg.type !== 'call') return;
    const result = msg.kind === 'resources/list'
      ? { resources: [{ uri: 'plugin-ai://overview', name: 'overview' }] }
      : msg.kind === 'resources/read'
        ? { contents: [{ uri: msg.arguments.uri, text: 'workspace overview' }] }
        : { content: [{ type: 'text', text: 'browser result' }] };
    browser.send(JSON.stringify({ type: 'result', id: msg.id, result }));
  });
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/__plugin-ai/mcp`)));
  t.after(() => client.close());
  assert.equal((await client.callTool({ name: 'read_file', arguments: {} })).isError, true);
  const workspaces = await client.callTool({ name: 'list_workspaces', arguments: {} });
  assert.equal(JSON.parse(workspaces.content[0].text).workspaces[0].workspaceId, 'demo');
  assert.equal((await client.callTool({ name: 'enter_workspace', arguments: { workspaceId: 'demo' } })).isError, undefined);
  assert.equal((await client.callTool({ name: 'read_file', arguments: {} })).isError, true);
  assert.equal((await client.readResource({ uri: 'plugin-ai://overview' })).contents[0].text, 'workspace overview');
  assert.equal((await client.callTool({ name: 'read_file', arguments: {} })).content[0].text, 'browser result');
  assert.equal((await client.callTool({ name: 'exit_workspace', arguments: {} })).isError, undefined);
  assert.equal((await client.callTool({ name: 'read_file', arguments: {} })).isError, true);
});
