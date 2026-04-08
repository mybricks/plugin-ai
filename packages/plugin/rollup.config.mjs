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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ENV = process.env.APP_ENV || 'production';

const aliasPlugin = alias({
  entries: [
    { find: '@plugin-ai/agent', replacement: path.resolve(__dirname, '../agent/src/index.ts') },
    { find: '@plugin-ai/request', replacement: path.resolve(__dirname, '../request/src/index.ts') },
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
  'classnames',
  'markdown-it',
];

export default [
  // ESM（保留模块结构，供 tree-shaking）
  {
    input: 'src/index.tsx',
    output: {
      dir: 'dist',
      entryFileNames: '[name].js',
      chunkFileNames: '[name].js',
      assetFileNames: '[name][extname]',
      format: 'es',
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: 'src',
    },
    external,
    plugins: [
      replace({ preventAssignment: true, values: { APP_ENV: JSON.stringify(APP_ENV) } }),
      json(),
      aliasPlugin,
      resolve({ extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'] }),
      commonjs(),
      babelPlugin,
      postcssPlugin,
    ],
  },
  // UMD（单文件，供 CDN/script 标签直接引用）
  {
    input: 'src/index.tsx',
    output: {
      file: 'dist/index.umd.js',
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
        classnames: 'classNames',
        'markdown-it': 'markdownit',
      },
    },
    external,
    plugins: [
      replace({ preventAssignment: true, values: { APP_ENV: JSON.stringify(APP_ENV) } }),
      json(),
      aliasPlugin,
      resolve({ extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'] }),
      commonjs(),
      babelPlugin,
      postcssPlugin,
      terser(),
    ],
  },
];
