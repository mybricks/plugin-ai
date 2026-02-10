import type { CodingManager } from '../agents/workspace/coding-manager'
import { requestVibeCodingAgent } from '../agents/custom'

const NAME = 'coding-subagent-as-tool'
codingSubagentAsTool.toolName = NAME

interface Config {
  codingManager: CodingManager,
  onStart: () => void,
  onComplete: () => void,
  onError: () => void,
}

function getBatchCodingPayload(codingManager: CodingManager) {
  const codings = [...codingManager.waitForCoding]
  const message = `# 批量组件代码还原任务

## 当前页面结构
${codingManager.getJsxById(codingManager.pageId)}

## 任务说明
需要按顺序还原以下 ${codings.length} 个组件，请根据图片严格还原设计效果。

## 待还原组件

${codings
  .map(
    (coding, index) =>
      `### 组件 ${index + 1}: ${coding.comId}
**需求描述：**
${coding.requirement}`
  )
  .join('\n\n')}
`
  return {
    key: `vibe_coding_${codingManager.pageId}_${Math.random().toString(36).substring(2, 15)}`,
    message,
    attachments: codingManager.attachments,
    pageId: codingManager.pageId,
  }
}

function onDevelopModule(
  p: { files: Array<{ fileName: string; content: string }> },
  updateComponent: (comId: string, files: Array<{ fileName: string; content: string }>) => void
) {
  const { files } = p
  const filesByUuid = files.reduce(
    (acc, file) => {
      const match = file.fileName.match(/^(.+)@([^.]+)(\..+)$/)
      if (match) {
        const [, name, uuid, ext] = match
        if (!acc[uuid]) acc[uuid] = []
        acc[uuid].push({ fileName: `${name}${ext}`, content: file.content })
      }
      return acc
    },
    {} as Record<string, Array<{ fileName: string; content: string }>>
  )
  Object.entries(filesByUuid).forEach(([uuid, componentFiles]) => {
    updateComponent(uuid, componentFiles)
  })
}

export default function codingSubagentAsTool(config: Config): any {
  return {
    name: NAME,
    displayName: '代码开发',
    description: `执行「AI区域开发」：当生成页面时添加了需要开发代码的AI组件时，调用智能组件助手批量开发/还原这些组件的代码。无需规划此工具，此工具会自行调用。`,
    async execute() {
      const { codingManager } = config
      if (!codingManager.waitForCoding.length) {
        return {
          llmContent: '当前没有需要开发的组件。',
          displayContent: '当前没有需要开发的组件。',
        }
      }
      const payload = getBatchCodingPayload(codingManager)
      return new Promise<{ llmContent: string; displayContent: string }>((resolve, reject) => {
        const onProgress = (status: string) => {
          if (status === 'complete') {
            resolve({ llmContent: '代码开发已完成。', displayContent: '代码开发已完成。' })
          }
          if (status === 'error') {
            reject(new Error('开发出问题了'))
          }
        }
        const promise = requestVibeCodingAgent(
          {
            ...payload,
            onProgress,
            onDevelopModule,
            asTool: true,
          },
          { pageId: payload.pageId }
        )
        if (!promise) {
          reject(new Error('此工具暂不支持调用'))
          return
        }
        promise.catch(reject)
      })
    },
  }
}
