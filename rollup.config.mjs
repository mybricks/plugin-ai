import babel from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import alias from '@rollup/plugin-alias';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  input: 'src/mybricks-api/index.ts',
  external: [],
  // output: {
  //   file: 'dist/mybricks-api.js',
  //   format: 'es',
  //   sourcemap: true,
  //   inlineDynamicImports: true,
  // },
  output: {
    file: 'dist/mybricks-api.js', // 输出的 UMD 文件的路径
    format: 'umd', // 输出格式为 UMD
    name: 'MyBricksAPI', // UMD 的全局变量名（可选）
  },
  plugins: [
    alias({
      entries: [
        {
          find: '@mybricks/rxai',
          replacement: path.resolve(__dirname, '')
        }
      ]
    }),
    resolve({
      preferBuiltins: false,
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
    }),
    commonjs(),
    babel({
      babelHelpers: 'bundled',
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      exclude: 'node_modules/**',
      presets: [
        '@babel/preset-react',
        // ['@babel/preset-typescript', {
        //   onlyRemoveTypeImports: true,
        //   allowDeclareFields: true
        // }],
        ['@babel/preset-env', {
          targets: { browsers: ['> 0.2%, not dead'] }
        }]
      ],
      plugins: [
        ['@babel/plugin-proposal-decorators', { version: '2023-05' }],
        '@babel/plugin-proposal-class-properties',
        ['@babel/plugin-transform-typescript', {
          onlyRemoveTypeImports: true
        }]
      ]
    })
  ]
};
