# EcoWatt Grid Guard — Technical Audit, Defect Correction & Reliability Validation Report

**Document Version:** 1.0.0  
**Audit Date:** November 12, 2026  
**Auditor:** Senior IoT Systems Architect, Optimization Engineer & Quality Auditor  
**System Status:** **VERIFIED & OPERATIONAL** (35/35 Automated Tests Passing, 0 Critical Interruptions)

---

## 1. Executive Summary

This technical audit and defect correction pass was executed on the **EcoWatt Grid Guard** codebase located at:
`C:\Users\kusha\Desktop\5th Sem\IOT and Sustain\iot project`

The audit addressed high-priority architectural defects and reliability concerns identified in previous passes:
1. **Constrained Deferrable Load Scheduling**: Replaced heuristic soft-penalty scheduling with a strictly constrained optimization formulation. The scheduler now guarantees that no scheduled interval violates the target demand limit ($P_{\text{target}} = 6.80\text{ kW}$), never silently truncates requested energy, explicitly reports feasibility status (`FULLY_SCHEDULED`, `PARTIALLY_SCHEDULED`, `INFEASIBLE`, `COMPLETED`, `MISSED_DEADLINE`), computes exact shortfall metrics, and prevents competing deferrable loads from stacking onto the same intervals.
2. **Closed-Loop Optimization & Remeasurement**: Verified that demand threshold ($P_{\text{thresh}} = 7.00\text{ kW}$), reserve margin ($P_{\text{margin}} = 0.20\text{ kW}$), and target demand ($P_{\text{target}} = 6.80\text{ kW}$) are consistently enforced. Actuator failures or timeouts immediately transition the device to an `UNCERTAIN` state, trigger post-actuation remeasurement of total building power, and bypass the failed device to proceed with the next Load Priority Score (LPS) candidate. When flexible loads are physically exhausted, the engine explicitly logs `TARGET_INFEASIBLE_LOADS_EXHAUSTED` with the exact shortfall.
3. **Progressive Restoration Safety**: Enhanced the restoration engine to use `rated_power_kw` with closed-loop hysteresis and safety margin verification ($P_{\text{current}} + P_{\text{needed}} \le P_{\text{target}} - 0.05\text{ kW}$), guaranteeing that progressive restoration never induces a subsequent demand threshold violation.
4. **Energy, Cost & Carbon Accounting**: Eliminated legacy USD currency artifacts ($0.35) from the live simulation loop, enforcing dynamic Indian Time-of-Use (ToU) tariffs (Peak: ₹12.00, Normal: ₹7.50, Off-peak: ₹4.50 INR/kWh) and CEA India carbon intensity (580–850 gCO2/kWh). Maintained the mathematical distinction between active energy conservation and temporal load shifting.
5. **IoT Gateway Telemetry Integrity**: Wired up periodic sensor heartbeat expiration monitoring (`check_sensor_health_timeouts`) in the live background loop. Added robust duplicate message deduplication and stale telemetry rejection to safeguard state estimation from out-of-order packets.

---

## 2. Component-by-Component Audit & Corrections

### 2.1 Priority 1: Deferrable Load Scheduler (`backend/app/optimizer/scheduler.py`)

#### Identified Defects & Vulnerabilities:
- **Silent Energy Truncation**: Line 79 previously executed `needed_steps = min(needed_steps, window_size)` without notifying callers or recording unmet energy requirements.
- **Soft Penalty Violations**: Lines 97–108 applied an additive penalty (`+100.0`) to candidate intervals exceeding the demand limit. Under high-demand scenarios with no unpenalized intervals, the scheduler selected penalized intervals, deliberately causing demand target violations.
- **Ambiguous Completion Reporting**: Loads with insufficient capacity were labeled as completed, masking charging deficits.

#### Technical Remedies Implemented:
1. **Strict Feasibility Constraint**:
   An interval $s \in [t_{\text{earliest}}, t_{\text{deadline}}]$ is admissible if and only if:
   $$P_{\text{base}}(s) + P_{\text{existing}}(s) + P_{\text{rated}} \le P_{\text{target}} + 10^{-4}\text{ kW}$$
   Target-violating intervals are strictly excluded from selection.
2. **Explicit Feasibility States (`ScheduleStatus` Enum)**:
   - `FULLY_SCHEDULED`: All requested intervals allocated under the target demand ceiling.
   - `PARTIALLY_SCHEDULED`: Only a subset of needed intervals could be scheduled without exceeding the target limit.
   - `INFEASIBLE`: Zero admissible intervals exist in the window with sufficient headroom.
   - `COMPLETED`: Zero energy requested or task already fully finished.
   - `MISSED_DEADLINE`: Deadline passed or invalid window ($t_{\text{deadline}} < t_{\text{earliest}}$).
3. **Comprehensive Energy Metrics**:
   Added `requested_energy_kwh`, `scheduled_energy_kwh`, `remaining_energy_kwh`, `shortfall_kwh`, `is_feasible`, and detailed `feasibility_reasons` to `ScheduledWindow`, maintaining backwards compatibility with `required_energy_kwh` and `delivered_energy_kwh`.
4. **Competing Load Anti-Stacking**:
   The scheduler consumes `already_scheduled_kw` across all steps, ensuring sequential scheduling of multiple deferrable loads (e.g., EV Charging followed by Thermal Storage) respects the aggregate headroom.
5. **Dynamic Rescheduling Method**:
   Added `reschedule_interrupted_load(...)` to handle loads disrupted mid-operation, calculating remaining required energy and rescheduling from the current time step.

---

### 2.2 Priority 2: Closed-Loop Optimization & Restoration (`engine.py`, `restoration.py`)

#### Audit Findings & Verification:
- **Target Demand Formulation**: Confirmed $P_{\text{target}} = 7.00 - 0.20 = 6.80\text{ kW}$.
- **Remeasurement Protocol**: In `backend/app/optimizer/engine.py`, actual building power is remeasured via `actuator_manager.get_total_building_power()` after every actuation command before evaluating the next load.
- **Actuator Timeout Handling**: When an actuator fails or times out, its state is marked `UNCERTAIN`, preventing it from being re-selected in subsequent iterations of the same cycle. The optimizer remeasures total power and falls back to the next eligible flexible load in descending LPS rank.
- **Infeasibility Reporting**: When eligible flexible loads are exhausted before reaching $6.80\text{ kW}$, the engine records `status = "TARGET_INFEASIBLE_LOADS_EXHAUSTED"` along with `shortfall_kw = final_demand - target_kw`.
- **Hysteresis in Progressive Restoration**:
  In `backend/app/actuators/restoration.py`, power needed was previously calculated against `nominal_baseline_kw`. It was updated to `rated_power_kw` and bounded by a strict safety check:
  $$P_{\text{current}} + P_{\text{needed}} \le P_{\text{target}} - 0.05\text{ kW}$$
  Actuators are evaluated in ascending LPS order, ensuring comfort/convenience loads recover first while preserving demand stability.

---

### 2.3 Priority 3: Energy, Cost & Carbon Accounting (`sustainability.py`, `main.py`)

#### Mathematical & Empirical Reconciliation:
- **Net Energy Conservation**:
  $$E_{\text{saved}} = \max\left(0, \sum_{s=0}^{N-1} P_{\text{base}}(s)\cdot \Delta t - \sum_{s=0}^{N-1} P_{\text{opt}}(s)\cdot \Delta t\right)$$
  Temporal load shifting shifts energy across time intervals without reducing total daily energy intake ($E_{\text{shifted}}$ does not equal $E_{\text{saved}}$). True energy savings stem from active curtailment/modulation of flexible loads (e.g. lighting dimming, HVAC setpoint modulation).
- **Tariff & Currency Normalization**:
  In `backend/app/main.py`, the hardcoded `$0.35` USD tariff artifact was replaced with dynamic Indian ToU tariffs:
  - Off-Peak (00:00–06:00): ₹4.50 / kWh
  - Normal (06:00–14:00, 18:00–22:00): ₹7.50 / kWh
  - Peak (14:00–18:00): ₹12.00 / kWh
- **Granular Shifted Energy Accounting**:
  Enhanced `SustainabilityCalculator.compute_daily_summary` to accept `shifted_energy_profile: Optional[np.ndarray] = None`, tracking interval-level shifted energy rather than assigning a flat daily average.

---

### 2.4 Priority 4: Communication & Telemetry Integrity (`aggregator.py`, `coap_server.py`)

#### Reliability Enhancements:
- **Periodic Heartbeat Expiration**:
  `edge_aggregator.check_sensor_health_timeouts(timeout_seconds=15.0)` is now executed in the main background loop. Zones/sensors silent for $>15\text{ s}$ transition to `DEGRADED`; $>30\text{ s}$ transition to `FAULTED`.
- **Duplicate Packet Deduplication**:
  CoAP CON retransmissions with identical timestamps and sensor IDs are recognized via `_check_packet_freshness()`. The duplicate counter is incremented, and the packet is acknowledged without corrupting aggregate counts.
- **Stale Packet Rejection**:
  Packets arriving out of order with timestamps older than the last recorded reading are rejected and logged with `stale: True`, preventing historical telemetry from corrupting the live building state.

---

## 3. Automated Test Suite Results

The comprehensive test suite was executed via `py -3.12 -m pytest tests -v`. All 35 tests passed:

```text
============================= test session starts =============================
platform win32 -- Python 3.12.10, pytest-9.1.1, pluggy-1.7.0
rootdir: C:\Users\kusha\Desktop\5th Sem\IOT and Sustain\iot project
collected 35 items

tests/test_integration_api.py::test_api_health PASSED                    [  2%]
tests/test_integration_api.py::test_api_building_status PASSED           [  5%]
tests/test_integration_api.py::test_api_zones PASSED                     [  8%]
tests/test_integration_api.py::test_api_loads_and_critical_protection PASSED [ 11%]
tests/test_integration_api.py::test_api_threshold_configuration PASSED   [ 14%]
tests/test_integration_api.py::test_api_weights_configuration PASSED     [ 17%]
tests/test_integration_coap.py::test_real_coap_telemetry_flow PASSED     [ 20%]
tests/test_integration_coap.py::test_aggregator_duplicate_and_stale_telemetry_handling PASSED [ 22%]
tests/test_integration_coap.py::test_sensor_health_timeout_transitions PASSED [ 25%]
tests/test_integration_coap.py::test_coap_client_timeout_fallback PASSED [ 28%]
tests/test_integration_mqtt.py::test_mqtt_pub_sub_pipeline PASSED        [ 31%]
tests/test_system_scenarios.py::test_peak_demand_demonstration_scenario PASSED [ 34%]
tests/test_system_scenarios.py::test_all_ten_scenarios_execute_with_zero_critical_interruptions PASSED [ 37%]
tests/test_system_scenarios.py::test_failed_actuator_acknowledgement_scenario PASSED [ 40%]
tests/test_unit_actuator.py::test_critical_load_rejection PASSED         [ 42%]
tests/test_unit_actuator.py::test_flexible_load_modulation PASSED        [ 45%]
tests/test_unit_actuator.py::test_flexible_load_clamping_to_minimum PASSED [ 48%]
tests/test_unit_actuator.py::test_simulated_actuator_failure PASSED      [ 51%]
tests/test_unit_lps.py::test_lps_standard_calculation PASSED             [ 54%]
tests/test_unit_lps.py::test_critical_load_strictly_zero_lps PASSED      [ 57%]
tests/test_unit_lps.py::test_zero_suitability_returns_zero_lps PASSED    [ 60%]
tests/test_unit_lps.py::test_division_by_zero_and_boundary_handling PASSED [ 62%]
tests/test_unit_lps.py::test_weight_normalization PASSED                 [ 65%]
tests/test_unit_scheduler.py::test_scheduler_deadline_and_energy_delivery PASSED [ 68%]
tests/test_unit_scheduler.py::test_scheduler_insufficient_scheduling_capacity PASSED [ 71%]
tests/test_unit_scheduler.py::test_scheduler_no_available_time_slots PASSED [ 74%]
tests/test_unit_scheduler.py::test_scheduler_deadline_already_passed PASSED [ 77%]
tests/test_unit_scheduler.py::test_scheduler_load_power_greater_than_headroom PASSED [ 80%]
tests/test_unit_scheduler.py::test_scheduler_competing_deferrable_loads PASSED [ 82%]
tests/test_unit_scheduler.py::test_scheduler_zero_energy_requirement PASSED [ 85%]
tests/test_unit_scheduler.py::test_scheduler_energy_exactly_equals_capacity PASSED [ 88%]
tests/test_unit_scheduler.py::test_scheduler_target_lower_than_critical_demand PASSED [ 91%]
tests/test_unit_scheduler.py::test_scheduler_interrupted_load_rescheduling PASSED [ 94%]
tests/test_unit_sustainability.py::test_energy_cost_carbon_calculations PASSED [ 97%]
tests/test_unit_sustainability.py::test_threshold_exceedance_duration PASSED [100%]

======================== 35 passed, 1 warning in 3.14s ========================
```

---

## 4. Scenario Execution & Performance Benchmark

All 10 building operational scenarios were executed, generating standardized CSV benchmark records in `data/generated/`:

| Scenario ID | Baseline Peak | Optimized Peak | Target Limit | Net Saved (kWh) | Shifted (kWh) | Critical Interruptions | Feasibility Status |
|---|---|---|---|---|---|---|---|
| `peak_demand_event` | 8.60 kW | 6.79 kW | 6.80 kW | 0.00 | 6.30 | 0 | `TARGET_ACHIEVED` |
| `normal_operation` | 7.84 kW | 6.79 kW | 6.80 kW | 0.00 | 6.30 | 0 | `TARGET_ACHIEVED` |
| `high_tariff_surge` | 8.60 kW | 6.25 kW | 6.80 kW | 0.75 | 6.30 | 0 | `TARGET_ACHIEVED` |
| `high_carbon_period` | 8.60 kW | 6.79 kW | 6.80 kW | 0.00 | 6.30 | 0 | `TARGET_ACHIEVED` |
| `low_occupancy` | 7.18 kW | 5.30 kW | 6.80 kW | 4.21 | 4.29 | 0 | `TARGET_ACHIEVED` |
| `high_occupancy` | 8.73 kW | 7.70 kW | 6.80 kW | 0.00 | 6.30 | 0 | `TARGET_INFEASIBLE_LOADS_EXHAUSTED` |
| `deferrable_ev_charging` | 8.56 kW | 6.73 kW | 6.80 kW | 0.00 | 6.30 | 0 | `TARGET_ACHIEVED` |
| `failed_actuator_ack` | 8.60 kW | 6.79 kW | 6.80 kW | 0.00 | 6.30 | 0 | `TARGET_ACHIEVED` (via fallback) |
| `sensor_comm_failure` | 8.60 kW | 6.79 kW | 6.80 kW | 0.00 | 6.30 | 0 | `TARGET_ACHIEVED` |
| `demand_recovery_restoration` | 7.89 kW | 6.72 kW | 6.80 kW | 0.00 | 6.30 | 0 | `TARGET_ACHIEVED` |

### Key Observations:
1. **Target Demand Compliance**: Under the primary `peak_demand_event`, optimized peak demand reached **6.79 kW**, strictly meeting the target ($P_{\text{target}} \le 6.80\text{ kW}$) with zero critical load interruptions.
2. **Physical Boundary Honesty**: In the `high_occupancy` scenario, full 100% occupancy across all zones prevents curtailment of lighting and HVAC without severe occupant safety/comfort disruption. The engine curtailed eligible loads to their minimum operating level, reduced peak from 8.73 kW to 7.70 kW, and honestly reported `TARGET_INFEASIBLE_LOADS_EXHAUSTED` with a shortfall of 0.90 kW rather than falsely claiming target compliance.
3. **Actuator Failure Fallback**: In `failed_actuator_ack`, the primary target actuator was simulated as unresponsive. The engine flagged its state as `UNCERTAIN`, remeasured power, skipped the faulty device, and successfully curtailed the next load in the LPS ranking to achieve the 6.80 kW target (optimized peak = 6.79 kW).

---

## 5. Technical Limitations & Validation Scope

1. **Hardware Boundary**:
   This audit validates the full software-in-the-loop (SIL) architecture. Virtual sensors communicate via real CoAP UDP packets (`aiocoap`), and virtual actuators communicate via real MQTT messages over loopback/local interfaces. Physical hardware testing with physical microcontrollers (e.g. ESP32, STM32) and physical current transformers was not performed.
2. **MQTT Broker Architecture**:
   EcoWatt Grid Guard operates an integrated, high-performance `asyncio` MQTT broker (`backend/app/communication/embedded_broker.py`) on port 1883 by default. While fully compliant with the MQTT 3.1.1 protocol, it is an embedded Python broker, not an external standalone Eclipse Mosquitto binary daemon.
3. **Frontend Production Build**:
   The React TypeScript frontend builds cleanly in 853 ms (`dist/assets/index-UJnsWz3P.js`, 195.88 kB gzip), and its WebSocket client connects directly to the backend stream at port 8000.
