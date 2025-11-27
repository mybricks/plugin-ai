import React from 'react';
import { Rxai } from "@mybricks/rxai";
import data from './data';

import pkg from '../package.json';

console.log(`%c ${pkg.name} %c@${pkg.version}`, `color:#FFF;background:#fa6400`, ``, ``);

import { Agents } from './agents'
import { View } from "./view";
import { context } from './context';
import { StartView } from "./startView";

export { fileFormat } from '@mybricks/rxai'
import preset from "./preset"

const transformParams = (params?: any) => {
  if (!params) {
    return preset;
  }

  return {
    user: {
      name: "user",
      avatar: "/default_avatar.png"
    },
    ...params
  }
}

export default function pluginAI(params: any): any {
  const { user, prompts, requestAsStream } = transformParams(params);
  const copilot = {
    name: "MyBricks.ai",
    avatar: "https://my.mybricks.world/image/icon.png"
  }

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
              context.currentFocus = params;
            },
            request(params: AiServiceRequestParams) {
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
          return <View user={user} copilot={copilot}/>
        },
        display() {
          context.events.emit("aiViewDisplay", true);
        },
        hide() {}
      },
      aiStartView: {
        render() {
          return <StartView user={user} copilot={copilot}/>
        }
      }
    }
  }
}