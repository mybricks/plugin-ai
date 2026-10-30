/** Mock transport shared by the HTTP Agent playground and its regression tests. */
export type HttpAgentScenario = 'conflict-retry' | 'retry-error' | 'model-error-retry' | 'success' | 'finalizing' | 'network-error' | 'sse-disconnect' | 'server-http-error' | 'server-turn-error' | 'error-finalizing' | 'legacy-close' | 'model-request-network';
export type HttpCall = { path: string; method: string; body: unknown; timestamp: number };

export function createHttpAgentMock(scenario: HttpAgentScenario = 'conflict-retry') {
  const calls: HttpCall[] = [];
  const listeners = new Set<() => void>();
  let runs = 0;
  let retries = 0;
  const turns: Array<Record<string, any>> = [];
  const fetchMock = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const path = new URL(String(input), 'http://localhost').pathname;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ path, method: init?.method ?? 'GET', body, timestamp: Date.now() });
    listeners.forEach(listener => listener());
    if (path.endsWith('/turns')) return Response.json({ turns: structuredClone(turns), hasMore: false });
    if (path.endsWith('/connect')) return new Response(null, { status: 204 });
    if (path.endsWith('/run')) {
      const turnId = body.turnId;
      const setup = ['session:locked', 'session:files-synced', 'session:agent-configured', 'session:start'].map(event => ({ event, turnId, data: { turnId } }));
      runs++;
      if (runs === 1 && scenario === 'network-error') throw new TypeError('Failed to fetch');
      if (runs === 1 && scenario === 'server-http-error') return Response.json({ message: 'Simulated server unavailable' }, { status: 503 });
      if (scenario === 'conflict-retry' && runs === 1) {
        return Response.json({ message: 'Agent is already running: demo:default (previous-turn)' }, { status: 409 });
      }
      const turn = { id: turnId, startTime: Date.now(), userText: body.message ?? body.displayMessage, userFormattedText: body.modelMessage, userAttachments: body.attachments ?? [], iterations: [], status: 'success' };
      turns.push(turn);
      if (scenario === 'success' || scenario === 'conflict-retry' || scenario === 'finalizing' || scenario === 'network-error' || scenario === 'server-http-error') return stream([...setup, ...successEvents(turnId, '服务端响应成功。')], turn, scenario === 'finalizing' ? 4000 : 0);
      if (scenario === 'sse-disconnect') return stream([...setup, { event: 'llm:start', turnId, data: { turnId, iterId: 'interrupted-iter', startTime: Date.now() } }], turn);
      if (scenario === 'server-turn-error' || scenario === 'error-finalizing' || scenario === 'legacy-close') return stream([...setup,
        { event: 'turn:error', turnId, data: { turnId, error: 'Simulated server execution failure', errorCode: 'SERVER_ERROR' } },
      ], turn, scenario === 'error-finalizing' ? 4000 : 0, scenario !== 'legacy-close');
      if (scenario === 'model-request-network') return stream([...setup,
        ...modelErrorEvents(turnId, 'model-network', 'Model request failed: fetch failed'),
      ], turn);
      if (scenario === 'model-error-retry') return stream([...setup,
        { event: 'turn:start', turnId, data: { turnId, message: turn.userText } },
        ...modelErrorEvents(turnId, 'model-first', '模型服务报错：请求失败'),
      ], turn);
      return stream([...setup,
        { event: 'turn:error', turnId, data: { turnId, error: '模拟服务端错误：请再次重试' } },
      ], turn);
    }
    if (path.endsWith('/retry')) {
      retries++;
      const turnId = body.turnId;
      const turn = turns[turns.length - 1];
      const setup = ['session:locked', 'session:files-synced', 'session:agent-configured', 'session:start'].map(event => ({ event, turnId, data: { turnId } }));
      if (!turn || turn.id !== turnId) return stream([...setup, { event: 'turn:error', turnId, data: { turnId, error: `Turn ${turnId} is not the last turn of session demo:default, cannot retry.` } }]);
      if (scenario === 'sse-disconnect' || scenario === 'server-turn-error' || scenario === 'error-finalizing' || scenario === 'model-request-network' || (scenario === 'model-error-retry' && body.modelId === 'model-b')) return stream([...setup, { event: 'turn:resume', turnId, data: { turnId } }, ...successEvents(turnId, '重试成功。')], turn);
      if (scenario === 'model-error-retry' && retries === 1) return stream([...setup,
        { event: 'turn:resume', turnId, data: { turnId } },
        ...modelErrorEvents(turnId, 'model-retry', '模型服务报错：重试仍然失败'),
      ], turn);
      if (retries === 1) return stream([...setup, { event: 'turn:error', turnId, data: { turnId, error: '模拟重试失败：最新错误' } }], turn);
      return stream([...setup, { event: 'turn:resume', turnId, data: { turnId } }, ...successEvents(turnId, '重试成功。')], turn);
    }
    return Response.json({});
  };
  return { fetchMock, calls, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; } };
}

function modelErrorEvents(turnId: string, iterId: string, message: string) {
  return [
    { event: 'llm:start', turnId, data: { turnId, iterId, startTime: Date.now() } },
    { event: 'turn:error', turnId, data: { turnId, error: { name: 'Error', message }, errorCode: 'MODEL_ERROR' } },
  ];
}

function successEvents(turnId: string, content: string) {
  return [
    { event: 'llm:start', turnId, data: { turnId, iterId: 'iter-1', startTime: Date.now() } },
    { event: 'llm:content', turnId, data: { turnId, iterId: 'iter-1', content } },
    { event: 'llm:complete', turnId, data: { turnId, iterId: 'iter-1', done: true, endTime: Date.now() } },
    { event: 'turn:complete', turnId, data: { turnId } },
  ];
}

function stream(events: Array<Record<string, any>>, turn?: Record<string, any>, releaseDelay = 0, emitRelease = true): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    async start(controller) {
      for (const event of events) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (turn && event.event === 'turn:error') { turn.status = 'error'; turn.error = event.data.error?.message ?? event.data.error; turn.errorCode = event.data.errorCode; turn.endTime = Date.now(); }
        if (turn && event.event === 'turn:complete') { turn.status = 'success'; delete turn.error; delete turn.errorCode; turn.endTime = Date.now(); }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ...event, createdAt: Date.now() })}\n\n`));
      }
      const terminal = events.find(event => ['turn:complete', 'turn:error', 'turn:abort'].includes(event.event));
      if (terminal && emitRelease) {
        if (releaseDelay) await new Promise(resolve => setTimeout(resolve, releaseDelay));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'session:released', turnId: terminal.turnId, data: { turnId: terminal.turnId }, createdAt: Date.now() })}\n\n`));
      }
      controller.close();
    },
  }), { headers: { 'content-type': 'text/event-stream' } });
}
