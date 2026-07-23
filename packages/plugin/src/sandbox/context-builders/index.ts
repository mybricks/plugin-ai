import type { PromptSections } from "../../prompts";
import type { Designer } from "../types";

interface DesignerContextBuildRules {
  codeRules?: string;
  designRules?: string;
}

function wrapRules(tag: string, value?: string): string {
  const content = value?.trim();
  return content ? `\n<${tag}>\n${content}\n</${tag}>\n` : "";
}

function formatLibraryDocs(libraries: Array<{ name: string; version?: string; usage: string }>): string {
  return libraries
    .map((library) => `---\nname: ${library.name}\nversion: ${library.version ?? ""}\n---\n${library.usage}`)
    .join("\n\n");
}

export async function buildGuideUserContext(
  designer: Designer | undefined,
  promptSections: PromptSections | undefined,
  rules: DesignerContextBuildRules
): Promise<string | null> {
  if (!designer) return null;

  const developeGuide = promptSections?.developeGuide ?? {};

  if (!developeGuide.firstOfAll?.trim()) return null;

  const designGuide = promptSections?.designGuide ?? {};
  const documentGuide = promptSections?.documentGuide ?? {};

  const codeRulesSection = wrapRules("code_rules", rules.codeRules);
  const designRulesSection = wrapRules("design_rules", rules.designRules);

  const bestPracticesContent = [
    codeRulesSection ? "#### 代码规范：\n" + codeRulesSection : undefined,
    developeGuide.assetsUsageSection ? "#### 图片和图标使用：\n" + developeGuide.assetsUsageSection : undefined,
    developeGuide.examplesSection ? "#### 开发示例：\n" + developeGuide.examplesSection : undefined,
  ].filter(Boolean).join("\n");

  const documentGuideContent = [
    documentGuide.firstOfAll,
    documentGuide.requirementGuide,
  ].filter(Boolean).join("\n\n");

  const libraries = await designer.getEffectiveLibraries();
  const libraryDocsContent = formatLibraryDocs(libraries);

  return [
    "\n# 前端开发指南\n",
    developeGuide.firstOfAll,
    "\n## 项目架构\n",
    developeGuide.architectureSection ?? "",
    "\n## 环境变量\n",
    [
      "以下是系统注入的环境变量，可在组件代码中通过 `process.env.<变量名>` 访问，**禁止自行声明或覆盖这些变量**：\n",
      "| 变量名 | 类型 | 设计态值 | 运行态值 | 说明 |",
      "|--------|------|----------|----------|------|",
      "| `process.env.POPUP_VISIBLE` | `boolean` | `true` | `false` | **只能在 \`popupRef\` 包裹的组件内部使用**，否则会导致运行时报错。控制浮层（弹窗/抽屉等）的默认显示状态。设计态下为 true 使浮层保持展开，方便设计者选中浮层内元素进行编辑；运行态下为 false，由业务逻辑控制显隐。浮层组件必须将此变量与业务状态做 || 合并使用，例如：visible={process.env.POPUP_VISIBLE || visible} |",
      "| `process.env.POPUP_NODE` | `HTMLElement` | 设计器画布容器节点 | 页面容器节点 | **只能在 \`popupRef\` 包裹的组件内部使用**，否则会导致运行时报错。浮层的挂载容器。设计、运行态下均指向设计器画布，确保浮层渲染在画布内部。例如一些三方库的指定挂载节点：getContainer={() => process.env.POPUP_NODE} |",
    ].join("\n") + "\n",
    "\n## 最佳实践\n",
    bestPracticesContent,
    developeGuide.end,
    "\n## 设计规范\n",
    [designGuide.firstOfAll, designRulesSection].filter(Boolean).join("\n"),
    ...(documentGuideContent ? [
      "\n## 文档规范\n",
      "<文档规范>\n",
      documentGuideContent,
      "\n</文档规范>\n",
    ] : []),
    "\n## 允许使用的类库\n",
    "\n---\n\n",
    libraryDocsContent,
  ].join("");
}
