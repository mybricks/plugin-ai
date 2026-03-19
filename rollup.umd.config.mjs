import path from 'path';
import alias from '@rollup/plugin-alias';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';
import babel from '@rollup/plugin-babel';
import postcss from 'rollup-plugin-postcss';
import terser from '@rollup/plugin-terser';

const APP_ENV = process.env.APP_ENV || 'production';

export default {
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
    },
  },
  external: [
    'react',
    'react/jsx-runtime',
    'react-dom',
    'antd',
    '@ant-design/icons',
  ],
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        APP_ENV: JSON.stringify(APP_ENV),
      },
    }),
    json(),
    alias({
      entries: [{ find: '@mybricks/rxai', replacement: path.resolve('../rxai/src/index.ts') }],
    }),
    resolve({ extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'] }),
    commonjs(),
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
    terser(),
  ],
};
