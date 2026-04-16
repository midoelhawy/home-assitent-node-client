export type HassStateValueKind = "binary" | "numeric" | "enum" | "unknown";

export interface NormalizedEntityState {
  entityId: string;
  domain: string;
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
