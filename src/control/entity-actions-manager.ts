import type { ServerApiManager } from "../server/server-api-manager.js";
import type { CallServiceResponse } from "../types/hass.js";
import { HomeAssistantError } from "../errors.js";

/** Maps entity domains to Home Assistant service names for “power-like” actions. */
const DOMAIN_ACTIONS: Record<
  string,
  {
    on: string;
    off: string;
    /** If omitted, {@link EntityActionsManager.toggle} throws for this domain. */
    toggle?: string;
  }
> = {
  switch: { on: "turn_on", off: "turn_off", toggle: "toggle" },
  light: { on: "turn_on", off: "turn_off", toggle: "toggle" },
  fan: { on: "turn_on", off: "turn_off", toggle: "toggle" },
  automation: { on: "turn_on", off: "turn_off", toggle: "toggle" },
  input_boolean: { on: "turn_on", off: "turn_off", toggle: "toggle" },
  siren: { on: "turn_on", off: "turn_off", toggle: "toggle" },
  remote: { on: "turn_on", off: "turn_off", toggle: "toggle" },
  lock: { on: "lock", off: "unlock" },
  cover: { on: "open_cover", off: "close_cover", toggle: "toggle" },
  valve: { on: "open_valve", off: "close_valve", toggle: "toggle" },
};

function parseEntityDomain(entityId: string): string {
  const dot = entityId.indexOf(".");
  if (dot <= 0) {
    throw new HomeAssistantError(`Invalid entity_id: "${entityId}"`);
  }
  return entityId.slice(0, dot);
}

function resolveServiceName(
  domain: string,
  kind: "on" | "off" | "toggle",
): string {
  const spec = DOMAIN_ACTIONS[domain];
  if (spec) {
    if (kind === "toggle") {
      if (spec.toggle === undefined) {
        throw new HomeAssistantError(
          `toggle() is not supported for domain "${domain}". Use turnOn() or turnOff().`,
        );
      }
      return spec.toggle;
    }
    return kind === "on" ? spec.on : spec.off;
  }
  if (kind === "on") return "turn_on";
  if (kind === "off") return "turn_off";
  return "toggle";
}

/**
 * High-level helpers around {@link ServerApiManager.callService} for common entity actions
 * (on/off/toggle, automations, scripts, scenes).
 */
export class EntityActionsManager {
  constructor(private readonly server: ServerApiManager) {}

  /**
   * Turn entity “on” (or equivalent: lock, open cover, open valve, etc.).
   * All `entity_id` values must share the same domain in one call.
   */
  async turnOn(
    entityId: string | string[],
    serviceData?: Record<string, unknown>,
  ): Promise<CallServiceResponse[]> {
    return await this.invoke("on", entityId, serviceData);
  }

  /**
   * Turn entity “off” (or equivalent: unlock, close cover, close valve, disable automation, …).
   */
  async turnOff(
    entityId: string | string[],
    serviceData?: Record<string, unknown>,
  ): Promise<CallServiceResponse[]> {
    return await this.invoke("off", entityId, serviceData);
  }

  /**
   * Toggle entity state. Not supported for `lock` (use {@link turnOn} / {@link turnOff}).
   */
  async toggle(
    entityId: string | string[],
    serviceData?: Record<string, unknown>,
  ): Promise<CallServiceResponse[]> {
    return await this.invoke("toggle", entityId, serviceData);
  }

  /**
   * Enable or disable an `automation.*` entity (same as UI on/off).
   */
  async setAutomationEnabled(
    entityId: string,
    enabled: boolean,
    serviceData?: Record<string, unknown>,
  ): Promise<CallServiceResponse[]> {
    if (parseEntityDomain(entityId) !== "automation") {
      throw new HomeAssistantError(
        `setAutomationEnabled expects automation.*, got "${entityId}".`,
      );
    }
    return enabled ? await this.turnOn(entityId, serviceData) : await this.turnOff(entityId, serviceData);
  }

  /**
   * Run a `script.*` entity (`script.turn_on`).
   */
  async triggerScript(
    entityId: string,
    serviceData?: Record<string, unknown>,
  ): Promise<CallServiceResponse[]> {
    if (parseEntityDomain(entityId) !== "script") {
      throw new HomeAssistantError(`triggerScript expects script.*, got "${entityId}".`);
    }
    return await this.server.callService("script", "turn_on", {
      ...serviceData,
      entity_id: entityId,
    });
  }

  /**
   * Activate a `scene.*` entity (`scene.turn_on`).
   */
  async activateScene(
    entityId: string,
    serviceData?: Record<string, unknown>,
  ): Promise<CallServiceResponse[]> {
    if (parseEntityDomain(entityId) !== "scene") {
      throw new HomeAssistantError(`activateScene expects scene.*, got "${entityId}".`);
    }
    return await this.server.callService("scene", "turn_on", {
      ...serviceData,
      entity_id: entityId,
    });
  }

  /**
   * Generic on/off for any entity that supports the resolved services (e.g. switch, light, automation).
   */
  async setActive(
    entityId: string | string[],
    active: boolean,
    serviceData?: Record<string, unknown>,
  ): Promise<CallServiceResponse[]> {
    return active ? await this.turnOn(entityId, serviceData) : await this.turnOff(entityId, serviceData);
  }

  private async invoke(
    kind: "on" | "off" | "toggle",
    entityId: string | string[],
    serviceData?: Record<string, unknown>,
  ): Promise<CallServiceResponse[]> {
    const ids = Array.isArray(entityId) ? entityId : [entityId];
    if (ids.length === 0) {
      throw new HomeAssistantError("At least one entity_id is required.");
    }
    const domains = new Set(ids.map((id) => parseEntityDomain(id)));
    if (domains.size !== 1) {
      throw new HomeAssistantError(
        "All entity_id values in one call must use the same domain (e.g. only light.*).",
      );
    }
    const domain = [...domains][0]!;
    const service = resolveServiceName(domain, kind);
    const payload: Record<string, unknown> = {
      ...serviceData,
      entity_id: ids.length === 1 ? ids[0] : ids,
    };
    return await this.server.callService(domain, service, payload);
  }
}
