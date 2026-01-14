import { jsonSafeParse } from "./../tools/utils";
import { context } from "../context";

export interface CloudComponentMeta {
  summary?: string;
  description?: string;
  [key: string]: any;
}

export interface CloudComponent {
  namespace: string;
  title?: string;
  meta?: string;
  summary?: string;
  [key: string]: any;
}

interface CloudComponentsApiResponse {
  data?: {
    list?: CloudComponent[];
    [key: string]: any;
  };
  list?: CloudComponent[];
  [key: string]: any;
}

/**
 * 查询云组件列表（固定 URL）
 */
export async function fetchCloudComponents(): Promise<CloudComponent[]> {
  const url = `/api/material/list?type=component&tags=${encodeURIComponent('含提示词')}&page=1&pageSize=50`;

  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }

    const json = (await res.json()) as CloudComponentsApiResponse;

    console.log('json', json);
    const list =
      (json && json.data && Array.isArray(json.data.list) && json.data.list) ||
      (Array.isArray(json.list) ? json.list : []) ||
      [];

    return list;
  } catch (error) {
    console.error("[plugin-ai] fetchCloudComponents error:", error);
    return [];
  }
}

/**
 * 将云组件列表转为「允许使用的组件」的 XML 片段
 * 约定：
 * - namespace 必填
 * - meta.summary 作为 description 使用（若无则尝试其它字段）
 * - 云组件统一视为 UI 组件
 */
export function buildCloudComponentsPrompts(
  components: CloudComponent[]
): string {
  if (!Array.isArray(components) || !components.length) {
    return "";
  }

  return `<可以使用的MyBricks复合组件>
  复合组件是封装好的MyBricks组件，通常比普通组件的功能更强大，但是没那么灵活，因此在使用时，需要根据具体需求选择合适的组件。
  ${components.filter((item) => !!item?.namespace).map((item) => {

    const meta = jsonSafeParse(item.meta as string || "{}");

    return `<component>
    <namespace>${item.namespace}</namespace>
    <title>${item.title || ""}</title>
    <description>${meta?.ai?.prompts?.summary || ""}</description>
    ${meta?.ai?.prompts?.usage || ""}
  </component>
  `}).join("\n")}
</可以使用的MyBricks复合组件>
  `;
}

/**
 * 创建 getAllComDefPrompts 方法，返回原有组件信息 + 云组件信息
 */
export function createGetAllComDefPrompts(
  getAllComDefPrompts: (() => string) | undefined
): () => string {
  // 若未启用云组件，则直接返回原有的 getAllComDefPrompts（不请求云组件）
  if (!context.useCloudComponents) {
    return (): string => {
      return getAllComDefPrompts?.() ?? "";
    };
  }

  let cloudPrompts = "";
  fetchCloudComponents()
    .then((list) => {
      cloudPrompts = buildCloudComponentsPrompts(list);
    })
    .catch((error) => {
      console.error(
        "[plugin-ai] createGetAllComDefPrompts fetchCloudComponents error:",
        error
      );
      // 失败就保持 cloudPrompts 为空，只使用原有组件定义
    });

  return (): string => {
    const base = getAllComDefPrompts?.() ?? "";

    console.log('cloudPrompts', cloudPrompts);

    if (!cloudPrompts) {
      // 若云组件尚未加载完成，则只返回原有组件定义，避免影响正常使用
      return base;
    }

    if (!base) {
      return cloudPrompts;
    }

    return `${cloudPrompts}\n${base}\n`;
  };
}


