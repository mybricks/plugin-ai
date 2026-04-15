import type { Sandbox } from "@agent/code-agent";

export interface FsFile {
  path: string;
  content: string;
}

/**
 * 内存文件系统，实现 Sandbox 接口。
 * 每次 case 重置时 new 一个新实例（或传入预设文件）。
 * 所有读写操作都在内存中完成，无副作用。
 */
export class MemFS implements Sandbox {
  private files: Map<string, string>;

  constructor(initialFiles: FsFile[] = DEFAULT_FILES) {
    this.files = new Map(initialFiles.map((f) => [f.path, f.content]));
  }

  async getFiles(): Promise<FsFile[]> {
    return Array.from(this.files.entries()).map(([path, content]) => ({ path, content }));
  }

  async updateFiles(files: FsFile[]): Promise<void> {
    for (const f of files) {
      this.files.set(f.path, f.content);
    }
  }

  async deleteFiles(paths: string[]): Promise<void> {
    for (const p of paths) {
      this.files.delete(p);
    }
  }

  async getContext(): Promise<string | null> {
    return null;
  }

  /** 读取单个文件内容（供 Inspector 展示） */
  readFile(path: string): string | undefined {
    return this.files.get(path);
  }

  /** 获取所有文件列表（供 FSViewer 展示） */
  snapshot(): FsFile[] {
    return Array.from(this.files.entries()).map(([path, content]) => ({ path, content }));
  }
}

// ─── 默认预设文件 ─────────────────────────────────────────────────────────────

export const DEFAULT_FILES: FsFile[] = [
  {
    path: "src/App.tsx",
    content: `import React from 'react';
import { Button } from './components/Button';

export default function App() {
  return (
    <div className="app">
      <h1>Hello World</h1>
      <Button label="Click me" onClick={() => alert('clicked')} />
    </div>
  );
}`,
  },
  {
    path: "src/components/Button.tsx",
    content: `import React from 'react';

interface ButtonProps {
  label: string;
  onClick?: () => void;
}

export function Button({ label, onClick }: ButtonProps) {
  return (
    <button className="btn" onClick={onClick}>
      {label}
    </button>
  );
}`,
  },
  {
    path: "src/index.ts",
    content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
  },
  {
    path: "src/styles/global.css",
    content: `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.app {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid #d0d5dd;
  background: #fff;
  cursor: pointer;
  font-size: 14px;
}

.btn:hover {
  background: #f5f5ff;
  border-color: #6366f1;
  color: #6366f1;
}`,
  },
  {
    path: "package.json",
    content: `{
  "name": "my-app",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vite": "^5.4.0"
  }
}`,
  },
];
