import React from 'react';
import data from './data';

import pkg from '../package.json';

console.log(`%c ${pkg.name} %c@${pkg.version}`, `color:#FFF;background:#fa6400`, ``, ``);

import { MYBRICKS_TOOLS } from "./tools"
import { View } from "./view";
import { context } from './context';

export { fileFormat } from '@mybricks/rxai'

export default function pluginAI({
  requestAsStream,
  prompts
}: any): any {
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

          context.registTools = () => {
            const targetId = context.currentFocus?.type === 'uiCom' ? context.currentFocus?.comId : context.currentFocus?.pageId
            context.rxai.register({
              name: "canvas",
              tools: [
                MYBRICKS_TOOLS.GetComponentsDocAndPrd({
                  allowComponents: api?.global?.api?.getAllComDefPrompts?.(),
                  examples: prompts.prdExamplesPrompts,
                  canvasWidth: prompts.canvasWidth,
                  queryComponentsDocsByNamespaces: (namespaces) => {
                    return namespaces.reduce((acc, cur) => {
                      return acc + '\n' + api?.uiCom?.api?.getComEditorPrompts?.(cur.namespace)
                    }, '')
                  }
                }),
                MYBRICKS_TOOLS.GeneratePage({
                  getFocusRootComponentDoc: () => api?.page?.api?.getPageContainerPrompts?.(targetId) as string,
                  getTargetId: () => targetId as string,
                  appendPrompt: prompts.systemAppendPrompts,
                  examples: prompts.generatePageActionExamplesPrompts,
                  onActions: (actions) => {
                    api?.page?.api?.updatePage?.(targetId, actions)
                  }
                }),
                MYBRICKS_TOOLS.ModifyComponent({
                  onActions: (actions) => {
                    const actionsGroupById = actions.reduce((acc, item) => {
                      const id = item.comId;
                      if (!acc[id]) {
                        acc[id] = [];
                      }
                      acc[id].push(item);
                      return acc;
                    }, {});

                    Object.keys(actionsGroupById).forEach(id => {
                      api?.uiCom?.api?.updateCom?.(id, actionsGroupById[id])
                    })
                  }
                }),
                MYBRICKS_TOOLS.GetMybricksDSL({
                  getContext: (id: string) => api?.page?.api?.getPageDSLPrompts?.(targetId) as string,
                }),
                MYBRICKS_TOOLS.GetComponentInfo({
                  getComInfo(id) {
                    return api?.uiCom?.api?.getComPrompts?.(id)?.replace(/当前组件的情况/g, `组件${id}的信息`) as string
                  },
                })
                // MYBRICKS_TOOLS.FocusElement({})
              ],
            });
          }
          console.log("[init - API]", api)

          context.getPresetMessages = () => {
            return [
              {
                role: 'user',
                content: `聚焦位置发生变化，当前聚焦在哪里？`
              },
              {
                role: 'assistant',
                content: `当前已聚焦到${context.currentFocus?.type === 'uiCom' ? `组件(id=${context.currentFocus?.comId})` : `页面(title=${context.currentFocus?.title},id=${context.currentFocus?.pageId})`}中，后续用户的提问，关于”这个“、“此”，甚至不提主语，都是指代此元素。
                `
              }
            ]
          }

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

              const id = params.comId ?? params.pageId

              context.registTools()

              if (params.attachments?.length) {
                params.message = "参考附件图片完成页面搭建\n" + params.message
              }

              context.rxai.requestAI({
                ...params,
                message: params.message,
                key: id,
                emits: {
                  write: () => {},
                  complete: () => {},
                  error: () => {},
                  cancel: () => {},
                },
                presetMessages: context.getPresetMessages()
              });
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