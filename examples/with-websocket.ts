import {
  HomeAssistantClient,
  normalizeStateChangedEvent,
  type AutomationTriggeredEventData,
} from "../dist/index.js";

function parseEntityDomain(entityId: string): string {
  const dot = entityId.indexOf(".");
  return dot > 0 ? entityId.slice(0, dot) : entityId;
}

function shouldLogStateDomain(domain: string): boolean {
  const raw = process.env.HA_WS_DOMAINS?.trim();
  if (!raw) return true;
  const allow = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
  return allow.has(domain);
}

async function main() {
  const client = new HomeAssistantClient({
    baseUrl: process.env.HA_BASE_URL ?? "http://localhost:8123",
    token: process.env.HA_TOKEN ?? "REPLACE_ME",
  });

  await client.connectWebSocket();

  client.ws!.on("connected", () => {
    console.log("[ws] connected");
  });

  client.ws!.on("disconnected", () => {
    console.log("[ws] disconnected");
  });

  client.ws!.on("state_changed", (ev) => {
    const domain = parseEntityDomain(ev.entity_id);
    if (!shouldLogStateDomain(domain)) return;

    const n = normalizeStateChangedEvent(ev, "new");
    if (n) {
      console.log(
        "[state_changed]",
        n.coreDomain ?? n.domain,
        n.entityId,
        n.valueKind,
        n.isBinary ? `binary=${n.booleanValue}` : n.numericValue ?? n.rawState,
        n.unitOfMeasurement ?? "",
        n.lastUpdated?.toISOString() ?? "",
      );
    }

    if (ev.entity_id.startsWith("automation.")) {
      const oldS = ev.old_state?.state;
      const newS = ev.new_state?.state;
      if (oldS !== newS) {
        console.log("[automation enabled/disabled]", ev.entity_id, oldS, "->", newS);
      }
    }
  });

  client.ws!.on("automation_triggered", (ev: AutomationTriggeredEventData) => {
    console.log(
      "[automation_triggered] run started:",
      ev.entity_id ?? ev.name ?? "(unknown)",
      ev.data,
    );
  });

  console.log("\n--- Device tree (devices → entities, like HA device page) ---\n");
  console.log(await client.devices.getDeviceTreeAsText());

  const ping = await client.server.ping();
  console.log("\n[rest] ping:", ping.message);
}

void main();
