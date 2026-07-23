/**
 * WebFetch URL 状态管理
 * 
 * 用于存储用户在 playground 输入框中填写的 URL，
 * web-fetch 测试用例的 mock LLM 会从这里读取 URL。
 */

/** 基础请求默认 URL */
export const DEFAULT_WEBFETCH_URL = "https://p4-ec.ecukwai.com/kos/nlav11092/vibe-coding/latest/manifest.json";

/** 图片请求默认 URL */
export const DEFAULT_IMAGE_URL = "https://p5-ec.eckwai.com/kos/nlav12333/fangzhou/pub/model-images/image_1776779097388.jpeg";

/** 错误页默认 URL（返回 HTML 错误页） */
export const DEFAULT_ERROR_PAGE_URL = "https://p4-ec.ecu.com/kos/nlav11092";

let currentUrl = DEFAULT_WEBFETCH_URL;

export function getWebFetchUrl(): string {
  return currentUrl;
}

export function setWebFetchUrl(url: string): void {
  currentUrl = url;
}

/** 根据测试用例 ID 获取默认 URL */
export function getDefaultUrlForCase(caseId: string): string {
  switch (caseId) {
    case "web-fetch-image":
      return DEFAULT_IMAGE_URL;
    case "web-fetch-error":
      return DEFAULT_ERROR_PAGE_URL;
    default:
      return DEFAULT_WEBFETCH_URL;
  }
}
