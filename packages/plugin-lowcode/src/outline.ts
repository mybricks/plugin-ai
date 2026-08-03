import type { LowCodeDesignerAPI, LowCodeDesignerRuntime, LowCodeFocusParams } from "./designer";
import { ComponentsManager } from "./components-manager";

interface SlotInfo {
  id: string;
  title?: string;
  layout?: any;
  components?: OutlineNode[];
}

interface OutlineNode {
  id?: string;
  title?: string;
  def?: { namespace?: string };
  asRoot?: boolean;
  data?: any;
  style?: any;
  layout?: any;
  components?: OutlineNode[];
  slots?: SlotInfo[];
}

const ROOT_NAMESPACE = "root";
const ROOT_ID = "_root_";
const ROOT_SLOT_ID = "_rootSlot_";

function getOutlineInfo(api: LowCodeDesignerAPI | undefined, id: string, type?: string): OutlineNode | undefined {
  if (type === "uiCom") return api?.uiCom?.api?.getOutlineInfo?.(id);
  return api?.page?.api?.getOutlineInfo?.(id);
}

function getOriginRootCom(outline?: OutlineNode): OutlineNode | null {
  return outline?.components?.[0]?.asRoot ? outline.components[0] : null;
}

function normalizePageOutline(outline: OutlineNode | undefined, pageId: string): OutlineNode | undefined {
  if (!outline) return undefined;

  if (outline.id === pageId) {
    let rootNode: OutlineNode = outline;
    let rootSlots: SlotInfo[] | undefined = [{
      id: ROOT_SLOT_ID,
      components: outline.components,
      layout: outline.layout,
    }];
    const whInfo = {
      width: outline.layout?.width,
      height: outline.layout?.height,
    };

    const rootCom = getOriginRootCom(outline);
    if (rootCom) {
      rootNode = rootCom;
      rootSlots = rootNode.slots;
    }

    const normalized: OutlineNode = {
      ...rootNode,
      style: { ...(rootNode.style ?? {}), ...whInfo },
      slots: rootSlots,
      def: { ...(rootNode.def ?? {}), version: "1.0.0", namespace: ROOT_NAMESPACE } as any,
      asRoot: true,
    };

    return {
      id: pageId,
      title: outline.title,
      slots: [{ id: ROOT_ID, components: [normalized] }],
    };
  }

  return {
    id: pageId,
    title: outline.title,
    slots: [{ id: ROOT_ID, components: [outline] }],
  };
}

function findNodeById(node: OutlineNode | undefined, id: string): OutlineNode | undefined {
  if (!node) return undefined;
  if (node.id === id) return node;
  for (const slot of node.slots ?? []) {
    for (const child of slot.components ?? []) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  for (const child of node.components ?? []) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return undefined;
}

function findSlotOwnerByNodeId(node: OutlineNode | undefined, id: string): { owner?: OutlineNode; slot?: SlotInfo } | undefined {
  if (!node) return undefined;
  for (const slot of node.slots ?? []) {
    for (const child of slot.components ?? []) {
      if (child.id === id) return { owner: node, slot };
      const found = findSlotOwnerByNodeId(child, id);
      if (found) return found;
    }
  }
  for (const child of node.components ?? []) {
    if (child.id === id) return { owner: node };
    const found = findSlotOwnerByNodeId(child, id);
    if (found) return found;
  }
  return undefined;
}

function collectNamespaces(node: OutlineNode | undefined, set = new Set<string>()): Set<string> {
  if (!node) return set;
  if (node.def?.namespace && node.def.namespace !== ROOT_NAMESPACE) {
    set.add(node.def.namespace);
  }
  for (const slot of node.slots ?? []) {
    for (const child of slot.components ?? []) collectNamespaces(child, set);
  }
  for (const child of node.components ?? []) collectNamespaces(child, set);
  return set;
}

function renderValue(value: any): string {
  if (value === undefined) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

interface RenderNodeOptions {
  maxDepth?: number;
}

function renderNode(node: OutlineNode | undefined, level = 0, options: RenderNodeOptions = {}, depth = 0): string {
  if (!node) return "无内容";
  const indent = "  ".repeat(level);
  const namespaceValue = node.def?.namespace
    ? ComponentsManager.getAbbreviation(node.def.namespace)
    : "";
  const namespace = namespaceValue ? ` namespace="${namespaceValue}"` : "";
  const title = node.title ? ` title="${node.title}"` : "";
  const id = node.id ? ` id="${node.id}"` : "";
  const layout = node.layout ? ` layout=${renderValue(node.layout)}` : "";
  const style = node.style ? ` style=${renderValue(node.style)}` : "";
  const header = `${indent}<Com${id}${title}${namespace}${layout}${style}>`;
  const children: string[] = [];
  const maxDepth = options.maxDepth;
  const reachedMaxDepth = maxDepth !== undefined && depth >= maxDepth;

  if (reachedMaxDepth) {
    const childCount = (node.components?.length ?? 0) + (node.slots ?? []).reduce((sum, slot) => sum + (slot.components?.length ?? 0), 0);
    return `${header}\n${indent}  ${childCount ? `...已省略 ${childCount} 个子节点` : "无内容"}\n${indent}</Com>`;
  }

  for (const slot of node.slots ?? []) {
    const slotLayout = slot.layout ? ` layout=${renderValue(slot.layout)}` : "";
    const slotChildren = (slot.components ?? []).map((child) => renderNode(child, level + 2, options, depth + 1)).join("\n");
    children.push(`${indent}  <Slot id="${slot.id}"${slot.title ? ` title="${slot.title}"` : ""}${slotLayout}>\n${slotChildren || `${indent}    无内容`}\n${indent}  </Slot>`);
  }

  if (!children.length && node.components?.length) {
    children.push(...node.components.map((child) => renderNode(child, level + 1, options, depth + 1)));
  }

  return `${header}\n${children.join("\n") || `${indent}  无内容`}\n${indent}</Com>`;
}

function flattenPages(input: any): any[] {
  if (!input) return [];
  const roots = Array.isArray(input) ? input : input.pageAry;
  const result: any[] = [];
  const visit = (page: any) => {
    if (!page) return;
    result.push(page);
    (page.children ?? []).forEach(visit);
  };
  (roots ?? []).forEach((item: any) => {
    if (item?.pageAry) item.pageAry.forEach(visit);
    else visit(item);
  });
  return result;
}

function getPageRoots(input: any): any[] {
  if (!input) return [];
  const roots = Array.isArray(input) ? input : input.pageAry;
  const pages: any[] = [];
  (roots ?? []).forEach((item: any) => {
    if (item?.pageAry) pages.push(...item.pageAry);
    else pages.push(item);
  });
  return pages.filter(Boolean);
}

function buildPagesSummary(input: any, focus?: LowCodeFocusParams): string {
  const roots = getPageRoots(input);
  if (!roots.length) return "暂无页面信息";

  const render = (page: any, level = 0): string => {
    const indent = "  ".repeat(level);
    const markers = [
      page.id === focus?.pageId ? "当前聚焦页面" : "",
      page.type ? `type=${page.type}` : "",
      page.componentType ? `componentType=${page.componentType}` : "",
    ].filter(Boolean);
    const line = `${indent}- ${page.title ?? "未命名"} id=${page.id ?? ""}${markers.length ? ` (${markers.join("，")})` : ""}`;
    const children = (page.children ?? []).map((child: any) => render(child, level + 1));
    return [line, ...children].join("\n");
  };

  return roots.map((page) => render(page)).join("\n");
}

function buildFocusSummary(focus?: LowCodeFocusParams): string {
  return focus
    ? [
        `type: ${focus.type ?? "unknown"}`,
        `pageId: ${focus.pageId ?? ""}`,
        `comId: ${focus.comId ?? ""}`,
        `title: ${focus.title ?? ""}`,
        focus.focusArea ? `focusArea: ${focus.focusArea.title ?? ""} ${focus.focusArea.selector ?? ""}` : "",
      ].filter(Boolean).join("\n")
    : "当前没有聚焦页面或组件";
}

function findPageInfoById(input: any, id: string): any {
  return flattenPages(input).find((page) => page?.id === id);
}

function renderComlibsUsage(comlibsUsage?: string): string {
  const usage = comlibsUsage?.trim();
  return usage ? `<组件库使用说明>\n${usage}\n</组件库使用说明>` : "";
}

function buildComponentDocs(runtime: LowCodeDesignerRuntime, namespaces?: string[]): string {
  const shouldBuildComlibsDocs = namespaces === undefined;
  const targetComponents = shouldBuildComlibsDocs
    ? ComponentsManager.getAllAiComponents()
    : namespaces.map((namespace) => {
        const fullNamespace = ComponentsManager.getFullNamespace(namespace);
        const componentInfo = ComponentsManager.getAiComponent(fullNamespace);
        return {
          namespace: fullNamespace,
          abbreviation: ComponentsManager.getAbbreviation(fullNamespace),
          all: componentInfo?.all,
        };
      });

  if (!targetComponents.length) return "当前没有可用组件编辑文档。";

  const docs = targetComponents.map(({ namespace, abbreviation, all }) => {
    const rawDoc = (
      runtime.api?.global?.api?.getComEditorPrompts?.(namespace) ??
      runtime.api?.uiCom?.api?.getComEditorPrompts?.(namespace) ??
      runtime.api?.uiCom?.api?.getComPrompts?.(namespace) ??
      ""
    );
    const doc = ComponentsManager.replaceKnownNamespaces(normalizeComponentDocForPrompt(rawDoc.trim()));
    const inputs = all?.inputs?.reduce?.((prev: string, input: any) => {
      let schema = "";
      try {
        schema = input.schema ? `    - schema: ${JSON.stringify(input.schema)}\n` : "";
      } catch {}
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
    renderComlibsUsage(runtime.comlibsUsage),
    shouldBuildComlibsDocs
      ? ComponentsManager.replaceKnownNamespaces(runtime.api?.global?.api?.getAllComDefPrompts?.() ?? "").trim()
      : "",
    shouldBuildComlibsDocs ? "## Available Component Details" : "",
    docs.join("\n\n---\n\n"),
  ].filter(Boolean).join("\n\n");
}

function renderComponentSlots(component: any): string {
  const slots = component?.slots;
  if (!Array.isArray(slots) || !slots.length) return "";
  return slots.reduce((prev: string, slot: any) => {
    const scopeInputs = slot.type === "scope" && Array.isArray(slot.inputs)
      ? slot.inputs.map((input: any) => `    - ${input.id}（${input.title ?? ""}）${input.desc ? ` - ${input.desc}` : ""}`).join("\n")
      : "";
    return `${prev}  - ${slot.id}（${slot.title ?? ""}${slot.description ? ` - ${slot.description}` : ""}）${slot.type === "scope" ? " - 作用域插槽" : ""}\n${scopeInputs ? `${scopeInputs}\n` : ""}`;
  }, "");
}

function normalizeComponentDocForPrompt(doc: string): string {
  const withLayoutTitle = doc.replace(/尺寸：/g, "layout声明：");
  return withLayoutTitle.replace(
    /(layout声明：\n(?:- .+(?:\n|$))+)/g,
    (section) => section.includes("margin：") || section.includes("margin:")
      ? section
      : `${section.trimEnd()}\n- margin：可选配置\n`,
  );
}

export function getComponentsDocs(runtime: LowCodeDesignerRuntime, namespaces: string | string[]): string {
  return buildComponentDocs(runtime, Array.isArray(namespaces) ? namespaces : [namespaces]);
}

export function getComlibsDocs(runtime: LowCodeDesignerRuntime): string {
  return buildComponentDocs(runtime);
}

export function buildLowCodeDesignerContext(api: LowCodeDesignerAPI | undefined, focus?: LowCodeFocusParams): string {
  const allPageInfo = api?.global?.api?.getAllPageInfo?.();
  const pages = flattenPages(allPageInfo);
  const focusPageId = focus?.pageId ?? pages[0]?.id;
  const pageOutline = focusPageId
    ? normalizePageOutline(getOutlineInfo(api, focusPageId, "page"), focusPageId)
    : undefined;
  const focusNode = focus?.comId ? findNodeById(pageOutline, focus.comId) : pageOutline;
  const targetNode = focusNode ?? pageOutline;
  const namespaces = Array.from(collectNamespaces(targetNode));

  return [
    "# LowCode Designer Context",
    "",
    "## 所有页面简略信息",
    "以下是发送消息时设计器内所有页面的简略快照，包含页面 id、标题、层级和当前聚焦标记。",
    buildPagesSummary(allPageInfo, focus),
    "",
    "## Current Focus",
    buildFocusSummary(focus),
    "",
    "## Focus DSL",
    renderNode(targetNode, 0, { maxDepth: 2 }),
    "",
    "## Namespaces In Focus",
    namespaces.length ? namespaces.map((ns) => `- ${ComponentsManager.getAbbreviation(ns)}`).join("\n") : "无",
  ].join("\n");
}

export function buildLowCodeStableContext(runtime: LowCodeDesignerRuntime): string {
  const components = getComlibsDocs(runtime);
  const layoutComponents = ComponentsManager.getLayoutComponentsAbbreviationNs();

  return [
    "# 开发指南",
    "",
    "## 布局组件",
    layoutComponents.length
      ? `特别地，${layoutComponents.join("、")} 是基础布局组件；ignore/enhance 等辅助标记仅允许用于这些基础布局组件。`
      : "",
    "",
    "## Available Components",
    components || "宿主未提供 getAllComDefPrompts",
  ].join("\n");
}

export const buildLowCodeProjectContext = buildLowCodeStableContext;

export interface LowCodeContextRetrievalParams {
  id: string;
  type?: "page" | "uiCom";
}

export function buildLowCodeRetrievedContext(
  api: LowCodeDesignerAPI | undefined,
  focus: LowCodeFocusParams | undefined,
  params: LowCodeContextRetrievalParams,
): string {
  const id = params.id?.trim();
  if (!id) return "请提供要检索的页面 id 或组件 id。";

  const allPageInfo = api?.global?.api?.getAllPageInfo?.();
  const pages = flattenPages(allPageInfo);
  const requestedPageInfo = findPageInfoById(allPageInfo, id);
  const shouldReadAsPage = params.type === "page" || Boolean(requestedPageInfo);

  if (shouldReadAsPage) {
    const pageOutline = normalizePageOutline(getOutlineInfo(api, id, "page"), id);
    const namespaces = Array.from(collectNamespaces(pageOutline));
    return [
      "# LowCode Context Retrieval",
      "",
      `## Target Page`,
      `id: ${id}`,
      requestedPageInfo?.title ? `title: ${requestedPageInfo.title}` : "",
      requestedPageInfo?.type ? `type: ${requestedPageInfo.type}` : "",
      "",
      "## Current Focus",
      buildFocusSummary(focus),
      "",
      "## Page DSL",
      pageOutline ? renderNode(pageOutline) : "未读取到该页面 outline。",
      "",
      "## Namespaces In Target",
      namespaces.length ? namespaces.map((ns) => `- ${ComponentsManager.getAbbreviation(ns)}`).join("\n") : "无",
    ].filter((item) => item !== "").join("\n");
  }

  const candidatePageIds = [
    focus?.pageId,
    ...pages.map((page) => page?.id),
  ].filter(Boolean) as string[];
  const uniquePageIds = Array.from(new Set(candidatePageIds));

  for (const pageId of uniquePageIds) {
    const pageInfo = findPageInfoById(allPageInfo, pageId);
    const pageOutline = normalizePageOutline(getOutlineInfo(api, pageId, "page"), pageId);
    const targetNode = findNodeById(pageOutline, id);
    if (!targetNode) continue;

    const slotOwner = findSlotOwnerByNodeId(pageOutline, id);
    const namespaces = Array.from(collectNamespaces(targetNode));
    return [
      "# LowCode Context Retrieval",
      "",
      "## Target Component",
      `id: ${id}`,
      targetNode.title ? `title: ${targetNode.title}` : "",
      targetNode.def?.namespace ? `namespace: ${ComponentsManager.getAbbreviation(targetNode.def.namespace)}` : "",
      "",
      "## Located In Page",
      `pageId: ${pageId}`,
      pageInfo?.title ? `pageTitle: ${pageInfo.title}` : "",
      "",
      "## Current Focus",
      buildFocusSummary(focus),
      "",
      "## Parent Context",
      slotOwner?.owner?.id ? `parentComId: ${slotOwner.owner.id}` : "",
      slotOwner?.slot?.id ? `slotId: ${slotOwner.slot.id}` : "",
      slotOwner?.slot?.title ? `slotTitle: ${slotOwner.slot.title}` : "",
      "",
      "## Component DSL",
      renderNode(targetNode),
      "",
      "## Namespaces In Target",
      namespaces.length ? namespaces.map((ns) => `- ${ComponentsManager.getAbbreviation(ns)}`).join("\n") : "无",
    ].filter((item) => item !== "").join("\n");
  }

  return [
    "# LowCode Context Retrieval",
    "",
    `未找到 id=${id} 对应的页面或 UI 组件。`,
    "",
    "## Current Focus",
    buildFocusSummary(focus),
  ].join("\n");
}
