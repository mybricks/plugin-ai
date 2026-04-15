import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const pluginSrc = path.resolve(__dirname, "../plugin/src");
const agentSrc = path.resolve(__dirname, "../agent/src");

/**
 * 将主工程源码中的 `.less` 导入重定向到同名的虚拟 `.module.less` 文件，
 * 让 Vite 内置 CSS Module 管道生效（它通过文件名后缀 .module.less 判断）。
 *
 * 虚拟文件 id 格式：{realPath}.module.less
 * load 时读取真实 less 文件内容，并通过 less options 设置 basedir，
 * 确保 @import 相对路径能正确解析。
 */
function lessAsCssModulesPlugin(): Plugin {
  const SUFFIX = ".module.less";
  // 标记：该虚拟 id 是我们生成的
  const MARKER = "?real=";

  return {
    name: "less-as-css-modules",
    enforce: "pre",

    resolveId(id, importer) {
      if (!importer) return;

      // 处理：主工程 .less 文件的直接引用 → 重写为虚拟 .module.less
      if (
        id.endsWith(".less") &&
        !id.endsWith(SUFFIX) &&
        !id.includes("?")
      ) {
        const isFromSrc =
          importer.startsWith(pluginSrc) || importer.startsWith(agentSrc);
        // 虚拟 .module.less 自身的 @import 引用也需要拦截
        const isFromVirtual = importer.includes(MARKER);

        if (!isFromSrc && !isFromVirtual) return;

        let basedir: string;
        if (isFromVirtual) {
          // importer 形如 /abs/path/to/file.module.less?real=/abs/path/to/file.less
          const realPath = new URLSearchParams(importer.split("?")[1]).get("real")!;
          basedir = path.dirname(realPath);
        } else {
          basedir = path.dirname(importer);
        }

        const absReal = path.resolve(basedir, id);
        // 返回虚拟 id：真实路径 + .module.less 后缀 + real 参数（供 @import 拦截时用）
        return `${absReal}${SUFFIX}${MARKER}${absReal}`;
      }

      return;
    },

    load(id) {
      if (!id.includes(MARKER)) return;
      const [, realPath] = id.split(MARKER);
      try {
        return fs.readFileSync(realPath, "utf-8");
      } catch {
        return "";
      }
    },
  };
}

export default defineConfig({
  plugins: [lessAsCssModulesPlugin(), react()],
  resolve: {
    alias: {
      "@agent": path.resolve(__dirname, "../agent/src"),
      "@request": path.resolve(__dirname, "../request/src"),
      "@plugin": path.resolve(__dirname, "../plugin/src"),
    },
  },
  css: {
    modules: {
      localsConvention: "camelCase",
      generateScopedName: "[name]__[local]__[hash:5]",
    },
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
  server: {
    port: 3100,
    open: true,
    // 允许 Vite dev server 提供 playground 以外的源码文件
    fs: {
      allow: [
        path.resolve(__dirname, ".."),  // packages/ 目录
      ],
    },
    watch: {
      // chokidar 额外监听 plugin/agent/request 源码；
      // 保留默认 node_modules 忽略，只追加这三个目录
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
      ],
      // 明确追加监听范围（chokidar paths 选项不直接暴露，
      // 通过 Vite resolvedConfig 内的 watchOptions 传递）
    },
  },
});
