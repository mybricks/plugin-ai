import type { LowCodeDesignerRuntime } from "../designer";
import { ComponentsManager } from "../designer/components-manager";

function buildComponentDocs(runtime: LowCodeDesignerRuntime, namespaces?: string[]): string {
  const allComponents = ComponentsManager.getAllAiComponents();
  const targetComponents = namespaces === undefined
    ? allComponents
    : namespaces.map((namespace) => {
        const fullNamespace = ComponentsManager.getFullNamespace(namespace);
        const componentInfo = ComponentsManager.getAiComponent(fullNamespace);
        return { namespace: fullNamespace, abbreviation: ComponentsManager.getAbbreviation(fullNamespace), all: componentInfo?.all };
      });
  if (!targetComponents.length) return "当前没有可用组件编辑文档。";

  const docs = targetComponents.map(({ namespace, abbreviation, all }) => {
    const rawDoc = runtime.api?.global?.api?.getComEditorPrompts?.(namespace)
      ?? runtime.api?.uiCom?.api?.getComEditorPrompts?.(namespace)
      ?? runtime.api?.uiCom?.api?.getComPrompts?.(namespace)
      ?? "";
    const doc = ComponentsManager.replaceKnownNamespaces(normalizeComponentDocForPrompt(rawDoc.trim()));
    const inputs = all?.inputs?.reduce?.((prev: string, input: any) => {
      let schema = "";
      try { schema = input.schema ? `    - schema: ${JSON.stringify(input.schema)}\n` : ""; } catch {}
      return `${prev}  - ${input.title ?? input.id}\n    - inputId: ${input.id}\n${schema}`;
    }, "");
    const slots = renderComponentSlots(all);
    return [
      `### ${abbreviation}`,
      all?.title ? `title：${all.title}` : "",
      doc ? `<组件文档>\n${doc}\n</组件文档>` : "宿主未提供该组件的编辑文档。",
      slots ? `<slots>\n${slots}</slots>` : "",
      inputs ? `<inputs>\n${inputs}</inputs>` : "",
    ].filter(Boolean).join("\n");
  });
  return [
    namespaces === undefined ? ComponentsManager.replaceKnownNamespaces(runtime.api?.global?.api?.getAllComDefPrompts?.() ?? "").trim() : "",
    namespaces === undefined ? "## Available Component Details" : "",
    docs.join("\n\n---\n\n"),
  ].filter(Boolean).join("\n\n");
}

function renderComponentSlots(component: any): string {
  if (!Array.isArray(component?.slots) || !component.slots.length) return "";
  return component.slots.reduce((prev: string, slot: any) => {
    const scopeInputs = slot.type === "scope" && Array.isArray(slot.inputs)
      ? slot.inputs.map((input: any) => `    - ${input.id}（${input.title ?? ""}）${input.desc ? ` - ${input.desc}` : ""}`).join("\n")
      : "";
    return `${prev}  - ${slot.id}（${slot.title ?? ""}${slot.description ? ` - ${slot.description}` : ""}）${slot.type === "scope" ? " - 作用域插槽" : ""}\n${scopeInputs ? `${scopeInputs}\n` : ""}`;
  }, "");
}

function normalizeComponentDocForPrompt(doc: string): string {
  const withLayoutTitle = doc.replace(/尺寸：/g, "layout声明：");
  return withLayoutTitle.replace(/(layout声明：\n(?:- .+(?:\n|$))+)/g, (section) =>
    section.includes("margin：") || section.includes("margin:") ? section : `${section.trimEnd()}\n- margin：可选配置\n`,
  );
}

export function getComponentsDocs(runtime: LowCodeDesignerRuntime, namespaces: string | string[]): string {
  return buildComponentDocs(runtime, Array.isArray(namespaces) ? namespaces : [namespaces]);
}

export function getComlibsDocs(runtime: LowCodeDesignerRuntime): string {
  return buildComponentDocs(runtime);
}

export function buildLowCodeStableContext(runtime: LowCodeDesignerRuntime): string {
  const components = getComlibsDocs(runtime);
  const layoutComponents = ComponentsManager.getLayoutComponentsAbbreviationNs();
  return [
    "# 组件使用指南",
    "优先使用基础组件（布局、文本、图片/图标）+ 业务组件开发，如果无法实现的内容，如果有无法使用组件搭建的内容，仅在完全无法实现的部分，使用占位组件占据一个区域，比如地图。",
    "## 布局组件",
    layoutComponents.length ? `特别地，${layoutComponents.join("、")} 是基础布局组件；ignore/enhance 等辅助标记仅允许用于这些基础布局组件。` : "",
    "",
    "## Available Components",
    components || "宿主未提供 getAllComDefPrompts",
  ].join("\n");
}

export const buildLowCodeProjectContext = buildLowCodeStableContext;
