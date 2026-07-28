import { io, type Socket } from "socket.io-client";

export interface WorkspaceJoinResponse<TChange = unknown> {
  ok?: boolean;
  error?: string;
  currentVersion?: number;
  snapshotRequired?: boolean;
  changes?: TChange[];
}

type WorkspaceJoinListener<TChange> = (
  response: WorkspaceJoinResponse<TChange>,
) => void | Promise<void>;

export class WorkspaceSocket<TChange = unknown> {
  private socket?: Socket;
  private connectionPromise?: Promise<void>;
  private readonly joinListeners = new Set<WorkspaceJoinListener<TChange>>();
  private readonly disconnectListeners = new Set<() => void>();
  private readonly eventListeners = new Map<
    string,
    Set<(payload: any) => void>
  >();

  constructor(
    private readonly options: {
      origin: string;
      workspaceId: string;
      getVersion: () => number;
    },
  ) {}

  get connected(): boolean {
    return !!this.socket?.connected;
  }

  onJoin(listener: WorkspaceJoinListener<TChange>): () => void {
    this.joinListeners.add(listener);
    return () => this.joinListeners.delete(listener);
  }

  onDisconnect(listener: () => void): () => void {
    this.disconnectListeners.add(listener);
    return () => this.disconnectListeners.delete(listener);
  }

  on<T>(event: string, listener: (payload: T) => void): () => void {
    let listeners = this.eventListeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this.eventListeners.set(event, listeners);
    }
    listeners.add(listener as (payload: any) => void);
    return () => {
      listeners?.delete(listener as (payload: any) => void);
      if (!listeners?.size) this.eventListeners.delete(event);
    };
  }

  emit(event: string, payload: unknown): void {
    this.socket?.emit(event, payload);
  }

  async connect(): Promise<void> {
    if (!this.socket) this.createSocket();
    if (!this.socket?.connected) this.socket?.connect();
    await this.connectionPromise;
  }

  disconnect(): void {
    const socket = this.socket;
    if (!socket) return;
    socket.emit("workspace:leave", {
      workspaceId: this.options.workspaceId,
    });
    socket.disconnect();
    this.resolveInitialConnection();
    this.socket = undefined;
    this.connectionPromise = undefined;
  }

  private createSocket(): void {
    const socket = io(`${this.options.origin}/ws`, {
      transports: ["websocket"],
      reconnection: true,
      autoConnect: false,
    });
    this.socket = socket;
    console.info("[plugin-ai][ws] socket created", {
      workspaceId: this.options.workspaceId,
      namespace: socket.nsp,
    });
    socket.onAny((event, ...args) => {
      if (this.socket !== socket) return;
      console.info("[plugin-ai][ws] received event", {
        workspaceId: this.options.workspaceId,
        event,
        payload: args[0],
      });
      const listeners = this.eventListeners.get(event);
      if (!listeners) return;
      for (const listener of listeners) {
        try {
          listener(args[0]);
        } catch (error) {
          console.error(
            `[plugin-ai] workspace ws handler failed for ${event}`,
            error,
          );
        }
      }
    });
    socket.on("connect_error", (error) => {
      if (this.socket !== socket) return;
      console.error("[plugin-ai] workspace ws connect failed", error);
      this.resolveInitialConnection();
    });
    socket.on("disconnect", () => {
      if (this.socket !== socket) return;
      for (const listener of this.disconnectListeners) listener();
    });
    socket.on("connect", () => {
      if (this.socket !== socket) return;
      const sinceVersion = this.options.getVersion();
      console.info("[plugin-ai][ws] connected", {
        workspaceId: this.options.workspaceId,
        socketId: socket.id,
        namespace: socket.nsp,
        sinceVersion,
      });
      socket
        .timeout(10_000)
        .emit(
          "workspace:join",
          {
            workspaceId: this.options.workspaceId,
            sinceVersion,
          },
          (
            error: Error | null,
            response?: WorkspaceJoinResponse<TChange>,
          ) => {
            if (this.socket !== socket) return;
            if (error || response?.error) {
              console.error(
                "[plugin-ai] workspace ws join failed",
                error ?? response?.error,
              );
              this.resolveInitialConnection();
              return;
            }
            console.info("[plugin-ai][ws] workspace joined", {
              workspaceId: this.options.workspaceId,
              response,
            });
            for (const listener of this.joinListeners) {
              void listener(response ?? {});
            }
            this.resolveInitialConnection();
          },
        );
    });
    this.connectionPromise = new Promise<void>((resolve) => {
      this.initialConnectionResolver = resolve;
    });
  }

  private initialConnectionResolver?: () => void;

  private resolveInitialConnection(): void {
    this.initialConnectionResolver?.();
    this.initialConnectionResolver = undefined;
  }
}
