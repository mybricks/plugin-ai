import type { History, SubAgentTurnRecord, TurnRecord } from "../types";

/** 子 turn 与主 turn 共用同一个底层 History key，通过 parentTurnId 区分。 */
export function isChildTurn(turn: TurnRecord): turn is SubAgentTurnRecord {
  return typeof (turn as Partial<SubAgentTurnRecord>).parentTurnId === "string";
}

const views = new WeakMap<History, TurnsManager>();
const managers = new WeakMap<History, Map<string, TurnsManager>>();

/**
 * 统一管理同一会话的主、子 turn 视图及写队列。底层 History 可以忽略 key，
 * 视图只使用父 key，并在分页前过滤，避免子 turn 占用主会话页大小。
 */
export class TurnsManager {
  private queue: Promise<void> = Promise.resolve();
  private readonly pending = new Map<string, TurnRecord>();
  readonly main: History;

  constructor(private readonly history: History, private readonly key: string) {
    this.main = this.createView();
  }

  private write<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work, work);
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  private async all(): Promise<TurnRecord[]> {
    const persisted = await this.history.load(this.key);
    const merged = new Map(persisted.map(turn => [turn.id, turn]));
    for (const [id, turn] of this.pending) merged.set(id, turn);
    return [...merged.values()];
  }

  async children(agentKey?: string): Promise<SubAgentTurnRecord[]> {
    return (await this.all()).filter(isChildTurn).filter(turn => !agentKey || turn.agentKey === agentKey);
  }

  child(record: SubAgentTurnRecord): History {
    return this.createView(record);
  }

  async reserveChild(record: SubAgentTurnRecord): Promise<void> {
    await this.child(record).append(record.agentKey, record);
  }

  private createView(child?: SubAgentTurnRecord): History {
    const matches = (turn: TurnRecord) => child ? isChildTurn(turn) && turn.agentKey === child.agentKey : !isChildTurn(turn);
    const manager = this;
    const overrides: Partial<History> = {
      persistMode: child ? "iter" : this.history.persistMode,
      async load() {
        return (await manager.all()).filter(turn => matches(turn) && (!child || turn.id !== child.id));
      },
      async loadTurns(_key, options) {
        if (manager.history.loadTurns && !options.after && options.limit !== undefined) {
          const selected: TurnRecord[] = [];
          let before = options.before;
          let hasMore = false;
          for (;;) {
            const page = await manager.history.loadTurns(manager.key, { before, limit: Math.max(options.limit, 20) });
            selected.unshift(...page.turns.filter(matches));
            hasMore = page.hasMore;
            if (selected.length > options.limit || !page.hasMore || page.turns.length === 0) break;
            const next = page.turns[0].id;
            if (next === before) break;
            before = next;
          }
          if (selected.length > options.limit) {
            return { turns: selected.slice(-options.limit), hasMore: true };
          }
          return { turns: selected, hasMore };
        }
        const turns = (await manager.all()).filter(matches);
        let result = turns;
        let hasMore = false;
        if (options.after) {
          const index = turns.findIndex(turn => turn.id === options.after);
          if (index < 0) return { turns: [], hasMore: false };
          result = turns.slice(index + 1);
          hasMore = index > 0;
        } else if (options.before) {
          const index = turns.findIndex(turn => turn.id === options.before);
          if (index < 0) return { turns: [], hasMore: false };
          result = turns.slice(0, index);
        }
        if (options.limit !== undefined && result.length > options.limit) {
          hasMore = true;
          result = result.slice(-options.limit);
        }
        return { turns: result, hasMore };
      },
      async append(_key, turn) {
        const saved = child ? { ...turn, agentKey: child.agentKey, parentAgentKey: child.parentAgentKey, parentTurnId: child.parentTurnId, callId: child.callId, subAgentType: child.subAgentType, title: child.title, async: child.async, startTime: child.startTime } : turn;
        await manager.write(async () => {
          if (child && manager.pending.has(saved.id)) await manager.history.update(manager.key, saved.id, saved);
          else await manager.history.append(manager.key, saved);
          manager.pending.set(saved.id, structuredClone(saved));
        });
      },
      async update(_key, id, patch) {
        await manager.write(async () => {
          const saved = child && id === child.id ? { ...patch, startTime: child.startTime } : patch;
          await manager.history.update(manager.key, id, saved);
          const current = manager.pending.get(id);
          if (current) manager.pending.set(id, { ...current, ...structuredClone(saved) });
        });
      },
    };
    if (!this.history.loadTurns) delete overrides.loadTurns;
    if (child) {
      overrides.loadCompact = async () => null;
      overrides.saveCompact = async () => {};
      overrides.clear = async () => { throw new Error("Cannot clear shared history through a child view"); };
      overrides.import = async () => { throw new Error("Cannot import shared history through a child view"); };
    } else {
      overrides.clear = async () => manager.write(async () => { await manager.history.clear(manager.key); manager.pending.clear(); });
      overrides.import = async (_key, turns) => manager.write(async () => { await manager.history.import(manager.key, turns); manager.pending.clear(); });
    }
    const view = new Proxy(this.history, {
      get(target, property) {
        if (property in overrides) return Reflect.get(overrides, property);
        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    views.set(view, this);
    return view;
  }
}

export function getTurnsManager(history: History, key: string): TurnsManager {
  const existing = views.get(history);
  if (existing) return existing;
  let byKey = managers.get(history);
  if (!byKey) { byKey = new Map(); managers.set(history, byKey); }
  let manager = byKey.get(key);
  if (!manager) { manager = new TurnsManager(history, key); byKey.set(key, manager); }
  return manager;
}

export function isTurnsView(history: History): boolean {
  return views.has(history);
}
