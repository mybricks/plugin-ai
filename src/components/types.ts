interface Mention {
  /** 唯一ID */
  id: string;
  /** 展示用 */
  name: string;
  /** 类型，组件、页面 */
  type: "page" | "uiCom";
}

interface Extension {
  mentions: Mention[]
}

type Attachments = {
  type: "image";
  content: string;
}[]

export type { Mention, Extension, Attachments }
