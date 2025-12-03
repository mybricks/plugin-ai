import React from 'react';
import { Rxai } from "@mybricks/rxai";
import data from './data';

// import './../test'

import pkg from '../package.json';

console.log(`%c ${pkg.name} %c@${pkg.version}`, `color:#FFF;background:#fa6400`, ``, ``);

import { Agents } from './agents'
import { View } from "./view";
import { context } from './context';
import { StartView } from "./startView";

export { fileFormat } from '@mybricks/rxai'
import preset from "./preset"

const transformParams = (params: any = {}) => {
  return Object.assign({...preset}, params);
}

export default function pluginAI(params?: any): any {
  const { user, prompts, requestAsStream, mock, key } = transformParams(params);
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

          const useMock = !!mock?.length;
          
          const mockRequestAsStream = () => {
            let count = 0;
            let length = mock.length;
            return (params: {
              messages: any;
              emits: any;
              aiRole?: any;
            }) => {
              params.emits.write("");
              params.emits.write(mock[count++]);
              params.emits.complete("");
              if (count === length) {
                count = 0;
              }
            }
          }

          context.createRxai({
            request: {
              requestAsStream: useMock ? mockRequestAsStream() : requestAsStream
            },
            key
          })

          console.log("[init - API]", api)

          return {
            focus(params: AiServiceFocusParams) {
              const currentFocus = !params ? undefined : params;
              context.currentFocus = currentFocus;
              context.events.emit("focus", currentFocus);
            },
            request(params: AiServiceRequestParams) {
              if (params.attachments?.length) {
                params.message = "参考附件图片完成页面搭建\n" + params.message
              }

              const focus = context.currentFocus;
              const extension: any = {};

              if (focus) {
                const type = focus.type;
                const id = type === "page" ? focus.pageId : focus.comId;
                extension.mentions = [
                  {
                    id,
                    type,
                    name: focus.title,
                  }
                ]
                if (focus.onProgress) {
                  params.onProgress = focus.onProgress;
                } else if (params.onProgress) {
                  focus.onProgress = params.onProgress;
                }
              }

              Agents.requestCommonAgent({...params, extension})
            }
          }
        }
      },
      aiView: {
        render(api: AiViewApi) {
          context.aiViewAPI = api;
          return <View user={user} copilot={copilot} api={api}/>
        },
        display() {
          context.events.emit("aiViewDisplay", true);
        },
        hide() {}
      },
      aiStartView: {
        render(api: AiStartViewApi) {
          return <StartView user={user} copilot={copilot} api={api}/>
        }
      }
    }
  }
}