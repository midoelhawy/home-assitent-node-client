import type { HttpClient } from "../http-client.js";
import type {
  CallServiceResponse,
  HassApiStatus,
  HassConfig,
  HassRegisteredEvent,
  HassServicesTree,
  HassState,
} from "../types/hass.js";

export class ServerApiManager {
  constructor(private readonly http: HttpClient) {}

  async ping(): Promise<HassApiStatus> {
    return await this.http.getJson<HassApiStatus>("/");
  }

  async getConfiguration(): Promise<HassConfig> {
    return await this.http.getJson<HassConfig>("/config");
  }

  async listComponents(): Promise<string[]> {
    return await this.http.getJson<string[]>("/components");
  }

  async listRegisteredEvents(): Promise<HassRegisteredEvent[]> {
    return await this.http.getJson<HassRegisteredEvent[]>("/events");
  }

  async listServices(): Promise<HassServicesTree> {
    return await this.http.getJson<HassServicesTree>("/services");
  }

  async getEntityStates(): Promise<HassState[]> {
    return await this.http.getJson<HassState[]>("/states");
  }

  async listStatesByEntityDomain(domain: string): Promise<HassState[]> {
    const prefix = `${domain}.`;
    const states = await this.getEntityStates();
    return states.filter((s) => s.entity_id.startsWith(prefix));
  }

  async callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
  ): Promise<CallServiceResponse[]> {
    const encDomain = encodeURIComponent(domain);
    const encService = encodeURIComponent(service);
    return await this.http.postJson<CallServiceResponse[]>(
      `/services/${encDomain}/${encService}`,
      serviceData ?? {},
    );
  }
}
