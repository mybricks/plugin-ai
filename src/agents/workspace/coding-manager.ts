export interface CodingCom {
  pageId: string
  comId: string
  title: string
  requirement: string
}

/** 只负责存储待开发组件 ID 列表及获取所需上下文 */
export class CodingManager {
  attachments: any
  getJsxById: (id: string) => string
  pageId: string
  waitForCoding: CodingCom[] = []

  constructor(params: {
    pageId: string
    attachments: any[]
    getJsxById: (id: string) => string
  }) {
    this.pageId = params.pageId
    this.attachments = params.attachments
    this.getJsxById = params.getJsxById
  }

  addCodingCom(com: CodingCom) {
    if (this.waitForCoding.some((c) => c.comId === com.comId)) {
      return
    }
    this.waitForCoding.push(com)
  }
}
