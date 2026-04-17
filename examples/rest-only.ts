import { HomeAssistantClient } from "../dist/index.js";

async function main() {
  const client = new HomeAssistantClient({
    baseUrl: process.env.HA_BASE_URL ?? "http://localhost:8123",
    token: process.env.HA_TOKEN ?? "REPLACE_ME",
  });

  const alive = await client.server.ping();
  console.log("ping:", alive.message);

  const config = await client.server.getConfiguration();
  console.log("Home Assistant version:", config.version, "|", config.location_name);

  const allStates = await client.devices.getAllDevices();
  console.log("entities (REST):", allStates.length);
  console.log("ws is undefined (REST-only):", client.ws === undefined);

  const automations = await client.server.listStatesByCoreDomain("automation");
  const scripts = await client.server.listStatesByCoreDomain("script");
  const scenes = await client.server.listStatesByCoreDomain("scene");
  console.log("automations:", automations.length, automations.map((s) => s.entity_id).slice(0, 5), "…");
  console.log("scripts:", scripts.length);
  console.log("scenes:", scenes.length);

  const services = await client.server.listServices();
  const automationServices = Object.keys(services["automation"] ?? {});
  console.log("services under domain 'automation':", automationServices.slice(0, 8), "…");

  const events = await client.server.listRegisteredEvents();
  console.log(
    "registered event types (sample):",
    events.slice(0, 6).map((e) => e.event),
  );

  const historyStart = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const historyEntity =
    automations[0]?.entity_id ?? scripts[0]?.entity_id ?? allStates[0]?.entity_id;
  if (!historyEntity) {
    console.log("history: skipped (no entity available)");
  } else {
    const history = await client.history.getHistory({
      start: historyStart,
      entityIds: [historyEntity],
      minimalResponse: true,
    });
    console.log("history groups:", history.length, `(entity: ${historyEntity})`);
    if (history[0]?.[0]) {
      console.log("history sample first point:", history[0][0].entity_id, history[0][0].state);
    }
  }
}

void main();
