import WebSocket from "ws";
import { WebSocketNotConnectedError } from "../errors.js";
import type { HassDeviceRegistryEntry } from "../types/hass.js";
import type {
  WebSocketEventName,
  WebSocketEvents,
  WebSocketListener,
} from "./typed-events.js";

const WS_PATH = "/api/websocket";

export interface WebSocketManagerOptions {
  baseUrl: string;
  token: string;
  reconnect?: boolean;
  maxReconnectDelayMs?: number;
  initialReconnectDelayMs?: number;
}

interface HaMessageBase {
  type: string;
}

function httpToWsBase(u: string): string {
  const trimmed = u.replace(/\/+$/, "");
  if (trimmed.startsWith("https://")) return `wss://${trimmed.slice("https://".length)}`;
  if (trimmed.startsWith("http://")) return `ws://${trimmed.slice("http://".length)}`;
  return trimmed;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private msgId = 1;
  private authenticated = false;
  private intentionalClose = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private readonly eventSubscriptionByMsgId = new Map<number, "state_changed" | "automation_triggered">();
  private handshake: Promise<void> | null = null;

  private readonly listeners = new Map<
    WebSocketEventName,
    Set<WebSocketListener<WebSocketEventName>>
  >();

  private readonly pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();

  constructor(private readonly options: WebSocketManagerOptions) {}

  get connected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN && this.authenticated;
  }

  on<K extends WebSocketEventName>(event: K, handler: WebSocketListener<K>): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as WebSocketListener<WebSocketEventName>);
  }

  off<K extends WebSocketEventName>(event: K, handler: WebSocketListener<K>): void {
    this.listeners.get(event)?.delete(handler as WebSocketListener<WebSocketEventName>);
  }

  async connect(): Promise<void> {
    this.intentionalClose = false;
    if (this.connected) return;
    if (this.handshake) {
      await this.handshake;
      return;
    }
    this.handshake = this.openSocket().finally(() => {
      this.handshake = null;
    });
    await this.handshake;
  }

  async disconnect(): Promise<void> {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    await new Promise<void>((resolve) => {
      if (!this.ws) {
        resolve();
        return;
      }
      this.ws.once("close", () => resolve());
      this.ws.close();
    });
    this.ws = null;
    this.authenticated = false;
    this.eventSubscriptionByMsgId.clear();
    this.emit("disconnected", undefined);
  }

  async sendCommand<T = unknown>(commandType: string, payload?: Record<string, unknown>): Promise<T> {
    if (!this.connected || !this.ws) {
      throw new WebSocketNotConnectedError();
    }
    const id = this.msgId++;
    const message: Record<string, unknown> = { id, type: commandType, ...payload };
    return await new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
      });
      try {
        this.ws!.send(JSON.stringify(message));
      } catch (e) {
        this.pending.delete(id);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  async listDeviceRegistry(): Promise<HassDeviceRegistryEntry[]> {
    const result = await this.sendCommand<unknown>("config/device_registry/list");
    return result as HassDeviceRegistryEntry[];
  }

  private emit<K extends WebSocketEventName>(event: K, payload: WebSocketEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const h of set) {
      try {
        h(payload);
      } catch {}
    }
  }

  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${httpToWsBase(this.options.baseUrl)}${WS_PATH}`;
      const socket = new WebSocket(url);
      this.ws = socket;

      const fail = (err: Error) => {
        socket.removeAllListeners();
        if (this.ws === socket) this.ws = null;
        reject(err);
      };

      const onEarlyError = (err: Error) =>
        fail(err instanceof Error ? err : new Error(String(err)));

      socket.once("error", onEarlyError);

      socket.once("open", () => {
        socket.off("error", onEarlyError);
        let phase: "auth_required" | "auth_ok" | "live" = "auth_required";

        socket.on("message", (data: WebSocket.RawData) => {
          if (phase === "live") {
            this.dispatchMessage(data);
            return;
          }

          let msg: HaMessageBase & { message?: string };
          try {
            msg = JSON.parse(data.toString()) as HaMessageBase & { message?: string };
          } catch {
            return;
          }

          if (phase === "auth_required") {
            if (msg.type !== "auth_required") {
              fail(new Error(`Expected auth_required, got ${msg.type}`));
              return;
            }
            phase = "auth_ok";
            socket.send(JSON.stringify({ type: "auth", access_token: this.options.token }));
            return;
          }

          if (phase === "auth_ok") {
            if (msg.type === "auth_invalid") {
              fail(new Error(msg.message ?? "Invalid auth"));
              return;
            }
            if (msg.type !== "auth_ok") {
              return;
            }
            this.authenticated = true;
            phase = "live";
            socket.on("close", () => this.handleUnexpectedClose());
            socket.on("error", () => this.handleUnexpectedClose());
            void this.finishHandshakeAfterAuth(socket, resolve, fail);
          }
        });
      });
    });
  }

  private async finishHandshakeAfterAuth(
    socket: WebSocket,
    resolve: () => void,
    fail: (e: Error) => void,
  ): Promise<void> {
    try {
      await this.subscribeHaEventStreams();
      this.reconnectAttempt = 0;
      this.emit("connected", undefined);
      resolve();
    } catch (e) {
      socket.removeAllListeners();
      this.ws = null;
      this.authenticated = false;
      fail(e instanceof Error ? e : new Error(String(e)));
    }
  }

  private async subscribeHaEventStreams(): Promise<void> {
    await this.subscribeHaEvent("state_changed");
    await this.subscribeHaEvent("automation_triggered");
  }

  private async subscribeHaEvent(
    eventType: "state_changed" | "automation_triggered",
  ): Promise<void> {
    if (!this.ws || !this.authenticated) return;
    const id = this.msgId++;
    this.eventSubscriptionByMsgId.set(id, eventType);
    await new Promise<void>((resolve, reject) => {
      this.pending.set(id, {
        resolve: () => resolve(),
        reject,
      });
      this.ws!.send(
        JSON.stringify({
          id,
          type: "subscribe_events",
          event_type: eventType,
        }),
      );
    });
  }

  private dispatchMessage(data: WebSocket.RawData): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(data.toString()) as Record<string, unknown>;
    } catch {
      return;
    }

    const type = msg.type as string | undefined;
    if (type === "pong") return;

    if (type === "result") {
      const id = msg.id as number;
      const pending = this.pending.get(id);
      if (!pending) return;
      this.pending.delete(id);
      const success = Boolean(msg.success);
      if (!success) {
        pending.reject(
          new Error(
            JSON.stringify((msg as { error?: unknown }).error ?? "WebSocket command failed"),
          ),
        );
        return;
      }
      pending.resolve((msg as { result?: unknown }).result);
      return;
    }

    if (type === "event") {
      const id = msg.id as number | undefined;
      if (id === undefined) return;
      const kind = this.eventSubscriptionByMsgId.get(id);
      if (!kind) return;
      const ev = (msg as { event?: { event_type?: string; data?: unknown } }).event;
      if (!ev || ev.event_type !== kind) return;

      if (kind === "state_changed") {
        const d = ev.data as {
          entity_id?: string;
          old_state?: StateChangedInner | null;
          new_state?: StateChangedInner | null;
        };
        if (!d?.entity_id) return;
        this.emit("state_changed", {
          entity_id: d.entity_id,
          old_state: d.old_state ?? null,
          new_state: d.new_state ?? null,
        });
        return;
      }

      const raw = ev.data;
      const data =
        raw !== null && typeof raw === "object" && !Array.isArray(raw)
          ? (raw as Record<string, unknown>)
          : {};
      const entity_id = typeof data.entity_id === "string" ? data.entity_id : undefined;
      const name = typeof data.name === "string" ? data.name : undefined;
      this.emit("automation_triggered", { entity_id, name, data });
    }
  }

  private handleUnexpectedClose(): void {
    if (this.intentionalClose) return;
    this.authenticated = false;
    this.ws = null;
    this.eventSubscriptionByMsgId.clear();
    for (const [, p] of this.pending) {
      p.reject(new WebSocketNotConnectedError("WebSocket closed"));
    }
    this.pending.clear();
    this.emit("disconnected", undefined);

    if (this.options.reconnect === true) {
      this.scheduleReconnect();
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) return;
    this.clearReconnectTimer();
    const initial = this.options.initialReconnectDelayMs ?? 1000;
    const max = this.options.maxReconnectDelayMs ?? 30000;
    const delay = Math.min(max, initial * Math.pow(2, this.reconnectAttempt++));
    this.reconnectTimer = setTimeout(() => {
      void this.connect().catch(() => {
        if (!this.intentionalClose) this.scheduleReconnect();
      });
    }, delay);
  }
}

interface StateChangedInner {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
  context?: { id: string; parent_id: string | null; user_id: string | null };
}
