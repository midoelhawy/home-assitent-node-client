import type { NormalizedEntityState } from "./normalized-entity-state.js";
import { isHassCoreDomain } from "./hass-core-domains.js";
import type { HassStateLike, StateChangedEventData } from "../ws/typed-events.js";

const ON_OFF_DOMAINS = new Set([
  "switch",
  "light",
  "fan",
  "lock",
  "cover",
  "siren",
  "valve",
  "automation",
  "input_boolean",
]);

const BINARY_ALWAYS_DOMAINS = new Set(["binary_sensor", "input_boolean"]);

const UNKNOWN_STATES = new Set(["unknown", "unavailable", "", "none"]);

function parseIsoDate(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function strAttr(attrs: Record<string, unknown>, key: string): string | undefined {
  const v = attrs[key];
  return typeof v === "string" ? v : undefined;
}

export type HassStateNormalizable = HassStateLike;

function classify(
  domain: string,
  raw: string,
  attrs: Record<string, unknown>,
): Pick<
  NormalizedEntityState,
  | "valueKind"
  | "isBinary"
  | "booleanValue"
  | "numericValue"
  | "unitOfMeasurement"
  | "deviceClass"
  | "stateClass"
  | "friendlyName"
  | "isUnavailable"
> {
  const unit = strAttr(attrs, "unit_of_measurement");
  const deviceClass = strAttr(attrs, "device_class");
  const stateClass = strAttr(attrs, "state_class");
  const friendlyName = strAttr(attrs, "friendly_name");
  const isUnavailable = UNKNOWN_STATES.has(raw.toLowerCase());

  let isBinary = false;
  let booleanValue: boolean | undefined;
  let numericValue: number | undefined;
  let valueKind: NormalizedEntityState["valueKind"] = "enum";

  if (isUnavailable) {
    valueKind = "unknown";
    return {
      valueKind,
      isBinary: false,
      isUnavailable,
      unitOfMeasurement: unit,
      deviceClass,
      stateClass,
      friendlyName,
    };
  }

  if (BINARY_ALWAYS_DOMAINS.has(domain)) {
    isBinary = true;
    valueKind = "binary";
    booleanValue = raw === "on" || raw === "true";
  } else if ((raw === "on" || raw === "off") && ON_OFF_DOMAINS.has(domain)) {
    isBinary = true;
    valueKind = "binary";
    booleanValue = raw === "on";
  } else {
    const trimmed = raw.trim();
    const n = Number.parseFloat(trimmed);
    const finite = Number.isFinite(n);
    const plainNumeric =
      /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed);
    const looksNumeric =
      finite &&
      trimmed !== "" &&
      raw !== "on" &&
      raw !== "off" &&
      (plainNumeric || unit !== undefined || stateClass !== undefined);

    if (looksNumeric) {
      valueKind = "numeric";
      numericValue = n;
    } else {
      valueKind = "enum";
    }
  }

  return {
    valueKind,
    isBinary,
    booleanValue,
    numericValue,
    unitOfMeasurement: unit,
    deviceClass,
    stateClass,
    friendlyName,
    isUnavailable,
  };
}

export function normalizeHassState(state: HassStateNormalizable): NormalizedEntityState {
  const entityId = state.entity_id;
  const domain = entityId.includes(".") ? (entityId.split(".")[0] ?? "") : "";
  const coreDomain = isHassCoreDomain(domain) ? domain : null;
  const rawState = state.state;
  const attrs = state.attributes ?? {};

  const meta = classify(domain, rawState, attrs);

  return {
    entityId,
    domain,
    coreDomain,
    rawState,
    lastChanged: parseIsoDate(state.last_changed),
    lastUpdated: parseIsoDate(state.last_updated),
    lastReported: parseIsoDate(state.last_reported),
    ...meta,
  };
}

export function normalizeHassStateOrNull(
  state: HassStateNormalizable | null | undefined,
): NormalizedEntityState | null {
  if (state == null) return null;
  return normalizeHassState(state);
}

export function normalizeStateChangedEvent(
  data: StateChangedEventData,
  which: "new" | "old" = "new",
): NormalizedEntityState | null {
  const st = which === "new" ? data.new_state : data.old_state;
  return normalizeHassStateOrNull(st);
}

export class EntityStateNormalizer {
  normalize(state: HassStateNormalizable): NormalizedEntityState {
    return normalizeHassState(state);
  }

  normalizeOrNull(state: HassStateNormalizable | null | undefined): NormalizedEntityState | null {
    return normalizeHassStateOrNull(state);
  }

  fromStateChanged(
    data: StateChangedEventData,
    which: "new" | "old" = "new",
  ): NormalizedEntityState | null {
    return normalizeStateChangedEvent(data, which);
  }
}
