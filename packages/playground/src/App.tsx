import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import JsonView from "@microlink/react-json-view";
import { ChatPanel } from "@plugin/ui/chat/chat-panel";
import type { ChatPanelRef } from "@plugin/ui/chat/chat-panel";
import { openSetting } from "@plugin/ui/setting";
import type { TestCase } from "./cases/types";
import { usePlaygroundAgent } from "./lib/use-playground-agent";
import { useHttpAgent } from "./lib/use-http-agent";
import { LOCAL_CATEGORIES, caseCategory } from "./case-categories";
import type { HttpCall } from "./http-agent-mock";
import { useRequestInspector, type RequestSnapshot } from "./lib/use-request-inspector";
import type { MemFS } from "./lib/mem-fs";
import { getWebFetchUrl, setWebFetchUrl, getDefaultUrlForCase } from "./lib/web-fetch-state";
import { ToolContractLab } from "./tool-contract-lab";
import { getPlaygroundLocale, navigateToPlaygroundLocale, type PlaygroundLocale } from "./locale";
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

function LocaleToggle() {
  const locale = getPlaygroundLocale();

  return (
    <label className="pg-locale-toggle">
      <span className="pg-sr-only">Language</span>
      <select
        aria-label="Language"
        value={locale}
        onChange={(event) => navigateToPlaygroundLocale(event.target.value as PlaygroundLocale)}
      >
        <option value="zh">中文</option>
        <option value="en">English</option>
      </select>
    </label>
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

// ─── Group Tool Calls Toggle ────────────────────────────────────────────────────

const GROUP_TOOL_CALLS_KEY = "pg-group-tool-calls";

function useGroupToolCalls() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(GROUP_TOOL_CALLS_KEY) === "1");

  const toggle = useCallback(() => {
    setEnabled((v) => {
      const next = !v;
      localStorage.setItem(GROUP_TOOL_CALLS_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  return { enabled, toggle };
}

function GroupToolCallsToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      className={`pg-disabled-toggle${enabled ? " active" : ""}`}
      onClick={onToggle}
      title={enabled ? "已开启：连续工具调用会聚合折叠展示（对所有 case 生效）" : "已关闭：工具调用逐条展示"}
    >
      <span className="pg-disabled-label">Group</span>
      <span className="pg-disabled-state">{enabled ? "ON" : "OFF"}</span>
    </button>
  );
}

function groupCases(cases: TestCase[]): Record<string, TestCase[]> {
  return cases.reduce((groups, item) => {
    (groups[item.group] ??= []).push(item);
    return groups;
  }, {} as Record<string, TestCase[]>);
}
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

function InspectorPanel({ snapshots, httpCalls }: { snapshots: RequestSnapshot[]; httpCalls?: HttpCall[] }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const entries = useMemo(() => httpCalls
    ? httpCalls.filter(call => /\/(run|retry|abort)$/.test(call.path)).map((call, index) => ({
        index: index + 1,
        timestamp: call.timestamp,
        label: `${call.method} ${call.path.replace(/^\/__http_agent_playground__/, "")}`,
        detail: "HTTP",
        data: { method: call.method, path: call.path.replace(/^\/__http_agent_playground__/, ""), body: call.body },
      }))
    : snapshots.map(snapshot => ({
        index: snapshot.index,
        timestamp: snapshot.timestamp,
        label: `Step ${snapshot.index}`,
        detail: `${snapshot.params.messages?.length ?? 0} msgs`,
        data: snapshot.params,
        tools: snapshot.params.tools?.length ?? 0,
      })), [snapshots, httpCalls]);

  useEffect(() => {
    if (entries.length > 0) setActiveIdx(entries.length - 1);
    else setActiveIdx(null);
  }, [entries.length]);

  const active = activeIdx !== null ? entries[activeIdx] : null;

  return (
    <div className="pg-inspector">
      <div className="pg-inspector-header">
        <span className="pg-inspector-title">Request Inspector</span>
        <span className="pg-case-count">{entries.length} calls</span>
      </div>

      {entries.length === 0 ? (
        <div className="pg-inspector-empty">
          {httpCalls ? <>发送消息后，HTTP 请求的<br />完整参数会显示在这里</> : <>发送消息后，每次 LLM 请求的<br />完整参数会显示在这里</>}
        </div>
      ) : (
        <>
          <div className="pg-inspector-tabs">
            {entries.map((s, i) => (
              <button
                key={i}
                className={`pg-inspector-tab${activeIdx === i ? " active" : ""}`}
                onClick={() => setActiveIdx(i)}
              >
                <span className="pg-tab-step">{s.label}</span>
                <span className="pg-tab-count">
                  {s.detail}
                </span>
              </button>
            ))}
          </div>

          {active && (
            <div className="pg-inspector-body">
              <div className="pg-inspector-meta">
                <span>{active.label}</span>
                <span>{active.detail}</span>
                {'tools' in active && active.tools > 0 && (
                  <span>{active.tools} tools</span>
                )}
                <span className="pg-meta-time">
                  {new Date(active.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <div className="pg-json-wrap">
                <JsonView
                  src={active.data}
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

export default function App({ cases, suite }: { cases: TestCase[]; suite: "local" | "http" }) {
  const { mode, cycle: cycleTheme } = useTheme();
  const { disabled: chatDisabled, toggle: toggleDisabled } = useChatDisabled();
  const { width: panelWidth, toggle: togglePanelWidth } = usePanelWidth();
  const { enabled: groupToolCallsEnabled, toggle: toggleGroupToolCalls } = useGroupToolCalls();
  const chatPanelRef = useRef<ChatPanelRef | null>(null);

  // 从 URL 读取初始 case（?case=xxx）
  const params = new URLSearchParams(window.location.search);
  const selectedGroup = suite === "local" ? params.get("group") ?? "" : "";
  const categoryParam = params.get("category") ?? "";
  const selectedCategory = LOCAL_CATEGORIES.some(category => category.id === categoryParam) ? categoryParam : "";
  const visibleCases = selectedGroup
    ? cases.filter(c => c.group === selectedGroup)
    : suite === "local" && selectedCategory
      ? cases.filter(c => caseCategory(c) === selectedCategory)
      : cases;
  const initialCaseId = params.get("case");
  const initialCase = visibleCases.find(c => c.id === initialCaseId) ?? visibleCases[0] ?? null;
  const caseGroups = groupCases([...visibleCases].sort((a, b) => Number(b.priority === "P0") - Number(a.priority === "P0")));

  const [activeCase] = useState<TestCase | null>(initialCase);
  const [webFetchUrl, setWebFetchUrlState] = useState(() => getDefaultUrlForCase(initialCase?.id ?? ""));
  const isChatPanelSkinLayout = activeCase?.playgroundLayout === "chat-panel-skin";
  const isToolContractLayout = activeCase?.playgroundLayout === "tool-contract";
  const isDefaultChatPanelSkin = activeCase?.chatPanelSkin === "default";

  const { wrappedRequest, snapshots } = useRequestInspector(
    isChatPanelSkinLayout || isToolContractLayout || suite === "http" ? null : activeCase?.request ?? null
  );

  const { agent: localAgent, memFS } = usePlaygroundAgent(
    isToolContractLayout || suite === "http" ? null : activeCase,
    isChatPanelSkinLayout ? null : wrappedRequest
  );
  const { agent: httpAgent, calls: httpCalls } = useHttpAgent(activeCase?.httpScenario);
  const agent = suite === "http" ? httpAgent : localAgent;

  const selectSuite = useCallback((value: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("suite", value === "http" ? "http" : "local");
    url.searchParams.delete("case");
    url.searchParams.delete("group");
    url.searchParams.delete("category");
    if (value.startsWith("category:")) url.searchParams.set("category", value.slice(9));
    window.location.href = url.toString();
  }, []);

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
          <GroupToolCallsToggle enabled={groupToolCallsEnabled} onToggle={toggleGroupToolCalls} />
          <ThemeToggle mode={mode} onCycle={cycleTheme} />
          <LocaleToggle />
        </div>
      </header>

      {/* Body: sidebar + main */}
      <div className="pg-body">
        {/* Case 侧边栏 */}
        <aside className="pg-sidebar">
          <div className="pg-sidebar-header">
            <span className="pg-sidebar-title">Test Cases</span>
            <span className="pg-case-count">{visibleCases.length}</span>
          </div>
          <label className="pg-suite-select">测试集
            <select aria-label="测试集" value={suite === "http" ? "http" : selectedCategory ? `category:${selectedCategory}` : "local"} onChange={event => selectSuite(event.target.value)}>
              <option value="local">全部本地用例</option>
              {LOCAL_CATEGORIES.map(category => <option key={category.id} value={`category:${category.id}`}>{category.label}</option>)}
              <option value="http">HTTP Agent</option>
            </select>
          </label>
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
            {Object.entries(caseGroups).map(([group, cases]) => (
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

        {isToolContractLayout ? (
          <div className="pg-content"><ToolContractLab initialFiles={activeCase?.initialFiles ?? []} /></div>
        ) : isChatPanelSkinLayout ? (
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
                  groupToolCalls={groupToolCallsEnabled || activeCase?.groupToolCalls}
                  markdownit={activeCase?.markdownit}
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
                <ChatPanel ref={chatPanelRef} agent={agent as any} toolUI={activeCase?.toolUI} title="playground" header={true} disabled={chatDisabled} renderEmpty={activeCase?.renderEmpty} renderFocus={activeCase?.renderFocus} historyCollapse={activeCase?.historyCollapse} selectorRenderInTop={activeCase?.selectorRenderInTop} attachProcessors={activeCase?.attachProcessors} mentions={activeCase?.mentions} renderAttachmentSuffix={activeCase?.renderAttachmentSuffix} actionBar={activeCase?.actionBar} messagesRenderVariant={activeCase?.messagesRenderVariant} groupToolCalls={groupToolCallsEnabled || activeCase?.groupToolCalls} />
              ) : (
                <div className="pg-loading">加载中…</div>
              )}
            </div>

            {/* 右侧：Inspector 上 + FS Viewer 下 */}
            <div className="pg-right-col">
              {activeCase?.renderRightPanelActions?.({
                agent: localAgent,
                appendInput: (input) => chatPanelRef.current?.appendInput(input),
              })}
              <InspectorPanel snapshots={snapshots} httpCalls={suite === "http" ? httpCalls : undefined} />
              {suite !== "http" && <FSViewer memFS={memFS} />}
            </div>
          </div>
        )}
      </main>
      </div>

    </div>
  );
}
