import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAgentFixtures } from './helpers/load-agent.mjs';

const { Agent } = await loadAgentFixtures();

test('summary records the fork request as a plain turn', async () => {
  const agent = new Agent({
    key: 'effects-test', summary: { enabled: true, suggestions: false }, compact: { enabled: false },
    request: async ({ emits }) => {
      emits.write('<summary>done</summary><handoff>next</handoff>');
      emits.onUsage({ model: 'flash', promptTokens: 10, completionTokens: 2 });
      emits.complete();
    },
  });
  const turn = { id: 'parent', startTime: Date.now(), userText: 'hello', userAttachments: [], iterations: [], status: 'success' };
  agent.turns = [turn];
  await agent._runAutoSummary(turn);
  const effect = turn.effects[0];
  assert.equal(effect.operation, 'post_summary');
  assert.equal(effect.status, 'success');
  assert.equal(effect.turns.length, 1);
  assert.ok(effect.turns[0].id);
  assert.equal(effect.turns[0].agentKey, undefined);
  assert.equal(effect.turns[0].callId, undefined);
  assert.equal(effect.turns[0].subAgentType, undefined);
  assert.equal(effect.turns[0].iterations[0].usage.model, 'flash');
});
