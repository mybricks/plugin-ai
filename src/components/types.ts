interface Mention {
  /** 唯一ID */
  id?: string;
  /** 展示用 */
  name?: string;

  
  /** 区域才会有 */
  focusArea?: {
    selector: string;
    title: string;
  }
  comId: string;
  pageId: string;
  title: string;
  /** 类型，组件、页面 */
  type: "page" | "uiCom";
  /** 是否为 vibeCoding 状态（代码编辑模式） */
  vibeCoding?: boolean;
}

interface Extension {
  mentions: Mention[]
}

type Attachments = {
  type: "image";
  content: string;
}[]

export type { Mention, Extension, Attachments }
