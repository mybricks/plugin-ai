import type { ComponentType, ReactNode, RefObject } from "react";
import { mybricksConfig } from "./config";

export type DesignerInstance = { dump(): unknown };
export type DesignerComponent = ComponentType<{
  config: Record<string, unknown>;
  ref?: RefObject<DesignerInstance | null>;
  toolbar?: () => ReactNode;
}>;

declare global {
  interface Window { mybricks?: { SPADesigner?: DesignerComponent } }
}

const DESIGNER_SCRIPT_URL = `https://f2.eckwai.com/kos/nlav12333/mybricks/designer-spa/${mybricksConfig.designer.version}/index.min.js`;
let loading: Promise<DesignerComponent> | null = null;

/** Uses the same remote designer runtime as vibe-page-web. */
export function loadDesigner(): Promise<DesignerComponent> {
  if (window.mybricks?.SPADesigner) return Promise.resolve(window.mybricks.SPADesigner);
  if (loading) return loading;
  loading = new Promise<DesignerComponent>((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = DESIGNER_SCRIPT_URL;
    script.onload = () => {
      const designer = window.mybricks?.SPADesigner;
      if (designer) resolve(designer);
      else reject(new Error("设计器脚本加载成功，但未找到 window.mybricks.SPADesigner。"));
    };
    script.onerror = () => reject(new Error(`无法加载设计器：${DESIGNER_SCRIPT_URL}`));
    document.head.appendChild(script);
  }).finally(() => { loading = null; });
  return loading;
}
