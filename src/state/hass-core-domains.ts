/**
 * Built-in Home Assistant entity domains (core components).
 * Custom integrations may use other domain strings; those yield `coreDomain: null` in normalized state.
 *
 * @see https://www.home-assistant.io/docs/configuration/entities_domains/
 */
export const HASS_CORE_DOMAINS = [
  "alarm_control_panel",
  "automation",
  "binary_sensor",
  "button",
  "calendar",
  "camera",
  "climate",
  "conversation",
  "cover",
  "counter",
  "date",
  "datetime",
  "device_tracker",
  "event",
  "fan",
  "group",
  "humidifier",
  "image",
  "image_processing",
  "input_boolean",
  "input_button",
  "input_datetime",
  "input_number",
  "input_select",
  "input_text",
  "lawn_mower",
  "light",
  "lock",
  "mailbox",
  "media_player",
  "notify",
  "number",
  "person",
  "remote",
  "scene",
  "schedule",
  "script",
  "select",
  "sensor",
  "siren",
  "sun",
  "stt",
  "switch",
  "text",
  "time",
  "timer",
  "todo",
  "tts",
  "update",
  "vacuum",
  "valve",
  "wake_word",
  "water_heater",
  "weather",
  "zone",
] as const;

export type HassCoreDomain = (typeof HASS_CORE_DOMAINS)[number];

const CORE_DOMAIN_SET: ReadonlySet<string> = new Set(HASS_CORE_DOMAINS);

export function isHassCoreDomain(domain: string): domain is HassCoreDomain {
  return CORE_DOMAIN_SET.has(domain);
}
