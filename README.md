# home-assistant-node-client

TypeScript-first SDK for [Home Assistant](https://www.home-assistant.io/) on Node.js **18+**. It wraps the REST API, optionally connects to the WebSocket API for live events, and adds small helpers for domains, state normalization, and common service calls.

## Installation

```bash
npm install home-assistant-node-client
```

## Prerequisites

- A running Home Assistant instance reachable from your app.
- A **long-lived access token** (Profile → Security → Long-Lived Access Tokens).

## Quick start (REST only)

```ts
import { HomeAssistantClient } from "home-assistant-node-client";

const client = new HomeAssistantClient({
  baseUrl: "HA_BASE_URL", // FOR EXAMPLE -> "http://localhost:8123",
  token: "<HA_TOKEN>", // your Long-lived access token  
});

const { message } = await client.server.ping();
console.log(message);

const config = await client.server.getConfiguration();
console.log(config.version, config.location_name);

const states = await client.devices.getAllDevices();
console.log("entities:", states.length);
```

`client.ws` is `undefined` until you call `connectWebSocket()` (see below).

## States by domain (automations, switches, sensors, …)

Use typed core domains for autocomplete, or pass any string for custom integration domains.

```ts
const automations = await client.server.listStatesByCoreDomain("automation");
const switches = await client.server.listStatesByCoreDomain("switch");

// Custom integration domain (not in the built-in union)
const custom = await client.server.listStatesByEntityDomain("my_integration");
```

## Simplified actions (on/off, automations, scripts, scenes)

`client.actions` maps entity IDs to the correct Home Assistant services (`turn_on` / `turn_off`, `lock` / `unlock`, `open_cover` / `close_cover`, etc.).

```ts
await client.actions.turnOn("light.living_room");
await client.actions.turnOff("switch.plug");

await client.actions.setAutomationEnabled("automation.alerts", true);
await client.actions.setAutomationEnabled("automation.alerts", false);

await client.actions.triggerScript("script.good_morning");
await client.actions.activateScene("scene.movie");

// Optional extra fields supported by Home Assistant (brightness, color, …)
await client.actions.turnOn("light.living_room", { brightness_pct: 40 });
```

For uncommon services, use the low-level API:

```ts
await client.server.callService("notify", "mobile_app", {
  message: "Hello",
});
```

## WebSocket: connect and listen

Call `connectWebSocket()` to open the API WebSocket and populate `client.ws`. You can enable automatic reconnect with `webSocketReconnect: true`.

```ts
const client = new HomeAssistantClient({
  baseUrl: process.env.HA_BASE_URL!,
  token: process.env.HA_TOKEN!,
  webSocketReconnect: true,
});

await client.connectWebSocket();

client.ws!.on("connected", () => console.log("WebSocket connected"));
client.ws!.on("disconnected", () => console.log("WebSocket disconnected"));

client.ws!.on("state_changed", (ev) => {
  console.log(ev.entity_id, ev.new_state?.state);
});

client.ws!.on("automation_triggered", (ev) => {
  console.log("Automation run started:", ev.entity_id, ev.name, ev.data);
});
```

Emitted events:


| Event                        | Meaning                                                                                                                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connected` / `disconnected` | Connection lifecycle                                                                                                                                                                                        |
| `state_changed`              | Any entity state change (live stream of what backs `/api/states` over time)                                                                                                                                 |
| `automation_triggered`       | Fired when an automation starts running. Home Assistant does not expose a standard “automation finished” bus event (a workaround based on tracking the automation state/config may be added in the future). |


Some methods require WebSocket in this SDK (for example `client.devices.getDeviceRegistry()`).

### Registries (WebSocket only)

Home Assistant does **not** expose `GET /api/config/entity_registry/list` in core. Use the WebSocket API instead:

| Method | WebSocket command |
|--------|-------------------|
| `client.ws!.listDeviceRegistry()` | `config/device_registry/list` |
| `client.ws!.listEntityRegistry()` | `config/entity_registry/list` |

Each entity registry row includes a `device_id` when the entity belongs to a physical device; that ID matches `device.id` in the device registry (same grouping as the HA UI device pages).

## Device tree (group entities by device)

Build the same **device → entities** structure as in Settings → Devices: one entry per device, with all related entities nested underneath.

```ts
await client.connectWebSocket();

// Structured data
const tree = await client.devices.getDeviceTree();
for (const { device, entities } of tree.devices) {
  console.log(device.name ?? device.id, entities.map((e) => e.entity_id));
}
// Entities without a device (helpers, some core entities, …)
console.log(tree.unassignedEntities.length);

// FOR CLI (OR DEBUG CASES )
console.log(await client.devices.getDeviceTreeAsText());
// Without live state values:
console.log(await client.devices.getDeviceTreeAsText(false));
```

Lower-level helpers (same package) if you already fetched registry arrays:

```ts
import {
  buildHaDeviceTree,
  formatDeviceTreeAsText,
  statesArrayToMap,
} from "home-assistant-node-client";

const tree = buildHaDeviceTree(devices, entities);
const states = await client.devices.getAllDevices();
const text = formatDeviceTreeAsText(tree, {
  statesByEntityId: statesArrayToMap(states),
});
```

## State normalization

Helpers turn raw `HassState` / `state_changed` payloads into a consistent shape (`valueKind`, `coreDomain`, booleans for on/off entities, etc.).

```ts
import {
  normalizeStateChangedEvent,
  normalizeHassState,
} from "home-assistant-node-client";

client.ws!.on("state_changed", (ev) => {
  const n = normalizeStateChangedEvent(ev, "new");
  if (n) {
    console.log(n.entityId, n.coreDomain, n.valueKind, n.rawState);
  }
});

const state = await client.devices.getEntityState("sensor.temperature");
const normalized = normalizeHassState(state);
```


### Example scripts (this repository)

```bash
npm run test:rest_api_only   # requires .env with HA_BASE_URL and HA_TOKEN
npm run test:with_websocket
```

Examples under `examples/` import from `../dist/index.js`; run `npm run build` first, or point imports at the package name once installed.

## License

MIT