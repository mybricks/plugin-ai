import path from 'path';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import babel from '@rollup/plugin-babel';

const APP_ENV = process.env.APP_ENV || 'production';

export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    entryFileNames: '[name].js',
    chunkFileNames: '[name].js',
    format: 'es',
    sourcemap: true,
    preserveModules: true,
    preserveModulesRoot: 'src',
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
