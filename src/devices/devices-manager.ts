import type { HttpClient } from "../http-client.js";
import type { HassDeviceRegistryEntry, HassState } from "../types/hass.js";
import { WebSocketNotConnectedError } from "../errors.js";
import type { WebSocketManager } from "../ws/websocket-manager.js";

export class DevicesManager {
  constructor(
    private readonly http: HttpClient,
    private readonly getWs: () => WebSocketManager | undefined,
  ) {}

  async getAllDevices(): Promise<HassState[]> {
    return await this.http.getJson<HassState[]>("/states");
  }

  async getEntityState(entityId: string): Promise<HassState> {
    const enc = encodeURIComponent(entityId);
    return await this.http.getJson<HassState>(`/states/${enc}`);
  }

  async setEntityState(
    entityId: string,
    body: Pick<HassState, "state" | "attributes"> & Partial<Pick<HassState, "last_changed" | "last_updated">>,
  ): Promise<HassState[]> {
    const enc = encodeURIComponent(entityId);
    return await this.http.postJson<HassState[]>(`/states/${enc}`, body);
  }

  async getDeviceRegistry(): Promise<HassDeviceRegistryEntry[]> {
    const ws = this.getWs();
    if (!ws?.connected) {
      throw new WebSocketNotConnectedError(
        "getDeviceRegistry() needs an active WebSocket connection. Call connectWebSocket() first.",
      );
    }
    return await ws.listDeviceRegistry();
  }
}
