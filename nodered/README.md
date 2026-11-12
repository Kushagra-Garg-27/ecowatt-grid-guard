# EcoWatt Grid Guard — Node-RED Visual IoT Flow Integration

This directory contains production-ready, importable Node-RED flows (`flows.json`) designed to visualize and audit the live IoT messaging, demand threshold alerts, and actuator feedback loops for the **EcoWatt Grid Guard** system.

---

## 1. Flow Overview

The flow integrates directly with the running EcoWatt MQTT broker (`127.0.0.1:1883`) across the following published topics:

| Topic Pattern | Function |
| :--- | :--- |
| `ecowatt/building/demand` | Subscribes to real-time active building demand (kW), compares against `P_threshold` (7.00 kW) and `P_target` (6.80 kW), and triggers an alert if violated. |
| `ecowatt/alerts` | Emits `CRITICAL_DEMAND_EXCEEDANCE` alert payloads with required demand reduction metrics. |
| `ecowatt/load/+/command` | Audits dispatched actuator commands in real-time, verifying that no critical loads are ever curtailed. |
| `ecowatt/load/+/ack` | Subscribes to actuator execution acknowledgements, tracking power change and latency metrics. |
| `ecowatt/optimization/events` | Monitors closed-loop iterative optimization runs and residual demand post-actuation. |

---

## 2. Prerequisites & Setup

1. **Node.js**: Ensure Node.js v18+ is installed (`node -v`).
2. **Node-RED**: Install Node-RED globally if not already installed:
   ```bash
   npm install -g --unsafe-perm node-red
   ```

---

## 3. How to Import and Run the Flows

1. Start Node-RED in a terminal:
   ```bash
   node-red
   ```
2. Open your browser and navigate to:
   ```
   http://127.0.0.1:1880
   ```
3. In the top-right menu (&equiv;), select **Import**.
4. Click **select a file to import** and choose `nodered/flows.json` (or paste the file contents).
5. Click **Import**, then click the red **Deploy** button in the top-right corner.

---

## 4. Verification

- Ensure the EcoWatt backend is running (port `8000` / MQTT on `1883`).
- Open the Node-RED **Debug** tab (bug icon on the right sidebar).
- You will see live telemetry, demand evaluation, actuator acknowledgements, and safety audit logs streaming directly from the Python edge gateway.

