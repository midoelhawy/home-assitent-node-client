import { DevicesManager } from "./devices/devices-manager.js";
import { HistoryManager } from "./history/history-manager.js";
import { HttpClient, type HttpClientOptions } from "./http-client.js";
import { ServerApiManager } from "./server/server-api-manager.js";
import { ZWaveManager } from "./zwave/zwave-manager.js";
import type { WebSocketManager } from "./ws/websocket-manager.js";
import type { WebSocketManagerOptions } from "./ws/websocket-manager.js";

export interface HomeAssistantClientConfig {
  baseUrl: string;
  token: string;
  enableWebSocket?: boolean;
  fetch?: typeof fetch;
  webSocketReconnect?: boolean;
  webSocketReconnectDelays?: Pick<WebSocketManagerOptions, "initialReconnectDelayMs" | "maxReconnectDelayMs">;
}

export class HomeAssistantClient {
  private readonly http: HttpClient;
  private _ws: WebSocketManager | undefined;
  private _wsInit: Promise<WebSocketManager> | null = null;

  readonly devices: DevicesManager;
  readonly history: HistoryManager;
  readonly zwave: ZWaveManager;
  readonly server: ServerApiManager;

  private readonly token: string;
  private readonly baseUrl: string;
  private readonly enableWebSocketFlag: boolean;
  private readonly wsReconnect: boolean;
  private readonly wsReconnectDelays: Pick<
    WebSocketManagerOptions,
    "initialReconnectDelayMs" | "maxReconnectDelayMs"
  >;

  constructor(config: HomeAssistantClientConfig) {
    this.baseUrl = config.baseUrl;
    this.token = config.token;
    this.enableWebSocketFlag = config.enableWebSocket ?? false;
    this.wsReconnect = config.webSocketReconnect ?? false;
    this.wsReconnectDelays = config.webSocketReconnectDelays ?? {};

    this.http = new HttpClient({
      baseUrl: config.baseUrl,
      token: config.token,
      fetchImpl: config.fetch,
    });

    this.devices = new DevicesManager(this.http, () => this._ws);
    this.history = new HistoryManager(this.http);
    this.zwave = new ZWaveManager(this.http);
    this.server = new ServerApiManager(this.http);

    if (this.enableWebSocketFlag) {
      queueMicrotask(() => {
        void this.ensureWebSocketManager();
      });
    }
  }

  get ws(): WebSocketManager | undefined {
    return this._ws;
  }

  async connectWebSocket(): Promise<void> {
    const manager = await this.ensureWebSocketManager();
    await manager.connect();
  }

  async disconnectWebSocket(): Promise<void> {
    await this._ws?.disconnect();
  }

  private async ensureWebSocketManager(): Promise<WebSocketManager> {
    if (this._ws) return this._ws;
    if (!this._wsInit) {
      this._wsInit = import("./ws/websocket-manager.js").then(({ WebSocketManager }) => {
        const instance = new WebSocketManager({
          baseUrl: this.baseUrl,
          token: this.token,
          reconnect: this.wsReconnect,
          ...this.wsReconnectDelays,
        });
        this._ws = instance;
        return instance;
      });
    }
    return await this._wsInit;
  }
}

export type { HttpClient, HttpClientOptions };
