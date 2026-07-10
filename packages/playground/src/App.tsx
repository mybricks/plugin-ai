import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
import markdownSkinSpecial from "./markdown-skin-special.module.css";

// ─── Theme Toggle ─────────────────────────────────────────────────────────────

type ThemeMode = "light" | "dark" | "none";

const THEME_KEY = "pg-theme";
const THEME_ORDER: ThemeMode[] = ["light", "dark", "none"];
const THEME_ICONS: Record<ThemeMode, string> = { light: "Light", dark: "Dark", none: "None" };
const THEME_TIPS: Record<ThemeMode, string> = {
  light: "Light mode (CSS variables injected)",
  dark: "Dark mode (CSS variables injected)",
  none: "Default mode (no CSS variables, verify fallback)",
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

// ─── Disabled Toggle ──────────────────────────────────────────────────────────

function useChatDisabled() {
  const [disabled, setDisabled] = useState(false);

  const toggle = useCallback(() => {
    setDisabled(v => !v);
  }, []);

  return { disabled, toggle };
}

function DisabledToggle({ disabled, onToggle }: { disabled: boolean; onToggle: () => void }) {
  return (
    <button
      className={`pg-disabled-toggle${disabled ? " active" : ""}`}
      onClick={onToggle}
      title={disabled ? "Disabled: input is blocked" : "Enabled: input is available"}
    >
      <span className="pg-disabled-label">Disabled</span>
      <span className="pg-disabled-state">{disabled ? "ON" : "OFF"}</span>
    </button>
  );
}

// ─── Panel Width Toggle ────────────────────────────────────────────────────────

const PANEL_WIDTHS = [360, 267] as const;
type PanelWidth = typeof PANEL_WIDTHS[number];
const PANEL_WIDTH_KEY = "pg-panel-width";

function usePanelWidth() {
  const [width, setWidth] = useState<PanelWidth>(() => {
    const saved = Number(localStorage.getItem(PANEL_WIDTH_KEY));
    return PANEL_WIDTHS.includes(saved as PanelWidth) ? (saved as PanelWidth) : 360;
  });

  const toggle = useCallback(() => {
    setWidth((w) => {
      const next = w === 360 ? 267 : 360;
      localStorage.setItem(PANEL_WIDTH_KEY, String(next));
      return next;
    });
  }, []);

  return { width, toggle };
}

function PanelWidthToggle({ width, onToggle }: { width: PanelWidth; onToggle: () => void }) {
  return (
    <button
      className="pg-panel-width-toggle"
      onClick={onToggle}
      title={width === 360 ? "切换到最小宽度 267px" : "切换到默认宽度 360px"}
    >
      <span>W:</span>
      <span className="pg-panel-width-value">{width}</span>
    </button>
  );
}

const P0_CASES = ALL_CASES.filter(c => c.priority === "P0");
const P0_GROUPS = groupCases(P0_CASES);
const OTHER_CASES = ALL_CASES.filter(c => c.priority !== "P0");
const OTHER_GROUPS = groupCases(OTHER_CASES);
const GROUP_ICONS: Record<string, string> = {};

const CHAT_PANEL_SKIN_VARIABLES = [
  ["--mybricks-color-primary", "#2563eb"],
  ["--mybricks-text-color-main", "#333"],
  ["--mybricks-text-color-hover", "#FFF"],
  ["--mybricks-text-color-active", "#FFF"],
  ["--mybricks-text-color-disabled", "#AAA"],
  ["--mybricks-bg-color-main", "#FFF"],
  ["--mybricks-bg-color-main-transparent", "rgba(255, 255, 255, 0.93)"],
  ["--mybricks-bg-color-secondary", "#FFF"],
  ["--mybricks-bg-color-hover", "#FDFDFD"],
  ["--mybricks-bg-color-active", "#EEE"],
  ["--mybricks-bg-color-designer", "#F5F5F5"],
  ["--mybricks-menu-bg-color", "#FFF"],
  ["--mybricks-shadow-main", "0 4px 10px rgba(0, 0, 0, .02), 0 2px 4px rgba(0, 0, 0, .04)"],
  ["--mybricks-shadow-main-left", "-6px 0 18px rgba(0, 0, 0, 0.12), -1px 0 4px rgba(0, 0, 0, 0.08)"],
  ["--mybricks-shadow-for-border", "0 0 0 1px rgba(0, 0, 0, 0.08)"],
  ["--mybricks-border-color-main", "#D9D9D9"],
  ["--mybricks-border-color-secondary", "#EDEDED"],
  ["--chat-user-message-bg", "color-mix(in srgb, var(--mybricks-color-primary, #2563eb) 10%, var(--mybricks-bg-color-main, #fff))"],
  ["--chat-user-message-border-color", "transparent"],
  ["--chat-sender-border-radius", "24px"],
  ["--chat-message-group-padding", "8px 12px"]
] as const;

const CHAT_PANEL_SKIN_STYLE = Object.fromEntries(CHAT_PANEL_SKIN_VARIABLES) as React.CSSProperties;

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
        <span className="pg-fs-title">MemFS</span>
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
        <span className="pg-inspector-title">Request Inspector</span>
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

function AssertionPanel({
  activeCase,
  snapshots,
  agent,
  memFS,
}: {
  activeCase: TestCase | null;
  snapshots: RequestSnapshot[];
  agent: any;
  memFS: MemFS | null;
}) {
  const results = useMemo(() => {
    if (!activeCase?.assertions?.length) return [];
    return activeCase.assertions.map((assertion) => ({
      name: assertion.name,
      result: assertion.run({ snapshots, agent, memFS }),
    }));
  }, [activeCase, snapshots, agent, memFS]);

  if (results.length === 0) return null;

  return (
    <div className="pg-assertions">
      <span className="pg-assertions-label">自动断言</span>
      <div className="pg-assertions-list">
        {results.map(({ name, result }) => (
          <div
            key={name}
            className={`pg-assertion ${result == null ? "pending" : result.pass ? "pass" : "fail"}`}
            title={result?.message ?? "等待运行"}
          >
            <span className="pg-assertion-status">
              {result == null ? "WAIT" : result.pass ? "PASS" : "FAIL"}
            </span>
            <span className="pg-assertion-name">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const { mode, cycle: cycleTheme } = useTheme();
  const { disabled: chatDisabled, toggle: toggleDisabled } = useChatDisabled();
  const { width: panelWidth, toggle: togglePanelWidth } = usePanelWidth();

  // 从 URL 读取初始 case（?case=xxx）
  const initialCaseId = new URLSearchParams(window.location.search).get("case");
  const initialCase = ALL_CASES.find(c => c.id === initialCaseId) ?? ALL_CASES[0] ?? null;

  const [activeCase] = useState<TestCase | null>(initialCase);
  const [webFetchUrl, setWebFetchUrlState] = useState(() => getDefaultUrlForCase(initialCase?.id ?? ""));
  const isChatPanelSkinLayout = activeCase?.playgroundLayout === "chat-panel-skin";
  const isDefaultChatPanelSkin = activeCase?.chatPanelSkin === "default";

  const { wrappedRequest, snapshots } = useRequestInspector(
    isChatPanelSkinLayout ? null : activeCase?.request ?? null
  );

  const { agent, memFS } = usePlaygroundAgent(
    activeCase,
    isChatPanelSkinLayout ? null : wrappedRequest
  );

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
              title="Open settings"
            >
              Settings
            </button>
          )}
          <DisabledToggle disabled={chatDisabled} onToggle={toggleDisabled} />
          <PanelWidthToggle width={panelWidth} onToggle={togglePanelWidth} />
          <ThemeToggle mode={mode} onCycle={cycleTheme} />
        </div>
      </header>

      {/* Body: sidebar + main */}
      <div className="pg-body">
        {/* Case 侧边栏 */}
        <aside className="pg-sidebar">
          <div className="pg-sidebar-header">
            <span className="pg-sidebar-title">Test Cases</span>
            <span className="pg-case-count">{ALL_CASES.length}</span>
          </div>
          {/* WebFetch URL 输入框 */}
          {showWebFetchInput && (
            <div className="pg-webfetch-input-wrap">
              <label className="pg-webfetch-label">URL</label>
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
                  {GROUP_ICONS[group] ? GROUP_ICONS[group] + " " : ""}{group}
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
              <AssertionPanel activeCase={activeCase} snapshots={snapshots} agent={agent} memFS={memFS} />
              <button className="pg-reset-btn" onClick={handleReset}>Reset</button>
            </div>
          </div>
        )}

        {isChatPanelSkinLayout ? (
          <div className="pg-content pg-chat-skin-content">
            <div className="pg-chat-skin-aside">
              <div className="pg-chat-skin-card">
                <div className="pg-chat-skin-title">
                  {isDefaultChatPanelSkin ? "Default Skin" : "Large + Custom Variables"}
                </div>
                <div className="pg-chat-skin-desc">
                  {isDefaultChatPanelSkin
                    ? "这个 case 不传 className/style，只看 ChatPanel 默认 fallback 皮肤。"
                    : "这个 case 只预览 ChatPanel 的 large 模式 + 自定义变量：没有 Request Inspector，也没有 MemFS。"}
                </div>
                <div className="pg-chat-skin-props">
                  <span>header=false</span>
                  {isDefaultChatPanelSkin ? (
                    <>
                      <span>no className</span>
                      <span>no style variables</span>
                    </>
                  ) : (
                    <>
                      <span>size=large</span>
                      <span>messagesRenderVariant=line</span>
                      <span>className=pg-chat-panel-skin</span>
                      <span>style=custom variables</span>
                    </>
                  )}
                  {activeCase?.renderEmpty ? <span>renderEmpty</span> : <span>initialTurns with tools</span>}
                </div>
              </div>
              {!isDefaultChatPanelSkin && (
                <div className="pg-chat-skin-card">
                  <div className="pg-chat-skin-title">Injected Variables</div>
                  {CHAT_PANEL_SKIN_VARIABLES.map(([name, value]) => (
                    <div className="pg-chat-skin-var" key={name}>
                      <span style={{ background: value.startsWith("#") || value.startsWith("rgba") ? value : "#f8fafc" }} />
                      <span className="pg-chat-skin-var-name">{name}</span>
                      <span className="pg-chat-skin-var-value">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pg-chat-skin-preview">
              {agent ? (
                <ChatPanel
                  agent={agent as any}
                  header={false}
                  size={isDefaultChatPanelSkin ? undefined : "large"}
                  disabled={chatDisabled}
                  className={isDefaultChatPanelSkin ? undefined : "pg-chat-panel-skin"}
                  style={isDefaultChatPanelSkin ? undefined : CHAT_PANEL_SKIN_STYLE}
                  renderEmpty={activeCase?.renderEmpty}
                  scrollWithSender={activeCase?.scrollWithSender}
                  renderSenderFooter={activeCase?.renderSenderFooter}
                  messagesRenderVariant={activeCase?.messagesRenderVariant}
                  actionBar={["copy", "delete", "retry"]}
                  placeholder={isDefaultChatPanelSkin ? "输入一句话，继续检查默认皮肤下的 ChatPanel" : "输入一句话，继续检查 large + 自定义变量下的 ChatPanel"}
                  markdownSkin={isDefaultChatPanelSkin ? undefined : {
                    message: markdownSkinSpecial["pgMarkdownSkinSpecial"],
                    plan: markdownSkinSpecial["pgMarkdownSkinSpecial"],
                  }}
                />
              ) : (
                <div className="pg-loading">加载中…</div>
              )}
            </div>
          </div>
        ) : (
          <div className="pg-content">
            {/* ChatPanel 列 */}
            <div className="pg-chat-col" style={{ width: panelWidth }}>
              {agent ? (
                <ChatPanel agent={agent as any} title="playground" header={true} disabled={chatDisabled} renderEmpty={activeCase?.renderEmpty} historyCollapse={activeCase?.historyCollapse} selectorRenderInTop={activeCase?.selectorRenderInTop} />
              ) : (
                <div className="pg-loading">加载中…</div>
              )}
            </div>

            {/* 右侧：Inspector 上 + FS Viewer 下 */}
            <div className="pg-right-col">
              {activeCase?.renderRightPanelActions?.({ agent })}
              <InspectorPanel snapshots={snapshots} />
              <FSViewer memFS={memFS} />
            </div>
          </div>
        )}
      </main>
      </div>

    </div>
  );
}
