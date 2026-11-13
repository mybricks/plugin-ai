import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAgentFixtures } from './helpers/load-agent.mjs';

const { HistoryManager } = await loadAgentFixtures();

test('history writes wait for completion and a failed write does not block the next one', async () => {
  const calls = [];
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const history = {
    append: async () => { calls.push('append-start'); await pending; calls.push('append-end'); },
    update: async () => { calls.push('update'); throw new Error('write failed'); },
    clear: async () => { calls.push('clear'); },
  };
  const manager = new HistoryManager({ history, key: 'session' });
  const first = manager.append({ id: 'turn' });
  const second = manager.update('turn', {});
  const third = manager.clear();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['append-start']);
  release();
  await first;
  await assert.rejects(second, /write failed/);
  await third;
  assert.deepEqual(calls, ['append-start', 'append-end', 'update', 'clear']);
});
