import { createHash } from 'crypto';
import { writeFileSync, mkdirSync, unlinkSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import { rollup } from 'rollup';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.resolve(root, 'packages/request/dist');

const config = {
  input: path.resolve(root, 'packages/request/src/cdzd.ts'),
  output: {
    file: path.resolve(outDir, 'placeholder.js'),
    format: 'iife',
    name: 'cdzd',
    sourcemap: true,
  },
  plugins: [
    resolve({ extensions: ['.ts', '.js', '.json'] }),
    commonjs(),
    babel({
      babelHelpers: 'bundled',
      extensions: ['.ts', '.js'],
      presets: [
        ['@babel/preset-env', { targets: { esmodules: true } }],
        '@babel/preset-typescript',
      ],
    }),
    {
      name: 'time-and-content-hash',
      generateBundle(options, bundle) {
        const chunkEntry = Object.entries(bundle).find(([, o]) => o.type === 'chunk');
        if (!chunkEntry) return;
        const [placeholderKey, chunk] = chunkEntry;
        if (!chunk.code) return;
        const timePart = Date.now().toString(36);
        const contentHash = createHash('sha256').update(chunk.code).digest('hex').slice(0, 8);
        const fileName = `index.${timePart}.${contentHash}.js`;
        delete bundle[placeholderKey];
        bundle[fileName] = { ...chunk, fileName };
      },
      writeBundle(options, bundle) {
        const jsName = Object.keys(bundle).find((k) => k.endsWith('.js') && !k.endsWith('.map'));
        if (!jsName) return;
        const placeholderPath = path.resolve(outDir, 'placeholder.js');
        const placeholderMapPath = path.resolve(outDir, 'placeholder.js.map');
        if (existsSync(placeholderPath)) unlinkSync(placeholderPath);
        if (existsSync(placeholderMapPath)) unlinkSync(placeholderMapPath);
        mkdirSync(outDir, { recursive: true });
        const configPath = path.resolve(outDir, 'config.json');
        const config = { url: jsName };
        writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(`[cdzd] ${jsName}`);
        console.log(`[cdzd] wrote ${configPath} -> ${JSON.stringify(config)}`);
      },
    },
  ],
};

const bundle = await rollup(config);
await bundle.write(config.output);
await bundle.close();
