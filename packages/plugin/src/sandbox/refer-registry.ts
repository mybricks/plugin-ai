import type React from "react";

/**
 * 引用解析数据。各 scheme 自行约定字段，registry 只负责透传。
 */
export interface ReferData {
  id: string;
  title?: string;
  [key: string]: unknown;
}

/**
 * 引用解析器。由外部（如组件库）实现并通过 `window._sandbox_.registerRefer` 注册。
 * `scheme` 对应消息里 `<scheme>://<id>` 链接的协议名，如 AI 写的 `task://T-003`。
 */
export interface ReferResolver {
  scheme: string;
  resolve: (id: string) => Promise<ReferData | null>;
  renderCard: (data: ReferData) => React.ReactNode;
}

/**
 * 全局引用解析器注册表。
 * 与 agent / comId 无关，按 scheme 全局唯一；后注册的覆盖先注册的。
 */
class ReferRegistry {
  private map = new Map<string, ReferResolver>();

  register(resolver: ReferResolver): void {
    if (!resolver?.scheme) return;
    this.map.set(resolver.scheme, resolver);
  }

  unregister(scheme: string): void {
    this.map.delete(scheme);
  }

  get(scheme: string): ReferResolver | undefined {
    return this.map.get(scheme);
  }

  /** 解析形如 `task://T-003` 的链接，scheme 由已注册的协议名决定，id 取 `://` 之后的全部内容。 */
  parse(href: string): { scheme: string; id: string } | null {
    const match = href.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.+)$/);
    if (!match) return null;
    return { scheme: match[1], id: match[2] };
  }
}

export const referRegistry = new ReferRegistry();
