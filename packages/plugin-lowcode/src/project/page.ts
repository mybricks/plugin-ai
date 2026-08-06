import type { LowCodeDesignerAPI } from "../designer";
import type { OutlineNode, SlotInfo } from "./types";

export const ROOT_NAMESPACE = "root";
const ROOT_ID = "_root_";
const ROOT_SLOT_ID = "_rootSlot_";

function getOutlineInfo(api: LowCodeDesignerAPI | undefined, id: string): OutlineNode | undefined {
  return api?.page?.api?.getOutlineInfo?.(id);
}

function getOriginRootCom(outline?: OutlineNode): OutlineNode | null {
  return outline?.components?.[0]?.asRoot ? outline.components[0] : null;
}

export function getPageOutline(api: LowCodeDesignerAPI | undefined, pageId: string): OutlineNode | undefined {
  const outline = getOutlineInfo(api, pageId);
  if (!outline) return undefined;
  if (outline.id !== pageId) return { id: pageId, title: outline.title, slots: [{ id: ROOT_ID, components: [outline] }] };

  let rootNode: OutlineNode = outline;
  let rootSlots: SlotInfo[] | undefined = [{ id: ROOT_SLOT_ID, components: outline.components, layout: outline.layout }];
  const rootCom = getOriginRootCom(outline);
  if (rootCom) {
    rootNode = rootCom;
    rootSlots = rootNode.slots;
  }

  const normalized: OutlineNode = {
    ...rootNode,
    style: { ...(rootNode.style ?? {}), width: outline.layout?.width, height: outline.layout?.height },
    slots: rootSlots,
    def: { ...(rootNode.def ?? {}), version: "1.0.0", namespace: ROOT_NAMESPACE },
    asRoot: true,
  };
  return { id: pageId, title: outline.title, slots: [{ id: ROOT_ID, components: [normalized] }] };
}

export function flattenPages(input: any): any[] {
  if (!input) return [];
  const roots = Array.isArray(input) ? input : input.pageAry;
  const result: any[] = [];
  const visit = (page: any) => {
    if (!page) return;
    result.push(page);
    (page.children ?? []).forEach(visit);
  };
  (roots ?? []).forEach((item: any) => item?.pageAry ? item.pageAry.forEach(visit) : visit(item));
  return result;
}

export function findPageInfoById(input: any, id: string): any {
  return flattenPages(input).find((page) => page?.id === id);
}
