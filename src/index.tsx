import React from 'react';
import data from './data';

import './agents/workspace-by-knowledges/test';
import './../test'

import pkg from '../package.json';

console.log(`%c ${pkg.name} %c@${pkg.version}`, `color:#FFF;background:#fa6400`, ``, ``);

import { Agents } from './agents'
import { View } from "./view";
import { context } from './context';
import { StartView } from "./startView";
import { DeviceType } from './types';
import { createGetAllComDefPrompts } from "./api/cloud-components";
import { AgentConfigParams, getAgentConfigs, backStoryPrompts, transformLegacyPromptsToAgents, AbstractAgent, CustomAgent } from './agents/utils/config';

import preset from "./preset";
import { createRequestAsStream, createMyBricksAIRequest, type RequestAsStreamParams, type RequestAsStreamFn } from "./requestAsStream";
import { apiRecorder } from './api-record-replay';
import { replay, replayFromJSON, ReplayAPI, ReplayOptions } from './api-record-replay';
import { RecordedAction } from './api-record-replay';
import { fileFormat } from '@mybricks/rxai';

// 导出收集和回放相关的接口
export { apiRecorder, replay, replayFromJSON, fileFormat };
export type { RecordedAction, ReplayAPI, ReplayOptions };

const transformParams = (params: any = {}) => {
  const result: any = {...preset};
  Object.entries(params).forEach(([key, value]: any) => {
    if (key === "agents") {
      result[key] = preset.agents.concat(value);
    } else {
      result[key] = value;
    }
  })
  return Object.assign({...preset}, params);
}

export default function pluginAI(params?: any): any {
  const {
    name = '智能助手',
    user,
    prompts,
    mock,
    key,
    agents: rawAgents,
    guidePrompt,
    createTemplates,
    isMutiCanvas,
    deviceType,
    config,
    onRequest,
    onDownload,
    codingMode = false
  } = transformParams(params);

  const requestAsStream = onRequest ?? createRequestAsStream();

  const copilot = {
    // name: "MyBricks.ai",
    name: "智能助手",
    avatar: "https://my.mybricks.world/image/icon.png"
  }

  // 兼容历史配置：如果没有 agents 但有 prompts，则将 prompts 转换为 agents
  const agents = rawAgents || (prompts ? transformLegacyPromptsToAgents(prompts) : undefined);

  context.name = name;
  context.agents = agents;
  context.createTemplates = createTemplates ?? {};
  context.isMutiCanvas = isMutiCanvas ?? true;
  context.deviceType = deviceType ?? DeviceType.Mobile;
  context.userConfig = config ?? {}
  context.codingMode = codingMode;
  context.pluginParams = {
    name,
    user,
    prompts,
    requestAsStream,
    mock,
    key,
    agents: rawAgents,
    guidePrompt,
    createTemplates,
    isMutiCanvas,
    deviceType,
    config,
    onDownload,
  }

  return {
    name: '@mybricks/plugins/ai',
    title: name,
    author: 'MyBricks',
    ['author.zh']: 'MyBricks',
    version: '1.0.0',
    description: 'ai for MyBricks',
    data,
    contributes: {
      aiService: {
        init(api: AiServiceAPI) {
          context.api = api;

          // 在 context.designer 上挂载新的 API（带记录功能）
          context.designer = {
            createPage: async (id: string, title: string, config?: any) => {
              const params = [id, title, config];
              apiRecorder.record('createPage', params);
              return api.page.api.createPage(id, title, config);
            },
            createCanvas: async () => {
              const params: any[] = [];
              apiRecorder.record('createCanvas', params);
              return api.page.api.createCanvas();
            },
            updatePage: async (...params: any[]) => {
              apiRecorder.record('updatePage', params);
              return api.page.api.updatePage(...params);
            },
            updateUiCom: async (...params: any[]) => {
              apiRecorder.record('updateUiCom', params);
              return api.uiCom.api.updateCom(...params);
            },
            updateLogicCom: async (...params: any[]) => {
              apiRecorder.record('updateLogicCom', params);
              return api.logicCom.api.updateCom(...params);
            },
            createDiagram: async (...params: any[]) => {
              apiRecorder.record('createDiagram', params);
              return api.diagram.api.createDiagram(...params);
            },
            updateDiagram: async (...params: any[]) => {
              apiRecorder.record('updateDiagram', params);
              return api.diagram.api.updateDiagram(...params);
            },
            getDiagramInfo: (...params: any[]) => {
              return api.diagram.api.getDiagramInfo(...params);
            },
            getDiagramInfoByVarId: (...params: any[]) => {
              return api.diagram.api.getDiagramInfoByVarId(...params);
            },
            getDiagramInfoByListenerInfo: (...params: any[]) => {
              return api.diagram.api.getDiagramInfoByListenerInfo(...params);
            },
            getAllComDefPrompts: createGetAllComDefPrompts(api?.global?.api?.getAllComDefPrompts)
          };

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
            system: {
              // title: 'MyBricks.ai',
              title: '智能助手',
              prompt: getAgentConfigs(agents, 'page')?.system ?? backStoryPrompts()
            },
            request: {
              maxRetries: 3,
              requestAsStream: useMock ? mockRequestAsStream() : requestAsStream
            },
            key
          })

          console.log("[init - API]", api)

          window._registerAgent_ = (agentConfig: any) => {
            context.agents.push(new CustomAgent(agentConfig));
          }

          return {
            focus(params: AiServiceFocusParams) {
              const currentFocus = !params ? undefined : params;
              context.currentFocus = currentFocus;
              context.events.emit("focus", currentFocus);

              if (currentFocus) {
                if ('vibeCoding' in currentFocus) {
                  const { type, pageId, comId } = currentFocus;
                  const id = ["page", "section"].includes(type) ? pageId : comId;
                  if (!context.vibeStatus[id]) {
                    context.vibeStatus[id] = 'vibe';
                  }
                }
              }
            },
            // 聚焦到页面或者组件时使用这个方法请求agent
            request(requestParams: AiServiceRequestParams) {
              if (requestParams.attachments?.length) {
                // TODO: attachments是Proxy代理，引擎不应该抛出此类代理
                requestParams.attachments = requestParams.attachments.map((attachment) => {
                  return {
                    ...attachment
                  }
                })
              } else {
                requestParams.attachments = [];
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
                // TODO: 兼容引擎的onProgress问题
                if (focus.onProgress) {
                  requestParams.onProgress = focus.onProgress;
                } else if (requestParams.onProgress) {
                  focus.onProgress = requestParams.onProgress;
                }
              }

              // 使用统一的 requestAgent 方法，自动处理自定义 agent 和默认 agent
              const focusId = focus ? (focus.type === "page" ? focus.pageId : focus.comId) : "";
              const agentType = context.vibeStatus[focusId] === "vibe" ? 'vibe' : 'common';
              context.requestStatusTracker.track(focusId, Agents.requestAgent(agentType, { ...requestParams, extension }))
            },
            registerAgent: window._registerAgent_,
            fileFormat
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

export { MyBricksParamsTools as MyBricksTools, Agent } from './agents/utils/config';
export { createMyBricksAIRequest };
export type { RequestAsStreamParams, RequestAsStreamFn }; 
interface AgentPluginProps {
  agents: AgentConfigParams[];
  [key: string]: any;
}

export function agentPlugin(props: AgentPluginProps) {
  return pluginAI(props)
}

export { AbstractAgent }