/** A structured command is used by AgentSandbox-owned tools such as grep. */
export interface StructuredCommandRequest {
  name: string;
  args?: string[];
  input?: unknown;
  metadata?: Record<string, unknown>;
}

export type CommandRequest = string | StructuredCommandRequest;

export function isStructuredCommandRequest(request: CommandRequest): request is StructuredCommandRequest {
  return typeof request !== "string";
}

/**
 * Parses only the deliberately small shell subset that virtual file proxies
 * support. Anything with shell control syntax must fall through to the host's
 * raw command transport unchanged.
 */
export function parseSimpleCommand(script: string): StructuredCommandRequest | null {
  const tokens: string[] = [];
  let token = "";
  let quote: "'" | '"' | null = null;

  const pushToken = () => {
    if (token) tokens.push(token);
    token = "";
  };

  for (let index = 0; index < script.length; index++) {
    const char = script[index];
    if (quote) {
      if (char === quote) quote = null;
      else token += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    // Do not reinterpret pipes, redirects, substitutions, command chaining,
    // escapes, or newlines as virtual filesystem commands.
    if ("|&;<>$`\\\n\r".includes(char)) return null;
    if (/\s/.test(char)) {
      pushToken();
      continue;
    }
    token += char;
  }

  if (quote) return null;
  pushToken();
  const [name, ...args] = tokens;
  return name ? { name, args } : null;
}

/** Returns a proxyable command for either a structured request or a safe raw script. */
export function getProxyCommand(request: CommandRequest): StructuredCommandRequest | null {
  return isStructuredCommandRequest(request) ? request : parseSimpleCommand(request);
}
