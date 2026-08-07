import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import alias from "@rollup/plugin-alias";
import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import replace from "@rollup/plugin-replace";
import resolve from "@rollup/plugin-node-resolve";
import { rollup } from "rollup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const agentRoot = path.resolve(root, "packages/agent");
const outDir = path.resolve(agentRoot, "dist");
const entry = path.resolve(agentRoot, "src/index.ts");

rmSync(outDir, { recursive: true, force: true });

const createPlugins = (targets) => [
  replace({ preventAssignment: true, values: { APP_ENV: JSON.stringify("production") } }),
  alias({ entries: [{ find: "@mybricks/request", replacement: path.resolve(root, "packages/request/src/index.ts") }] }),
  resolve({ extensions: [".ts", ".js", ".json"] }),
  commonjs(),
  babel({
    babelHelpers: "bundled",
    extensions: [".ts", ".js"],
    presets: [
      ["@babel/preset-env", { targets }],
      "@babel/preset-typescript",
    ],
  }),
];

const builds = [
  { output: { file: path.resolve(outDir, "browser/index.js"), format: "es", sourcemap: true }, targets: { esmodules: true } },
  { output: { file: path.resolve(outDir, "node/index.js"), format: "es", sourcemap: true }, targets: { node: "18" } },
  { output: { file: path.resolve(outDir, "node/index.cjs"), format: "cjs", sourcemap: true, exports: "named" }, targets: { node: "18" } },
];

for (const { output, targets } of builds) {
  const bundle = await rollup({ input: entry, external: ["node-forge"], plugins: createPlugins(targets) });
  await bundle.write(output);
  await bundle.close();
}

const tsc = path.resolve(root, "node_modules/.bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
execFileSync(tsc, ["-p", path.resolve(agentRoot, "tsconfig.build.json")], { stdio: "inherit" });

console.log("[build-agent] done");
