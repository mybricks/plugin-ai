const DB_NAME = "@mybricks/plugin-ai/showcase/designs";
const STORE_NAME = "dumps";

type DumpRecord = { id: string; dump: unknown; updatedAt: number };
export type DumpSummary = Pick<DumpRecord, "id" | "updatedAt">;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadDump(id: string): Promise<unknown | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as DumpRecord | undefined)?.dump ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDump(id: string, dump: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({
      id,
      dump,
      updatedAt: Date.now()
    } satisfies DumpRecord);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function listDumps(): Promise<DumpSummary[]> {
  const db = await openDB();
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

export async function deleteDump(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
