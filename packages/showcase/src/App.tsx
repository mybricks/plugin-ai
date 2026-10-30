import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import pluginAI from "@plugin/index";
import { IDBHistory, Tools } from "@agent/index";
import { loadDesigner, type DesignerComponent, type DesignerInstance } from "./designer-runtime";
import { deleteDump, listDumps, loadDump, saveDump, type DumpSummary } from "./storage";
import { mybricksConfig } from "./config";
import { createTestAIPluginParams } from "./test-ai";
import { applyShowcaseLocale, getShowcaseLocale, type ShowcaseLocale } from "./locale";
import "./styles.css";
import { createTaskFirstPlugin } from "../../kit/src";

function getWorkspaceId() {
  const pathId = window.location.pathname.match(/^\/app\/([^/]+)/)?.[1];
  const queryId = new URLSearchParams(window.location.search).get("id");
  return pathId ? decodeURIComponent(pathId) : queryId ?? "";
}

type Scenario = "local" | "task" | "remote";
function getScenario(): Scenario {
  const value = new URLSearchParams(window.location.search).get("scene");
  return value === "task" || value === "remote" ? value : "local";
}

function workspaceUrl(id: string, scenario: Scenario) {
  return `/app/${encodeURIComponent(id)}?scene=${scenario}`;
}

function Landing() {
  const [dumps, setDumps] = useState<DumpSummary[]>([]);
  const [id, setId] = useState("");
  const [scene, setScene] = useState<Scenario>("local");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setDumps([]);
    setError("");
    if (scene !== "remote") {
      listDumps(scene).then((items) => { if (active) setDumps(items); }).catch(() => { if (active) setError("读取本地工作区失败"); });
    }
    return () => { active = false; };
  }, [scene]);
  const open = (workspaceId: string) => {
    if (workspaceId.trim()) window.location.assign(workspaceUrl(workspaceId.trim(), scene));
  };
  return <main className="landing"><div className="landing-content">
    <p className="eyebrow">PLUGIN AI / SHOWCASE</p>
    <h1>选择一个场景</h1><p className="landing-lead">选择运行方式，然后打开已有工作区或输入 ID。</p>
    <div className="scene-grid">{([
      ["local", "本地 Agent", "在浏览器中运行 Agent"],
      ["task", "任务视图", "本地 Agent 与任务视图"],
      ["remote", "服务端 Agent", "连接本地 aicode-agents"],
    ] as const).map(([value, title, description]) => <button key={value} className={`scene-card ${scene === value ? "selected" : ""}`} onClick={() => setScene(value)} aria-pressed={scene === value}><strong>{title}</strong><span>{description}</span></button>)}</div>
    <form className="open-workspace" onSubmit={(event) => { event.preventDefault(); open(id); }}>
      <label htmlFor="workspace-id">{scene === "remote" ? "服务端 Workspace ID" : "工作区 ID"}</label>
      <div><input id="workspace-id" value={id} onChange={(event) => setId(event.target.value)} placeholder={scene === "remote" ? "输入已有的服务端 workspace ID" : "输入或新建工作区 ID"} /><button disabled={!id.trim()}>打开工作区 →</button></div>
    </form>
    {scene !== "remote" && <section className="saved-workspaces"><h2>{scene === "task" ? "任务视图" : "本地 Agent"}的工作区 <span>{dumps.length}</span></h2><p>这些 ID 来自此浏览器保存的设计数据。</p>
      {error ? <p className="landing-error">{error}</p> : dumps.length === 0 ? <p className="empty-workspaces">暂无已保存的工作区</p> : dumps.map((item) => <button className="workspace-row" key={item.id} onClick={() => open(item.id)}><strong>{item.id}</strong><time>{new Date(item.updatedAt).toLocaleString()}</time><span>打开 →</span></button>)}
    </section>}
  </div></main>;
}

function FaultControl() {
  const [mode, setMode] = useState("off");
  const [status, setStatus] = useState("");
  const read = async () => {
    try { const response = await fetch("/__llm_fault/status"); if (!response.ok) throw new Error(); const data = await response.json(); setMode(data.mode); setStatus(""); }
    catch { setStatus("故障代理未连接，请先启动 aicode-agents 测试代理。"); }
  };
  useEffect(() => { void read(); }, []);
  const change = async (next: string) => {
    try {
      const response = await fetch("/__llm_fault/mode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: next }) });
      if (!response.ok) throw new Error();
      setMode((await response.json()).mode); setStatus("");
    } catch { setStatus("设置失败，请确认故障代理已启动。"); }
  };
  return <div className="fault-control"><strong>模型故障注入</strong><select aria-label="模型故障注入" value={mode} onChange={(event) => void change(event.target.value)}><option value="off">正常透传</option><option value="http503">HTTP 503</option><option value="disconnect">连接断开</option></select><span>{status || (mode === "off" ? "模型请求透传" : "持续生效，重试前切回正常透传")}</span></div>;
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

function readProjectFile(text: string): Record<string, unknown> {
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
    throw new Error("数据格式不正确，请导入从 MyBricks 导出的 .ui 或 dumpJson（.json）文件。");
  }

  return project as Record<string, unknown>;
}

export default function App() {
  const id = useMemo(getWorkspaceId, []);
  const scenario = useMemo(getScenario, []);
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
    Promise.all([loadDesigner(), scenario === "remote" ? Promise.resolve(null) : loadDump(id, scenario)])
      .then(([designer, dump]) => {
        if (!active) return;
        setDesigner(() => designer);
        setInitialDump(dump);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "设计器初始化失败。"))
      .finally(() => active && setIsLoading(false));
    return () => { active = false; };
  }, [id, scenario]);

  const aiPlugin = useMemo(() => {
    if (!id) return null;
    // 沿用本地场景原有 key 和 history；任务场景使用独立命名空间。
    return pluginAI({
      ...createTestAIPluginParams(),
      key: `@mybricks/plugin-ai/${scenario === "task" ? "showcase-task" : scenario === "remote" ? "showcase-remote" : "showcase"}/${id}`,
      ...(scenario !== "remote" ? { history: new IDBHistory({ dbName: `@mybricks/plugin-ai/${scenario === "task" ? "showcase-task" : "showcase"}/history/${id}` }) } : {}),
      ...(scenario === "remote" ? { remoteAgent: { baseUrl: "http://localhost:3001/agents/api", workspaceId: id } } : {}),
      ...(scenario === "remote" ? { tools: [Tools.createAskQuestions()] } : {}),
      codingConfig: { availableLibraries: [] },
      plugins: scenario === "task" ? [createTaskFirstPlugin()] : []
    });
  }, [id, scenario]);

  const config = useMemo(
    () => (Designer && aiPlugin ? createConfig(initialDump, aiPlugin) : null),
    [Designer, aiPlugin, initialDump]
  );

  const save = async () => {
    if (!designerRef.current) return;
    setIsSaving(true);
    try {
      if (scenario !== "remote") await saveDump(id, designerRef.current.dump(), scenario);
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
      if (scenario !== "remote") await deleteDump(id, scenario);
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "清空 dump 失败。");
      setIsClearing(false);
    }
  };

  const importProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // 允许用户连续选择同一份文件。
    input.value = "";
    if (!file) return;

    setError("");
    setIsImporting(true);
    try {
      const project = readProjectFile(await file.text());
      if (!window.confirm("导入会覆盖当前工作区中已保存的设计器数据，是否继续？")) return;
      if (scenario !== "remote") await saveDump(id, project, scenario);
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "导入文件失败。");
    } finally {
      setIsImporting(false);
    }
  };

  const importRxAI = async () => {
    const importHistory = (window as typeof window & {
      __importRxAIJson__?: () => Promise<boolean>;
    }).__importRxAIJson__;
    if (await importHistory?.()) window.location.reload();
  };

  const openSwitcher = async () => {
    setIsSwitcherOpen(true);
    try {
      if (scenario !== "remote") setDumps(await listDumps(scenario));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "读取已保存文件失败。");
    }
  };

  const switchWorkspace = (nextId: string) => {
    const nextUrl = new URL(window.location.href);
    nextUrl.pathname = `/app/${encodeURIComponent(nextId)}`;
    nextUrl.search = `?scene=${scenario}`;
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

  if (!id) return <Landing />;
  if (isLoading) return <main className="status">正在载入设计器…</main>;
  if (error && !config) return <main className="status error">{error}</main>;
  if (!Designer || !config) return <main className="status error">设计器配置不可用。</main>;

  return (
    <main className="designer-page">
      {scenario === "remote" && <FaultControl />}
      <div className="designer-content">
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
            <a className="text-button" href="/">场景入口</a>
            {scenario !== "remote" && <><button className="text-button" disabled={isSaving} onClick={() => void save()}>{isSaving ? "保存中…" : "保存"}</button>
            <button className="text-button" disabled={isImporting} onClick={() => importInputRef.current?.click()}>{isImporting ? "导入中…" : "导入 .ui / JSON"}</button>
            <button className="text-button" onClick={() => void importRxAI()}>导入 .rxai</button>
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
            </div></>}
          </div>
        )}
      /></div>
      <input ref={importInputRef} className="file-input" type="file" accept=".ui,.json,application/json" onChange={(event) => void importProject(event)} />
      {error && <p className="toast">{error}</p>}
    </main>
  );
}
