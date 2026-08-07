import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import babel from "@rollup/plugin-babel";
import resolve from "@rollup/plugin-node-resolve";
import { rollup } from "rollup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const kitRoot = path.resolve(root, "packages/kit");
const outDir = path.resolve(kitRoot, "dist");
const entry = path.resolve(kitRoot, "src/index.ts");

rmSync(outDir, { recursive: true, force: true });

const createPlugins = (targets) => [
  resolve({ extensions: [".ts", ".js", ".json"] }),
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
  {
    output: { file: path.resolve(outDir, "browser/index.js"), format: "es", sourcemap: true },
    targets: { esmodules: true },
  },
  {
    output: { file: path.resolve(outDir, "node/index.js"), format: "es", sourcemap: true },
    targets: { node: "18" },
  },
  {
    output: { file: path.resolve(outDir, "node/index.cjs"), format: "cjs", sourcemap: true, exports: "named" },
    targets: { node: "18" },
  },
];

for (const { output, targets } of builds) {
  const bundle = await rollup({
    input: entry,
    external: ["@mybricks/agent"],
    plugins: createPlugins(targets),
  });
  await bundle.write(output);
  await bundle.close();
}

const tsc = path.resolve(root, "node_modules/.bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
execFileSync(tsc, ["-p", path.resolve(kitRoot, "tsconfig.build.json")], { stdio: "inherit" });

console.log("[build-kit] done");
