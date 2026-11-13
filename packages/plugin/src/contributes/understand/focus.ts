import type { SenderRef } from "../../ui/components/sender";

type Entry = { target?: SenderRef; request?: object; checking?: boolean };

/** Coordinate the designer's loaded callback with the Sender's mount. */
export function createSenderFocus(hasDiagram: (id: string) => Promise<boolean>) {
  const entries = new Map<string, Entry>();
  const getEntry = (id: string) => {
    let entry = entries.get(id);
    if (!entry) entries.set(id, entry = {});
    return entry;
  };
  const clean = (id: string, entry: Entry) => {
    if (!entry.target && !entry.request && !entry.checking && entries.get(id) === entry) entries.delete(id);
  };
  const tryFocus = async (id: string, entry: Entry) => {
    const { target, request } = entry;
    if (!target || !request || entry.checking) return;
    entry.checking = true;
    try {
      const exists = await hasDiagram(id);
      if (entry.request === request && entry.target === target && !exists && target.canAppendInput()) target.focus();
    } catch {
      // A failed read cannot establish that the diagram is empty.
    } finally {
      entry.checking = false;
      if (entry.request === request && entry.target === target) entry.request = undefined;
      if (entry.request && entry.target) void tryFocus(id, entry);
      clean(id, entry);
    }
  };
  return {
    register(id: string, target: SenderRef) {
      const entry = getEntry(id);
      entry.target = target;
      void tryFocus(id, entry);
      return () => { if (entry.target === target) entry.target = undefined; clean(id, entry); };
    },
    loaded({ id }: { id: string }) {
      const entry = getEntry(id);
      const request = entry.request = {};
      void tryFocus(id, entry);
      return () => { if (entry.request === request) entry.request = undefined; clean(id, entry); };
    },
  };
}
