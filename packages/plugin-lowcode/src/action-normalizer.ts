import { jsonrepair } from "jsonrepair";
import { ComponentsManager } from "./components-manager";

export interface DesignerObjectAction {
  comId: string;
  type: string;
  target?: string;
  params?: any;
}

export interface NormalizeDesignerActionOptions {
  pageId?: string;
}

const ROOT_COM_ID = "*root*";
const ROOT_SLOT_ID = "*rootSlot*";
const LEGACY_ROOT_COM_ID = "_root_";
const LEGACY_ROOT_SLOT_ID = "_rootSlot_";

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

function transformToValidBackground(styles: any): void {
  if (!styles) return;

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

  const isRootCom = action.comId === LEGACY_ROOT_COM_ID || action.comId === ROOT_COM_ID || action.comId === options.pageId;
  if (isRootCom) {
    action.comId = ROOT_COM_ID;
  }

  const isRootSlot = action.target === LEGACY_ROOT_SLOT_ID || action.target === ROOT_SLOT_ID || action.target === options.pageId;
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
    if (next.params?.ns) {
      next.params.namespace = ComponentsManager.getFullNamespace(next.params.ns);
      delete next.params.ns;
    }
    if (next.params?.namespace) {
      next.params.namespace = ComponentsManager.getFullNamespace(next.params.namespace);
    }
    if (!ComponentsManager.isLayoutComponent(next.params?.namespace)) {
      delete next.params?.ignore;
      delete next.params?.enhance;
    }
    if (Array.isArray(next.params?.configs)) {
      next.params.configs = next.params.configs.map(normalizeConfig);
    }
    if (next.params?.layout) {
      transformToValidMargins(next.params.layout);
      if (next.params.layout.width === "auto") {
        next.params.layout.width = "100%";
      }
    }
  }

  if (next.params?.value?.display === "absolute") {
    next.params.value.position = "smart";
    delete next.params.value.display;
  }

  if (next.params?.value?.display === "flex" && !next.params.value.flexDirection) {
    next.params.value.flexDirection = "row";
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
  return actions.map((action) => normalizeDesignerAction(action, options));
}
