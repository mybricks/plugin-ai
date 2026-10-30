import type { RemoteAgentEvent } from "./http-agent";

interface ReplayCallbacks {
  onEvent: (event: RemoteAgentEvent) => void;
  onError: (error: Event | Error) => void;
  onClose: () => void;
  onIdle: () => void;
}

interface RecoveryDependencies {
  finalizeRejectedTurn: (turnId: string) => Promise<void>;
  loadHistory: () => Promise<void>;
  resetState: () => void;
  waitInitialized: () => Promise<void>;
  subscribe: (callbacks: ReplayCallbacks) => () => void;
  onEvent: (event: RemoteAgentEvent) => void;
  onError: (error: Event | Error) => void;
  onClose: (terminalSeen: boolean, terminalTurnId: string | null) => void;
  onIdle: () => void;
}

/** Owns the replay subscription and serializes refresh-like session recovery. */
export function createRemoteSessionRecovery(deps: RecoveryDependencies) {
  let version = 0;
  let stopReplay: (() => void) | undefined;
  let pending: Promise<void> | undefined;

  function openReplay(): void {
    const current = ++version;
    stopReplay?.();
    let terminalSeen = false;
    let terminalTurnId: string | null = null;
    stopReplay = deps.subscribe({
      onEvent(event) {
        if (current !== version) return;
        if (["turn:complete", "turn:abort", "turn:error"].includes(event.event)) {
          terminalSeen = true;
          terminalTurnId = typeof event.data?.turnId === "string" ? event.data.turnId : event.turnId ?? null;
        }
        if (event.event === "turn:resume" || event.event === "turn:start") {
          terminalSeen = false;
          terminalTurnId = null;
        }
        deps.onEvent(event);
      },
      onError(error) { if (current === version) deps.onError(error); },
      onClose() {
        if (current !== version) return;
        stopReplay = undefined;
        deps.onClose(terminalSeen, terminalTurnId);
      },
      onIdle() { if (current === version) deps.onIdle(); },
    });
  }

  function startReplay(): void {
    if (!pending) openReplay();
  }

  async function recover(turnId: string): Promise<void> {
    if (pending) return pending;
    const recovery = (async () => {
      await deps.finalizeRejectedTurn(turnId);
      ++version;
      stopReplay?.();
      stopReplay = undefined;
      await deps.loadHistory();
      deps.resetState();
      await deps.waitInitialized();
      openReplay();
    })();
    pending = recovery;
    try { await recovery; }
    finally { if (pending === recovery) pending = undefined; }
  }

  return { startReplay, recover };
}
