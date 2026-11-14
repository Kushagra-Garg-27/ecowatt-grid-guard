# EcoWatt Grid Guard — Energy Simulation Methodology

## 1. Simulation Architecture

EcoWatt Grid Guard incorporates a deterministic 24-hour simulation engine modeling multi-zone building thermal dynamics, occupancy schedules, grid tariffs, time-varying carbon intensity, and load behavior.

- **Temporal Resolution**: 96 intervals per day (15-minute sampling interval $\Delta t = 0.25\text{ h}$).
- **Reproducibility**: Controlled random number generator seeds (`seed = 42`) guarantee that baseline and optimized runs start from identical initial states.
- **Data Persistence**: Results are written to `data/generated/{scenario_id}_simulation_results.csv`.
- **Validation Scope**: Operates in a **Software-in-the-Loop (SIL)** environment where sensor nodes communicate via real CoAP UDP sockets and actuators respond via real MQTT topics on loopback/local interfaces. Physical hardware testing with live current transformers and physical ESP32 boards has not been performed.

---

## 2. Grid Signals Modeling

### 2.1 Time-of-Use (ToU) Electricity Tariff (₹ / kWh)
Reflecting dynamic Time-of-Use billing in Indian Rupees (INR):
- **Off-Peak (22:00 - 06:00 IST)**: ₹4.50 / kWh (Baseload overnight incentive)
- **Shoulder / Normal (06:00 - 14:00, 20:00 - 22:00 IST)**: ₹7.50 / kWh (Standard daytime grid rate)
- **On-Peak (14:00 - 20:00 IST)**: ₹12.00 / kWh (Peak demand congestion surcharge)

### 2.2 Grid Carbon Intensity ($\text{gCO}_2/\text{kWh}$) & Supported Methodologies

The system provides four independently selectable carbon accounting methodologies via `settings.CARBON_ACCOUNTING_MODE`:

1. **Modeled Diurnal Profile (`MODELED_DIURNAL`)** — *Default Simulation Assumption*:
   A synthetic simulation curve approximating the operational dispatch dynamics of the Indian National Grid (NEWNE + SR):
   - **Solar Midday Depression (11:00 - 15:00 IST)**: $\approx 580 \pm 25\text{ gCO}_2/\text{kWh}$ (modeled assumption: high utility-scale solar generation displaces marginal thermal coal dispatch).
   - **Evening Peaker Surge (17:00 - 21:00 IST)**: $\approx 880 \pm 35\text{ gCO}_2/\text{kWh}$ (modeled assumption: zero solar output during peak evening demand drives subcritical coal and gas peakers to maximum capacity).
   - **Morning Ramp (07:00 - 10:00 IST)**: $\approx 760 \pm 20\text{ gCO}_2/\text{kWh}$.
   - **Overnight Baseload (22:00 - 06:00 IST)**: $\approx 710 \pm 15\text{ gCO}_2/\text{kWh}$ (thermal baseload and nocturnal wind generation).
   *Scientific Notice: This hourly curve is an engineering simulation assumption approximating diurnal dispatch physics, not an hourly measured data feed published by the Central Electricity Authority (CEA).*

2. **CEA Weighted Average (`CEA_WEIGHTED_AVERAGE` / `CONSTANT_CEA`)**:
   Employs the official static gross generation weighted average factor published in the Central Electricity Authority (CEA) *"CO2 Baseline Database for the Indian Power Sector"* (Version 19.0, Nov 2023 / Version 20.0, Oct 2024):
   - **National Grid Factor (FY 2022-23)**: $716.0\text{ gCO}_2/\text{kWh}$ ($0.716\text{ kg CO}_2/\text{kWh}$).

3. **CEA Combined Margin (`CEA_COMBINED_MARGIN`)**:
   Employs the official CEA Baseline Database Combined Margin (CM) factor:
   - **Combined Margin Factor**: $785.0\text{ gCO}_2/\text{kWh}$ ($0.785\text{ kg CO}_2/\text{kWh}$).
   - Standard regulatory baseline for grid-connected Clean Development Mechanism (CDM) and renewable energy interventions.

4. **CEA Operating Margin (`CEA_OPERATING_MARGIN`)**:
   Employs the official CEA Baseline Database Operating Margin (OM) factor:
   - **Operating Margin Factor**: $820.0\text{ gCO}_2/\text{kWh}$ ($0.820\text{ kg CO}_2/\text{kWh}$).
   - Reflects the specific emission factor of operating marginal power plants dispatched to serve increment demand.

**Accounting Invariant**: In all simulation runs, baseline and optimized emissions are evaluated against the exact same time-aligned carbon factor at every 15-minute interval ($s \in [0, 95]$).

---

## 3. Ten Pre-Configured Test Scenarios

| Scenario ID | Name | Primary Objective & Invariants |
| :--- | :--- | :--- |
| `peak_demand_event` | Peak-Demand Event | Baseline peaks at $\approx 8.60\text{ kW}$ during afternoon lab and EV overlap. Configured demand threshold $P_{\text{threshold}} = 7.00\text{ kW}$ with reserve margin $P_{\text{margin}} = 0.20\text{ kW}$ yields target demand $P_{\text{target}} = 6.80\text{ kW}$. EcoWatt curtails and shifts demand down to $6.79\text{ kW}$ ($21.0\%$ peak shaving). Critical loads curtailed: 0. |
| `normal_operation` | Normal Building Operation | Typical day with moderate attendance and routine comfort profiles. Peak shaved from $7.84\text{ kW}$ to $6.79\text{ kW}$ ($\le 6.80\text{ kW}$ target). |
| `high_tariff_surge` | High Electricity Tariff | Extreme grid price spike during peak hours (₹12.00/kWh); optimizer weights financial savings in LPS, reducing peak to $6.25\text{ kW}$. |
| `high_carbon_period` | High Carbon Intensity | Grid relies heavily on peaker plants; scheduler moves EV/storage charging to solar midday. Peak shaved to $6.79\text{ kW}$. |
| `low_occupancy` | Low Occupancy (Break) | Low attendance allows deep curtailment; target demand $5.30\text{ kW}$ achieved with logged $2.00\text{ kWh}$ partial scheduling shortfall. |
| `high_occupancy` | High Occupancy (Exam) | Full occupancy across all zones; strict comfort preservation prioritizes non-essential sockets. Identifies target infeasibility when flexible loads are exhausted ($7.70\text{ kW}$). |
| `deferrable_ev_charging`| Deferrable EV Fleet | 2.2 kW EV charger shifted from peak tariff hours to low-cost, low-carbon windows under target limit. Peak: $6.73\text{ kW}$. |
| `failed_actuator_ack` | Actuator Timeout & Recovery | Actuator on `lab_sockets_aux` fails to acknowledge (3000ms timeout); gateway detects timeout, marks status UNCERTAIN, remeasures actual power, and curtails next load. Peak: $6.79\text{ kW}$. |
| `sensor_comm_failure` | Sensor Packet Loss | Evaluates gateway fallback, timeout status transitions (DEGRADED/FAULTED), and last-known-good estimation. Peak: $6.79\text{ kW}$. |
| `demand_recovery_restoration`| Demand Recovery | Demonstrates progressive restoration against actual measured demand enforcing safety buffer ($P_{\text{target}} - 0.05\text{ kW} = 6.75\text{ kW}$) in ascending LPS order. Peak: $6.72\text{ kW}$. |
