import React from 'react';
import data from './data';

import pkg from '../package.json';

console.log(`%c ${pkg.name} %c@${pkg.version}`, `color:#FFF;background:#fa6400`, ``, ``);

import { Agents } from './agents'
import { View } from "./view";
import { context } from './context';

export { fileFormat } from '@mybricks/rxai'

export default function pluginAI({
  requestAsStream,
  prompts
}: any): any {

  context.prompts = prompts

  // window.requestGenerateCanvasAgent = requestGenerateCanvasAgent

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
        init(api: AiServiceAPI) {
          context.api = api;
          context.createRxai({
            request: {
              requestAsStream
            }
          })

          console.log("[init - API]", api)

          return {
            focus(params: AiServiceFocusParams) {
              if (!params) {
                context.currentFocus = undefined;
                return;
              }
              console.log("[focus - params]", params)
              context.currentFocus = params;
            },
            request(params: AiServiceRequestParams) {
              console.log("[request - params]", params);

              if (params.attachments?.length) {
                params.message = "参考附件图片完成页面搭建\n" + params.message
              }

              Agents.requestCommonAgent(params)
            }
          }
        }
      },
      aiView: {
        render() {
          return <View />
        }
      }
    }
  }
}