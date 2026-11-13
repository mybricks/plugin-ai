import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
export interface PluginAiMcpOptions { target?: "codex"; token?: string; allowedOrigins: string[]; mcpPath?: string; bridgePath?: string; timeoutMs?: number }
export declare function createPluginAiMcp(options: PluginAiMcpOptions): {
  handleRequest(req: IncomingMessage, res: ServerResponse): boolean;
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean;
  close(): void;
};
