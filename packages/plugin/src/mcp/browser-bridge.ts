import type { CodeAgent } from '../../../agent/src';
import { createMcpResourceCatalog, type McpResourceProvider } from './resources';

export interface McpBridgeOptions {
  bridgeUrl: string;
  token?: string;
  workspaceId?: string;
  onWorkspaceChange?: (entered: boolean) => void;
  onActivity?: (operation: string) => void;
  /** Explicit tool allowlist; tools requiring Agent UI/context should be excluded. */
  tools: string[];
  onStatus?: (status: "connecting" | "connected" | "disconnected") => void;
}

/** Exposes the actual initialized CodeAgent tools, never serializing their closures. */
export function connectMcpBrowser(options: McpBridgeOptions, agent: CodeAgent, resources: McpResourceProvider, ready?: Promise<void>): () => void {
  let socket: WebSocket | undefined;
  let stopped = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let queue = Promise.resolve();
  const cancelled = new Set<string>();
  const allowed = new Set(options.tools);
  const tools = () => agent.getTools().filter(tool => allowed.has(tool.name) && tool.name !== 'use_skill');
  const connect = async () => {
    try {
      await ready;
      await agent.initializePlugins();
      if (stopped) return;
      options.onStatus?.("connecting");
      const url = new URL(options.bridgeUrl, location.href);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = socket = new WebSocket(url);
      ws.onopen = () => { if (options.token) ws.send(JSON.stringify({ token: options.token })); };
      ws.onmessage = event => {
        let message: any; try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === 'ready') {
          options.onStatus?.("connected");
          ws.send(JSON.stringify({ type: 'register', workspaceId: options.workspaceId, tools: tools().map(tool => ({ name: tool.name, description: tool.description, inputSchema: tool.parameters ?? { type: 'object', properties: {} } })) }));
        } else if (message.type === 'workspace') {
          options.onWorkspaceChange?.(message.entered === true);
        } else if (message.type === 'activity' && typeof message.operation === 'string') {
          options.onActivity?.(message.operation);
        } else if (message.type === 'cancel') {
          cancelled.add(message.id);
        } else if (message.type === 'call') {
          queue = queue.then(async () => {
            if (cancelled.delete(message.id)) return;
            try {
              if (message.kind === 'resources/list' || message.kind === 'resources/read') {
                const catalog = await createMcpResourceCatalog(resources);
                const result = message.kind === 'resources/list'
                  ? { resources: catalog.resources }
                  : { contents: [await catalog.read(message.arguments.uri)] };
                if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'result', id: message.id, result }));
                return;
              }
              const tool = tools().find(item => item.name === message.name);
              if (!tool) throw new Error('Tool is not available');
              tool.validate?.(message.arguments);
              const result = await tool.execute(message.arguments);
              if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'result', id: message.id, result: { content: [{ type: 'text', text: result.output }] } }));
            } catch (error) {
              if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'result', id: message.id, result: message.kind?.startsWith('resources/') ? { error: error instanceof Error ? error.message : String(error) } : { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] } }));
            } finally { cancelled.delete(message.id); }
          });
        }
      };
      ws.onclose = () => { options.onWorkspaceChange?.(false); options.onStatus?.("disconnected"); if (!stopped) retry = setTimeout(connect, 2000); };
      ws.onerror = () => ws.close();
    } catch (error) { console.error('[plugin-ai][mcp] initialization failed', error); }
  };
  void connect();
  return () => { stopped = true; if (retry) clearTimeout(retry); socket?.close(); };
}
