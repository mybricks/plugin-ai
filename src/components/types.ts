interface Mention {
  /** 唯一ID */
  id: string;
  /** 展示用 */
  name: string;
  /** 点击事件 */
  onClick: () => void;
}

interface Extension {
  mentions: Mention[]
}

type Attachments = {
  type: "image";
  content: string;
}[]

export type { Mention, Extension, Attachments }
