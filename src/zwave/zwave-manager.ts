import type { HttpClient } from "../http-client.js";
import type { CallServiceResponse, HassState } from "../types/hass.js";

const DOMAIN = "zwave_js";

export class ZWaveManager {
  constructor(private readonly http: HttpClient) {}

  async invokeService(
    service: string,
    data?: Record<string, unknown>,
  ): Promise<CallServiceResponse[]> {
    return await this.http.postJson<CallServiceResponse[]>(`/services/${DOMAIN}/${service}`, data ?? {});
  }

  async listZWaveEntityStates(): Promise<HassState[]> {
    const states = await this.http.getJson<HassState[]>("/states");
    return states.filter((s) => s.entity_id.startsWith(`${DOMAIN}.`));
  }

  async startAddNode(data?: Record<string, unknown>): Promise<CallServiceResponse[]> {
    return await this.invokeService("add_node", data);
  }

  async removeFailedNode(data?: Record<string, unknown>): Promise<CallServiceResponse[]> {
    return await this.invokeService("remove_failed_node", data);
  }

  async healNetwork(data?: Record<string, unknown>): Promise<CallServiceResponse[]> {
    return await this.invokeService("heal_network", data);
  }
}
