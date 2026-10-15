import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import pluginAI from "@plugin/index";
import { IDBHistory } from "@agent/index";
import { loadDesigner, type DesignerComponent, type DesignerInstance } from "./designer-runtime";
import { deleteDump, listDumps, loadDump, saveDump, type DumpSummary } from "./storage";
import { mybricksConfig } from "./config";
import { createTestAIPluginParams } from "./test-ai";
import { applyShowcaseLocale, getShowcaseLocale, type ShowcaseLocale } from "./locale";
import "./styles.css";

function getWorkspaceId() {
  const pathId = window.location.pathname.match(/^\/app\/([^/]+)/)?.[1];
  const queryId = new URLSearchParams(window.location.search).get("id");
  return pathId ? decodeURIComponent(pathId) : queryId ?? "";
}

function createConfig(dump: unknown, aiPlugin: unknown) {
  console.log('mybricksConfig.aiComLib.url', mybricksConfig.aiComLib.url)
  return {
    vibeCoding: { for: "pd", useIframe: false },
    comLibLoader: async () => mybricksConfig.aiComLib.url ? [mybricksConfig.aiComLib.url] : [],
    pageContentLoader: () => dump || "{}",
    toplView: {},
    editView: {
      items: (_props: unknown, category: { title?: string; items?: unknown[] }) => {
        category.title = "";
        category.items = [];
      }
    },
    geoView: {
      nav: {
        float: true,
        comShortcuts: [{
          namespace: "mybricks.basic-comlib.ai-mix",
          title: "AI 页面"
        }]
      },
      scenes: {
        adder: [{
          type: "normal",
          title: "AI 页面",
          template: { namespace: "mybricks.basic-comlib.ai-mix", deletable: false, asRoot: true },
          widthAuto: true
        }]
      }
    },
    plugins: [aiPlugin],
    promptSections: {
      documentGuide: {
        firstOfAll: '',
        requirementGuide: '',
      }
    },
    componentRuntime: {
      eslint: {
        rules: {
          'requirement-check': 'off',
          'jsdoc-check': 'off',
        },
      },
    },
  };
}

function readUIFile(text: string): Record<string, unknown> {
  let project: unknown;
  try {
    project = JSON.parse(text);
  } catch {
    throw new Error("文件内容不是合法的 JSON，请检查后重试。");
  }

  if (
    !project
    || typeof project !== "object"
    || Array.isArray(project)
    || !("content" in project)
    || !(project as { content?: unknown }).content
  ) {
    throw new Error("数据格式不正确，请导入从 MyBricks 导出的 .ui 文件。");
  }

  return project as Record<string, unknown>;
}

export default function App() {
  const id = useMemo(getWorkspaceId, []);
  const [locale] = useState(() => {
    const initialLocale = getShowcaseLocale();
    applyShowcaseLocale(initialLocale);
    return initialLocale;
  });
  const designerRef = useRef<DesignerInstance | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [Designer, setDesigner] = useState<DesignerComponent | null>(null);
  const [initialDump, setInitialDump] = useState<unknown | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isLocaleOpen, setIsLocaleOpen] = useState(false);
  const [dumps, setDumps] = useState<DumpSummary[]>([]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([loadDesigner(), loadDump(id)])
      .then(([designer, dump]) => {
        if (!active) return;
        setDesigner(() => designer);
        setInitialDump(dump);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "设计器初始化失败。"))
      .finally(() => active && setIsLoading(false));
    return () => { active = false; };
  }, [id]);

  const aiPlugin = useMemo(() => {
    if (!id) return null;
    // Plugin AI 直接从 packages/plugin/src 导入；每个 id 使用独立的 IndexedDB history。
    return pluginAI({
      ...createTestAIPluginParams(),
      key: `@mybricks/plugin-ai/showcase/${id}`,
      history: new IDBHistory({ dbName: `@mybricks/plugin-ai/showcase/history/${id}` }),
      codingConfig: { availableLibraries: [] }
    });
  }, [id]);

  const config = useMemo(
    () => (Designer && aiPlugin ? createConfig(initialDump, aiPlugin) : null),
    [Designer, aiPlugin, initialDump]
  );

  const save = async () => {
    if (!designerRef.current) return;
    setIsSaving(true);
    try {
      await saveDump(id, designerRef.current.dump());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存 dump 失败。");
    } finally {
      setIsSaving(false);
    }
  };

  const clear = async () => {
    if (!window.confirm("清空当前设计器文件？已保存的 dump 会被删除。")) return;
    setIsClearing(true);
    try {
      await deleteDump(id);
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "清空 dump 失败。");
      setIsClearing(false);
    }
  };

  const importUI = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // 允许用户连续选择同一份文件。
    input.value = "";
    if (!file) return;

    setError("");
    setIsImporting(true);
    try {
      const project = readUIFile(await file.text());
      if (!window.confirm("导入会覆盖当前工作区中已保存的设计器数据，是否继续？")) return;
      await saveDump(id, project);
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "导入 .ui 文件失败。");
    } finally {
      setIsImporting(false);
    }
  };

  const openSwitcher = async () => {
    setIsSwitcherOpen(true);
    try {
      setDumps(await listDumps());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "读取已保存文件失败。");
    }
  };

  const switchWorkspace = (nextId: string) => {
    const nextUrl = new URL(window.location.href);
    nextUrl.pathname = `/app/${encodeURIComponent(nextId)}`;
    nextUrl.search = "";
    window.location.assign(nextUrl.toString());
  };

  const changeLocale = (nextLocale: ShowcaseLocale) => {
    if (nextLocale === locale) return;
    applyShowcaseLocale(nextLocale);
    window.location.reload();
  };

  const selectLocale = (nextLocale: ShowcaseLocale) => {
    setIsLocaleOpen(false);
    changeLocale(nextLocale);
  };

  if (!id) return <main className="route-error">使用 <code>/app/你的-id</code> 或 <code>/app?id=你的-id</code> 打开一个设计器工作区。</main>;
  if (isLoading) return <main className="status">正在载入设计器…</main>;
  if (error && !config) return <main className="status error">{error}</main>;
  if (!Designer || !config) return <main className="status error">设计器配置不可用。</main>;

  return (
    <main className="designer-page">
      <div className="locale-switcher">
        <button
          className="text-button"
          aria-expanded={isLocaleOpen}
          aria-haspopup="menu"
          onClick={() => setIsLocaleOpen((open) => !open)}
        >
          {locale === "zh" ? "中文" : "EN"} <span aria-hidden="true">⌄</span>
        </button>
        {isLocaleOpen && (
          <div className="locale-menu" role="menu">
            <button role="menuitem" disabled={locale === "zh"} onClick={() => selectLocale("zh")}>中文</button>
            <button role="menuitem" disabled={locale === "en"} onClick={() => selectLocale("en")}>EN</button>
          </div>
        )}
      </div>
      <Designer
        ref={designerRef}
        config={config}
        toolbar={() => (
          <div className="toolbar">
            <button className="text-button" disabled={isSaving} onClick={() => void save()}>{isSaving ? "保存中…" : "保存"}</button>
            <button className="text-button" disabled={isImporting} onClick={() => importInputRef.current?.click()}>{isImporting ? "导入中…" : "导入 .ui"}</button>
            <button className="text-button" disabled={isClearing} onClick={() => void clear()}>{isClearing ? "清空中…" : "清空"}</button>
            <div className="switcher">
              <button className="text-button" onClick={() => void openSwitcher()}>切换</button>
              {isSwitcherOpen && (
                <div className="switcher-menu">
                  <div className="switcher-title">已保存的文件</div>
                  {dumps.length === 0 ? <div className="switcher-empty">暂无已保存文件</div> : dumps.map((item) => (
                    <button
                      className="switcher-item"
                      key={item.id}
                      disabled={item.id === id}
                      onClick={() => switchWorkspace(item.id)}
                    >
                      <span>{item.id}</span>
                      <time>{new Date(item.updatedAt).toLocaleString()}</time>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      />
      <input ref={importInputRef} className="file-input" type="file" accept=".ui" onChange={(event) => void importUI(event)} />
      {error && <p className="toast">{error}</p>}
    </main>
  );
}
