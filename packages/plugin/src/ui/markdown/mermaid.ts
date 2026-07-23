/**
 * 扫描 DOM 中的 mermaid 代码块并原地渲染为 SVG 图表。
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
      pre.replaceWith(wrapper);
    } catch {
      // 渲染失败时保留原始代码块
    }
  });

  await Promise.all(jobs);
}
