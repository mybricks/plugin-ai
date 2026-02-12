export type OnDownloadParams = {
  name: string;
  /** 下载内容，已由调用方序列化好的字符串（如 JSON.stringify 后的结果） */
  content: string;
  // 后续可扩展更多字段，如 mimeType、encoding 等
};

/**
 * 浏览器下载：通过 <a download> + Blob 触发下载。
 * 在 VSCode/Webview 等环境可能无效，可传入自定义 onDownload 替代。
 */
export function browserDownload({ name, content }: OnDownloadParams) {
  const eleLink = document.createElement('a');
  eleLink.download = name;
  eleLink.style.display = 'none';

  const blob = new Blob([content]);

  eleLink.href = URL.createObjectURL(blob);
  document.body.appendChild(eleLink);
  eleLink.click();
  document.body.removeChild(eleLink);
}
