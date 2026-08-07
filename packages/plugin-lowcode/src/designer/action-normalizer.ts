/** 将 Agent action 规范化为设计器可执行 action。 */
import { jsonrepair } from "jsonrepair";
import { ComponentsManager } from "./components-manager";
import { flatConfigsToArray } from "../dsl/style-detect";

export interface DesignerObjectAction {
  comId: string;
  type: string;
  target?: string;
  params?: any;
}

export interface NormalizeDesignerActionOptions {
  pageId?: string;
  componentParamsMap?: Map<string, any>;
  enableRenderingOptimization?: boolean;
}

const ROOT_COM_ID = "_root_";
const ROOT_SLOT_ID = "_rootSlot_";
const ALTERNATE_ROOT_COM_ID = "*root*";
const ALTERNATE_ROOT_SLOT_ID = "*rootSlot*";

function isPageId(value: any, options: NormalizeDesignerActionOptions = {}): boolean {
  return typeof options.pageId === "string" && options.pageId.length > 0 && value === options.pageId;
}

function clone<T>(value: T): T {
  if (value === undefined || value === null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function parseActionString(action: string): any {
  try {
    const fixed = action.replaceAll('{":parent/', '{"path":":parent/');
    return JSON.parse(fixed);
  } catch {
    try {
      return JSON.parse(jsonrepair(action));
    } catch (error) {
      console.error("[plugin-lowcode] repair action error", error);
      throw error;
    }
  }
}

function extractBackgroundImages(background: string): string[] {
  const images: string[] = [];
  let remaining = background;

  while (remaining.length > 0) {
    const urlMatch = remaining.match(/url\s*\(/);
    const gradientMatch = remaining.match(/(linear-gradient|radial-gradient|conic-gradient)\s*\(/);
    let nextMatch: RegExpMatchArray | null = null;

    if (urlMatch && gradientMatch) {
      nextMatch = urlMatch.index! < gradientMatch.index! ? urlMatch : gradientMatch;
    } else {
      nextMatch = urlMatch ?? gradientMatch;
    }

    if (!nextMatch) break;

    const startIndex = nextMatch.index!;
    const functionStart = remaining.indexOf("(", startIndex) + 1;
    let parenCount = 1;
    let endIndex = functionStart;

    while (endIndex < remaining.length && parenCount > 0) {
      if (remaining[endIndex] === "(") parenCount += 1;
      if (remaining[endIndex] === ")") parenCount -= 1;
      endIndex += 1;
    }

    if (parenCount === 0) {
      images.push(remaining.substring(startIndex, endIndex));
      remaining = remaining.substring(endIndex);
    } else {
      remaining = remaining.substring(startIndex + 1);
    }
  }

  return images;
}

function isValidBackgroundPosition(value: string): boolean {
  const positionKeywords = ["center", "top", "bottom", "left", "right"];
  return value.split(/\s+/).every((part) => (
    positionKeywords.includes(part) ||
    /^-?\d+(\.\d+)?(px|em|rem|%)$/.test(part)
  ));
}

function isValidBackgroundSize(value: string): boolean {
  const sizeKeywords = ["cover", "contain", "auto"];
  if (sizeKeywords.includes(value)) return true;

  return value.split(/\s+/).every((part) => (
    part === "auto" ||
    /^-?\d+(\.\d+)?(px|em|rem|%)$/.test(part)
  ));
}

function extractPositionAndSize(background: string, images: string[]): { position: string; size: string } {
  let cleanBackground = background;
  images.forEach((image) => {
    cleanBackground = cleanBackground.replace(image, "");
  });
  cleanBackground = cleanBackground.replace(/,\s*,/g, ",").replace(/^\s*,\s*|\s*,\s*$/g, "").trim();

  const positionSizeMatch = cleanBackground.match(/([^/,]*?)\/([^/,]*)/);
  if (positionSizeMatch) {
    const positionPart = positionSizeMatch[1]?.trim();
    const sizePart = positionSizeMatch[2]?.trim();
    return {
      position: positionPart && isValidBackgroundPosition(positionPart) ? positionPart : "",
      size: sizePart && isValidBackgroundSize(sizePart) ? sizePart : "",
    };
  }

  let position = "";
  let size = "";
  for (const part of cleanBackground.split(/\s+/).filter(Boolean)) {
    if (!position && isValidBackgroundPosition(part)) {
      position = part;
    } else if (!size && isValidBackgroundSize(part)) {
      size = part;
    }
  }

  return { position, size };
}

function extractBackgroundColor(background: string, images: string[]): string {
  let cleanBackground = background;
  images.forEach((image) => {
    cleanBackground = cleanBackground.replace(image, "");
  });
  cleanBackground = cleanBackground.replace(/\s*(center|top|bottom|left|right|-?\d+(\.\d+)?(px|em|rem|%))\s*/g, " ");
  cleanBackground = cleanBackground.replace(/\s*\/\s*(cover|contain|auto|-?\d+(\.\d+)?(px|em|rem|%))\s*/g, " ");
  cleanBackground = cleanBackground.replace(/,\s*,/g, ",").replace(/^\s*,\s*|\s*,\s*$/g, "").trim();

  const colorMatch = cleanBackground.match(/(#[0-9A-Fa-f]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)|[a-zA-Z]+)/);
  return colorMatch ? colorMatch[0] : "";
}

function parseComplexBackground(background: string) {
  const images = extractBackgroundImages(background);
  const { position, size } = extractPositionAndSize(background, images);
  return {
    images,
    color: extractBackgroundColor(background, images),
    position,
    size,
    hasImages: images.length > 0,
  };
}

function transformToValidBackground(styles: any): void {
  if (!styles || typeof styles !== "object") return;

  if (
    typeof styles.backgroundColor === "string" &&
    styles.backgroundColor.includes("gradient")
  ) {
    const imageRegex = /(url\([^)]+\)|linear-gradient\([^)]+\)|radial-gradient\([^)]+\)|conic-gradient\([^)]+\))/;
    const imageMatch = styles.backgroundColor.match(imageRegex);
    if (imageMatch && !styles.backgroundImage) {
      styles.backgroundImage = imageMatch[0];
    }
    delete styles.backgroundColor;
  }

  if (styles.backgroundColor && !styles.backgroundImage) {
    styles.backgroundImage = "none";
  }

  if (!styles.background) return;

  const background = styles.background.toString().trim();
  delete styles.background;

  if (background === "transparent" || background === "none") {
    styles.backgroundColor = "transparent";
    styles.backgroundImage = "none";
    return;
  }

  const parsedBackground = parseComplexBackground(background);
  if (parsedBackground.hasImages && !styles.backgroundImage) {
    styles.backgroundColor = "transparent";
    styles.backgroundImage = parsedBackground.images.join(", ");
    if (parsedBackground.position && !styles.backgroundPosition) {
      styles.backgroundPosition = parsedBackground.position;
    }
    if (parsedBackground.size && !styles.backgroundSize) {
      styles.backgroundSize = parsedBackground.size;
    }
    return;
  }

  if (parsedBackground.color && !styles.backgroundColor) {
    styles.backgroundColor = parsedBackground.color;
    if (!styles.backgroundImage) {
      styles.backgroundImage = "none";
    }
    return;
  }

  if (styles.backgroundImage && !styles.backgroundColor) {
    styles.backgroundColor = "transparent";
  }
}

function normalizeMarginValue(value: string): string | number {
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  const pxMatch = value.match(/^(-?\d+(\.\d+)?)px$/);
  return pxMatch ? Number(pxMatch[1]) : value;
}

function transformToValidMargins(layout: any): void {
  if (!layout || typeof layout !== "object") return;
  if (layout.margin !== undefined) {
    const margin = layout.margin;
    delete layout.margin;
    if (typeof margin === "number") {
      layout.marginTop ??= margin;
      layout.marginRight ??= margin;
      layout.marginBottom ??= margin;
      layout.marginLeft ??= margin;
      return;
    }

    if (typeof margin === "string") {
      const values = margin.trim().split(/\s+/).map(normalizeMarginValue);
      if (values.length === 1) {
        layout.marginTop ??= values[0];
        layout.marginRight ??= values[0];
        layout.marginBottom ??= values[0];
        layout.marginLeft ??= values[0];
      } else if (values.length === 2) {
        layout.marginTop ??= values[0];
        layout.marginRight ??= values[1];
        layout.marginBottom ??= values[0];
        layout.marginLeft ??= values[1];
      } else if (values.length === 3) {
        layout.marginTop ??= values[0];
        layout.marginRight ??= values[1];
        layout.marginBottom ??= values[2];
        layout.marginLeft ??= values[1];
      } else if (values.length >= 4) {
        layout.marginTop ??= values[0];
        layout.marginRight ??= values[1];
        layout.marginBottom ??= values[2];
        layout.marginLeft ??= values[3];
      }
    }
  }
}

function normalizeLayout(layout: any): void {
  if (!layout || typeof layout !== "object") return;

  if (layout.display === "absolute") {
    layout.position = "smart";
    delete layout.display;
  }

  if (layout.display === "flex" && !layout.flexDirection) {
    layout.flexDirection = "row";
  }

  transformToValidMargins(layout);

  if (layout.width === "auto") {
    layout.width = "100%";
  }
}

function hasPaddingStyle(configs: any[]): boolean {
  return configs.some((config) => Object.keys(config?.style ?? {}).some((key) => key.startsWith("padding")));
}

function normalizeActionTags(action: DesignerObjectAction, options: NormalizeDesignerActionOptions): void {
  if (action.type !== "addChild" || !action.params) return;

  if (!options.enableRenderingOptimization) {
    delete action.params.ignore;
    delete action.params.enhance;
    return;
  }

  if (action.params.ignore && Array.isArray(action.params.configs) && hasPaddingStyle(action.params.configs)) {
    action.params.enhance = true;
    delete action.params.ignore;
  }

  if (!ComponentsManager.isLayoutComponent(action.params.namespace)) {
    delete action.params.ignore;
    delete action.params.enhance;
    return;
  }

  if (action.params.ignore && options.componentParamsMap) {
    const parentParams = options.componentParamsMap.get(action.comId);
    if (!parentParams) {
      delete action.params.ignore;
      delete action.params.enhance;
      return;
    }
    if (parentParams.namespace && !ComponentsManager.isLayoutComponent(parentParams.namespace)) {
      action.params.enhance = true;
      delete action.params.ignore;
    }
  }
}

function normalizeConfig(config: any): any {
  if (!config || typeof config !== "object") return config;

  if (!config.path && Object.keys(config).length === 1) {
    const firstKey = Object.keys(config)[0];
    const value = config[firstKey];
    delete config[firstKey];
    config.path = firstKey;
    config.value = value;
  }

  if (config.parent) {
    config.path = `:parent/${config.path}`;
    delete config.parent;
  }

  if (config?.value?.display === "absolute") {
    config.value.position = "smart";
    delete config.value.display;
  }

  if (config?.value?.display === "flex" && !config.value.flexDirection) {
    config.value.flexDirection = "row";
  }

  if (config?.style) {
    transformToValidBackground(config.style);
  }

  return config;
}

function normalizeRootTarget(action: DesignerObjectAction, options: NormalizeDesignerActionOptions = {}): void {
  if (!action) return;

  const isRootCom =
    action.comId === ROOT_COM_ID ||
    action.comId === ALTERNATE_ROOT_COM_ID ||
    action.comId === ALTERNATE_ROOT_SLOT_ID ||
    action.comId === ROOT_SLOT_ID ||
    isPageId(action.comId, options);
  if (isRootCom) {
    action.comId = ROOT_COM_ID;
  }

  const isRootSlot = action.target === ROOT_SLOT_ID || action.target === ALTERNATE_ROOT_SLOT_ID || isPageId(action.target, options);
  if (isRootSlot) {
    action.target = ROOT_SLOT_ID;
  }

  if (action.type === "addChild" && action.comId === ROOT_COM_ID && !action.target) {
    action.target = ROOT_SLOT_ID;
  }
}

function normalizeObjectAction(action: DesignerObjectAction, options: NormalizeDesignerActionOptions = {}): DesignerObjectAction {
  const next = clone(action);
  normalizeRootTarget(next, options);

  if (next.type === "delete" && !next.params) {
    next.params = {};
  }

  if (next.type === "move" && next.params && !next.params.to) {
    next.params = { to: next.params };
  }

  if (next.type === "addChild") {
    if (next.params?.slot === ROOT_SLOT_ID || next.params?.slot === ALTERNATE_ROOT_SLOT_ID || isPageId(next.params?.slot, options)) {
      next.params.slot = ROOT_SLOT_ID;
    }
    if (next.params?.ns) {
      next.params.namespace = ComponentsManager.getFullNamespace(next.params.ns);
      delete next.params.ns;
    }
    if (next.params?.namespace) {
      next.params.namespace = ComponentsManager.getFullNamespace(next.params.namespace);
    }
    if (Array.isArray(next.params?.configs)) {
      next.params.configs = next.params.configs.map(normalizeConfig);
    } else if (next.params?.configs && typeof next.params.configs === "object") {
      next.params.configs = flatConfigsToArray(next.params.configs).map(normalizeConfig);
    }
    normalizeActionTags(next, options);
    if (next.params?.layout) {
      normalizeLayout(next.params.layout);
    }
    if (options.componentParamsMap && next.params?.comId) {
      options.componentParamsMap.set(next.params.comId, clone(next.params));
    }
  }

  if (next.params?.value?.display === "absolute") {
    next.params.value.position = "smart";
    delete next.params.value.display;
  }

  if (next.params?.value?.display === "flex" && !next.params.value.flexDirection) {
    next.params.value.flexDirection = "row";
  }

  if (next.type === "setLayout") {
    normalizeLayout(next.params);
  }

  if (next.type === "doConfig") {
    if (next.params?.display === "flex" && !next.params.flexDirection) {
      next.params.flexDirection = "column";
    }
    if (next.params?.flexDirection && !next.params.display) {
      next.params.display = "flex";
    }
    if (next.params?.style) {
      transformToValidBackground(next.params.style);
    }
  }

  return next;
}

export function normalizeDesignerAction(action: any, options: NormalizeDesignerActionOptions = {}): DesignerObjectAction {
  if (typeof action === "string") {
    return normalizeDesignerAction(parseActionString(action), options);
  }
  if (Array.isArray(action)) {
    const [comId, target, type, params] = action;
    return normalizeObjectAction({ comId, target, type, params }, options);
  }
  return normalizeObjectAction(action, options);
}

export function normalizeDesignerActions(actions: any[] = [], options: NormalizeDesignerActionOptions = {}): DesignerObjectAction[] {
  if (typeof actions === "string") {
    const parsed = parseActionString(actions);
    return normalizeDesignerActions(Array.isArray(parsed) && Array.isArray(parsed[0]) ? parsed : [parsed], options);
  }
  const componentParamsMap = options.componentParamsMap ?? new Map<string, any>();
  return actions.map((action) => normalizeDesignerAction(action, { ...options, componentParamsMap }));
}
