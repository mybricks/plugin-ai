function getStorage(): Storage | undefined {
  if (typeof localStorage === "undefined") return undefined;
  return localStorage;
}

export const kv = {
  get<T = unknown>(key: string): T | undefined {
    const storage = getStorage();
    if (!storage) return undefined;

    try {
      const raw = storage.getItem(key);
      return raw === null ? undefined : JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  },

  set<T = unknown>(key: string, value: T): void {
    const storage = getStorage();
    if (!storage) return;

    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage quota / privacy mode failures.
    }
  },

  remove(key: string): void {
    const storage = getStorage();
    if (!storage) return;

    try {
      storage.removeItem(key);
    } catch {
      // Ignore storage access failures.
    }
  },
};
