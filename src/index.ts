export { HomeAssistantClient, type HomeAssistantClientConfig } from "./client.js";
export { HttpClient, type HttpClientOptions } from "./http-client.js";
export {
  HomeAssistantError,
  HomeAssistantHttpError,
  WebSocketNotConnectedError,
} from "./errors.js";
export type {
  CallServiceResponse,
  HassApiStatus,
  HassConfig,
  HassContext,
  HassDeviceRegistryEntry,
  HassHistoryRow,
  HassHistoryState,
  HassRegisteredEvent,
  HassServicesTree,
  HassState,
} from "./types/hass.js";
export { DevicesManager } from "./devices/devices-manager.js";
export { HistoryManager, type HistoryQuery } from "./history/history-manager.js";
export { ZWaveManager } from "./zwave/zwave-manager.js";
export { ServerApiManager } from "./server/server-api-manager.js";
export type {
  AutomationTriggeredEventData,
  WebSocketEvents,
  WebSocketEventName,
  WebSocketListener,
} from "./ws/typed-events.js";
export type { StateChangedEventData, HassStateLike } from "./ws/typed-events.js";
export { WebSocketManager, type WebSocketManagerOptions } from "./ws/websocket-manager.js";
export type { HassCoreDomain } from "./state/hass-core-domains.js";
export { HASS_CORE_DOMAINS, isHassCoreDomain } from "./state/hass-core-domains.js";
export type { HassStateValueKind, NormalizedEntityState } from "./state/normalized-entity-state.js";
export {
  EntityStateNormalizer,
  normalizeHassState,
  normalizeHassStateOrNull,
  normalizeStateChangedEvent,
  type HassStateNormalizable,
} from "./state/normalize-hass-state.js";
