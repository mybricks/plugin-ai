export class PluginAIKVStore {
  private namespace = "default";

  setNamespace(namespace: string) {
    this.namespace = namespace || "default";
  }

  get<T = unknown>(key: string): T | undefined {
    const raw = this.getRaw(key);
    if (raw === undefined) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  set<T = unknown>(key: string, value: T): void {
    this.setRaw(key, JSON.stringify(value));
  }

  getRaw(key: string): string | undefined {
    const storage = getStorage();
    if (!storage) return undefined;
    try {
      return storage.getItem(this.storageKey(key)) ?? undefined;
    } catch {
      return undefined;
    }
  }

  setRaw(key: string, value: string): void {
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.setItem(this.storageKey(key), value);
    } catch {
      // Ignore storage quota / privacy mode failures.
    }
  }

  remove(key: string): void {
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.removeItem(this.storageKey(key));
    } catch {
      // Ignore storage access failures.
    }
  }

  private storageKey(key: string): string {
    return `plugin-ai:${this.namespace}:${key}`;
  }
}

function getStorage(): Storage | undefined {
  if (typeof localStorage === "undefined") return undefined;
  return localStorage;
}
