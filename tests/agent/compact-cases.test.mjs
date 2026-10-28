import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollup } from 'rollup';
import { transformAsync } from '@babel/core';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Use the real playground mocks; shorten their UI-only streaming delays for regression tests.
const dir = await mkdtemp(path.join(tmpdir(), 'compact-case-tests-'));
const bundle = await rollup({
  input: 'compact-case-test-entry',
  external: ['node-forge'],
  plugins: [{
    name: 'typescript-for-tests',
    resolveId(source, importer) {
      if (source === 'compact-case-test-entry') return '\0compact-case-test-entry';
      if (source.startsWith('.') && importer && !path.extname(source)) {
        const base = path.resolve(path.dirname(importer), source);
        return existsSync(`${base}.ts`) ? `${base}.ts` : path.join(base, 'index.ts');
      }
      return null;
    },
    load(id) {
      if (id !== '\0compact-case-test-entry') return null;
      return `export { Agent } from ${JSON.stringify(path.resolve('packages/agent/src/agent.ts'))}; export * from ${JSON.stringify(path.resolve('packages/playground/src/cases/compact.ts'))};`;
    },
    async transform(code, id) {
      if (!id.endsWith('.ts')) return null;
      if (id.endsWith('/playground/src/cases/compact.ts')) code = code.replace(/setTimeout\(r,\s*\d+\)/g, 'setTimeout(r, 0)');
      return transformAsync(code, { filename: id, presets: ['@babel/preset-typescript'], sourceMaps: false });
    },
  }],
});
const output = path.join(dir, 'cases.mjs');
await bundle.write({ file: output, format: 'es' });
await bundle.close();
const { Agent, ...cases } = await import(pathToFileURL(output));
await rm(dir, { recursive: true, force: true });

const names = [
  'compactTriggerCase', 'compactWithToolsCase', 'compactHandoffCase',
  'compactWarmupByUsageCase', 'compactFirstTurnUsageNoCompactCase',
  'compactErrorCase', 'compactEmptyResponseCase', 'compactNoContentCase',
  'compactInfiniteCase', 'compactRetrySuccessErrorCase', 'compactRetrySuccessTagCase',
  'compactBinaryExpandSuccessCase',
];

for (const name of names) {
  test(`playground ${cases[name].id}`, async () => {
    const testCase = cases[name];
    const records = structuredClone(testCase.initialTurns);
    let compactRecord = null;
    const snapshots = [];
    const history = {
      load: async () => structuredClone(records),
      append: async (_key, record) => { records.push(structuredClone(record)); },
      update: async (_key, id, patch) => { Object.assign(records.find(record => record.id === id), structuredClone(patch)); },
      clear: async () => { records.length = 0; },
      loadCompact: async () => structuredClone(compactRecord),
      saveCompact: async (_key, record) => { compactRecord = structuredClone(record); },
    };
    let agent;
    agent = new Agent({
      key: testCase.id, history, summary: false, compact: testCase.compactOptions,
      ...(testCase.handoffOptions ? { handoff: testCase.handoffOptions } : {}),
      ...(testCase.maskOptions ? { mask: testCase.maskOptions } : {}),
      retry: { maxRetries: 0 },
      tools: [{ name: 'write_file', description: 'write file', execute: async () => ({ output: 'ok' }) }],
      request: async params => {
        snapshots.push({ params: { messages: structuredClone(params.messages) } });
        if (name === 'compactInfiniteCase') setTimeout(() => agent.abort(), 10);
        await testCase.request(params);
      },
    });
    let resolveSettled;
    const settled = new Promise(resolve => { resolveSettled = resolve; });
    agent.events.on('turn:settled', resolveSettled);
    await agent.requestAI({ message: 'run case' });
    const turn = agent.getTurns().at(-1);
    if (turn.status === 'success') {
      let timeout;
      try {
        await Promise.race([settled, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('turn did not settle')), 3000); })]);
      } finally { clearTimeout(timeout); }
    }
    if (['compactErrorCase', 'compactEmptyResponseCase', 'compactNoContentCase'].includes(name)) {
      assert.equal(turn.status, 'error');
      assert.equal(turn.errorCode, 'CONTEXT_COMPACTION_FAILED');
    } else if (name === 'compactInfiniteCase') {
      assert.equal(turn.status, 'abort');
    } else {
      assert.equal(turn.status, 'success');
    }
    for (const assertion of testCase.assertions ?? []) {
      const result = assertion.run({ snapshots, agent, memFS: null });
      assert.ok(result, `${assertion.name}: still pending`);
      assert.equal(result.pass, true, `${assertion.name}: ${result.message}`);
    }
  });
}
