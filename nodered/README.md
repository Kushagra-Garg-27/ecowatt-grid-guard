# EcoWatt Grid Guard — Node-RED Visual IoT Flow Integration (Prototype & Audit Pipeline)

> [!NOTE]
> **SIMULATION & AUDIT STATUS**:
> The flows in this directory (`flows.json`) represent an **engineering prototype and visual audit pipeline** designed for Software-in-the-Loop (SIL) demonstration.
> - **Monitoring & Alerting Role**: Node-RED monitors MQTT telemetry streams and publishes alerts to `ecowatt/alerts` when demand exceeds the 7.00 kW threshold or when an unauthorized curtailment command is published for a critical load.
> - **No Inline Hardware Blocking**: Node-RED acts as a non-intrusive security auditor and alerting node; it does **not** act as an inline electrical circuit breaker or physical hardware gateway. Critical load protection is enforced at multiple layers: in the Python optimization engine, in the virtual actuator manager, and via the physical GPIO23 safety interlock jumper on the ESP32 actuator firmware.

---

## 1. Flow Overview

The flow integrates with the EcoWatt MQTT broker (`127.0.0.1:1883`) across the following published topics:

| Topic Pattern | Audit & Alerting Function |
| :--- | :--- |
| `ecowatt/building/demand` | Subscribes to real-time active building demand (kW), compares against configured threshold ($P_{\text{threshold}} = 7.00\text{ kW}$) and target ($P_{\text{target}} = 6.80\text{ kW}$), and triggers an alert if violated. |
| `ecowatt/alerts` | Emits `CRITICAL_DEMAND_EXCEEDANCE` alert payloads with required demand reduction metrics, as well as `SECURITY_AUDIT_FAIL` alerts. |
| `ecowatt/load/+/command` | Audits dispatched actuator commands in real-time. If a command attempts to curtail a protected critical load (e.g. `srv_it_rack_1`), an alert is routed to `ecowatt/alerts` and the command is blocked from the pass-through output. |
| `ecowatt/load/+/ack` | Subscribes to actuator execution acknowledgements, tracking power change and latency metrics. |
| `ecowatt/optimization/events` | Monitors closed-loop iterative optimization cycles and residual demand post-actuation. |

---

## 2. Broker Connection Architecture

By default, the Node-RED flow connects to the **embedded asyncio MQTT broker** bundled directly with EcoWatt Grid Guard on `127.0.0.1:1883`. An external standalone Eclipse Mosquitto broker can optionally be substituted via `docker-compose.yml` without modifying flow configurations.

---

## 3. How to Import and Run the Flows

1. Start Node-RED in a terminal:
   ```bash
   npx --yes node-red --userDir nodered nodered/flows.json
   ```
2. Open your browser and navigate to:
   ```
   http://127.0.0.1:1880
   ```
3. The flow is automatically loaded from `nodered/flows.json`. If importing manually:
   - In the top-right menu (&equiv;), select **Import**.
   - Select `nodered/flows.json` and click **Import**, then click **Deploy**.

---

## 4. Verification

- Ensure the EcoWatt backend is running (FastAPI on `8000` / embedded MQTT on `1883`).
- Open the Node-RED **Debug** sidebar (bug icon).
- When a demand exceedance occurs ($>7.00\text{ kW}$), the `Demand Threshold Evaluator` node triggers and emits a structured alert to `ecowatt/alerts`.
- When an unauthorized curtailment command is dispatched targeting a critical load (`srv_it_rack_1`), the `Critical Load Safety Auditor` intercepts the event, publishes `SECURITY_AUDIT_FAIL` to `ecowatt/alerts`, and terminates forwarding along the safe command path.
