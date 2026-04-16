export interface HassState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_reported?: string;
  last_updated: string;
  context: HassContext;
}

export interface HassContext {
  id: string;
  parent_id: string | null;
  user_id: string | null;
}

export interface HassDeviceRegistryEntry {
  area_id: string | null;
  configuration_url: string | null;
  config_entries: string[];
  connections: [string, string][];
  created_at: number;
  disabled_by: string | null;
  entry_type: string | null;
  hw_version: string | null;
  id: string;
  identifiers: [string, string][];
  manufacturer: string | null;
  model: string | null;
  model_id: string | null;
  name_by_user: string | null;
  name: string | null;
  primary_config_entry: string | null;
  serial_number: string | null;
  sw_version: string | null;
  via_device_id: string | null;
}

export interface HassHistoryState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export type HassHistoryRow = HassHistoryState[];

export interface HassApiStatus {
  message: string;
}

export interface HassConfig {
  latitude: number;
  longitude: number;
  elevation: number;
  unit_system: {
    length: string;
    mass: string;
    temperature: string;
    volume: string;
  };
  location_name: string;
  time_zone: string;
  components: string[];
  config_dir: string;
  allowlist_external_dirs: string[];
  allowlist_external_urls: string[];
  version: string;
  [key: string]: unknown;
}

export interface CallServiceResponse {
  context: HassContext;
  [key: string]: unknown;
}

export interface HassRegisteredEvent {
  event: string;
  listener_count?: number;
}

export type HassServicesTree = Record<string, Record<string, unknown>>;
