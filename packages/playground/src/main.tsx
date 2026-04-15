import React from "react";
import ReactDOM from "react-dom/client";
import { context } from "@plugin/context";
import App from "./App";

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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
