import fs from "node:fs";
import { createPluginAiMcp } from "../mcp/src/index.js";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

const showcaseRoot = fileURLToPath(new URL(".", import.meta.url));
const pluginSrc = fileURLToPath(new URL("../plugin/src", import.meta.url));
const agentSrc = fileURLToPath(new URL("../agent/src", import.meta.url));
const lowcodeSrc = fileURLToPath(new URL("../plugin-lowcode/src", import.meta.url));
const bridge = (name: string) => fileURLToPath(new URL(`./src/runtime/${name}.cjs`, import.meta.url));

function markdownAsText(): Plugin {
  return {
    name: "markdown-as-text",
    enforce: "pre",
    transform(source, id) {
      if (!id.split("?", 1)[0].endsWith(".md")) return;
      return { code: `export default ${JSON.stringify(source)};`, map: null };
    }
  };
}

function lessAsCssModules(): Plugin {
  const suffix = ".module.less";
  const marker = "?real=";
  return {
    name: "showcase-less-modules",
    enforce: "pre",
    resolveId(id, importer) {
      if (!importer || !id.endsWith(".less") || id.endsWith(suffix) || id.includes("?")) return;
      if (!importer.startsWith(pluginSrc) && !importer.startsWith(agentSrc) && !importer.startsWith(lowcodeSrc) && !importer.includes(marker)) return;
      const sourcePath = importer.includes(marker) ? new URLSearchParams(importer.split("?")[1]).get("real")! : importer;
      const realPath = path.resolve(path.dirname(sourcePath), id);
      return `${realPath}${suffix}${marker}${realPath}`;
    },
    load(id) {
      if (!id.includes(marker)) return;
      return fs.readFileSync(id.split(marker)[1], "utf8");
    }
  };
}

export default defineConfig(({ mode }) => {
  // 不使用 VITE_ 前缀加载 Cookie，避免它进入客户端 bundle。
  const env = { ...loadEnv(mode, showcaseRoot, ""), ...process.env };
  const apiTarget = env.TEST_AI_PROXY_TARGET;
  const cookie = env.TEST_AI_PROXY_COOKIE;
  const proxy = apiTarget
    ? {
        target: apiTarget,
        changeOrigin: true,
        ...(cookie ? { headers: { cookie } } : {})
      }
    : undefined;

  const port = Number(env.SHOWCASE_PORT || 5200);
  const mcp = createPluginAiMcp({ target: "codex", allowedOrigins: [`http://localhost:${port}`, `http://127.0.0.1:${port}`] });
  // Showcase-only wiring of the generic Node handlers, not a reusable Vite adapter.
  const showcaseMcp: Plugin = {
    name: "showcase-mcp-test",
    configureServer(server) {
      server.middlewares.use((req, res, next) => { if (!mcp.handleRequest(req, res)) next(); });
      server.httpServer?.on("upgrade", (req, socket, head) => { mcp.handleUpgrade(req, socket, head); });
      server.httpServer?.once("listening", () => console.info(`\n[showcase MCP] URL: http://127.0.0.1:${port}/__plugin-ai/mcp\n`));
      server.httpServer?.once("close", () => mcp.close());
    },
  };
  return {
    plugins: [showcaseMcp, markdownAsText(), lessAsCssModules(), react()],
    resolve: {
    alias: [
      { find: /^react$/, replacement: bridge("react") },
      { find: /^react-dom(?:\/client)?$/, replacement: bridge("react-dom") },
      { find: /^react\/jsx-runtime$/, replacement: bridge("react-jsx-runtime") },
      { find: /^antd$/, replacement: bridge("antd") },
      { find: "@agent", replacement: agentSrc },
      { find: "@request", replacement: fileURLToPath(new URL("../request/src", import.meta.url)) },
      { find: "@plugin", replacement: pluginSrc },
      { find: "@mybricks/request", replacement: fileURLToPath(new URL("../request/src", import.meta.url)) },
      { find: "@mybricks/agent", replacement: agentSrc }
    ]
    },
    optimizeDeps: { include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "antd"] },
    css: { modules: { localsConvention: "camelCase" }, preprocessorOptions: { less: { javascriptEnabled: true } } },
    server: {
      host: "127.0.0.1",
      strictPort: true,
      port,
      fs: { allow: [fileURLToPath(new URL("..", import.meta.url)), showcaseRoot] },
      proxy: {
        ...(proxy ? { "/api/ai-chat/stream": proxy } : {}),
        "/__llm_fault": { target: env.LLM_FAULT_PROXY_CONTROL_URL || "http://127.0.0.1:4318" }
      }
    }
  };
});
