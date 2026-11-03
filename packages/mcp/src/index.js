import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { WebSocketServer } from 'ws';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { getTargetProfile } from './targets/index.js';

/** A Node HTTP adapter. The host must route requests and upgrades to these handlers. */
export function createPluginAiMcp({ target = 'codex', token, allowedOrigins, mcpPath = '/__plugin-ai/mcp', bridgePath = '/__plugin-ai/bridge', timeoutMs = 30000 }) {
  const profile = getTargetProfile(target);
  if (!Array.isArray(allowedOrigins) || !allowedOrigins.length) throw new Error('allowedOrigins are required');
  if (token !== undefined && (typeof token !== 'string' || !token)) throw new Error('token must be a non-empty string');
  const sockets = new Set();
  const pending = new Map();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
  const isLoopback = address => address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
  const localOnly = req => isLoopback(req.socket.localAddress) && isLoopback(req.socket.remoteAddress);
  const validHost = req => allowedOrigins.some(origin => { try { return new URL(origin).host === req.headers.host; } catch { return false; } });
  const matches = req => { if (!token) return localOnly(req); const v = req.headers.authorization?.replace(/^Bearer /i, '') || ''; const a = Buffer.from(v), b = Buffer.from(token); return a.length === b.length && timingSafeEqual(a, b); };
  const originAllowed = req => !req.headers.origin || allowedOrigins.includes(req.headers.origin);
  // This local prototype has one shared active workspace, not a per-client lease.
  let entered = null;
  const workflowTools = [
    { name: 'list_workspaces', description: 'List open designer workspaces. Call this first for every task.', inputSchema: { type: 'object', properties: {} } },
    { name: 'enter_workspace', description: 'Enter the selected workspace before reading its overview. Supply browserId when multiple instances share the same ID.', inputSchema: { type: 'object', properties: { workspaceId: { type: 'string' }, browserId: { type: 'string' } }, required: ['workspaceId'] } },
    { name: 'exit_workspace', description: 'Leave the active workspace when the task is finished.', inputSchema: { type: 'object', properties: {} } },
  ];
  const connected = () => [...sockets].filter(s => s.readyState === 1 && s.tools && s.workspaceId);
  const notify = (socket, message) => { if (socket?.readyState === 1) socket.send(JSON.stringify(message)); };
  const active = () => {
    if (!entered || entered.socket.readyState !== 1) throw new Error('No workspace entered. Call list_workspaces then enter_workspace.');
    return entered.socket;
  };
  const requireOverview = () => {
    if (!entered?.overviewRead) throw new Error('Read plugin-ai://overview before working in this workspace.');
  };
  const toolResult = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
  const activity = (socket, operation) => notify(socket, { type: 'activity', operation });
  function invoke(socket, kind, name, args, signal) {
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const finish = (err, result) => { clearTimeout(timer); signal?.removeEventListener('abort', abort); pending.delete(id); err ? reject(err) : resolve(result); };
      const cancel = () => { if (socket.readyState === 1) socket.send(JSON.stringify({ type: 'cancel', id })); };
      const abort = () => { cancel(); finish(new Error('Request cancelled')); };
      const timer = setTimeout(() => { cancel(); finish(new Error('Browser tool timed out; the operation may have completed.')); }, timeoutMs);
      pending.set(id, { socket, finish });
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) return abort();
      socket.send(JSON.stringify({ type: 'call', id, kind, name, arguments: args }), e => { if (e) finish(e); });
    });
  }
  wss.on('connection', socket => {
    sockets.add(socket);
    socket.browserId = randomUUID();
    socket.on('message', raw => {
      let msg; try { msg = JSON.parse(raw.toString()); } catch { return socket.close(1003); }
      if (msg.type === 'register' && Array.isArray(msg.tools)) {
        socket.workspaceId = typeof msg.workspaceId === 'string' ? msg.workspaceId.trim().slice(0, 200) : '';
        socket.tools = msg.tools.filter(t => typeof t.name === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(t.name) && t.inputSchema?.type === 'object').slice(0, 100);
      } else if (msg.type === 'result') {
        const item = pending.get(msg.id); if (item?.socket === socket) item.finish(null, msg.result);
      }
    });
    socket.on('close', () => { sockets.delete(socket); if (entered?.socket === socket) entered = null; for (const item of pending.values()) if (item.socket === socket) item.finish(new Error('Browser disconnected; the operation may have completed.')); });
    socket.on('error', () => socket.terminate());
  });
  function handleRequest(req, res) {
    if (new URL(req.url, 'http://localhost').pathname !== mcpPath) return false;
    if (!validHost(req) || !originAllowed(req) || !matches(req)) { res.writeHead(401).end('Unauthorized'); return true; }
    if (req.method !== 'POST') { res.writeHead(405).end(); return true; }
    const server = new Server({ name: profile.name, version: '0.1.0' }, { capabilities: { tools: {}, resources: {} }, instructions: profile.instructions });
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const socketsToList = entered ? [active()] : connected();
      const byName = new Map(workflowTools.map(tool => [tool.name, tool]));
      for (const socket of socketsToList) for (const tool of socket.tools) if (!byName.has(tool.name)) byName.set(tool.name, tool);
      return { tools: [...byName.values()] };
    });
    server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      try {
        const { name, arguments: args = {} } = request.params;
        if (name === 'list_workspaces') {
          const items = connected().map(s => ({ workspaceId: s.workspaceId, browserId: s.browserId, active: entered?.socket === s }));
          for (const socket of connected()) activity(socket, 'list_workspaces');
          return toolResult({ workspaces: items });
        }
        if (name === 'enter_workspace') {
          if (typeof args.workspaceId !== 'string' || !args.workspaceId) throw new Error('workspaceId is required');
          const candidates = connected().filter(s => s.workspaceId === args.workspaceId && (!args.browserId || s.browserId === args.browserId));
          if (candidates.length !== 1) throw new Error(candidates.length ? 'Multiple browser instances match; provide browserId.' : 'Workspace is not connected.');
          if (entered?.socket !== candidates[0]) notify(entered?.socket, { type: 'workspace', entered: false });
          entered = { socket: candidates[0], overviewRead: false };
          notify(entered.socket, { type: 'workspace', entered: true });
          activity(entered.socket, 'enter_workspace');
          return toolResult({ workspaceId: entered.socket.workspaceId, browserId: entered.socket.browserId, next: 'Read plugin-ai://overview before any other work.' });
        }
        if (name === 'exit_workspace') {
          const socket = active(); activity(socket, 'exit_workspace'); notify(socket, { type: 'workspace', entered: false }); entered = null;
          return toolResult({ exited: true });
        }
        const socket = active(); requireOverview();
        if (!socket.tools.some(t => t.name === name)) throw new Error('Tool not registered');
        activity(socket, name);
        return await invoke(socket, 'tools/call', name, args, extra.signal);
      } catch (e) { return { isError: true, content: [{ type: 'text', text: e.message }] }; }
    });
    server.setRequestHandler(ListResourcesRequestSchema, async (_request, extra) => {
      try {
        const candidates = entered ? [active()] : connected();
        if (candidates.length !== 1) return { resources: [
          { uri: 'plugin-ai://overview', name: 'PluginAI resource overview', description: 'Enter a workspace before reading.', mimeType: 'text/markdown' },
          { uri: 'plugin-ai://development-guide', name: 'Frontend development guide', description: 'Enter a workspace and read the overview first.', mimeType: 'text/markdown' },
        ] };
        const result = await invoke(candidates[0], 'resources/list', '', {}, extra.signal);
        if (result?.error) throw new Error(result.error);
        return result;
      } catch (e) { throw new McpError(ErrorCode.InternalError, e.message); }
    });
    server.setRequestHandler(ReadResourceRequestSchema, async (request, extra) => {
      try {
        const socket = active();
        if (request.params.uri !== 'plugin-ai://overview') requireOverview();
        activity(socket, `read ${request.params.uri}`);
        const result = await invoke(socket, 'resources/read', '', { uri: request.params.uri }, extra.signal);
        if (result?.error) throw new Error(result.error);
        if (request.params.uri === 'plugin-ai://overview' && entered?.socket === socket) entered.overviewRead = true;
        return result;
      } catch (e) { throw new McpError(ErrorCode.InvalidParams, e.message); }
    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { void transport.close(); void server.close(); });
    void server.connect(transport).then(() => transport.handleRequest(req, res)).catch(() => { if (!res.headersSent) res.writeHead(500).end(); });
    return true;
  }
  function handleUpgrade(req, socket, head) {
    if (new URL(req.url, 'http://localhost').pathname !== bridgePath) return false;
    // Browser WebSocket cannot set Authorization; optional tokens use the first message.
    if (!validHost(req) || !req.headers.origin || !originAllowed(req) || (!token && !localOnly(req))) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return true; }
    wss.handleUpgrade(req, socket, head, ws => {
      if (!token) { wss.emit('connection', ws, req); ws.send(JSON.stringify({ type: 'ready' })); return; }
      const timer = setTimeout(() => ws.terminate(), 5000);
      ws.once('message', raw => { clearTimeout(timer); let msg; try { msg = JSON.parse(raw.toString()); } catch { return ws.close(1008); }
        const a = Buffer.from(typeof msg.token === 'string' ? msg.token : ''), b = Buffer.from(token);
        if (a.length !== b.length || !timingSafeEqual(a, b)) return ws.close(1008);
        wss.emit('connection', ws, req);
        ws.send(JSON.stringify({ type: 'ready' }));
      });
    });
    return true;
  }
  function close() { for (const s of sockets) s.terminate(); wss.close(); }
  return { handleRequest, handleUpgrade, close };
}
