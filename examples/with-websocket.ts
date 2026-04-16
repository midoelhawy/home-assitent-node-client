import { HomeAssistantClient, normalizeStateChangedEvent } from "../dist/index.js";

async function main() {
  const client = new HomeAssistantClient({
    baseUrl: process.env.HA_BASE_URL ?? "http://localhost:8123",
    token: process.env.HA_TOKEN ?? "REPLACE_ME",
  });

  await client.connectWebSocket();

  client.ws!.on("connected", () => console.log("websocket connected"));
  client.ws!.on("disconnected", () => console.log("websocket disconnected"));
  client.ws!.on("state_changed", (ev) => {
    const n = normalizeStateChangedEvent(ev, "new");
    if (n) {
      console.log(
        "state_changed",
        n.entityId,
        n.valueKind,
        n.isBinary ? `binary=${n.booleanValue}` : n.numericValue ?? n.rawState,
        n.unitOfMeasurement ?? "",
        n.lastUpdated?.toISOString() ?? "",
      );
    }
  });

  const registry = await client.devices.getDeviceRegistry();
  console.log("device registry entries:", registry.length);
}

void main();
