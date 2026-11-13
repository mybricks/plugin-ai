import fs from "node:fs";
import { createPluginAiMcp } from "../mcp/src/index.js";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

const showcaseRoot = fileURLToPath(new URL(".", import.meta.url));
const pluginSrc = fileURLToPath(new URL("../plugin/src", import.meta.url));
const agentSrc = fileURLToPath(new URL("../agent/src", import.meta.url));
const lowcodeSrc = fileURLToPath(new URL("../plugin-lowcode/src", import.meta.url));
const bridge = (name: string) => fileURLToPath(new URL(`./src/runtime/${name}.cjs`, import.meta.url));

// Cookie values may contain `$`, which Vite's dotenv expansion would alter.
// Read this server-only value literally, preserving Vite's env file precedence.
function readProxyCookie(mode: string): string | undefined {
  let value: string | undefined;
  for (const name of [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`]) {
    const file = path.join(showcaseRoot, name);
    if (!fs.existsSync(file)) continue;
    const match = fs.readFileSync(file, "utf8").match(/^\s*(?:export\s+)?TEST_AI_PROXY_COOKIE\s*=\s*([^\r\n]*)/m);
    if (!match) continue;
    const raw = match[1].trim();
    value = ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))
      ? raw.slice(1, -1)
      : raw;
  }
  return process.env.TEST_AI_PROXY_COOKIE ?? value;
}

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

// Keep readable Unicode names while escaping path separators and characters unsafe on Windows.
function uiFileName(id: string): string {
  const chars = Array.from(id);
  return chars.map((char, index) => {
    const unsafe = /[\x00-\x1f\x7f%\\/:*?"<>|]/.test(char)
      || (char === "." && (id === "." || id === ".."))
      || ((char === "." || char === " ") && index === chars.length - 1);
    return unsafe ? Array.from(Buffer.from(char), (byte) => `%${byte.toString(16).toUpperCase().padStart(2, "0")}`).join("") : char;
  }).join("") + ".ui";
}

// Local development storage. Files remain ordinary MyBricks JSON .ui files.
function uiFileStorage(port: number): Plugin {
  const root = path.join(showcaseRoot, "ui-files");
  const scenes = new Set(["local", "task", "task-overview", "audit", "mcp"]);
  return {
    name: "showcase-ui-file-storage",
    configureServer(server) {
      server.middlewares.use("/__showcase/ui", (req, res) => {
        const respond = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(body));
        };
        void (async () => {
          const origin = req.headers.origin;
          if (origin && ![`http://localhost:${port}`, `http://127.0.0.1:${port}`].includes(origin)) return respond(403, { error: "Forbidden" });
          const query = new URL(req.url || "/", "http://localhost").searchParams;
          const scene = query.get("scene") || "";
          const id = query.get("id");
          if (!scenes.has(scene) || (id !== null && (!id.trim() || id.length > 150))) return respond(400, { error: "Invalid scene or ID" });
          const dir = path.join(root, scene);
          if (req.method === "GET" && id === null) {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return []; throw error; });
            const items = await Promise.all(entries.filter((entry) => entry.isFile() && entry.name.endsWith(".ui")).map(async (entry) => {
              try { return { id: decodeURIComponent(entry.name.slice(0, -3)), updatedAt: (await fs.promises.stat(path.join(dir, entry.name))).mtimeMs }; } catch { return null; }
            }));
            return respond(200, items.filter(Boolean).sort((a, b) => b!.updatedAt - a!.updatedAt));
          }
          if (id === null) return respond(400, { error: "ID required" });
          const file = path.join(dir, uiFileName(id));
          const legacyFile = path.join(dir, `${encodeURIComponent(id)}.ui`);
          // Older versions encoded the entire name. Continue to open and delete those files.
          const existingFile = async () => {
            try { await fs.promises.access(file); return file; }
            catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
            return legacyFile;
          };
          if (req.method === "GET") {
            try { return respond(200, JSON.parse(await fs.promises.readFile(await existingFile(), "utf8"))); }
            catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return respond(404, { error: "Not found" }); throw error; }
          }
          if (req.method === "DELETE") {
            await fs.promises.rm(await existingFile(), { force: true });
            return respond(200, { ok: true });
          }
          if (req.method !== "PUT" || !req.headers["content-type"]?.startsWith("application/json")) return respond(405, { error: "Method not allowed" });
          let body = "";
          let byteLength = 0;
          const decoder = new StringDecoder("utf8");
          for await (const chunk of req) {
            byteLength += chunk.length;
            if (byteLength > 50 * 1024 * 1024) return respond(413, { error: "File too large" });
            body += decoder.write(chunk);
          }
          body += decoder.end();
          const project = JSON.parse(body);
          if (!project || typeof project !== "object" || Array.isArray(project) || !project.content) return respond(400, { error: "Invalid UI file" });
          await fs.promises.mkdir(dir, { recursive: true });
          // Avoid creating a second copy when an older encoded filename already exists.
          const target = await existingFile();
          if (target !== file && req.headers["if-none-match"] === "*") {
            try { await fs.promises.access(target); return respond(409, { error: "Already exists" }); }
            catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
          }
          const writeTarget = target !== file && fs.existsSync(target) ? target : file;
          try { await fs.promises.writeFile(writeTarget, JSON.stringify(project, null, 2), { encoding: "utf8", flag: req.headers["if-none-match"] === "*" ? "wx" : "w" }); }
          catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") return respond(409, { error: "Already exists" }); throw error; }
          return respond(200, { ok: true });
        })().catch((error) => { console.error("[showcase ui files]", error); if (!res.headersSent) respond(500, { error: "File operation failed" }); });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // 不使用 VITE_ 前缀加载 Cookie，避免它进入客户端 bundle。
  const env = { ...loadEnv(mode, showcaseRoot, ""), ...process.env };
  const apiTarget = env.TEST_AI_PROXY_TARGET;
  const cookie = readProxyCookie(mode);
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
    plugins: [showcaseMcp, uiFileStorage(port), markdownAsText(), lessAsCssModules(), react()],
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
