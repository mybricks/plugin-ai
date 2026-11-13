import type { CodeAgentPlugin } from "../../../../agent/src";

interface CanvasRoute {
  path: string;
  title?: string;
  params?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseRoutes(content: string): CanvasRoute[] {
  const config: unknown = JSON.parse(content);
  if (!isRecord(config) || !isRecord(config.canvas) || !Array.isArray(config.canvas.showRoutes)) return [];

  return config.canvas.showRoutes.flatMap((route): CanvasRoute[] => {
    if (!isRecord(route) || typeof route.path !== "string" || !route.path.trim()) return [];
    return [{
      path: route.path.trim(),
      ...(typeof route.title === "string" && route.title.trim() ? { title: route.title.trim() } : {}),
      params: route.params,
    }];
  });
}

function routeQuery(params: unknown): string {
  if (!params) return "";

  let entries: Array<[string, string]>;
  if (Array.isArray(params)) {
    entries = params.flatMap((item): Array<[string, string]> => {
      if (typeof item === "string") return item ? [[item, ""]] : [];
      if (!isRecord(item)) return [];
      const key = typeof item.key === "string" ? item.key : "";
      if (!key) return [];
      return [[key, String(item.value ?? "")]];
    });
  } else if (isRecord(params)) {
    entries = Object.entries(params).map(([key, value]) => [key, String(value ?? "")]);
  } else {
    return "";
  }

  return entries.length
    ? `?${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&")}`
    : "";
}

function describeRoute(route: CanvasRoute): string {
  const path = `${route.path}${routeQuery(route.params)}`;
  const title = route.title ?? route.path;
  return `- ${title}（路由：${path}）`;
}

/** CLI PDE adds the project's configured canvas routes to each turn's context. */
export function createCanvasInfoPlugin(): CodeAgentPlugin {
  return {
    name: "cli-pde-canvas-info",
    description: "向 Agent 提供项目配置的画布页面和路由信息。",
    async getAttachmentContextMessages({ sandbox }) {
      try {
        const hostConfig = typeof window === "undefined"
          ? undefined
          : (window as Window & { __LINGCHUANG_CONFIG__?: { projectFilePath?: unknown } }).__LINGCHUANG_CONFIG__;
        const projectConfigPath = hostConfig?.projectFilePath;
        if (typeof projectConfigPath !== "string" || !projectConfigPath.trim()) return [];
        const file = await sandbox.files.read(projectConfigPath);
        const routes = file ? parseRoutes(file.content) : [];

        return [{
          key: "canvas-info",
          content: [
            `<canvas-info>`,
            routes.length ? `当前画布配置了以下 ${routes.length} 个页面：` : "配置文件中暂无有效的画布路由。",
            ...routes.map(describeRoute),
            ...(routes.length ? [] : [
              '在配置文件的 `canvas` 对象中添加 `showRoutes` 数组，例如：`{"canvas":{"showRoutes":[{"id":"home","title":"首页","path":"/","params":[]}]}}`。每项的 `id` 是唯一标识，`title` 是页面名称，`path` 是路由路径，`params` 是参数数组，参数项格式为 `{ "key": "参数名", "value": "参数值" }`；修改时保留配置文件中的其他字段。',
            ]),
            "可视化画布展示的页面由 `" + projectConfigPath + "` 中的 `canvas.showRoutes` 配置决定；如需在画布中展示或打开新页面，务必先修改该配置。",
            "注意：`web-runner`使用的是独立的无头浏览器，和可视化画布不是一个渲染维度。",
            `</canvas-info>`,
          ].join("\n"),
        }];
      } catch (error) {
        console.warn("[cli-pde-canvas-info] 读取项目配置失败:", error);
        return [];
      }
    },
  };
}
