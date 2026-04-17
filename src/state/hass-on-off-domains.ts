/**
 * Entity domains whose state is commonly modeled as on/off for normalization
 * (see {@link normalizeHassState}).
 */
export const HASS_ON_OFF_DOMAINS = [
  "switch",
  "light",
  "fan",
  "lock",
  "cover",
  "siren",
  "valve",
  "automation",
  "input_boolean",
] as const;

export type HassOnOffDomain = (typeof HASS_ON_OFF_DOMAINS)[number];

export const HASS_ON_OFF_DOMAIN_SET: ReadonlySet<string> = new Set(HASS_ON_OFF_DOMAINS);

export function isHassOnOffDomain(domain: string): domain is HassOnOffDomain {
  return HASS_ON_OFF_DOMAIN_SET.has(domain);
}
