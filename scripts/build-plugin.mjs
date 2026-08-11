import path from 'path';
import { fileURLToPath } from 'url';
import alias from '@rollup/plugin-alias';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';
import babel from '@rollup/plugin-babel';
import postcss from 'rollup-plugin-postcss';
import terser from '@rollup/plugin-terser';
import { rollup } from 'rollup';
import { rmSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const APP_ENV = process.env.APP_ENV || 'production';
const isWatch = process.argv.includes('--watch');

// clean dist
rmSync(path.resolve(root, 'packages/plugin/dist'), { recursive: true, force: true });

const aliasPlugin = alias({
  entries: [
    { find: '@plugin-ai/agent', replacement: path.resolve(root, 'packages/agent/src/index.ts') },
    { find: '@mybricks/request', replacement: path.resolve(root, 'packages/request/src/index.ts') },
    { find: '@plugin-ai/request', replacement: path.resolve(root, 'packages/request/src/index.ts') },
  ],
});

const babelPlugin = babel({
  babelHelpers: 'bundled',
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
  presets: [
    ['@babel/preset-env', { targets: { esmodules: true } }],
    ['@babel/preset-react', { runtime: 'classic' }],
    '@babel/preset-typescript',
  ],
});

const postcssPlugin = postcss({
  extract: false,
  inject: true,
  modules: true,
  use: { less: {} },
});

const external = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'antd',
  '@ant-design/icons',
];

const sharedPlugins = [
  replace({ preventAssignment: true, values: { APP_ENV: JSON.stringify(APP_ENV) } }),
  json(),
  aliasPlugin,
  resolve({ extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'] }),
  commonjs(),
  babelPlugin,
  postcssPlugin,
];

const entry = path.resolve(root, 'index.tsx');

const configs = [
  // ESM（暂时禁用）
  // {
  //   input: entry,
  //   output: {
  //     dir: path.resolve(root, 'packages/plugin/dist'),
  //     entryFileNames: '[name].js',
  //     chunkFileNames: '[name].js',
  //     assetFileNames: '[name][extname]',
  //     format: 'es',
  //     sourcemap: true,
  //     preserveModules: true,
  //     preserveModulesRoot: root,
  //   },
  //   external,
  //   plugins: sharedPlugins,
  // },
  // UMD
  {
    input: entry,
    output: {
      file: path.resolve(root, 'packages/plugin/dist/index.umd.js'),
      format: 'umd',
      name: 'MyBricksPluginAI',
      sourcemap: true,
      exports: 'named',
      globals: {
        react: 'React',
        'react/jsx-runtime': 'ReactJSXRuntime',
        'react-dom': 'ReactDOM',
        antd: 'antd',
        '@ant-design/icons': 'icons',
      },
    },
    external,
    plugins: [...sharedPlugins, terser()],
  },
];

if (isWatch) {
  const { watch } = await import('rollup');
  const watcher = watch(configs.map(c => ({ ...c, watch: {} })));
  watcher.on('event', (event) => {
    if (event.code === 'BUNDLE_END') {
      console.log(`[build-plugin] rebuilt in ${event.duration}ms`);
      event.result?.close();
    }
    if (event.code === 'ERROR') console.error('[build-plugin] error', event.error);
  });
} else {
  for (const config of configs) {
    const bundle = await rollup(config);
    await bundle.write(config.output);
    await bundle.close();
  }
  console.log('[build-plugin] done');
}
