import React from 'react';
import data from './data';

import pkg from '../package.json';

console.log(`%c ${pkg.name} %c@${pkg.version}`, `color:#FFF;background:#fa6400`, ``, ``);

export default function pluginAI(): any {
  return {
    name: '@mybricks/plugins/ai',
    title: 'MyBricksAI助手',
    author: 'MyBricks',
    ['author.zh']: 'MyBricks',
    version: '1.0.0',
    description: 'ai for MyBricks',
    data,
    contributes: {
      aiService: {
        init(api) {
          //debugger

          ////TODO
          return {
            request() {//调用
              return new Promise((resolve, reject) => {
                const files = {}//返回的文件列表
                resolve(files)
              })
            }
          }
        }
      },
      // aiService(params,ref){
      //   ref()
      // },
      aiView: {
        render(args: any): JSX.Element {
          debugger
        }
      }
    }
  }
}