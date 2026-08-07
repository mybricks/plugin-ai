import type { CanonicalAction } from "./types";

export const EXAMPLES = {
  outputFormat: [
    { type: "setLayout", comId: "_root_", target: ":root", width: 1024, height: 800 },
    {
      type: "addChild",
      comId: "_root_",
      target: "_rootSlot_",
      title: "容器",
      ns: "vibe.layout",
      newComId: "a1b",
      layout: { width: "100%", height: "fit-content" },
      cfg: { 区域列表: [{ name: "内容", slotId: "content", slotStyle: { flexDirection: "column" } }] },
    },
  ] as CanonicalAction[],

  setLayoutSimple: [
    { type: "setLayout", comId: "ou1", target: ":root", width: 200 },
  ] as CanonicalAction[],

  doConfigProperty: [
    { type: "doConfig", comId: "ou1", target: ":root", path: "常规/标题", value: "标题内容" },
  ] as CanonicalAction[],

  doConfigStyle: [
    { type: "doConfig", comId: "ou1", target: ":root", path: "常规/banner样式", style: { background: "red" } },
  ] as CanonicalAction[],

  addChildText: [
    { type: "addChild", comId: "ou1", target: "content", title: "添加的文本组件", ns: "pc.text", newComId: "iys" },
  ] as CanonicalAction[],

  addChildWithConfig: [
    {
      type: "addChild",
      comId: "ou1",
      target: "content",
      title: "背景图",
      ns: "pc.image",
      newComId: "ko4",
      layout: { width: "100%", height: 200, marginTop: 8, marginLeft: 12, marginRight: 12 },
      cfg: { "常规/图片地址": "https://ai.mybricks.world/image-search?term=风景" },
      sty: { "样式/图片": { borderRadius: "8px" } },
    },
  ] as CanonicalAction[],

  addChildWithIgnore: [
    {
      type: "addChild",
      comId: "ou1",
      target: "content",
      title: "添加的布局组件",
      ns: "vibe.layout",
      newComId: "nb5",
      ignore: true,
      cfg: { 区域列表: [{ name: "内容", slotId: "content", slotStyle: { flexDirection: "column" } }] },
    },
  ] as CanonicalAction[],

  delete: [
    { type: "delete", comId: "o21", target: ":root" },
  ] as CanonicalAction[],

  fixedLayout: [
    {
      type: "addChild",
      comId: "_root_",
      target: "_rootSlot_",
      title: "添加一个固定定位组件",
      ns: "vibe.layout",
      newComId: "fu3",
      layout: { position: "fixed", width: "100%", height: 84, bottom: 0, left: 0 },
      cfg: {
        方向: "row",
        区域列表: [{ name: "内容", slotId: "content", slotStyle: { flexDirection: "row", alignItems: "center" } }],
      },
    },
  ] as CanonicalAction[],

  flexLeftFixed: [
    {
      type: "addChild",
      comId: "par",
      target: "content",
      title: "添加一个布局组件",
      ns: "vibe.layout",
      newComId: "fx0",
      layout: { width: "100%", height: 60 },
      cfg: {
        方向: "row",
        区域列表: [
          { name: "左侧", slotId: "left", width: 60, slotStyle: { flexDirection: "row", alignItems: "center" } },
          { name: "右侧", slotId: "right", span: 1, slotStyle: { flexDirection: "row", alignItems: "center" } },
        ],
      },
    },
    { type: "addChild", comId: "fx0", target: "left", title: "左侧固定宽度组件", ns: "vibe.text", newComId: "lf4", layout: { width: "100%", height: "fit-content" } },
    { type: "addChild", comId: "fx0", target: "right", title: "右侧自适应组件", ns: "vibe.text", newComId: "rfo", layout: { width: "100%", height: "fit-content" } },
  ] as CanonicalAction[],

  flexIconTextArrow: [
    {
      type: "addChild",
      comId: "par",
      target: "content",
      title: "添加一个布局组件",
      ns: "vibe.layout",
      newComId: "fx1",
      layout: { width: "100%", height: 60 },
      cfg: {
        方向: "row",
        区域列表: [
          { name: "左侧", slotId: "left", span: 1, slotStyle: { flexDirection: "row", alignItems: "center", columnGap: 8 } },
          { name: "右侧", slotId: "right", width: 24, slotStyle: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end" } },
        ],
      },
    },
    { type: "addChild", comId: "fx1", target: "left", title: "图标组件", ns: "vibe.placeholder", newComId: "i98", layout: { width: 24, height: 24 } },
    { type: "addChild", comId: "fx1", target: "left", title: "文本组件", ns: "vibe.text", newComId: "tsd", layout: { width: "fit-content", height: "fit-content" } },
    { type: "addChild", comId: "fx1", target: "right", title: "箭头图标组件", ns: "vibe.placeholder", newComId: "ar7", layout: { width: 24, height: 24 } },
  ] as CanonicalAction[],

  flexCenter: [
    {
      type: "addChild",
      comId: "par",
      target: "content",
      title: "添加一个布局组件",
      ns: "vibe.layout",
      newComId: "fx2",
      layout: { width: "100%", height: 120 },
      cfg: {
        区域列表: [{ name: "内容", slotId: "center", span: 1, slotStyle: { flexDirection: "column", alignItems: "center", justifyContent: "center" } }],
      },
    },
    { type: "addChild", comId: "fx2", target: "center", title: "子组件", ns: "vibe.text", newComId: "chi", layout: { width: 80, height: "fit-content" } },
  ] as CanonicalAction[],

  flexHalves: [
    {
      type: "addChild",
      comId: "par",
      target: "content",
      title: "添加一个布局组件",
      ns: "vibe.layout",
      newComId: "fx3",
      ignore: true,
      layout: { width: "100%", height: 120 },
      cfg: {
        方向: "row",
        区域列表: [
          { name: "A区域", slotId: "areaA", span: 1, slotStyle: { flexDirection: "column" } },
          { name: "B区域", slotId: "areaB", span: 1, slotStyle: { flexDirection: "column" } },
        ],
      },
    },
    { type: "addChild", comId: "fx3", target: "areaA", title: "A组件", ns: "vibe.text", newComId: "a32", layout: { width: "100%", height: "fit-content", marginRight: 8 } },
    { type: "addChild", comId: "fx3", target: "areaB", title: "B组件", ns: "vibe.text", newComId: "b32", layout: { width: "100%", height: "fit-content" } },
  ] as CanonicalAction[],

  flexNColumns: [
    {
      type: "addChild",
      comId: "par",
      target: "content",
      title: "添加一个布局组件",
      ns: "vibe.layout",
      newComId: "fx4",
      ignore: true,
      layout: { width: "100%", height: 120 },
      cfg: {
        方向: "row",
        区域列表: [
          { name: "A区域", slotId: "colA", span: 1, slotStyle: { flexDirection: "column" } },
          { name: "B区域", slotId: "colB", span: 1, slotStyle: { flexDirection: "column" } },
          { name: "C区域", slotId: "colC", span: 1, slotStyle: { flexDirection: "column" } },
        ],
      },
    },
    { type: "addChild", comId: "fx4", target: "colA", title: "A组件", ns: "vibe.text", newComId: "aks", layout: { width: "100%", height: "fit-content" } },
    { type: "addChild", comId: "fx4", target: "colB", title: "B组件", ns: "vibe.text", newComId: "b29", layout: { width: "100%", height: "fit-content" } },
    { type: "addChild", comId: "fx4", target: "colC", title: "C组件", ns: "vibe.text", newComId: "csi", layout: { width: "100%", height: "fit-content" } },
  ] as CanonicalAction[],

  absoluteInFlex: [
    {
      type: "addChild",
      comId: "par",
      target: "content",
      title: "添加一个布局组件",
      ns: "vibe.layout",
      newComId: "fx5",
      layout: { width: "100%", height: 200 },
      cfg: {
        方向: "row",
        区域列表: [{ name: "内容", slotId: "contentArea", span: 1, slotStyle: { flexDirection: "row", alignItems: "center" } }],
      },
    },
    { type: "addChild", comId: "fx5", target: "contentArea", title: "绝对定位组件", ns: "vibe.text", newComId: "abs", layout: { position: "absolute", width: 100, height: 40, top: 20, left: 20 } },
    { type: "addChild", comId: "fx5", target: "contentArea", title: "普通组件", ns: "vibe.text", newComId: "nor", layout: { width: 80, height: "fit-content" } },
  ] as CanonicalAction[],

  adminPageExample: [
    { type: "setLayout", comId: "_root_", target: ":root", width: 1600, height: 1800 },
    { type: "doConfig", comId: "_root_", target: ":root", path: "root/样式", style: { background: "#ffffff" } },
    { type: "doConfig", comId: "_root_", target: ":root", path: "root/布局", value: { display: "flex", flexDirection: "column" } },
    {
      type: "addChild", comId: "_root_", target: "_rootSlot_", title: "页面布局", ns: "vibe.layout", newComId: "pge",
      layout: { width: "100%", height: "fit-content" },
      cfg: {
        方向: "row",
        区域列表: [
          { name: "左侧", slotId: "left", width: 200, slotStyle: { flexDirection: "column", rowGap: 12 } },
          { name: "右侧", slotId: "right", span: 1, slotStyle: { flexDirection: "column", rowGap: 16 } },
        ],
      },
    },
    { type: "addChild", comId: "pge", target: "left", title: "Logo和网站信息", ns: "vibe.text", newComId: "log", layout: { width: "100%", height: "fit-content", marginRight: 12 } },
    { type: "addChild", comId: "pge", target: "left", title: "侧边栏", ns: "vibe.nav-list", newComId: "sdb", layout: { width: "100%", height: "fit-content", marginRight: 12 } },
    { type: "addChild", comId: "pge", target: "right", title: "顶部个人信息", ns: "vibe.section", newComId: "prf", layout: { width: "100%", height: "fit-content" } },
    {
      type: "addChild", comId: "pge", target: "right", title: "卡片概览", ns: "vibe.layout", newComId: "mtl",
      layout: { width: "100%", height: "fit-content", marginTop: 16 },
      cfg: {
        "布局/方向": "row",
        区域列表: [
          { name: "卡片A", slotId: "metricA", span: 1 },
          { name: "卡片B", slotId: "metricB", span: 1 },
          { name: "卡片C", slotId: "metricC", span: 1 },
        ],
      },
    },
    { type: "addChild", comId: "pge", target: "right", title: "底部表格", ns: "vibe.section", newComId: "tbl", layout: { width: "100%", height: "fit-content", marginTop: 16 } },
  ] as CanonicalAction[],

  blogPageExample: [
    { type: "setLayout", comId: "_root_", target: ":root", width: 1440, height: 1600 },
    { type: "doConfig", comId: "_root_", target: ":root", path: "root/样式", style: { background: "#ffffff" } },
    { type: "doConfig", comId: "_root_", target: ":root", path: "root/布局", value: { display: "flex", flexDirection: "column" } },
    {
      type: "addChild", comId: "_root_", target: "_rootSlot_", title: "顶部导航", ns: "vibe.layout", newComId: "nav",
      layout: { width: "100%", height: 60, marginBottom: 12 },
      cfg: {
        "布局/方向": "row",
        区域列表: [
          { name: "左侧菜单", slotId: "navLeft", span: 1, slotStyle: { flexDirection: "row", alignItems: "center" } },
          { name: "右侧信息", slotId: "navRight", width: 300, slotStyle: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end" } },
        ],
      },
    },
    { type: "addChild", comId: "nav", target: "navLeft", title: "左侧菜单", ns: "vibe.nav-list", newComId: "lft", layout: { width: "100%", height: "fit-content", marginLeft: 12 } },
    { type: "addChild", comId: "nav", target: "navRight", title: "右侧头像昵称区域", ns: "vibe.text", newComId: "rpt", layout: { width: "fit-content", height: "fit-content", marginRight: 12 } },
    {
      type: "addChild", comId: "_root_", target: "_rootSlot_", title: "详情内容", ns: "vibe.layout", newComId: "dtl",
      layout: { width: "100%", height: "fit-content", marginLeft: 12, marginRight: 12 },
      cfg: { 区域列表: [{ name: "内容", slotId: "detailContent", slotStyle: { flexDirection: "column", rowGap: 12 } }] },
    },
    { type: "addChild", comId: "dtl", target: "detailContent", title: "文章头部", ns: "vibe.section", newComId: "hdr", layout: { width: "100%", height: "fit-content" } },
    { type: "addChild", comId: "dtl", target: "detailContent", title: "文章内容", ns: "vibe.section", newComId: "bdy", layout: { width: "100%", height: "fit-content", marginTop: 12, marginLeft: 12, marginRight: 12 } },
  ] as CanonicalAction[],
} as const;
