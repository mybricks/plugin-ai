import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const defaultAicodeAgentsDir = path.resolve(root, "../../fangzhou/aicode-agents");

const usage = () => {
  console.log(`Usage: yarn export:aicode [--out <vendor/mybricks path>]

Builds @mybricks/agent and @mybricks/agent-kit, then exports their Node.js
CommonJS runtime files to aicode-agents/vendor/mybricks. The default target is:
  ${path.join(defaultAicodeAgentsDir, "vendor/mybricks")}

Use AICODE_AGENTS_DIR or --out to target a different checkout.`);
};

const parseArgs = () => {
  let outDir;

  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--out") {
      outDir = process.argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  const aicodeAgentsDir = process.env.AICODE_AGENTS_DIR || defaultAicodeAgentsDir;
  return path.resolve(outDir || path.join(aicodeAgentsDir, "vendor/mybricks"));
};

const runBuild = (script) => {
  console.log(`[export-aicode-agent-packages] ${script}`);
  execFileSync(process.execPath, [path.join(root, "scripts", script)], {
    cwd: root,
    stdio: "inherit",
  });
};

const assertPackageOutput = (packageDir) => {
  const requiredFiles = ["package.json", "dist/node/index.cjs"];
  for (const file of requiredFiles) {
    if (!existsSync(path.join(packageDir, file))) {
      throw new Error(`Missing build output: ${path.join(packageDir, file)}`);
    }
  }
};

const createRuntimeManifest = (source) => {
  const packageJson = JSON.parse(readFileSync(path.join(source, "package.json"), "utf8"));
  const manifest = {
    name: packageJson.name,
    version: packageJson.version,
    main: "./index.cjs",
    exports: {
      ".": {
        require: "./index.cjs",
        default: "./index.cjs",
      },
    },
  };

  if (packageJson.dependencies) manifest.dependencies = packageJson.dependencies;
  if (packageJson.peerDependencies) manifest.peerDependencies = packageJson.peerDependencies;
  return manifest;
};

const exportPackage = (sourceName, packageName, targetRoot) => {
  const source = path.join(root, "packages", sourceName);
  const target = path.join(targetRoot, packageName);
  const staging = path.join(targetRoot, `.${packageName}.staging-${process.pid}`);

  assertPackageOutput(source);
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  writeFileSync(path.join(staging, "package.json"), `${JSON.stringify(createRuntimeManifest(source), null, 2)}\n`);
  cpSync(path.join(source, "dist/node/index.cjs"), path.join(staging, "index.cjs"));

  rmSync(target, { recursive: true, force: true });
  renameSync(staging, target);
  console.log(`[export-aicode-agent-packages] exported @mybricks/${packageName} -> ${target}`);
};

const targetRoot = parseArgs();
mkdirSync(targetRoot, { recursive: true });
runBuild("build-agent.mjs");
runBuild("build-kit.mjs");
exportPackage("agent", "agent", targetRoot);
exportPackage("kit", "agent-kit", targetRoot);
