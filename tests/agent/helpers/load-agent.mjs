import { rollup } from 'rollup';
import { transformAsync } from '@babel/core';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Bundle the working-tree source in a temporary module, without relying on dist.
export async function loadAgentFixtures() {
  const dir = await mkdtemp(path.join(tmpdir(), 'agent-test-'));
  let bundle;
  try {
    bundle = await rollup({
      input: 'agent-test-entry',
      plugins: [{
        name: 'typescript-for-tests',
        load(id) {
          if (id === '\0agent-test-entry') return `export { Agent } from ${JSON.stringify(path.resolve('packages/agent/src/agent.ts'))}; export { buildModeCatalogSection, buildModeStatusSection } from ${JSON.stringify(path.resolve('packages/agent/src/mode-manager.ts'))}; export { HistoryManager } from ${JSON.stringify(path.resolve('packages/agent/src/history/manager.ts'))}; export { compactMidTurnErrorRetryCase } from ${JSON.stringify(path.resolve('packages/playground/src/cases/compact.ts'))}; export { maskByTurnsCase, maskByAgeCase, maskToolHistoryCase, handoffDisabledCase, handoffWithMaskCase } from ${JSON.stringify(path.resolve('packages/playground/src/cases/mask.ts'))};`;
          return null;
        },
        async transform(code, id) {
          if (!id.endsWith('.ts')) return null;
          return transformAsync(code, { filename: id, presets: ['@babel/preset-typescript'], sourceMaps: false });
        },
        resolveId(source, importer) {
          if (source === 'agent-test-entry') return '\0agent-test-entry';
          if (source.startsWith('.') && importer && !path.extname(source)) {
            const base = path.resolve(path.dirname(importer), source);
            return existsSync(`${base}.ts`) ? `${base}.ts` : path.join(base, 'index.ts');
          }
          return null;
        },
      }],
      external: ['node-forge'],
    });
    const output = path.join(dir, 'agent.mjs');
    await bundle.write({ file: output, format: 'es' });
    return await import(pathToFileURL(output));
  } finally {
    await bundle?.close();
    await rm(dir, { recursive: true, force: true });
  }
}
