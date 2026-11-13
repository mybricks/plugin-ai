import { sanitizeForIndexedDB } from "./sanitize-for-indexeddb";

const DB_NAME = "@mybricks/plugin-ai/showcase/designs";
const STORE_NAME = "dumps";
export type LocalScenario = "local" | "task" | "task-overview" | "audit" | "mcp";

type DumpRecord = { id: string; dump: unknown; updatedAt: number };
export type DumpSummary = Pick<DumpRecord, "id" | "updatedAt">;
export type StorageSource = "indexeddb" | "file";

async function fileRequest(scenario: LocalScenario, id?: string, options?: RequestInit): Promise<Response> {
  const query = new URLSearchParams({ scene: scenario });
  if (id !== undefined) query.set("id", id);
  const response = await fetch(`/__showcase/ui?${query}`, options);
  if (!response.ok) throw new Error(response.status === 409 ? "本地文件已存在" : `本地文件操作失败 (${response.status})`);
  return response;
}

export async function listFileDumps(scenario: LocalScenario): Promise<DumpSummary[]> {
  return (await fileRequest(scenario)).json();
}

export async function loadFileDump(id: string, scenario: LocalScenario): Promise<unknown | null> {
  const query = new URLSearchParams({ scene: scenario, id });
  const response = await fetch(`/__showcase/ui?${query}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`读取本地文件失败 (${response.status})`);
  return response.json();
}

export async function saveFileDump(id: string, dump: unknown, scenario: LocalScenario, overwrite = true): Promise<void> {
  const body = JSON.stringify(sanitizeForIndexedDB(dump), null, 2);
  if (!body) throw new Error("设计数据无法序列化");
  await fileRequest(scenario, id, { method: "PUT", headers: { "Content-Type": "application/json", ...(overwrite ? {} : { "If-None-Match": "*" }) }, body });
}

export async function deleteFileDump(id: string, scenario: LocalScenario): Promise<void> {
  await fileRequest(scenario, id, { method: "DELETE" });
}

function openDB(scenario: LocalScenario = "local"): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(scenario === "local" ? DB_NAME : `${DB_NAME}/${scenario}`, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadDump(id: string, scenario: LocalScenario = "local"): Promise<unknown | null> {
  const db = await openDB(scenario);
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as DumpRecord | undefined)?.dump ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDump(id: string, dump: unknown, scenario: LocalScenario = "local"): Promise<void> {
  const filteredDump = sanitizeForIndexedDB(dump);
  const db = await openDB(scenario);
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({
      id,
      dump: filteredDump,
      updatedAt: Date.now()
    } satisfies DumpRecord);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function listDumps(scenario: LocalScenario = "local"): Promise<DumpSummary[]> {
  const db = await openDB(scenario);
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(
      (request.result as DumpRecord[])
        .map(({ id, updatedAt }) => ({ id, updatedAt }))
        .sort((left, right) => right.updatedAt - left.updatedAt)
    );
    request.onerror = () => reject(request.error);
  });
}

export async function deleteDump(id: string, scenario: LocalScenario = "local"): Promise<void> {
  const db = await openDB(scenario);
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
