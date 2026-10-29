import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAgentFixtures } from './helpers/load-agent.mjs';

const { Agent } = await loadAgentFixtures();

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

function createAgent(options = {}) {
  let requests = 0;
  const agent = new Agent({
    summary: false, compact: { enabled: false }, handoff: false, mask: false,
    ...options,
    request: async ({ emits }) => { requests++; emits.complete(); },
  });
  return { agent, requests: () => requests };
}

for (const phase of ['format', 'beforeTurn', 'attachment']) {
  test(`abort during ${phase} does not start the model and the next turn can run`, async () => {
    const entered = deferred();
    const release = deferred();
    let first = true;
    const wait = async () => {
      if (!first) return;
      first = false;
      entered.resolve();
      await release.promise;
    };
    const options = phase === 'format'
      ? { formatUserMessage: async params => { await wait(); return { message: params.message }; } }
      : phase === 'beforeTurn'
        ? { hooks: { beforeTurn: wait } }
        : { getAttachmentContextMessages: async () => { await wait(); return []; } };
    const { agent, requests } = createAgent(options);
    let aborts = 0;
    agent.events.on('turn:abort', () => aborts++);
    const run = agent.requestAI({ message: 'first' });
    await entered.promise;
    agent.abort();
    release.resolve();
    await run;
    assert.equal(requests(), 0);
    assert.equal(aborts, 1);
    assert.equal(agent.getTurns().at(-1).status, 'abort');
    await agent.requestAI({ message: 'second' });
    assert.equal(requests(), 1);
    assert.equal(agent.getTurns().at(-1).status, 'success');
  });
}

test('abort during retry preparation keeps the retry cancelled', async () => {
  const entered = deferred();
  const release = deferred();
  let calls = 0;
  const { agent, requests } = createAgent({
    hooks: { beforeTurn: async () => {
      if (++calls === 2) { entered.resolve(); await release.promise; }
    } },
  });
  await agent.requestAI({ message: 'first' });
  const run = agent.retry(agent.getTurns().at(-1).id);
  await entered.promise;
  agent.abort();
  release.resolve();
  await run;
  assert.equal(requests(), 1);
  assert.equal(agent.getTurns().at(-1).status, 'abort');
});
