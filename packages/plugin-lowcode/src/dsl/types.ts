/**
 * CanonicalAction —— DSL 的内部规范格式，与具体 wire 格式无关。
 *
 * 各 DSL 文件负责：
 *   serialize: CanonicalAction → wire 字符串（写入 prompt 示例）
 *   parse:     wire 字符串     → CanonicalAction（解析 LLM 输出）
 *
 * addChild 专用字段说明：
 *   cfg - 属性配置，{ "path": value }，对应 wire 里的 configs[]{path,value}
 *         value 可以是任意类型，包括数组（如 区域列表）、对象等
 *   sty - 样式配置，{ "path": {styles} }，对应 wire 里的 configs[]{path,style}
 */

export type LayoutParams = {
  position?: "absolute" | "fixed";
  width?: number | "fit-content" | "100%";
  height?: number | "fit-content" | "100%";
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export type CanonicalAction =
  | {
      type: "setLayout";
      comId: string;
      target: string;
      width?: number | string;
      height?: number | string;
      [key: string]: any;
    }
  | {
      type: "doConfig";
      comId: string;
      target: string;
      path: string;
      value?: any;
      style?: Record<string, any>;
    }
  | {
      type: "addChild";
      comId: string;
      target: string;
      title: string;
      ns: string;
      newComId: string;
      layout?: LayoutParams;
      cfg?: Record<string, any>;
      sty?: Record<string, Record<string, any>>;
      ignore?: boolean;
      enhance?: boolean;
    }
  | {
      type: "delete";
      comId: string;
      target: string;
    };

/**
 * ActionDSL —— 一种 wire 格式的完整描述。
 *
 * 新增 DSL 只需实现此接口并注册到 dsl/index.ts 的 DSL_REGISTRY，
 * 再将 activeDSL 指向它即可全局切换。
 */
export interface ActionDSL {
  id: string;
  fileTag: string;
  /**
   * 在 prompt 中描述当前 DSL 的格式规则，插入到 <关于actions> 块开头。
   * 不同 DSL 格式不同，这里描述字段含义、结构约束等。
   */
  formatDescription: string;
  serializeAction(action: CanonicalAction): string;
  serializeActions(actions: CanonicalAction[]): string;
  exampleBlock(actions: CanonicalAction[]): string;
  addChildDescription(ex: (actions: CanonicalAction[]) => string): string;
  parseContent(content: string): CanonicalAction[];
  parseStreamingContent(content: string): CanonicalAction[];
}
