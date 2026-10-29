import { useEffect, useState } from 'react';
import { HttpAgent } from '@plugin/ui/chat/chat-panel/http-agent';
import { createHttpAgentMock, type HttpAgentScenario, type HttpCall } from '../http-agent-mock';

export function useHttpAgent(scenario?: HttpAgentScenario) {
  const [agent, setAgent] = useState<HttpAgent | null>(null);
  const [calls, setCalls] = useState<HttpCall[]>([]);
  useEffect(() => {
    if (!scenario) return;
    const fixture = createHttpAgentMock(scenario);
    const originalFetch = window.fetch;
    const base = `/__http_agent_playground__`;
    const wrappedFetch: typeof fetch = (input, init) => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, location.href);
      return url.pathname.startsWith(`${base}/`) ? fixture.fetchMock(input, init) : originalFetch(input, init);
    };
    window.fetch = wrappedFetch;
    const unsubscribe = fixture.subscribe(() => setCalls([...fixture.calls]));
    setAgent(new HttpAgent({ baseUrl: base, workspaceId: 'demo' }));
    return () => {
      unsubscribe();
      if (window.fetch === wrappedFetch) window.fetch = originalFetch;
    };
  }, [scenario]);
  return { agent, calls };
}
