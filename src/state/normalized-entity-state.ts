import type { HassCoreDomain } from "./hass-core-domains.js";

export type HassStateValueKind = "binary" | "numeric" | "enum" | "unknown";

export interface NormalizedEntityState {
  entityId: string;
  /** First segment of `entity_id` (e.g. `automation` in `automation.my_auto`). */
  domain: string;
  /**
   * When `domain` matches a core Home Assistant domain, equals `domain`; otherwise `null` (custom integration).
   * Use for discriminated logic: `if (n.coreDomain === "automation") { ... }`.
   */
  coreDomain: HassCoreDomain | null;
  rawState: string;
  valueKind: HassStateValueKind;
  isBinary: boolean;
  booleanValue?: boolean;
  numericValue?: number;
  unitOfMeasurement?: string;
  deviceClass?: string;
  stateClass?: string;
  friendlyName?: string;
  isUnavailable: boolean;
  lastChanged?: Date;
  lastUpdated?: Date;
  lastReported?: Date;
}
