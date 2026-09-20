const FULLSCREEN_ICON =
  `<svg viewBox="0 0 1024 1024" width="14" height="14"><path fill="currentColor" d="M136 384h56a8 8 0 0 0 8-8V200h176a8 8 0 0 0 8-8v-56a8 8 0 0 0-8-8H120a8 8 0 0 0-8 8v240a8 8 0 0 0 8 8zM888 640h-56a8 8 0 0 0-8 8v176H648a8 8 0 0 0-8 8v56a8 8 0 0 0 8 8h240a8 8 0 0 0 8-8V648a8 8 0 0 0-8-8zM384 824H200V648a8 8 0 0 0-8-8h-56a8 8 0 0 0-8 8v240a8 8 0 0 0 8 8h240a8 8 0 0 0 8-8v-56a8 8 0 0 0-8-8zM648 200h176v176a8 8 0 0 0 8 8h56a8 8 0 0 0 8-8V136a8 8 0 0 0-8-8H648a8 8 0 0 0-8 8v56a8 8 0 0 0 8 8z"/></svg>`;

const CLOSE_ICON =
  `<svg viewBox="0 0 1024 1024" width="14" height="14"><path fill="currentColor" d="M557.312 513.248l265.28-263.904c12.544-12.48 12.608-32.704 0.128-45.248-12.512-12.576-32.704-12.608-45.248-0.128L512.128 467.904 246.944 203.936c-12.48-12.544-32.704-12.608-45.248-0.128-12.576 12.512-12.608 32.704-0.128 45.248l265.216 263.84L201.6 776.8c-12.544 12.48-12.608 32.704-0.128 45.248 6.24 6.272 14.464 9.44 22.688 9.44 8.16 0 16.32-3.104 22.56-9.312l265.216-263.872 265.152 263.872c6.24 6.208 14.4 9.312 22.56 9.312 8.224 0 16.448-3.168 22.688-9.44 12.48-12.544 12.416-32.768-0.128-45.248L557.312 513.248z"/></svg>`;

/**
 * 点击 mermaid 图表右上角的全屏按钮，展示一个放大后的 SVG 弹层。
 * 视觉/交互上对齐 components/modal 的 Modal 组件（遮罩、圆角卡片、Esc/点击遮罩关闭），
 * 但用纯 DOM 实现，避免在工具函数里额外挂载一棵独立的 React 子树。
 * 被 renderMermaidInContainer 内部注入的按钮复用。
 */
function openMermaidFullscreen(svg: SVGElement, darkMode: boolean): void {
  const mask = document.createElement("div");
  mask.className = "mermaid-fullscreen-mask";

  const box = document.createElement("div");
  box.className = darkMode ? "mermaid-fullscreen-box mermaid-fullscreen-box-dark" : "mermaid-fullscreen-box";

  const header = document.createElement("div");
  header.className = "mermaid-fullscreen-header";
  header.innerHTML = `<div class="mermaid-fullscreen-title">流程图</div><div class="mermaid-fullscreen-close" title="关闭">${CLOSE_ICON}</div>`;

  const body = document.createElement("div");
  body.className = "mermaid-fullscreen-body";
  body.appendChild(svg.cloneNode(true));

  box.appendChild(header);
  box.appendChild(body);
  mask.appendChild(box);

  const close = () => {
    mask.remove();
    document.removeEventListener("keydown", onKeydown);
  };
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };

  mask.addEventListener("click", close);
  box.addEventListener("click", (e) => e.stopPropagation());
  header.querySelector(".mermaid-fullscreen-close")?.addEventListener("click", close);
  document.addEventListener("keydown", onKeydown);

  document.body.appendChild(mask);
}

/**
 * 扫描 DOM 中的 mermaid 代码块并原地渲染为 SVG 图表，同时挂载右上角全屏按钮。
 * 被 MarkdownMessage 和 PrdRender 共用。
 */
export async function renderMermaidInContainer(
  container: HTMLElement,
  options?: { darkMode?: boolean }
): Promise<void> {
  const mermaid = (window as any).mermaid;
  if (!mermaid) return;

  const codeBlocks = container.querySelectorAll<HTMLElement>("code.language-mermaid");
  if (!codeBlocks.length) return;

  const darkMode = options?.darkMode ?? false;

  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    themeVariables: darkMode
      ? {
          primaryColor: "#1f1f1f",
          primaryTextColor: "#e0e0e0",
          primaryBorderColor: "#e0e0e0",
          lineColor: "#e0e0e0",
          secondaryColor: "#2a2a2a",
          tertiaryColor: "#2a2a2a",
          edgeLabelBackground: "#1f1f1f",
          textColor: "#e0e0e0",
          mainBkg: "#1a1a1a",
          nodeBorder: "#e0e0e0",
          clusterBkg: "#2a2a2a",
          clusterBorder: "#e0e0e0",
        }
      : {
          primaryColor: "#f6f8fa",
          primaryTextColor: "#333",
          primaryBorderColor: "#333",
          lineColor: "#333",
          secondaryColor: "#f6f8fa",
          tertiaryColor: "#f6f8fa",
          edgeLabelBackground: "#f6f8fa",
          textColor: "#333",
          mainBkg: "#fff",
          nodeBorder: "#333",
          clusterBkg: "#f6f8fa",
          clusterBorder: "#333",
        },
  });

  const jobs = Array.from(codeBlocks).map(async (codeEl, index) => {
    const graphDefinition = codeEl.textContent || "";
    const pre = codeEl.parentElement;
    if (!pre) return;

    try {
      const id = `mermaid-diagram-${Date.now()}-${index}`;
      const { svg } = await mermaid.render(id, graphDefinition);
      const wrapper = document.createElement("div");
      wrapper.className = "mermaid-diagram";
      wrapper.innerHTML = svg;

      const svgEl = wrapper.querySelector("svg");
      if (svgEl) {
        wrapper.classList.add("mermaid-diagram-clickable");
        wrapper.title = "点击全屏查看";
        wrapper.addEventListener("click", () => {
          openMermaidFullscreen(svgEl, darkMode);
        });

        const fullscreenBtn = document.createElement("div");
        fullscreenBtn.className = "mermaid-diagram-fullscreen-btn";
        fullscreenBtn.title = "全屏查看";
        fullscreenBtn.innerHTML = FULLSCREEN_ICON;
        fullscreenBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openMermaidFullscreen(svgEl, darkMode);
        });
        wrapper.appendChild(fullscreenBtn);
      }

      pre.replaceWith(wrapper);
    } catch {
      // 渲染失败时保留原始代码块
    }
  });

  await Promise.all(jobs);
}
