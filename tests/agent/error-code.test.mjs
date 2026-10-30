import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAgentFixtures } from './helpers/load-agent.mjs';

const { Agent } = await loadAgentFixtures();

for (const [name, failure, expected] of [
  ['model failure', new Error('provider rejected request'), 'MODEL_ERROR'],
  ['model request transport failure', new TypeError('fetch failed'), 'MODEL_ERROR'],
]) {
  test(`${name} is exposed on event and persisted turn`, async () => {
    const agent = new Agent({
      summary: false, compact: { enabled: false }, handoff: false,
      retry: { maxRetries: 0 },
      request: async () => { throw failure; },
    });
    let event;
    agent.events.on('turn:error', value => { event = value; });
    await assert.rejects(agent.requestAI({ message: 'test' }));
    assert.equal(event.errorCode, expected);
    assert.equal(agent.getTurns()[0].errorCode, expected);
  });
}
