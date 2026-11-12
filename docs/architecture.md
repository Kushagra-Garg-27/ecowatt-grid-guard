# EcoWatt Grid Guard — System Architecture Specification

## 1. Executive Summary

**EcoWatt Grid Guard** is a software-in-the-loop IoT smart-building energy management system designed to perform dynamic peak-demand shaving, context-aware load curtailment, deadline-constrained load shifting, and carbon footprint reduction while maintaining mission-critical facility infrastructure.

The architecture strictly reflects the technical mechanisms disclosed in the patent draft:
*SYSTEM AND METHOD FOR IoT-BASED DYNAMIC ENERGY OPTIMIZATION AND PEAK-LOAD SHIFTING IN BUILDINGS.*

---

## 2. High-Level System Architecture

```
+-----------------------------------------------------------------------------------+
|                        VIRTUAL IoT SENSOR NODES (5 ZONES)                        |
|   [Classroom]  [Computer Lab]  [Faculty Office]  [Main Corridor]  [Server Room]  |
|         Active Power (kW), Voltage (V), Current (A), Temp (°C), Occupancy         |
+-----------------------------------------------------------------------------------+
                                          |
                                          | CoAP over UDP (Port 5683)
                                          | Endpoints: /telemetry/{power,occ,env,status}
                                          v
+-----------------------------------------------------------------------------------+
|                           PYTHON EDGE GATEWAY AGGREGATOR                          |
|         - Packet Validation & Timestamp Alignment                                 |
|         - Sensor Health & Heartbeat Timeout Detection                             |
|         - Real-Time Building State Estimation & Active Power Aggregation          |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                     CLOSED-LOOP ENERGY OPTIMIZATION ENGINE                        |
|                                                                                   |
|   STAGE A: Demand Threshold Detection (P_total > P_threshold)                     |
|            P_target = P_threshold - P_margin; P_required = P_total - P_target     |
|                                                                                   |
|   STAGE B: Load Priority Scoring (LPS) & Ranking                                  |
|            LPS_k = w_s*S_k + w_o*(1 - Occ/Occ_max) + w_p*(P/P_max) + w_t*(T/T_max) |
|            CRITICAL LOADS (S_k = 0): STRICTLY EXCLUDED                            |
|                                                                                   |
|   STAGE C: Selective Curtailment & Modulation (Binary & Continuous VAV/Dimming)   |
|                                                                                   |
|   STAGE D: Iterative Actuation, Post-Actuation Remeasurement & Feedback Loop      |
+-----------------------------------------------------------------------------------+
       |                                                            |
       | MQTT Command Dispatch                                      | MQTT Telemetry &
       | QoS 1 (Port 1883)                                          | State Updates
       v                                                            v
+-----------------------------+                           +-------------------------+
|    MOSQUITTO MQTT BROKER    |                           |      REACT DASHBOARD    |
|   Topic: ecowatt/load/+/cmd |                           |     (Vite + TypeScript) |
+-----------------------------+                           +-------------------------+
       |                                                            ^
       v                                                            | WebSocket
+-----------------------------+                                     | (Port 8000)
|    VIRTUAL ACTUATOR FLEET   |                                     |
|  - Binary Switches          |                                     |
|  - Continuous Modulators    |                                     |
|  - Execution Verification   |                                     |
+-----------------------------+                                     |
       |                                                            |
       | Actual Power Remeasurement & Acknowledgement               |
       | Topic: ecowatt/load/+/ack                                  |
       v                                                            |
+-------------------------------------------------------------------+
|                       EDGE GATEWAY FEEDBACK                       |
|   - Reassess Residual Demand: P_residual = P_actual - P_target    |
|   - Progressive Restoration via Hysteresis (Ascending LPS Order)  |
+-------------------------------------------------------------------+
```

---

## 3. Communication Protocols

### 3.1 CoAP over UDP (Constrained Application Protocol)
- **Transport**: UDP on port `5683`.
- **Library**: `aiocoap` v0.4.17+.
- **Endpoints**:
  - `POST /telemetry/power`: active power (kW), line voltage (V), current (A), power factor.
  - `POST /telemetry/occupancy`: headcount, max capacity, motion detection.
  - `POST /telemetry/environment`: ambient temperature (°C), relative humidity (%), lux level.
  - `POST /telemetry/status`: node health flag, battery percentage, firmware version.
- **Handling**: Stateless asynchronous request/response. Returns `2.04 CHANGED` on successful ingestion or `4.00 BAD REQUEST` on validation failure.

### 3.2 MQTT (Message Queuing Telemetry Transport)
- **Transport**: TCP on port `1883`.
- **Client**: `paho-mqtt` v2.2.0+.
- **Broker**: Eclipse Mosquitto compatible, with built-in asyncio embedded fallback broker.
- **QoS Level**: QoS 1 (At least once delivery) with application-layer command identifiers and acknowledgement matching.
- **Topic Hierarchy**:
  - `ecowatt/building/demand`: Aggregated building power, threshold, and target status.
  - `ecowatt/building/status`: Comprehensive facility health and active alarm count.
  - `ecowatt/zone/{zone_id}/telemetry`: Zone-specific environmental and occupancy stream.
  - `ecowatt/load/{load_id}/command`: Control instructions dispatched from optimizer to actuators.
  - `ecowatt/load/{load_id}/ack`: Actuator execution status, measured latency, and post-actuation power.
  - `ecowatt/optimization/events`: Audit record of mitigation cycles and residual demand.
  - `ecowatt/alerts`: High-priority threshold violation notifications.

---

## 4. Electrical Load Taxonomy

The building models 19 distinct electrical loads classified into three strict operational tiers:

### Tier 1: Critical Loads ($S_k = 0.0$)
- `srv_it_rack_1` (1.80 kW) & `srv_it_rack_2` (1.20 kW): Primary IT blade chassis and SAN storage.
- `srv_cool_pri` (1.50 kW): Server room precision CRAC cooling unit.
- `cls_emerg_light` (0.08 kW) & `cor_emerg_light` (0.12 kW): Life-safety and pathway lighting.
- `srv_safety_sys` (0.20 kW): Central fire alarm and safety monitoring node.
- **Invariant**: Hardcoded $S_k = 0.0$. Excluded from the candidate curtailment queue. Software and hardware actuator rejection prevents automatic or unauthorized manual curtailment.

### Tier 2: Flexible Loads ($0.55 \le S_k \le 0.95$)
- General lighting (`cls_light_main`, `lab_light_main`, `off_light_main`, `cor_light_main`).
- Comfort HVAC (`cls_hvac`, `lab_hvac`, `off_hvac`).
- Non-essential auxiliary sockets (`lab_sockets_aux`, `off_sockets_aux`, `cls_projector_aux`).
- **Control**: Binary switching or continuous inverter/dimming modulation subject to strict $P_{min}$ boundaries.

### Tier 3: Deferrable Loads
- `bld_ev_charger_1` (2.20 kW, 6.60 kWh): Level 2 fleet EV charger.
- `bld_water_heater` (1.50 kW, 3.00 kWh): Central thermal storage water heater.
- `bld_battery_storage` (1.00 kW, 2.50 kWh): Auxiliary emergency battery buffer.
- **Control**: Temporal rescheduling to minimum composite cost/carbon windows before hard completion deadlines.

---

## 5. Patent-Draft Consistency Verification

| Disclosed Patent Feature | Software Implementation | Verification Location |
| :--- | :--- | :--- |
| Distributed Sensing | 5 virtual zone IoT nodes measuring electrical & environmental parameters | `backend/app/sensors/virtual_sensor.py` |
| CoAP Telemetry | Real CoAP over UDP with 4 distinct URI resources | `backend/app/gateway/coap_server.py` |
| Edge Aggregation | State estimation, timeout detection, active power summation | `backend/app/gateway/aggregator.py` |
| Curtailment Suitability | Explicit parameter $S_k \in [0, 1]$; $S_k = 0$ for critical loads | `backend/app/simulation/scenarios.py` |
| Load Priority Score (LPS) | Multi-criteria formulation with configurable normalized weights | `backend/app/optimizer/lps.py` |
| Multi-Stage Optimization | Threshold check $\to$ LPS ranking $\to$ Selective curtailment $\to$ Iterative feedback | `backend/app/optimizer/engine.py` |
| Deferrable Load Shifting | Objective: $\min \int [\beta \cdot \text{Tariff} + (1-\beta)\cdot \text{Carbon}] P_{load} dt$ | `backend/app/optimizer/scheduler.py` |
| MQTT Command Dissemination | Structured topic hierarchy, JSON payloads, QoS 1 | `backend/app/communication/mqtt_client.py` |
| Actual Power Remeasurement | Post-actuation measurement before subsequent load curtailment | `backend/app/optimizer/engine.py` |
| Ack Failure Handling | Missing ack $\to$ mark uncertain $\to$ remeasure $\to$ curtail next load | `backend/app/optimizer/engine.py` |
| Progressive Restoration | Hysteresis buffer $\to$ restore loads in ascending LPS order | `backend/app/actuators/restoration.py` |
| Sustainability Accounting | Rigorous hourly energy, ToU cost, and time-varying carbon calculation | `backend/app/analytics/sustainability.py` |

