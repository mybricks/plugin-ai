// ─── file-upload.ts ──────────────────────────────────────────────────────────
// 文件上传专题 case。
//
// 这些 case 使用真实上传 UI，用户可以手动拖入/选择文件，并在 Inspector 中查看
// chip format 后最终发给 LLM 的消息内容。

import type { TestCase } from "./types";
import type { AttachProcessor } from "@plugin/content-limits";
import { makeScriptedRequest } from "../lib/scripted-request";

function parseCsvToJson(text: string): Array<Record<string, string>> {
  const [headerLine, ...rows] = text.trim().split(/\r?\n/);
  if (!headerLine) return [];
  const headers = headerLine.split(",").map((header) => header.trim());
  return rows
    .filter((row) => row.trim())
    .map((row) => {
      const cells = row.split(",");
      return Object.fromEntries(
        headers.map((header, index) => [header, cells[index]?.trim() ?? ""])
      );
    });
}

function toJsonFileName(fileName: string): string {
  return fileName.replace(/\.csv$/i, ".json");
}

export const fileUploadInlineCase: TestCase = {
  id: "file-upload-inline",
  name: "文件上传：小文本内联",
  group: "文件上传",
  description:
    "上传 .txt / .md / .ts / .svg 等普通小文本文件，验证内容会以内联 <file> 块进入消息。",
  expectedBehavior:
    "chip 显示在输入框；发送后 Inspector 中可看到消息末尾有 <file> 代码块。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: ["收到，普通小文本文件会以内联内容的形式提供给模型。"],
      ttftMs: 300,
      chunkDelayMs: 40,
    },
  ]),
};

export const fileUploadReferenceCase: TestCase = {
  id: "file-upload-reference",
  name: "文件上传：倾向引用",
  group: "文件上传",
  description:
    "上传 .log / .csv / .jsonl / lockfile 等指定扩展名/文件名的文件，验证即使小于阈值也会写入 .tmp/uploads 并以路径引用。",
  expectedBehavior:
    "chip 显示在输入框；发送后 Inspector 中 chip 占位符被替换为 .tmp/uploads 下的 Markdown 链接，消息末尾不追加全文。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: ["收到，日志/表格/lockfile 等文件会以临时路径引用，模型可按需读取。"],
      ttftMs: 300,
      chunkDelayMs: 40,
    },
  ]),
};

export const fileUploadMhtmlCase: TestCase = {
  id: "file-upload-mhtml",
  name: "文件上传：MHTML 清理",
  group: "文件上传",
  description:
    "上传 .mht / .mhtml 文件，验证内置 cleanMhtml 会清理网页归档内容，并以内联 <file> 块进入消息。",
  expectedBehavior:
    "chip 显示在输入框；发送后 Inspector 中可看到清理后的 <file> 内容，资源片段和冗余头信息应被移除。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: ["收到，MHTML 已经过清理后以内联文本形式提供给模型。"],
      ttftMs: 300,
      chunkDelayMs: 40,
    },
  ]),
};

const mockCsvCdnProcessor: AttachProcessor = {
  type: "file",
  match: /\.csv$/i,
  process: async (file) => {
    const encodedName = encodeURIComponent(file.name);
    const url = `https://cdn.example.test/uploads/${encodedName}`;
    console.info(`[mock-cdn] 上传 ${file.name} (${file.size} bytes) -> ${url}`);
    return {
      type: "reference",
      text: `[${file.name}](${url})`,
    };
  },
};

export const fileUploadProcessorReferenceCase: TestCase = {
  id: "file-upload-processor-reference",
  name: "文件上传：AttachProcessor 返回 FileReference",
  group: "文件上传",
  description:
    "上传 CSV 文件，mock 宿主侧将文件上传到 CDN，并由 attachProcessor 直接返回 FileReference。",
  expectedBehavior:
    "发送后 Inspector 中 chip 占位符被替换为 CDN Markdown 链接，消息末尾不追加 CSV 全文。",
  initialTurns: [],
  attachProcessors: [mockCsvCdnProcessor],
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: ["收到，CSV 已上传到 CDN，并以链接形式提供。"],
      ttftMs: 300,
      chunkDelayMs: 40,
    },
  ]),
};

const csvToJsonProcessor: AttachProcessor = {
  type: "file",
  match: /\.csv$/i,
  process: async (file) => {
    const json = parseCsvToJson(await file.text());
    return {
      type: "content",
      fileName: toJsonFileName(file.name),
      content: JSON.stringify(json, null, 2),
      language: "json",
    };
  },
};

export const fileUploadProcessorContentCase: TestCase = {
  id: "file-upload-processor-content",
  name: "文件上传：AttachProcessor 返回 FileContent",
  group: "文件上传",
  description:
    "上传 CSV 文件，attachProcessor 在前置阶段将 CSV 转成 JSON，并直接返回 FileContent。",
  expectedBehavior:
    "发送后 Inspector 中可看到 <file name=\"*.json\"> 的 JSON 代码块，模型会按 JSON 内容读取。",
  initialTurns: [],
  attachProcessors: [csvToJsonProcessor],
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: ["收到，CSV 已在 attachProcessor 中转换为 JSON 内容。"],
      ttftMs: 300,
      chunkDelayMs: 40,
    },
  ]),
};
