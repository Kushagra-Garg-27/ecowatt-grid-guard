# EcoWatt Grid Guard
### IoT-Based Dynamic Energy Optimization, Peak-Load Shifting and Carbon Reduction System

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.0+-61DAFB.svg?logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![CoAP](https://img.shields.io/badge/CoAP-UDP_5683-FF6F00.svg)](https://aiocoap.readthedocs.io/)
[![MQTT](https://img.shields.io/badge/MQTT-Mosquitto_1883-660066.svg?logo=eclipse-mosquitto&logoColor=white)](https://mosquitto.org/)
[![Python](https://img.shields.io/badge/Python-3.12+-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
[![Tests](https://img.shields.io/badge/Pytest-23_Passed_100%25-brightgreen.svg)](docs/testing.md)

---

## 1. Project Overview

**EcoWatt Grid Guard** is an end-to-end, software-in-the-loop IoT smart-building energy management system designed to dynamically shave peak demand, selectively curtail and modulate flexible electrical loads, schedule deferrable energy consumption to low-cost and low-carbon windows, and protect mission-critical loads.

The system is aligned with the patent draft titled:
> **SYSTEM AND METHOD FOR IoT-BASED DYNAMIC ENERGY OPTIMIZATION AND PEAK-LOAD SHIFTING IN BUILDINGS.**

---

## 2. Problem Statement

Commercial and institutional facilities face escalating energy costs and carbon intensity under dynamic Time-of-Use (ToU) tariffs and grid congestion. Peak demand periods (e.g., afternoon EV charging, laboratory sessions, and HVAC cooling) trigger severe utility demand charges and force grid operators to fire carbon-intensive peaker plants. Conventional building automation systems rely on static threshold shedding or crude time clocks that either disrupt critical infrastructure or fail to respond to dynamic occupancy and real-time grid carbon signals.

---

## 3. Project Objectives

1. Simulate a multi-zone university/commercial building with 5 distinct functional zones and virtual IoT sensor nodes.
2. Ingest real-time telemetry using **CoAP over UDP** (port `5683`).
3. Aggregate readings and maintain building state via a Python edge gateway.
4. Detect demand threshold violations ($P_{total} > P_{threshold}$) and evaluate target demand ($P_{target} = P_{threshold} - P_{margin}$).
5. Compute a context-aware **Load Priority Score (LPS)** balancing suitability, occupancy, power draw, and tariff.
6. Strictly protect **critical loads** ($S_k = 0$) from automatic or unauthorized curtailment.
7. Selectively curtail or continuously modulate flexible loads.
8. Perform deadline-constrained load shifting for deferrable loads (EV fleet charging, water heating, battery buffer).
9. Dispatch commands and receive acknowledgements using **MQTT** (port `1883`, QoS 1).
10. Remeasure actual power post-actuation and execute iterative closed-loop corrective control.
11. Present a professional engineering dashboard built with React, TypeScript, Tailwind CSS, and Recharts.
12. Compute rigorous energy, cost, peak demand, and carbon metrics across 10 reproducible simulation scenarios.

---

## 4. Technology Stack

- **Backend & Edge Gateway**: Python 3.12, FastAPI, Pydantic v2, SQLAlchemy, aiosqlite, SQLite, asyncio, Uvicorn.
- **Scientific Computing**: NumPy, Pandas, SciPy.
- **IoT Communication**:
  - `aiocoap` (v0.4.17+): Native CoAP server and client over UDP on port `5683`.
  - `paho-mqtt` (v2.2.0+): MQTT client with structured topic hierarchy, QoS 1, and acknowledgements.
  - Eclipse Mosquitto & Embedded Asyncio MQTT Broker (fallback on port `1883`).
- **Frontend Dashboard**: React 18, TypeScript, Vite, Tailwind CSS v4, Recharts, Lucide Icons.
- **Visual IoT Integration**: Node-RED (`nodered/flows.json`).
- **Testing & DevOps**: `pytest`, `pytest-asyncio`, `httpx`, Docker Compose.

---

## 5. System Architecture

```
VIRTUAL IoT SENSOR NODES (5 ZONES)
        |
        | CoAP over UDP (Port 5683)
        v
PYTHON EDGE GATEWAY AGGREGATOR
        |
        v
DEMAND ANALYSIS & FORECASTING
        |
        v
LOAD PRIORITY SCORING (LPS)
        |
        v
MULTI-STAGE OPTIMIZATION ENGINE
        |
        | MQTT QoS 1 (Port 1883)
        v
MOSQUITTO MQTT BROKER <---+
        |                 |
        +--------+        | Acknowledgement &
        |        |        | Actual Power Remeasurement
        v        v        |
   REACT UI   ACTUATORS --+
                 |
                 v
      EDGE GATEWAY FEEDBACK
                 |
                 v
   REASSESSMENT & RESTORATION
```

---

## 6. Data Flow

1. **Virtual Sensor Sampling**: Zone sensors sample active power, voltage, current, temperature, and occupancy every 2 seconds.
2. **CoAP Ingestion**: Packets are POSTed over UDP to `/telemetry/power`, `/telemetry/occupancy`, `/telemetry/environment`, and `/telemetry/status`.
3. **Gateway State Estimation**: The edge gateway validates timestamps, updates zone state, and evaluates total building demand.
4. **Demand Threshold Evaluation**: If $P_{total} > P_{threshold}$, required demand reduction is calculated as $P_{required} = P_{total} - P_{target}$.
5. **LPS Evaluation & Queue Sorting**: Candidate flexible loads are ranked in descending order of LPS. Critical loads ($S_k = 0$) are excluded.
6. **Actuation Dispatch**: The top-ranked load receives an MQTT command on `ecowatt/load/{id}/command`.
7. **Post-Actuation Remeasurement**: The actuator returns actual power on `ecowatt/load/{id}/ack`. The gateway remeasures total demand and verifies whether additional loads need curtailment.
8. **Progressive Restoration**: When demand falls below target by at least the hysteresis margin ($0.50\text{ kW}$), loads are restored in ascending LPS order.

---

## 7. CoAP Implementation

Implemented using `aiocoap` over UDP port `5683`:
- `/telemetry/power`: active power (kW), voltage (V), current (A), power factor.
- `/telemetry/occupancy`: headcount, max capacity, motion detection.
- `/telemetry/environment`: ambient temperature (°C), relative humidity (%), lux level.
- `/telemetry/status`: node health flag, battery percentage, firmware version.

The server returns `2.04 CHANGED` upon successful ingestion and state estimation.

---

## 8. MQTT Implementation

- **Broker**: Compatible with Eclipse Mosquitto on port `1883`, featuring an embedded asyncio broker fallback.
- **Topic Hierarchy**:
  - `ecowatt/building/demand`: Live building active demand and threshold status.
  - `ecowatt/building/status`: Health state and active alarm counts.
  - `ecowatt/zone/{zone_id}/telemetry`: Zone-specific data.
  - `ecowatt/load/{load_id}/command`: Control commands dispatched to actuators.
  - `ecowatt/load/{load_id}/ack`: Execution status, actual power, and latency.
  - `ecowatt/optimization/events`: Complete audit log of closed-loop mitigation cycles.
  - `ecowatt/alerts`: Urgent threshold violation notifications.

---

## 9. Edge Gateway

The Python edge gateway (`backend/app/gateway/aggregator.py`):
- Monitors heartbeat timeouts (marking unresponsive nodes as `DEGRADED` after 30s and `FAULTED` after 60s).
- Validates electrical physics: $I = \frac{P \times 1000}{V \times \text{pf}}$ and realistic line voltage drops.
- Maintains rolling history for streaming to the dashboard via WebSockets.

---

## 10. Load Priority Score (LPS)

The context-aware ranking score is formulated as:

$$LPS_k(t) = w_s S_k + w_o \left(1 - \frac{Occ_j(t)}{Occ_{max,j}}\right) + w_p \left(\frac{P_k(t)}{P_{max}}\right) + w_t \left(\frac{\text{Tariff}(t)}{\text{Tariff}_{max}}\right)$$

Where:
- $S_k$: Curtailment Suitability Index ($0.0 \le S_k \le 1.0$).
- $Occ_j(t) / Occ_{max,j}$: Current occupancy headcount ratio in zone $j$.
- $P_k(t) / P_{max}$: Current power consumption normalized by $P_{max} = 10.0\text{ kW}$.
- $\text{Tariff}(t) / \text{Tariff}_{max}$: Current electricity tariff normalized by $\text{Tariff}_{max} = \$0.50/\text{kWh}$.
- $w_s, w_o, w_p, w_t$: Non-negative weights summing strictly to $1.0$ (Default: $0.40, 0.20, 0.20, 0.20$).

**Crucial Invariant**: Critical loads have $S_k = 0.0$ and return $LPS = 0.000$, excluding them from automatic curtailment queues.

---

## 11. Multi-Stage Optimization Engine

1. **Stage A (Threshold Detection)**:
   - Condition: $P_{total} > P_{threshold}$ ($7.00\text{ kW}$).
   - Target demand: $P_{target} = P_{threshold} - P_{margin} = 7.00 - 0.20 = 6.80\text{ kW}$.
   - Required reduction: $P_{required} = \max(0, P_{total} - P_{target})$.
2. **Stage B (Load Selection)**:
   - Exclude critical loads.
   - Exclude faulted or uncertain actuators.
   - Rank eligible flexible loads by descending LPS.
3. **Stage C (Selective Curtailment)**:
   - Modulate continuous loads (HVAC inverter frequency, dimmable LED arrays).
   - Switch binary auxiliary sockets off.
   - Respect minimum operating constraints ($P_{min}$).
4. **Stage D (Iterative Closed-Loop Control)**:
   - Dispatch actuator command.
   - Receive acknowledgement.
   - Remeasure actual power draw.
   - Recalculate residual demand: $P_{residual} = \max(0, P_{actual} - P_{target})$.
   - Stop when target is achieved ($P_{actual} \le P_{target}$) or no eligible flexible loads remain.

---

## 12. Deferrable Load Shifting

Deadline-constrained scheduler for:
- Level 2 EV Fleet Charger ($2.20\text{ kW}$, $6.60\text{ kWh}$)
- Central Sanitary Water Heater ($1.50\text{ kW}$, $3.00\text{ kWh}$)
- Auxiliary Battery Buffer Storage ($1.00\text{ kW}$, $2.50\text{ kWh}$)

**Objective**:
$$\min \int_{t_{start}}^{t_{deadline}} \left[ \beta \cdot \frac{\text{Tariff}(t)}{\text{Tariff}_{max}} + (1 - \beta) \cdot \frac{\text{Carbon}(t)}{\text{Carbon}_{max}} \right] P_{load}(t) \, dt$$
Subject to:
- Required energy delivery completed before deadline.
- Total building demand $+ P_{load} \le P_{threshold}$ to prevent artificial peak creation.

---

## 13. Critical-Load Protection

The following loads are designated **CRITICAL**:
- `srv_it_rack_1` (1.80 kW) & `srv_it_rack_2` (1.20 kW): Server IT Blade Chassis & SAN Storage.
- `srv_cool_pri` (1.50 kW): Server Room Precision Cooling Primary.
- `cls_emerg_light` (0.08 kW) & `cor_emerg_light` (0.12 kW): Emergency Life-Safety Lighting.
- `srv_safety_sys` (0.20 kW): Fire Suppression & Safety Node.

**Protection Guarantees**:
- Hardcoded $S_k = 0.0$.
- Excluded from optimizer candidate queues.
- Actuators reject any curtailment command with `REJECTED_CRITICAL_PROTECTED`.
- API rejects manual override attempts with `403 Forbidden`.
- In all 10 simulation test runs, **0 critical load interruptions occurred**.

---

## 14. Closed-Loop Feedback & Restoration

- **Actuator Timeout Handling**: If an actuator fails to acknowledge, its state is marked `UNCERTAIN`. Actual power is remeasured, and the next eligible load in the queue is actuated.
- **Progressive Restoration**: When building demand falls below $P_{target} - P_{hysteresis}$ ($6.30\text{ kW}$), curtailed loads are restored in **ascending LPS order** (recovering essential comfort loads first).

---

## 15. React Dashboard

A modern, responsive, dark-mode engineering dashboard with 7 dedicated pages:
- **A. Overview Dashboard**: Real-time power gauge, threshold limit, target, live alerts, and 24h demand chart.
- **B. Building Zones**: Multi-zone cards showing headcount, temperatures, voltage/current, and connected loads.
- **C. Load Management**: Inventory of 19 loads with live LPS scores and manual demonstration controls.
- **D. Optimization Centre**: Real-time threshold adjustments, LPS weights configuration sliders, and event history.
- **E. Load Scheduler**: Deferrable EV/water heater schedules, ToU tariff curve, and carbon intensity curves.
- **F. Sustainability & Analytics**: Comparative 24h load curve, net energy saved, cost saved, carbon avoided, and CSV export.
- **G. IoT Communication Monitor**: Live packet viewer for CoAP UDP and Mosquitto MQTT message feeds.

---

## 16. Sustainability Calculations

- **Net Energy Saved**: $E_{saved} = \sum (P_{baseline}(t) - P_{optimized}(t)) \Delta t$
- **Cost Savings**: $\text{Cost} = \sum E(t) \times \text{Tariff}(t)$
- **Avoided Carbon Emissions**: $\text{Emissions} = \sum E(t) \times \text{Carbon}(t)$
- **Peak Reduction**: $\text{Peak Reduction \%} = \frac{P_{peak,baseline} - P_{peak,optimized}}{P_{peak,baseline}} \times 100\%$

---

## 17. Installation

```powershell
# 1. Clone repository
git clone <repo_url>
cd "EcoWatt-Grid-Guard"

# 2. Install Python dependencies
py -3.12 -m pip install -r backend/requirements.txt

# 3. Install Frontend dependencies
cd frontend
npm install
cd ..
```

---

## 18. Execution

### Quick Start (Windows):
```powershell
.\scripts\start_all.ps1
```
Or start manually in two terminals:
- **Terminal 1**: `py -3.12 -m uvicorn backend.app.main:app --port 8000 --reload`
- **Terminal 2**: `cd frontend && npm run dev`

Access the services:
- **Dashboard**: `http://localhost:5173`
- **REST API Docs**: `http://127.0.0.1:8000/docs`

---

## 19. Testing & Actual Results

Execute the automated test suite:
```powershell
py -3.12 -m pytest backend/tests -v
```

### Actual Test Results (Executed on Windows 11, Python 3.12):
```
============================= test session starts =============================
backend/tests/test_integration_api.py::test_api_health PASSED            [  4%]
backend/tests/test_integration_api.py::test_api_building_status PASSED   [  8%]
backend/tests/test_integration_api.py::test_api_zones PASSED             [ 13%]
backend/tests/test_integration_api.py::test_api_loads_and_critical_protection PASSED [ 17%]
backend/tests/test_integration_api.py::test_api_threshold_configuration PASSED [ 21%]
backend/tests/test_integration_api.py::test_api_weights_configuration PASSED [ 26%]
backend/tests/test_integration_coap.py::test_real_coap_telemetry_flow PASSED [ 30%]
backend/tests/test_integration_mqtt.py::test_mqtt_pub_sub_pipeline PASSED [ 34%]
backend/tests/test_system_scenarios.py::test_peak_demand_demonstration_scenario PASSED [ 39%]
backend/tests/test_system_scenarios.py::test_all_ten_scenarios_execute_with_zero_critical_interruptions PASSED [ 43%]
backend/tests/test_system_scenarios.py::test_failed_actuator_acknowledgement_scenario PASSED [ 47%]
backend/tests/test_unit_actuator.py::test_critical_load_rejection PASSED [ 52%]
backend/tests/test_unit_actuator.py::test_flexible_load_modulation PASSED [ 56%]
backend/tests/test_unit_actuator.py::test_flexible_load_clamping_to_minimum PASSED [ 60%]
backend/tests/test_unit_actuator.py::test_simulated_actuator_failure PASSED [ 65%]
backend/tests/test_unit_lps.py::test_lps_standard_calculation PASSED     [ 69%]
backend/tests/test_unit_lps.py::test_critical_load_strictly_zero_lps PASSED [ 73%]
backend/tests/test_unit_lps.py::test_zero_suitability_returns_zero_lps PASSED [ 78%]
backend/tests/test_unit_lps.py::test_division_by_zero_and_boundary_handling PASSED [ 82%]
backend/tests/test_unit_lps.py::test_weight_normalization PASSED         [ 86%]
backend/tests/test_unit_scheduler.py::test_scheduler_deadline_and_energy_delivery PASSED [ 91%]
backend/tests/test_unit_sustainability.py::test_energy_cost_carbon_calculations PASSED [ 95%]
backend/tests/test_unit_sustainability.py::test_threshold_exceedance_duration PASSED [100%]

======================== 23 passed, 1 warning in 2.41s ========================
```

### Actual Demonstration Scenario Output (`peak_demand_event`):
- **Baseline Peak Demand**: $8.60\text{ kW}$
- **Configured Threshold**: $7.00\text{ kW}$ (Target: $6.80\text{ kW}$)
- **Optimized Peak Demand**: $6.93\text{ kW}$
- **Peak Shaving**: $1.67\text{ kW}$ ($19.5\%$ reduction)
- **Baseline Cost**: $\$33.72$ $\to$ **Optimized Cost**: $\$32.81$ (Cost Saved: $\$0.92$ / $2.7\%$)
- **Avoided Carbon Emissions**: $0.77\text{ kg CO}_2$ ($2.1\%$)
- **Shifted Energy**: $6.29\text{ kWh}$
- **Threshold Exceedance**: $180\text{ minutes baseline} \to 0\text{ minutes optimized}$
- **Critical Load Interruptions**: **0 (Zero)**

---

## 20. Known Limitations

1. **Software-in-the-Loop Emulation**: Actuators and sensors operate with simulated physical electrical dynamics; physical microcontrollers (e.g. ESP32, Raspberry Pi) can be connected by pointing their CoAP/MQTT client to the gateway IP.
2. **Simplified Thermal Inertia**: Room temperature dynamics utilize a lumped-capacitance 1-R-1-C thermal model rather than 3D finite-element CFD building simulations.
3. **Single Grid Phase Modeling**: The system models a balanced single-phase equivalent grid bus ($230\text{V}$ line voltage); multi-phase unbalance estimation is not modeled.

