import path from 'path';
import alias from '@rollup/plugin-alias';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';
import babel from '@rollup/plugin-babel';
import postcss from 'rollup-plugin-postcss';

// APP_ENV: development | production，构建时注入，默认 production（线上模式不打包 stream-test 相关代码）
const APP_ENV = process.env.APP_ENV || 'production';
const isProd = APP_ENV === 'production';

export default {
  input: 'src/index.tsx',
  output: {
    dir: 'dist',
    entryFileNames: '[name].js',
    chunkFileNames: '[name].js',
    assetFileNames: '[name][extname]',
    format: 'es',
    sourcemap: true,
    // 保持与 src 一致的目录结构，仅把 ts/tsx 编译成 js
    preserveModules: true,
    preserveModulesRoot: 'src',
  },
  external: [
    'react',
    'react/jsx-runtime',
    'react-dom',
    'antd',
    '@ant-design/icons',
    'classnames',
    'markdown-it',
    'jsonrepair',
    'node-forge',
  ],
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        // 代码里直接写 APP_ENV，构建时替换为具体值
        APP_ENV: JSON.stringify(APP_ENV),
      },
    }),
    json(),
    alias({
      entries: [{ find: '@mybricks/rxai', replacement: path.resolve('/Users/cocolbell/Desktop/projects/mybricks/rxai/src/index.ts') }],
    }),
    resolve({ extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'] }),
    commonjs(),
    // 全量用 Babel 转译 TS/TSX → 纯 JS，产出已是 react/jsx-runtime 调用，引用方无需再编译此包
    babel({
      babelHelpers: 'bundled',
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      presets: [
        ['@babel/preset-env', { targets: { esmodules: true } }],
        ['@babel/preset-react', { runtime: 'classic' }],
        '@babel/preset-typescript',
      ],
    }),
    postcss({
      extract: false,
      inject: true,
      modules: true,
      use: { less: {} },
    }),
  ],
};
