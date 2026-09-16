import type React from "react";
import type { ChatChipDef, ChatChipInstance } from "../../../../agent/src";

interface FocusMention {
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
  mentions: FocusMention[]
}

type Attachments = {
  type: "image";
  content: string;
}[]

export interface MentionMenuItem {
  /** 唯一 ID，provider 内唯一即可 */
  id: string;
  /** 生成 chip 时使用的 type；不传时使用 provider.chip.type */
  type?: string;
  /** 菜单与 chip fallback 展示文案 */
  label: string;
  description?: string;
  icon?: React.ReactNode;
  keywords?: string[];
  data?: any;
  /** 子选项，存在时点击进入二级菜单 */
  children?: MentionMenuItem[] | (() => Promise<MentionMenuItem[]> | MentionMenuItem[]);
  /** 叶子节点选择后生成 chip；不传时使用默认 ChatChipInstance */
  toChip?: (item: MentionMenuItem) => ChatChipInstance | Promise<ChatChipInstance>;
}

/**
 * 自定义 mention 注册源。
 * - 可以通过 `PluginAIParams.mentions` 全局注册（对所有组件生效）。
 * - 也可以通过 `connectToAI(comId, { mentions })` 按 comId 注册（仅对该组件生效，与 `chips` 同级），
 *   便于组件库随 connectToAI 一起声明自己支持的 @能力（见 sandbox/types.ts 的 RegistSandBoxConfig.mentions）。
 * `menu`/`search` 支持函数形式，每次唤起菜单/输入 @ 都会重新调用，天然支持动态数据。
 */
export interface MentionProvider {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** 出现在 + 菜单中的选项；不传时 provider 自身作为一项 */
  menu?: MentionMenuItem[] | (() => Promise<MentionMenuItem[]> | MentionMenuItem[]);
  /** 输入 @ 后的搜索源；不传时复用 menu 做本地过滤 */
  search?: (query: string) => Promise<MentionMenuItem[]> | MentionMenuItem[];
  /** chip UI 渲染和发送前格式化定义 */
  chip: ChatChipDef;
}

export type Mention = FocusMention;
export type { FocusMention, Extension, Attachments }
