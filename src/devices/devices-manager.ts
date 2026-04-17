import type { HttpClient } from "../http-client.js";
import type { HassDeviceRegistryEntry, HassState } from "../types/hass.js";
import { WebSocketNotConnectedError } from "../errors.js";
import type { WebSocketManager } from "../ws/websocket-manager.js";
import {
  buildHaDeviceTree,
  formatDeviceTreeAsText,
  statesArrayToMap,
  type HaDeviceTree,
} from "./device-tree.js";

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

  /**
   * Device → entities tree (same grouping as the Home Assistant device page).
   * Requires WebSocket (device registry) + REST (entity registry).
   */
  async getDeviceTree(): Promise<HaDeviceTree> {
    const ws = this.getWs();
    if (!ws?.connected) {
      throw new WebSocketNotConnectedError(
        "getDeviceTree() needs an active WebSocket connection. Call connectWebSocket() first.",
      );
    }
    const [deviceRows, entityRows] = await Promise.all([
      ws.listDeviceRegistry(),
      ws.listEntityRegistry(),
    ]);
    return buildHaDeviceTree(deviceRows, entityRows);
  }

  /**
   * Same as {@link getDeviceTree} plus optional live state values in the text (from `/api/states`).
   */
  async getDeviceTreeAsText(withStates = true): Promise<string> {
    const tree = await this.getDeviceTree();
    if (!withStates) {
      return formatDeviceTreeAsText(tree);
    }
    const states = await this.getAllDevices();
    return formatDeviceTreeAsText(tree, { statesByEntityId: statesArrayToMap(states) });
  }
}
