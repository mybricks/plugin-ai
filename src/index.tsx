import React from 'react';
import data from './data';

import pkg from '../package.json';

console.log(`%c ${pkg.name} %c@${pkg.version}`, `color:#FFF;background:#fa6400`, ``, ``);

export default function note(appCtx: any): any {
  return {
    name: '@mybricks/plugins/ai',
    title: 'AI助手',
    author: 'MyBricks',
    ['author.zh']: 'MyBricks',
    version: '1.0.0',
    description: 'ai for MyBricks',
    data,
    contributes: {
      geoView: {
        note: {
          type: 'default',
          render(args: any): JSX.Element {
          }
        }
      }
    }
  }
}