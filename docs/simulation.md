# EcoWatt Grid Guard — Energy Simulation Methodology

## 1. Simulation Architecture

EcoWatt Grid Guard incorporates a deterministic 24-hour simulation engine modeling multi-zone building thermal dynamics, occupancy schedules, grid tariffs, time-varying carbon intensity, and load behavior.

- **Temporal Resolution**: 96 intervals per day (15-minute sampling interval $\Delta t = 0.25\text{ h}$).
- **Reproducibility**: Controlled random number generator seeds (`seed = 42`) guarantee that baseline and optimized runs start from identical initial states.
- **Data Persistence**: Results are written to `data/generated/{scenario_id}_simulation_results.csv`.

---

## 2. Grid Signals Modeling

### 2.1 Time-of-Use (ToU) Electricity Tariff ($\$/\text{kWh}$)
Reflecting modern dynamic utility billing:
- **Off-Peak (22:00 - 06:00)**: $\$0.12 / \text{kWh}$
- **Shoulder (06:00 - 14:00, 20:00 - 22:00)**: $\$0.24 / \text{kWh}$
- **On-Peak (14:00 - 20:00)**: $\$0.45 / \text{kWh}$ (reflective of grid congestion and high marginal generation costs)

### 2.2 Grid Carbon Intensity ($\text{gCO}_2/\text{kWh}$) & Accounting Modes

The system supports two carbon intensity accounting modes:

1. **Modeled Diurnal Profile (`MODELED_DIURNAL`)** — *Default Simulation Assumption*:
   Approximates diurnal generation dispatch dynamics on the Indian National Grid (NEWNE + SR):
   - **Solar Midday Depression (11:00 - 15:00 IST)**: $\approx 580 \pm 25\text{ gCO}_2/\text{kWh}$ (modeled assumption: high utility solar generation depresses marginal thermal coal dispatch).
   - **Evening Peaker Surge (17:00 - 21:00 IST)**: $\approx 880 \pm 35\text{ gCO}_2/\text{kWh}$ (modeled assumption: zero solar output during evening peak demand drives subcritical coal and gas peakers to maximum dispatch).
   - **Overnight Baseload (22:00 - 06:00 IST)**: $\approx 710 \pm 15\text{ gCO}_2/\text{kWh}$ (modeled baseload coal and nocturnal wind).
   *Note: This hourly curve is a synthetic simulation model approximating diurnal dispatch, not a real-time measured telemetry feed published by CEA.*

2. **Official CEA Annual Static Factor (`CONSTANT_CEA`)**:
   Employs static empirical emission factors published in the Central Electricity Authority (CEA) *"CO2 Baseline Database for the Indian Power Sector"* (Version 19.0 / Version 20.0):
   - **Gross Generation Weighted Average (FY 2022-23)**: $716.0\text{ gCO}_2/\text{kWh}$ ($0.716\text{ kg CO}_2/\text{kWh}$)
   - **Combined Margin (CM)**: $785.0\text{ gCO}_2/\text{kWh}$ ($0.785\text{ kg CO}_2/\text{kWh}$)
   - **Operating Margin (OM)**: $820.0\text{ gCO}_2/\text{kWh}$ ($0.820\text{ kg CO}_2/\text{kWh}$)

---

## 3. Ten Pre-Configured Test Scenarios

| Scenario ID | Name | Primary Objective & Invariants |
| :--- | :--- | :--- |
| `peak_demand_event` | Peak-Demand Event | Baseline peaks at $\approx 8.60\text{ kW}$ during afternoon lab and EV overlap. EcoWatt curtails and shifts demand down to $7.00\text{ kW}$ ($19.5\%$ reduction). Critical loads: 0 curtailed. |
| `normal_operation` | Normal Building Operation | Typical day with moderate attendance and routine comfort profiles. |
| `high_tariff_surge` | High Electricity Tariff | Extreme grid price spike during peak hours; optimizer weights financial savings in LPS. |
| `high_carbon_period` | High Carbon Intensity | Grid relies heavily on peaker plants; scheduler moves EV/storage charging to solar midday. |
| `low_occupancy` | Low Occupancy (Break) | Low attendance allows deep curtailment of classroom & lab lighting and HVAC. |
| `high_occupancy` | High Occupancy (Exam) | Full occupancy across all zones; strict comfort preservation prioritizes non-essential sockets. |
| `deferrable_ev_charging`| Deferrable EV Fleet | 2.2 kW EV charger shifted from peak tariff hours to low-cost, low-carbon windows. |
| `failed_actuator_ack` | Actuator Timeout & Recovery | Actuator on `lab_sockets_aux` fails to acknowledge; gateway detects timeout, remeasures actual power, and curtails next load. |
| `sensor_comm_failure` | Sensor Packet Loss | Evaluates gateway fallback and last-known-good estimation during packet drops. |
| `demand_recovery_restoration`| Demand Recovery | Demonstrates progressive restoration using hysteresis in ascending LPS order. |

