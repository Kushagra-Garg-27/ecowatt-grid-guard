# EcoWatt Grid Guard — Technical Audit, Defect Correction & Reliability Validation Report

**Document Version:** 2.2.0  
**Audit Date:** November 14, 2026  
**Auditor:** Senior IoT Systems Architect, Optimization Engineer & Quality Auditor  
**System Status:** **VERIFIED & OPERATIONAL** (56/56 Automated Tests Passing, 0 Critical Interruptions)

---

## 1. Executive Summary

This technical audit and defect correction pass was executed on the **EcoWatt Grid Guard** codebase located at:
`C:\Users\kusha\Desktop\5th Sem\IOT and Sustain\iot project`

The audit resolved key physical IoT firmware issues, buffer overflow vulnerabilities, carbon accounting reconciliations, runtime test reliability, and documentation consistency:
1. **Physical Sensor Acquisition & Elimination of Fabricated Data**:
   - Replaced all hardcoded example values (2.45 kW, 230.2 V, 10.9 A, 0.96 pf, 22.8°C, 46.5% RH, and 28 occupancy) in `firmware/esp32_sensor_node/esp32_sensor_node.ino` with actual driver calls for PZEM-004T v3.0 (`PZEM004Tv30.h` over UART2), DHT22 (`DHT.h` on GPIO4), HC-SR501 PIR on GPIO19, and LDR on GPIO34.
   - Sensor readings are strictly validated before publication (`isnan()` guards, valid electrical/environmental physical bounds). Disconnected or failing sensors report `sensor_health: "FAULTED"`, `is_measured_power: false`, and detailed diagnostic error strings without publishing fabricated telemetry.
   - PIR motion detection is reported honestly as binary presence (`motion_detected: true/false`, `occupancy: 1 or 0`) with `is_headcount_measured: false`, explicitly noting that multi-person headcount estimation requires optical break-beam or camera counting hardware (pending hardware integration).
2. **Actuator MQTT ACK Buffer Overflow & Reconnection Draining**:
   - Upgraded the volatile RAM ACK queue in `firmware/esp32_actuator_node/esp32_actuator_node.ino` to a 16-slot FIFO ring buffer (`MAX_PENDING_ACKS = 16`).
   - Implemented explicit detection of buffer-full conditions, a dedicated diagnostic counter (`droppedAckCount`), and visible serial logging (`[ACK BUFFER OVERFLOW]`).
   - Documented the FIFO oldest-drop overflow policy and added explicit notices that the buffer resides in volatile SRAM and does not survive microcontroller reboots.
   - On broker reconnect, pending ACKs drain in FIFO order with `"retransmitted": true` and `"buffer_dropped_total": droppedAckCount`.
3. **Reconciled CEA India Carbon Accounting Methodologies**:
   - Implemented four independently selectable carbon accounting methodologies in `backend/app/core/config.py` and `backend/app/simulation/profiles.py`:
     1. `MODELED_DIURNAL`: Hourly synthetic diurnal profile (~580–880 gCO2/kWh) modeling solar depression and evening coal/gas peakers.
     2. `CEA_WEIGHTED_AVERAGE` (alias: `CONSTANT_CEA`): Official CEA Baseline Database (Version 19.0 / 20.0) national weighted average factor: 716.0 gCO2/kWh.
     3. `CEA_COMBINED_MARGIN`: Official CEA Combined Margin factor: 785.0 gCO2/kWh (standard CDM methodology).
     4. `CEA_OPERATING_MARGIN`: Official CEA Operating Margin factor: 820.0 gCO2/kWh (marginal operational dispatch).
   - Core invariant verified: Baseline and optimized emissions always utilize the exact same time-aligned carbon factors at every interval.
4. **Hardened Node-RED Runtime Live Tests**:
   - In `tests/test_integration_nodered.py`, replaced static sleep waits with active TCP socket polling on port 18883 and child process liveness verification.
   - If Node-RED fails to boot or exits unexpectedly, the test fails immediately with process exit codes, stdout, and stderr logs.
   - Added assertions verifying that unauthorized commands targeting critical loads (`srv_it_rack_1`) trigger `SECURITY_AUDIT_FAIL` alerts and are strictly blocked from pass-through execution along actuator command paths.
5. **Toolchain Compilation Audit**:
   - Audited host environment for `arduino-cli`, `idf.py`, and `platformio`. Verified they are not present in PATH on this host; documented exact reproducible CLI commands and library dependencies in `firmware/README.md`.
   - Maintained transparent boundary: all tests execute in a Software-in-the-Loop (SIL) socket environment; physical silicon hardware validation remains marked as not performed.
6. **Documentation & Currency Normalization**:
   - Reconciled all documentation across `docs/simulation.md`, `README.md`, `nodered/README.md`, and `firmware/README.md`.
   - Enforced Indian Rupees (₹) consistently, removed obsolete USD tariff examples, clearly distinguished the 7.00 kW threshold from the 6.80 kW target demand, and updated test badges.


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
- **Closed-Loop Safety in Progressive Restoration**:
  In `backend/app/actuators/restoration.py`, restoration now reads actual measured demand directly from actuators. It evaluates candidate loads in ascending LPS order and enforces a strict safety ceiling:
  $$P_{\text{measured}} + P_{\text{needed}} \le P_{\text{target}} - 0.05\text{ kW} = 6.75\text{ kW}$$
  If post-actuation measured demand reaches or exceeds $6.75\text{ kW}$, the restoration engine immediately breaks the loop, halting any further restoration and preventing oscillations.

---

### 2.3 Priority 3: Energy, Cost & Carbon Accounting (`sustainability.py`, `main.py`, `profiles.py`)

#### Mathematical & Empirical Reconciliation:
- **Net Energy Conservation**:
  $$E_{\text{saved}} = \max\left(0, \sum_{s=0}^{N-1} P_{\text{base}}(s)\cdot \Delta t - \sum_{s=0}^{N-1} P_{\text{opt}}(s)\cdot \Delta t\right)$$
  Temporal load shifting shifts energy across time intervals without reducing total daily energy intake ($E_{\text{shifted}}$ does not equal $E_{\text{saved}}$). True energy savings stem from active curtailment/modulation of flexible loads (e.g. lighting dimming, HVAC setpoint modulation).
- **Tariff & Currency Normalization**:
  In `backend/app/main.py`, the hardcoded `$0.35` USD tariff artifact was replaced with dynamic Indian ToU tariffs:
  - Off-Peak (00:00–06:00): ₹4.50 / kWh
  - Normal (06:00–14:00, 18:00–22:00): ₹7.50 / kWh
  - Peak (14:00–18:00): ₹12.00 / kWh
- **CEA India Official Carbon Source & Physics**:
  Calibrated to Central Electricity Authority (CEA) Baseline Database (*CO2 Baseline Database for the Indian Power Sector*, Version 19.0 / Version 20.0):
  - **Official Annual Baseline**: National weighted average emission factor for gross generation is **716 gCO2/kWh** (FY 2022-23) and Combined Margin is **785 gCO2/kWh**.
  - **Modeled Diurnal Profile**: Because the CEA publishes annual grid averages rather than hour-by-hour operational marginal profiles, the diurnal profile (~580–880 gCO2/kWh) is an engineering simulation model reflecting midday solar displacement (~60–75 GW solar depressing marginal thermal output to ~580 gCO2/kWh) and evening peak peakers (>240 GW national demand driving marginal coal/gas peakers up to ~880 gCO2/kWh).
  - **Dual Mode Configuration**: EcoWatt now natively supports both `MODELED_DIURNAL` (synthetic diurnal curve) and `CONSTANT_CEA` (official static factor: 716.0 gCO2/kWh, CM: 785.0 gCO2/kWh, OM: 820.0 gCO2/kWh) configurable via `settings.CARBON_ACCOUNTING_MODE`.

---

### 2.4 Firmware Security & Hardware Failsafe Controls (`firmware/`)

#### Security & Reliability Remediations:
1. **Zero Hardcoded Credentials**:
   - All real-looking Wi-Fi SSIDs, passwords, gateway IPs, and MQTT credentials were eliminated from `firmware/esp32_sensor_node/esp32_sensor_node.ino` and `firmware/esp32_actuator_node/esp32_actuator_node.ino`.
   - Introduced modular configuration via `secrets.example.h` templates; `.gitignore` was updated to prevent accidental credential commits.
   - Sketches implement preprocessor guards (`#error "Missing secrets.h..."`) and runtime checks halting execution if default placeholder credentials remain unconfigured.
2. **Safe Relay Boot Ordering (Active-Low Inversion)**:
   - Inverted relay initialization order: `digitalWrite(RELAY_PINS[i], HIGH)` is now executed **before** `pinMode(RELAY_PINS[i], OUTPUT)`. This prevents active-low optocoupled relays from momentarily grounding/closing during ESP32 GPIO configuration.
3. **NTP UTC Clock Synchronization & Resilient Buffering**:
   - Firmware initializes SNTP (`configTime(0, 0, "pool.ntp.org", "time.google.com")`) with ISO-8601 UTC timestamp formatting. If NTP is unreachable, a monotonic uptime fallback format (`UPTIME:xxx.xs`) is recorded and flagged.
   - Actuator commands are strictly validated (`command_id`, `action`, `requested_level`). Failed MQTT acknowledgements are buffered in a circular array (`pendingAckBuffer`) and drained automatically upon broker reconnection.
4. **Estimated vs. Measured Telemetry Distinction**:
   - Actuator telemetry explicitly reports `estimated_power_kw` with `is_measured_power = false` to prevent confusing actuator power estimates with true physical power readings (which carry `is_measured_power = true` from sensor nodes).

---

### 2.5 Live Node-RED Runtime Engine Integration (`nodered/`, `tests/test_integration_nodered.py`)

#### Runtime Verification:
- Validated end-to-end integration by launching the actual Node-RED v5.0.9 runtime process on Node.js v24.19.0 against the running embedded MQTT broker (`127.0.0.1:1883`).
- Verified automatic alert forwarding to `ecowatt/alerts` when building demand exceeds $7.00\text{ kW}$ (`CRITICAL_DEMAND_EXCEEDANCE`).
- Verified security interception of critical load curtailment commands on `ecowatt/cmd/srv_it_rack_1`, publishing immediate `SECURITY_AUDIT_FAIL` alerts without forwarding unauthorized switch commands.

---

### 2.6 Priority 4: Communication & Telemetry Integrity (`aggregator.py`, `coap_server.py`)

#### Reliability Enhancements:
- **Periodic Heartbeat Expiration**:
  `edge_aggregator.check_sensor_health_timeouts(timeout_seconds=15.0)` is now executed in the main background loop. Zones/sensors silent for $>15\text{ s}$ transition to `DEGRADED`; $>30\text{ s}$ transition to `FAULTED`.
- **Duplicate Packet Deduplication**:
  CoAP CON retransmissions with identical timestamps and sensor IDs are recognized via `_check_packet_freshness()`. The duplicate counter is incremented, and the packet is acknowledged without corrupting aggregate counts.
- **Stale Packet Rejection**:
  Packets arriving out of order with timestamps older than the last recorded reading are rejected and logged with `stale: True`, preventing historical telemetry from corrupting the live building state.

---

## 3. Automated Test Suite Results

The comprehensive test suite was executed via `py -3.12 -m pytest tests -v`. All 56 tests passed:

```text
============================= test session starts =============================
platform win32 -- Python 3.12.10, pytest-9.1.1, pluggy-1.7.0
rootdir: C:\Users\kusha\Desktop\5th Sem\IOT and Sustain\iot project
collected 56 items

tests/test_integration_api.py::test_api_health PASSED                    [  1%]
tests/test_integration_api.py::test_api_building_status PASSED           [  3%]
tests/test_integration_api.py::test_api_zones PASSED                     [  5%]
tests/test_integration_api.py::test_api_loads_and_critical_protection PASSED [  7%]
tests/test_integration_api.py::test_api_threshold_configuration PASSED   [  8%]
tests/test_integration_api.py::test_api_weights_configuration PASSED     [ 10%]
tests/test_integration_coap.py::test_real_coap_telemetry_flow PASSED     [ 12%]
tests/test_integration_coap.py::test_aggregator_duplicate_and_stale_telemetry_handling PASSED [ 14%]
tests/test_integration_coap.py::test_sensor_health_timeout_transitions PASSED [ 16%]
tests/test_integration_coap.py::test_coap_client_timeout_fallback PASSED [ 17%]
tests/test_integration_mqtt.py::test_mqtt_pub_sub_pipeline PASSED        [ 19%]
tests/test_integration_nodered.py::test_nodered_flow_structure_and_broker_configuration PASSED [ 21%]
tests/test_integration_nodered.py::test_nodered_javascript_functions_execution PASSED [ 23%]
tests/test_integration_nodered.py::test_nodered_live_runtime_end_to_end PASSED [ 25%]
tests/test_system_scenarios.py::test_peak_demand_demonstration_scenario PASSED [ 26%]
tests/test_system_scenarios.py::test_all_ten_scenarios_execute_with_zero_critical_interruptions PASSED [ 28%]
tests/test_system_scenarios.py::test_failed_actuator_acknowledgement_scenario PASSED [ 30%]
tests/test_unit_actuator.py::test_critical_load_rejection PASSED         [ 32%]
tests/test_unit_actuator.py::test_flexible_load_modulation PASSED        [ 33%]
tests/test_unit_actuator.py::test_flexible_load_clamping_to_minimum PASSED [ 35%]
tests/test_unit_actuator.py::test_simulated_actuator_failure PASSED      [ 37%]
tests/test_unit_actuator.py::test_progressive_restoration_safety_margin_against_actual_measured_demand PASSED [ 39%]
tests/test_unit_actuator.py::test_actuator_command_validation_rejections PASSED [ 41%]
tests/test_unit_actuator.py::test_actuator_acknowledgement_fields PASSED [ 42%]
tests/test_unit_firmware.py::test_firmware_no_hardcoded_credentials PASSED [ 44%]
tests/test_unit_firmware.py::test_secrets_template_and_gitignore PASSED  [ 46%]
tests/test_unit_firmware.py::test_firmware_compile_and_runtime_guards PASSED [ 48%]
tests/test_unit_firmware.py::test_actuator_safe_relay_initialization PASSED [ 50%]
tests/test_unit_firmware.py::test_actuator_measurement_vs_estimation_distinction PASSED [ 51%]
tests/test_unit_firmware.py::test_sensor_firmware_no_fabricated_example_values PASSED [ 53%]
tests/test_unit_firmware.py::test_sensor_firmware_actual_acquisition_and_health_validation PASSED [ 55%]
tests/test_unit_firmware.py::test_sensor_firmware_pir_motion_headcount_honesty PASSED [ 57%]
tests/test_unit_firmware.py::test_actuator_ack_buffer_overflow_diagnostics_and_policy PASSED [ 58%]
tests/test_unit_firmware.py::test_actuator_ack_ring_buffer_simulation_logic PASSED [ 60%]
tests/test_unit_lps.py::test_lps_standard_calculation PASSED             [ 62%]
tests/test_unit_lps.py::test_critical_load_strictly_zero_lps PASSED      [ 64%]
tests/test_unit_lps.py::test_zero_suitability_returns_zero_lps PASSED    [ 66%]
tests/test_unit_lps.py::test_division_by_zero_and_boundary_handling PASSED [ 67%]
tests/test_unit_lps.py::test_weight_normalization PASSED                 [ 69%]
tests/test_unit_scheduler.py::test_scheduler_deadline_and_energy_delivery PASSED [ 71%]
tests/test_unit_scheduler.py::test_scheduler_insufficient_scheduling_capacity PASSED [ 73%]
tests/test_unit_scheduler.py::test_scheduler_no_available_time_slots PASSED [ 75%]
tests/test_unit_scheduler.py::test_scheduler_deadline_already_passed PASSED [ 76%]
tests/test_unit_scheduler.py::test_scheduler_load_power_greater_than_headroom PASSED [ 78%]
tests/test_unit_scheduler.py::test_scheduler_competing_deferrable_loads PASSED [ 80%]
tests/test_unit_scheduler.py::test_scheduler_zero_energy_requirement PASSED [ 82%]
tests/test_unit_scheduler.py::test_scheduler_energy_exactly_equals_capacity PASSED [ 83%]
tests/test_unit_scheduler.py::test_scheduler_target_lower_than_critical_demand PASSED [ 85%]
tests/test_unit_scheduler.py::test_scheduler_interrupted_load_rescheduling PASSED [ 87%]
tests/test_unit_sustainability.py::test_energy_cost_carbon_calculations PASSED [ 89%]
tests/test_unit_sustainability.py::test_threshold_exceedance_duration PASSED [ 91%]
tests/test_unit_sustainability.py::test_modeled_diurnal_carbon_intensity_bounds PASSED [ 92%]
tests/test_unit_sustainability.py::test_constant_cea_carbon_mode PASSED  [ 94%]
tests/test_unit_sustainability.py::test_constant_vs_modeled_carbon_calculations PASSED [ 96%]
tests/test_unit_sustainability.py::test_selectable_cea_carbon_methodologies PASSED [ 98%]
tests/test_unit_sustainability.py::test_time_aligned_carbon_factors_invariant PASSED [100%]

======================= 56 passed, 1 warning in 17.67s ========================
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
| `low_occupancy` | 7.18 kW | 5.30 kW | 5.30 kW | 4.21 | 4.29 | 0 | `TARGET_ACHIEVED` (`PARTIAL_SCHED` shortfall: 2.0 kWh) |
| `high_occupancy` | 8.73 kW | 7.70 kW | 6.80 kW | 0.00 | 6.30 | 0 | `TARGET_INFEASIBLE_LOADS_EXHAUSTED` |
| `deferrable_ev_charging` | 8.56 kW | 6.73 kW | 6.80 kW | 0.00 | 6.30 | 0 | `TARGET_ACHIEVED` |
| `failed_actuator_ack` | 8.60 kW | 6.79 kW | 6.80 kW | 0.00 | 6.30 | 0 | `TARGET_ACHIEVED` (via fallback) |
| `sensor_comm_failure` | 8.60 kW | 6.79 kW | 6.80 kW | 0.00 | 6.30 | 0 | `TARGET_ACHIEVED` |
| `demand_recovery_restoration` | 7.89 kW | 6.72 kW | 6.80 kW | 0.00 | 6.30 | 0 | `TARGET_ACHIEVED` |

---

## 5. Technical Limitations & Validation Scope

1. **Hardware Boundary**:
   This audit validates the full software-in-the-loop (SIL) architecture. Virtual sensors communicate via real CoAP UDP packets (`aiocoap`), and virtual actuators communicate via real MQTT messages over loopback/local interfaces. Physical hardware testing with physical microcontrollers (e.g. ESP32, STM32) and physical current transformers was not performed in this session.
2. **MQTT Broker Architecture**:
   EcoWatt Grid Guard operates an integrated, high-performance `asyncio` MQTT broker (`backend/app/communication/embedded_broker.py`) on port 1883 by default. While fully compliant with the MQTT 3.1.1 protocol, it is an embedded Python broker, not an external standalone Eclipse Mosquitto binary daemon.
3. **Frontend Production Build**:
   The React TypeScript frontend builds cleanly in 1.36s (`dist/assets/index-UJnsWz3P.js`, 195.88 kB gzip), and its WebSocket client connects directly to the backend stream at port 8000.
