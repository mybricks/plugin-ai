/** 构建时由 rollup replace 注入 */
declare const APP_ENV: "development" | "production";

// ─── *.less 模块声明 ──────────────────────────────────────────────────────────

declare module "*.less" {
  const resource: { [key: string]: any };
  export default resource;
}

// ─── plugin contributes 接口类型 ──────────────────────────────────────────────

/** aiService.focus() 的参数 */
type AiServiceFocusParams = {
  onProgress?: (status: "start" | "ing" | "complete") => void;
  focusArea?: {
    selector: string;
    title: string;
    ele?: HTMLElement;
  };
  comId?: string;
  pageId?: string;
  title?: string;
  type?: string;
  [key: string]: any;
};

/** aiService.request() 的参数 */
type AiServiceRequestParams = {
  message: string;
  attachments?: {
    type: string;
    content: string;
    title?: string;
    size?: number;
  }[];
  onProgress?: (status: string) => void;
  [key: string]: any;
};

/** aiView.render() 回调中的 api */
interface AiViewApi {
  focusPage: (pageId: string) => void;
  focusCom: (comId: string) => void;
}

/** aiStartView.render() 回调中的 api */
interface AiStartViewApi {
  onProgress?: (state: "start" | "ing") => void;
}
