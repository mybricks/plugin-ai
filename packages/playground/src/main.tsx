import React from "react";
import ReactDOM from "react-dom/client";
import { context } from "@plugin/context";
import App from "./App";
import { applyPlaygroundLocale, getPlaygroundLocale } from "./locale";

// `lang` in the URL is the playground-wide source of truth. Set it before any
// plugin UI is rendered so every panel reads the same language.
applyPlaygroundLocale(getPlaygroundLocale());

// 初始化 context（让 ChatPanel 能运行）
context.name = "playground";
context.setPluginKey("playground");
context.pluginParams = {
  onUpload: async () => "https://placeholder.example.com/image.png",
  onDownload: ({ name, content }: { name: string; content: string }) => {
    const a = document.createElement("a");
    a.download = name;
    a.href = URL.createObjectURL(new Blob([content]));
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },
};

const suite = new URLSearchParams(window.location.search).get("suite") ?? "local";
void (suite === "http" ? import("./http-agent-cases").then(m => m.HTTP_PLAYGROUND_CASES) : import("./cases").then(m => m.ALL_CASES))
  .then(cases => ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode><App cases={cases} suite={suite === "http" ? "http" : "local"} /></React.StrictMode>
  ));
