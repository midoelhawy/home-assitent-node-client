import { HomeAssistantError } from "../errors.js";
import type { HttpClient } from "../http-client.js";
import type { HassHistoryRow } from "../types/hass.js";

export type { HassHistoryRow };

export interface HistoryQuery {
  start: string | Date;
  end?: string | Date;
  entityIds: string[];
  minimalResponse?: boolean;
  significantChangesOnly?: boolean;
  noAttributes?: boolean;
}

function iso(d: string | Date): string {
  return typeof d === "string" ? d : d.toISOString();
}

export class HistoryManager {
  constructor(private readonly http: HttpClient) {}

  async getHistory(query: HistoryQuery): Promise<HassHistoryRow[]> {
    if (!query.entityIds.length) {
      throw new HomeAssistantError(
        "HistoryQuery.entityIds must contain at least one entity_id (Home Assistant Core 2026.x+ requires filter_entity_id).",
      );
    }
    const start = encodeURIComponent(iso(query.start));
    const q: Record<string, string | undefined> = {};
    if (query.end !== undefined) q.end_time = iso(query.end);
    q.filter_entity_id = query.entityIds.join(",");
    if (query.minimalResponse === true) q.minimal_response = "1";
    if (query.significantChangesOnly === true) q.significant_changes_only = "1";
    if (query.noAttributes === true) q.no_attributes = "1";

    return await this.http.getJson<HassHistoryRow[]>(`/history/period/${start}`, q);
  }
}
