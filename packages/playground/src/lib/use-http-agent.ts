import { useEffect, useState } from 'react';
import { HttpAgent } from '@plugin/ui/chat/chat-panel/http-agent';
import { createHttpAgentMock, type HttpAgentScenario, type HttpCall } from '../http-agent-mock';
import { context } from '@plugin/context';

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
    const agent = new HttpAgent({ baseUrl: base, workspaceId: 'demo' });
    // 仅用于展示模型选择控件；HTTP 场景不会使用该 request 发网络请求。
    context.configureLLMProvider('http-playground', [{
      providerId: 'mock',
      models: [{ id: 'model-a', name: '测试模型 A' }, { id: 'model-b', name: '测试模型 B' }],
      request: async () => { throw new Error('HTTP playground uses mock transport'); },
    }]);
    context.createLLMRequest('http-playground', agent.key);
    setAgent(agent);
    return () => {
      unsubscribe();
      context.configureLLMProvider('http-playground');
      if (window.fetch === wrappedFetch) window.fetch = originalFetch;
    };
  }, [scenario]);
  return { agent, calls };
}
