import path from 'path';
import { fileURLToPath } from 'url';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import babel from '@rollup/plugin-babel';
import { rollup } from 'rollup';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const APP_ENV = process.env.APP_ENV || 'production';

const config = {
  input: path.resolve(root, 'packages/request/src/index.ts'),
  output: {
    dir: path.resolve(root, 'packages/request/dist'),
    entryFileNames: '[name].js',
    chunkFileNames: '[name].js',
    format: 'es',
    sourcemap: true,
    preserveModules: true,
    preserveModulesRoot: path.resolve(root, 'packages/request/src'),
  },
  external: ['node-forge'],
  plugins: [
    replace({
      preventAssignment: true,
      values: { APP_ENV: JSON.stringify(APP_ENV) },
    }),
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
  ],
};

const bundle = await rollup(config);
await bundle.write(config.output);
await bundle.close();
console.log('[build-request] done');
