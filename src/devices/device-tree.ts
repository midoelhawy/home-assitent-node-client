import type { HassDeviceRegistryEntry, HassEntityRegistryEntry, HassState } from "../types/hass.js";

export interface HaDeviceTreeNode {
  device: HassDeviceRegistryEntry;
  /** Entity registry rows for this device, sorted by `entity_id`. */
  entities: HassEntityRegistryEntry[];
}

export interface HaDeviceTree {
  /** One node per device in the device registry (including devices with zero entities). */
  devices: HaDeviceTreeNode[];
  /** Entities with no `device_id` (helpers, some core entities, etc.). */
  unassignedEntities: HassEntityRegistryEntry[];
}

/**
 * Groups entity registry rows under device registry rows (same logic as the HA UI device pages).
 */
export function buildHaDeviceTree(
  devices: HassDeviceRegistryEntry[],
  entities: HassEntityRegistryEntry[],
): HaDeviceTree {
  const byDevice = new Map<string, HassEntityRegistryEntry[]>();
  for (const e of entities) {
    if (e.device_id == null) continue;
    let list = byDevice.get(e.device_id);
    if (!list) {
      list = [];
      byDevice.set(e.device_id, list);
    }
    list.push(e);
  }
  for (const list of byDevice.values()) {
    list.sort((a, b) => a.entity_id.localeCompare(b.entity_id));
  }

  const deviceNodes: HaDeviceTreeNode[] = devices
    .map((device) => ({
      device,
      entities: byDevice.get(device.id) ?? [],
    }))
    .sort((a, b) => deviceTitle(a.device).localeCompare(deviceTitle(b.device)));

  const unassignedEntities = entities
    .filter((e) => e.device_id == null)
    .sort((a, b) => a.entity_id.localeCompare(b.entity_id));

  return { devices: deviceNodes, unassignedEntities };
}

export function deviceTitle(d: HassDeviceRegistryEntry): string {
  return d.name_by_user ?? d.name ?? d.id;
}

function entityLabel(e: HassEntityRegistryEntry): string {
  const name = e.name;
  if (typeof name === "string" && name.trim().length > 0) return name.trim();
  return e.entity_id;
}

/**
 * Pretty-print a device tree for logs / CLI (similar layout to HA device view: device name, then entities).
 *
 * Pass `statesByEntityId` from {@link DevicesManager.getAllDevices} (or a `Map` built from it) to append current values.
 */
export function formatDeviceTreeAsText(
  tree: HaDeviceTree,
  options?: {
    statesByEntityId?: Map<string, HassState>;
  },
): string {
  const states = options?.statesByEntityId;
  const lines: string[] = [];

  for (const node of tree.devices) {
    lines.push(deviceTitle(node.device));
    const ents = node.entities;
    for (let i = 0; i < ents.length; i++) {
      const ent = ents[i]!;
      const isLast = i === ents.length - 1;
      const branch = isLast ? "└─" : "├─";
      const label = entityLabel(ent);
      const value = states ? formatStateSuffix(ent.entity_id, states) : "";
      const tail = value ? `  ${value}` : "";
      lines.push(`${branch} ${label}${tail}`);
    }
    if (ents.length === 0) {
      lines.push("└─ (no entities)");
    }
    lines.push("");
  }

  if (tree.unassignedEntities.length > 0) {
    lines.push("— Unassigned entities (no device) —");
    for (const ent of tree.unassignedEntities) {
      const value = states ? formatStateSuffix(ent.entity_id, states) : "";
      lines.push(`  · ${entityLabel(ent)}  (${ent.entity_id})${value ? `  ${value}` : ""}`);
    }
  }

  return lines.join("\n").trimEnd();
}

function formatStateSuffix(entityId: string, states: Map<string, HassState>): string {
  const s = states.get(entityId);
  if (!s) return "";
  const unit =
    typeof s.attributes?.unit_of_measurement === "string" ? s.attributes.unit_of_measurement : "";
  const raw = s.state ?? "";
  return unit ? `${raw} ${unit}` : raw;
}

/**
 * Builds a map `entity_id` → {@link HassState} from the REST states list.
 */
export function statesArrayToMap(states: HassState[]): Map<string, HassState> {
  const m = new Map<string, HassState>();
  for (const s of states) {
    m.set(s.entity_id, s);
  }
  return m;
}
