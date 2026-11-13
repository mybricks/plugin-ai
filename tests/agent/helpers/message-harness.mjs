export function createAgentHarness(Agent, { items = () => [{ key: 'context', content: 'CONTEXT' }], ...options } = {}) {
  const requests = [];
  const agent = new Agent({
    summary: false, compact: { enabled: false }, handoff: false, mask: false,
    ...options,
    getAttachmentContextMessages: items,
    request: async ({ messages, emits }) => {
      requests.push(structuredClone(messages));
      emits.write('ok');
      emits.complete();
    },
  });
  return { agent, requests };
}

export const count = (messages, text) => messages.filter(m => typeof m.content === 'string' && m.content.includes(text)).length;
