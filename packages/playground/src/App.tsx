import React, { useState, useCallback, useEffect, useRef } from "react";
import JsonView from "@microlink/react-json-view";
import { ChatPanel } from "@plugin/ui/chat/chat-panel";
import { openSetting } from "@plugin/ui/setting";
import { ALL_CASES, groupCases } from "./cases";
import type { TestCase } from "./cases";
import { usePlaygroundAgent } from "./lib/use-playground-agent";
import { useRequestInspector, type RequestSnapshot } from "./lib/use-request-inspector";
import type { MemFS } from "./lib/mem-fs";
import { getWebFetchUrl, setWebFetchUrl, getDefaultUrlForCase } from "./lib/web-fetch-state";
import "./app.css";

// ─── Theme Toggle ─────────────────────────────────────────────────────────────

type ThemeMode = "light" | "dark" | "none";

const THEME_KEY = "pg-theme";
const THEME_ORDER: ThemeMode[] = ["light", "dark", "none"];
const THEME_ICONS: Record<ThemeMode, string> = { light: "☀️", dark: "🌙", none: "🔍" };
const THEME_TIPS: Record<ThemeMode, string> = {
  light: "浅色模式（CSS 变量已注入）",
  dark: "暗黑模式（CSS 变量已注入）",
  none: "默认值模式（无 CSS 变量注入，验证 fallback）",
};

function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved !== null && THEME_ORDER.includes(saved as ThemeMode)) return saved as ThemeMode;
    return "light";
  });

  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("pg-dark", mode === "dark");
    el.classList.toggle("pg-none", mode === "none");
    localStorage.setItem(THEME_KEY, mode);
  }, [mode]);

  const cycle = useCallback(() => {
    setMode((m) => {
      const idx = THEME_ORDER.indexOf(m);
      return THEME_ORDER[(idx + 1) % THEME_ORDER.length];
    });
  }, []);
  return { mode, cycle };
}

function ThemeToggle({ mode, onCycle }: { mode: ThemeMode; onCycle: () => void }) {
  return (
    <button className="pg-theme-toggle" onClick={onCycle} title={THEME_TIPS[mode]}>
      {THEME_ICONS[mode]}
    </button>
  );
}

const P0_CASES = ALL_CASES.filter(c => c.priority === "P0");
const P0_GROUPS = groupCases(P0_CASES);
const OTHER_CASES = ALL_CASES.filter(c => c.priority !== "P0");
const OTHER_GROUPS = groupCases(OTHER_CASES);
const GROUP_ICONS: Record<string, string> = {
  "P0 核心场景": "🔴",
  "网络中断": "🌐",
  "工具调用": "🔧",
  "多轮 ReAct": "🔁",
  "消息遮蔽": "🎭",
  "异常检测": "⚠️",
  "Compact": "🗜️",
  "WebFetch": "🔗",
  "UI 渲染": "🎨",
  "设置": "⚙️",
};

// ─── FS Viewer ────────────────────────────────────────────────────────────────

function FSViewer({ memFS }: { memFS: MemFS | null }) {
  const [files, setFiles] = useState(() => memFS?.snapshot() ?? []);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 轮询 MemFS 变化（工具写入后刷新）
  useEffect(() => {
    if (!memFS) { setFiles([]); setSelectedPath(null); return; }
    setFiles(memFS.snapshot());
    setSelectedPath(null);

    intervalRef.current = setInterval(() => {
      setFiles(memFS.snapshot());
    }, 300);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [memFS]);

  const selectedContent = selectedPath != null
    ? files.find(f => f.path === selectedPath)?.content ?? ""
    : null;

  return (
    <div className="pg-fs-viewer">
      <div className="pg-fs-header">
        <span className="pg-fs-title">📁 MemFS</span>
        <span className="pg-case-count">{files.length} files</span>
      </div>
      <div className="pg-fs-body">
        <div className="pg-fs-tree">
          {files.map(f => (
            <button
              key={f.path}
              className={`pg-fs-file${selectedPath === f.path ? " active" : ""}`}
              onClick={() => setSelectedPath(f.path === selectedPath ? null : f.path)}
            >
              {f.path}
            </button>
          ))}
        </div>
        {selectedContent !== null && (
          <pre className="pg-fs-content">{selectedContent}</pre>
        )}
      </div>
    </div>
  );
}

// ─── Inspector Panel ──────────────────────────────────────────────────────────

function InspectorPanel({ snapshots }: { snapshots: RequestSnapshot[] }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  useEffect(() => {
    if (snapshots.length > 0) setActiveIdx(snapshots.length - 1);
    else setActiveIdx(null);
  }, [snapshots.length]);

  const active = activeIdx !== null ? snapshots[activeIdx] : null;

  return (
    <div className="pg-inspector">
      <div className="pg-inspector-header">
        <span className="pg-inspector-title">🔍 Request Inspector</span>
        <span className="pg-case-count">{snapshots.length} calls</span>
      </div>

      {snapshots.length === 0 ? (
        <div className="pg-inspector-empty">
          发送消息后，每次 LLM 请求的<br />完整参数会显示在这里
        </div>
      ) : (
        <>
          <div className="pg-inspector-tabs">
            {snapshots.map((s, i) => (
              <button
                key={i}
                className={`pg-inspector-tab${activeIdx === i ? " active" : ""}`}
                onClick={() => setActiveIdx(i)}
              >
                <span className="pg-tab-step">Step {s.index}</span>
                <span className="pg-tab-count">
                  {s.params.messages?.length ?? 0} msgs
                </span>
              </button>
            ))}
          </div>

          {active && (
            <div className="pg-inspector-body">
              <div className="pg-inspector-meta">
                <span>Step {active.index}</span>
                <span>{active.params.messages?.length ?? 0} messages</span>
                {active.params.tools && active.params.tools.length > 0 && (
                  <span>{active.params.tools.length} tools</span>
                )}
                <span className="pg-meta-time">
                  {new Date(active.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <div className="pg-json-wrap">
                <JsonView
                  src={active.params}
                  theme="rjv-default"
                  collapsed={false}
                  shouldCollapse={({ name, namespace }) => {
                    // tools 及其子节点全部折叠
                    if (name === "tools") return true;
                    if (Array.isArray(namespace) && namespace.includes("tools")) return true;
                    return false;
                  }}
                  displayDataTypes={false}
                  displayObjectSize={true}
                  enableClipboard={true}
                  style={{ fontSize: 11, lineHeight: 1.6, background: "transparent" }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const { mode, cycle: cycleTheme } = useTheme();

  // 从 URL 读取初始 case（?case=xxx）
  const initialCaseId = new URLSearchParams(window.location.search).get("case");
  const initialCase = ALL_CASES.find(c => c.id === initialCaseId) ?? ALL_CASES[0] ?? null;

  const [activeCase] = useState<TestCase | null>(initialCase);
  const [webFetchUrl, setWebFetchUrlState] = useState(() => getDefaultUrlForCase(initialCase?.id ?? ""));

  const { wrappedRequest, snapshots } = useRequestInspector(
    activeCase?.request ?? null
  );

  const { agent, memFS } = usePlaygroundAgent(activeCase, wrappedRequest);

  // 是否显示设置按钮（设置分组）
  const showSettingBtn = activeCase?.group === "设置";

  // 切换 case：更新 URL 并刷新页面
  const handleSelectCase = useCallback((c: TestCase) => {
    const url = new URL(window.location.href);
    url.searchParams.set("case", c.id);
    window.location.href = url.toString();
  }, []);

  // 重置：保持 case 不变，刷新页面
  const handleReset = useCallback(() => {
    window.location.reload();
  }, []);

  // 是否显示 URL 输入框（WebFetch 分组）
  const showWebFetchInput = activeCase?.group === "WebFetch";

  const handleWebFetchUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setWebFetchUrlState(url);
    setWebFetchUrl(url);
  }, []);

  // 当切换 case 时更新默认 URL
  useEffect(() => {
    if (activeCase?.group === "WebFetch") {
      const defaultUrl = getDefaultUrlForCase(activeCase.id);
      setWebFetchUrlState(defaultUrl);
      setWebFetchUrl(defaultUrl);
    }
  }, [activeCase]);

  return (
    <div className="pg-layout">
      {/* 顶栏：主题切换 */}
      <header className="pg-header">
        <span className="pg-header-title">Playground</span>
        <div className="pg-header-actions">
          {showSettingBtn && (
            <button
              className="pg-setting-btn"
              onClick={() => openSetting()}
              title="打开设置"
            >
              ⚙️ 设置
            </button>
          )}
          <ThemeToggle mode={mode} onCycle={cycleTheme} />
        </div>
      </header>

      {/* Body: sidebar + main */}
      <div className="pg-body">
        {/* Case 侧边栏 */}
        <aside className="pg-sidebar">
          <div className="pg-sidebar-header">
            <span className="pg-sidebar-title">🧪 Test Cases</span>
            <span className="pg-case-count">{ALL_CASES.length}</span>
          </div>
          {/* WebFetch URL 输入框 */}
          {showWebFetchInput && (
            <div className="pg-webfetch-input-wrap">
              <label className="pg-webfetch-label">🔗 URL</label>
              <input
                type="url"
                className="pg-webfetch-input"
                placeholder="https://example.com"
                value={webFetchUrl}
                onChange={handleWebFetchUrlChange}
              />
            </div>
          )}
          <div className="pg-sidebar-body">
            {[
              ...Object.entries(P0_GROUPS),
              ...Object.entries(OTHER_GROUPS),
            ].map(([group, cases]) => (
              <div key={group} className="pg-group">
                <div className="pg-group-label">
                  {GROUP_ICONS[group] ?? "📁"} {group}
                </div>
                {cases.map((c) => (
                  <button
                    key={c.id}
                    className={`pg-case-btn${activeCase?.id === c.id ? " active" : ""}${c.priority === "P0" ? " pg-p0" : ""}`}
                    onClick={() => handleSelectCase(c)}
                  >
                    {c.priority === "P0" && <span className="pg-priority-badge">{c.priority}</span>}
                    {c.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </aside>

        {/* 主区域 */}
        <main className="pg-main">
        {activeCase && (
          <div className="pg-case-info">
            <div className="pg-case-info-left">
              <span className="pg-case-tag">{activeCase.group}</span>
              <span className="pg-case-name">{activeCase.name}</span>
              <span className="pg-case-desc">{activeCase.description}</span>
            </div>
            <div className="pg-case-info-right">
              <div className="pg-expected">
                <span className="pg-expected-label">预期行为</span>
                <span className="pg-expected-text">{activeCase.expectedBehavior}</span>
              </div>
              <button className="pg-reset-btn" onClick={handleReset}>↺ 重置</button>
            </div>
          </div>
        )}

        <div className="pg-content">
          {/* ChatPanel 列 */}
          <div className="pg-chat-col">
            {agent ? (
              <ChatPanel agent={agent as any} title="playground" header={true} />
            ) : (
              <div className="pg-loading">加载中…</div>
            )}
          </div>

          {/* 右侧：Inspector 上 + FS Viewer 下 */}
          <div className="pg-right-col">
            <InspectorPanel snapshots={snapshots} />
            <FSViewer memFS={memFS} />
          </div>
        </div>
      </main>
      </div>

    </div>
  );
}
