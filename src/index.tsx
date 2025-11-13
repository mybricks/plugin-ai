import React from 'react';
import data from './data';

import pkg from '../package.json';

console.log(`%c ${pkg.name} %c@${pkg.version}`, `color:#FFF;background:#fa6400`, ``, ``);

import { Rxai } from "../../rxai/src";
import { pageScene } from "./mock";

interface API {

}

interface RequestParams {
  key: string;
  message: string;
  attachments: {
    type: "image";
    content: string;
    title?: string;
    size?: number;
  }[]
  emits: {
    write: () => void;
    complete: () => void;
    error: () => void;
    cancel: () => void;
  }
}

export default function pluginAI({ requestAsStream }: any): any {
  const rxai = new Rxai({
    request: {
      requestAsStream
    }
  })

  rxai.register(pageScene);

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
        init(api: API) {
          console.log("[init - API]", api)
          return {
            request(params: RequestParams) {
              console.log("[request - params]", params);
              rxai.requestAI({
                ...params,
                emits: params.emits || {
                  write: () => {},
                  complete: () => {},
                  error: () => {},
                  cancel: () => {},
                }
              });
            }
          }
        }
      },
      aiView: {
        render(args: any): JSX.Element {
          debugger
        }
      }
    }
  }
}