# EcoWatt Grid Guard — Test Report & Verification Results

**Document Reference:** `ECOWATT-TEST-VERIFY-2026-FINAL`  
**Test Suite Execution Date:** November 14, 2026  
**Target Environment:** Python 3.12.10 (AMD64) on Windows 11  
**Test Frameworks:** `pytest` v9.1.1, `pytest-asyncio` v1.4.0, `httpx` v0.28.1  
**Repository State:** Commit `fe8a6c951df3b5d103ef94bb1b95f62f8b031968`  

---

## 1. Test Summary

| Metric | Measured Value | Standard / Invariant | Status |
| :--- | :--- | :--- | :--- |
| **Total Test Cases** | **56** | 56 automated test cases | **PASSED** |
| **Passed Cases** | **56** | Zero failures permissible | **100% PASS** |
| **Failed Cases** | **0** | Clean run | **PASSED** |
| **Warnings** | **1** | Starlette `TestClient` deprecation notice (harmless) | **RESOLVED** |
| **Suite Duration** | **10.22 seconds** | Deterministic local execution | **PASSED** |
| **Target Demand Invariant** | **Strictly $\le 6.80\text{ kW}$** | $P_{\text{target}} = P_{\text{threshold}} (7.00) - P_{\text{margin}} (0.20)$ | **ACHIEVED** |
| **Critical Interruptions** | **0 (Zero)** | 100% life-safety load protection across all 10 scenarios | **GUARANTEED** |

---

## 2. Key Architecture & Operational Invariants Verified

1. **Demand Threshold vs Optimization Target:**
   - **Contract Demand Threshold ($P_{\text{threshold}}$):** $7.00\text{ kW}$ — Upper electrical contract capacity.
   - **Safety Reserve Margin ($P_{\text{margin}}$):** $0.20\text{ kW}$ — Buffer preventing momentary overshoot.
   - **Dynamic Optimization Target ($P_{\text{target}}$):** $6.80\text{ kW}$ ($7.00 - 0.20\text{ kW}$) — Strict active power ceiling enforced during curtailment and deferrable scheduling.
2. **Restoration Safety Guard:**
   - Curtailed loads are progressively restored only when measured demand satisfies:
     $$P_{\text{measured}} + P_{\text{load}} \le P_{\text{target}} - 0.05\text{ kW} = 6.75\text{ kW}$$
3. **Currency & Tariffs:**
   - All economic metrics, ToU tariffs, and cost savings are denominated strictly in **Indian Rupees (₹ / INR)**.
   - Default tariff structure: Off-peak ₹4.50/kWh, Normal ₹7.50/kWh, Peak ₹10.50/kWh, Surge ₹12.00/kWh.
4. **CEA Carbon Accounting Invariant:**
   - Baseline and optimized interval emissions are evaluated using identical, time-aligned emission factors ($C(t)$) from the Central Electricity Authority (CEA) Baseline Database Version 19.0 / 20.0 (716.0 gCO2/kWh national average).

---

## 3. Detailed Test Breakdown (56 Tests)

### 3.1 Load Priority Score (LPS) Unit Tests (`tests/test_unit_lps.py` — 5 Tests)

| Test Case | Description | Assertion & Invariant | Result |
| :--- | :--- | :--- | :--- |
| `test_lps_standard_calculation` | Validates multi-criteria LPS formulation | $LPS_k = 0.670 \pm 0.001$ matches mathematical derivation | **PASSED** |
| `test_critical_load_strictly_zero_lps` | Ensures critical loads receive $S_k = 0$ | Critical load returns $LPS = 0.000$ strictly | **PASSED** |
| `test_zero_suitability_returns_zero_lps` | Ensures $S_k = 0$ loads return $LPS = 0$ | Returns $0.000$ regardless of power or tariff | **PASSED** |
| `test_division_by_zero_and_boundary_handling` | Robustness with 0 max occupancy and negative powers | Clamped gracefully in $[0.0, 1.0]$ | **PASSED** |
| `test_weight_normalization` | Rebalances weights if $\sum w \ne 1.0$ | Weights rebalanced to sum $1.0000$ | **PASSED** |

### 3.2 Deferrable Load Scheduler Unit Tests (`tests/test_unit_scheduler.py` — 10 Tests)

| Test Case | Description | Assertion & Invariant | Result |
| :--- | :--- | :--- | :--- |
| `test_scheduler_deadline_and_energy_delivery` | Deadline-constrained deferrable load scheduling | Delivers full required energy strictly before deadline | **PASSED** |
| `test_scheduler_insufficient_scheduling_capacity` | Insufficient headroom under $6.80\text{ kW}$ | Flags `PARTIALLY_SCHEDULED` or `INFEASIBLE` without violating envelope | **PASSED** |
| `test_scheduler_no_available_time_slots` | All time slots already exceed target | Rejects schedule; energy shortfall logged | **PASSED** |
| `test_scheduler_deadline_already_passed` | Request where deadline $\le$ current step | Rejects invalid request gracefully | **PASSED** |
| `test_scheduler_load_power_greater_than_headroom` | Load draw exceeds total available headroom | Does not violate target cap; records shortfall | **PASSED** |
| `test_scheduler_competing_deferrable_loads` | Multiple EV / battery loads competing for slots | Sorts by deadline and cost-carbon optimization | **PASSED** |
| `test_scheduler_zero_energy_requirement` | Edge case: $0.0\text{ kWh}$ requested | Returns zero-step schedule cleanly | **PASSED** |
| `test_scheduler_energy_exactly_equals_capacity` | Boundary condition: energy matches exact capacity | Fills envelope completely without overshoot | **PASSED** |
| `test_scheduler_target_lower_than_critical_demand` | Extreme grid emergency: target $<$ base critical load | Flags infeasibility; never curtails critical loads | **PASSED** |
| `test_scheduler_interrupted_load_rescheduling` | Re-optimizes residual energy after curtailment | Shifts remaining energy to next valid off-peak window | **PASSED** |

### 3.3 Virtual Actuator Unit Tests (`tests/test_unit_actuator.py` — 7 Tests)

| Test Case | Description | Assertion & Invariant | Result |
| :--- | :--- | :--- | :--- |
| `test_critical_load_rejection` | Actuator safety check for critical loads | Rejects command with `REJECTED_CRITICAL_PROTECTED` | **PASSED** |
| `test_flexible_load_modulation` | Modulates flexible HVAC compressor | Power throttled to exact target fraction | **PASSED** |
| `test_flexible_load_clamping_to_minimum` | Enforces minimum operating level constraint | Cannot curtail below configured $P_{min}$ | **PASSED** |
| `test_simulated_actuator_failure` | Simulates actuator timeout and network drop | Marks state as `UNCERTAIN` upon 3000ms timeout | **PASSED** |
| `test_progressive_restoration_safety_margin_against_actual_measured_demand` | Validates restoration against real measured power | Enforces $P_{\text{measured}} + P_{\text{load}} \le 6.75\text{ kW}$ | **PASSED** |
| `test_actuator_command_validation_rejections` | Malformed/out-of-bounds command rejection | Rejects invalid action payloads safely | **PASSED** |
| `test_actuator_acknowledgement_fields` | Verifies execution ACK schema and fields | Includes `command_id`, status, actual power, timestamp | **PASSED** |

### 3.4 Firmware Integrity & Security Tests (`tests/test_unit_firmware.py` — 10 Tests)

| Test Case | Description | Assertion & Invariant | Result |
| :--- | :--- | :--- | :--- |
| `test_firmware_no_hardcoded_credentials` | Scans sketches for real SSID/password strings | Zero hardcoded live credentials in source | **PASSED** |
| `test_secrets_template_and_gitignore` | Validates `secrets.example.h` and `.gitignore` | Config templates present; live secrets ignored | **PASSED** |
| `test_firmware_compile_and_runtime_guards` | Checks unconfigured placeholder traps | Firmware halts execution if placeholders unedited | **PASSED** |
| `test_actuator_safe_relay_initialization` | Cold boot relay pin initialization | Relays explicitly initialized to safe states | **PASSED** |
| `test_actuator_measurement_vs_estimation_distinction` | Actuator power measurement honesty flag | Sets `is_measured_power = false` when estimated | **PASSED** |
| `test_sensor_firmware_no_fabricated_example_values` | Scans for eliminated static readings | Zero hardcoded 2.45 kW, 230.2 V, 22.8°C, etc. | **PASSED** |
| `test_sensor_firmware_actual_acquisition_and_health_validation` | Inspects PZEM004T & DHT22 API calls | Real library APIs called; NaN handling verified | **PASSED** |
| `test_sensor_firmware_pir_motion_headcount_honesty` | PIR binary presence vs headcount honesty | Sets `is_headcount_measured = false` | **PASSED** |
| `test_actuator_ack_buffer_overflow_diagnostics_and_policy` | Ring buffer oldest-drop policy and counter | Drops oldest ACK when full; logs `droppedAckCount` | **PASSED** |
| `test_actuator_ack_ring_buffer_simulation_logic` | Reconnection queue draining behavior | Retransmits pending ACKs in FIFO order on reconnect | **PASSED** |

### 3.5 Sustainability & Carbon Analytics Unit Tests (`tests/test_unit_sustainability.py` — 7 Tests)

| Test Case | Description | Assertion & Invariant | Result |
| :--- | :--- | :--- | :--- |
| `test_energy_cost_carbon_calculations` | Validates energy (kWh), ToU cost (₹ INR), carbon (kg) | ₹60.00 baseline $\to$ ₹45.00 optimized ($25\%$ savings) | **PASSED** |
| `test_threshold_exceedance_duration` | Validates exceedance minute calculation | Exactly tracks minutes above threshold | **PASSED** |
| `test_modeled_diurnal_carbon_intensity_bounds` | Diurnal solar duck curve bounds | Verifies bounds in $[580, 880]\text{ gCO}_2/\text{kWh}$ | **PASSED** |
| `test_constant_cea_carbon_mode` | National average CEA grid emission factor | Verifies exact $716.0\text{ gCO}_2/\text{kWh}$ baseline | **PASSED** |
| `test_constant_vs_modeled_carbon_calculations` | Comparative analytics across emission models | Accurate interval evaluation across modes | **PASSED** |
| `test_selectable_cea_carbon_methodologies` | Validates CM ($785\text{ g}$) and OM ($820\text{ g}$) modes | Validates all CEA Baseline Database modes | **PASSED** |
| `test_time_aligned_carbon_factors_invariant` | Verifies identical time-aligned factors $C(t)$ | Guaranteed no artificial factor shifting distortion | **PASSED** |

### 3.6 CoAP Protocol Integration Tests (`tests/test_integration_coap.py` — 4 Tests)

| Test Case | Description | Protocol / Component | Result |
| :--- | :--- | :--- | :--- |
| `test_real_coap_telemetry_flow` | Dispatches real CoAP CON packets over UDP | CoAP client & server on UDP port 5683 | **PASSED** |
| `test_aggregator_duplicate_and_stale_telemetry_handling` | Filters out-of-order and stale packets | Validates timestamp monotonicity | **PASSED** |
| `test_sensor_health_timeout_transitions` | Heartbeat loss state machine | Transitions `ONLINE` $\to$ `DEGRADED` $\to$ `FAULTED` | **PASSED** |
| `test_coap_client_timeout_fallback` | Gateway fallback on packet loss | Retains last-known-good state gracefully | **PASSED** |

### 3.7 MQTT Protocol Integration Tests (`tests/test_integration_mqtt.py` — 1 Test)

| Test Case | Description | Protocol / Component | Result |
| :--- | :--- | :--- | :--- |
| `test_mqtt_pub_sub_pipeline` | Publishes & subscribes via Paho MQTT | Embedded Asyncio MQTT Broker on TCP 1883 | **PASSED** |

### 3.8 Node-RED Workflow Integration Tests (`tests/test_integration_nodered.py` — 3 Tests)

| Test Case | Description | Protocol / Component | Result |
| :--- | :--- | :--- | :--- |
| `test_nodered_flow_structure_and_broker_configuration` | Inspects `nodered/flows.json` structure | Validates tabs, node types, and broker configs | **PASSED** |
| `test_nodered_javascript_functions_execution` | Tests Node-RED JS function node logic | Tests demand filter and security guard logic | **PASSED** |
| `test_nodered_live_runtime_end_to_end` | Spawns live Node-RED v5.0.9 process | Intercepts critical load commands; forwards alerts | **PASSED** |

### 3.9 REST API Integration Tests (`tests/test_integration_api.py` — 6 Tests)

| Test Case | Description | Protocol / Component | Result |
| :--- | :--- | :--- | :--- |
| `test_api_health` | Checks `/api/health` REST endpoint | FastAPI HTTP `200 OK` | **PASSED** |
| `test_api_building_status` | Checks `/api/building/status` KPIs | FastAPI HTTP `200 OK` | **PASSED** |
| `test_api_zones` | Confirms all 5 building zones returned | FastAPI HTTP `200 OK` (5 zones) | **PASSED** |
| `test_api_loads_and_critical_protection` | Tests load inventory and 403 on critical override | HTTP `403 Forbidden` on critical curtailment | **PASSED** |
| `test_api_threshold_configuration` | Updates $P_{\text{threshold}}$ and $P_{\text{margin}}$ via API | HTTP `200 OK` and persists | **PASSED** |
| `test_api_weights_configuration` | Updates LPS weights via API | HTTP `200 OK` with sum validation | **PASSED** |

### 3.10 System & Scenario Acceptance Tests (`tests/test_system_scenarios.py` — 3 Tests)

| Test Case | Acceptance Criteria | Measured Result | Status |
| :--- | :--- | :--- | :--- |
| `test_peak_demand_demonstration_scenario` | Baseline peak $\approx 8.60\text{ kW}$, target $\le 6.80\text{ kW}$, critical interruptions $= 0$ | Base peak: $8.60\text{ kW}$, Opt peak: $6.79\text{ kW}$, Red: $21.0\%$, Crit interruptions: $0$ | **PASSED** |
| `test_all_ten_scenarios_execute_with_zero_critical_interruptions` | All 10 scenarios complete with 0 critical interruptions | 10/10 scenarios passed with $0$ critical interruptions | **PASSED** |
| `test_failed_actuator_acknowledgement_scenario` | Missing ack triggers remeasurement and secondary curtailment | Failures detected, remeasured, and mitigated | **PASSED** |

---

## 4. Benchmark Scenario Verification Results

Detailed performance metrics for the primary benchmark scenario (`peak_demand_event`):

- **Baseline Peak Demand:** $8.60\text{ kW}$ (observed during concurrent afternoon lab sessions and EV charging)
- **Contract Demand Threshold ($P_{\text{threshold}}$):** $7.00\text{ kW}$
- **Safety Reserve Margin ($P_{\text{margin}}$):** $0.20\text{ kW}$
- **Dynamic Optimization Target ($P_{\text{target}}$):** **$6.80\text{ kW}$**
- **Optimized Peak Demand:** **$6.79\text{ kW}$** (Target Demand Achieved: **TRUE**, strictly $\le 6.80\text{ kW}$)
- **Peak Shaving:** **$1.81\text{ kW}$ ($21.0\%$ reduction)**
- **Baseline Cost:** ₹989.89 INR $\to$ **Optimized Cost:** ₹972.62 INR (Net Savings: ₹17.26 INR)
- **Avoided Carbon Emissions:** $0.22\text{ kg CO}_2$ (diurnal profile)
- **Shifted Energy:** $6.30\text{ kWh}$ moved from peak tariff to off-peak slots
- **Threshold Exceedance Duration:** $120\text{ minutes baseline} \to 0\text{ minutes optimized}$
- **Critical Load Interruptions:** **0 (Zero)**

---

## 5. Verification Command Reproducibility

To reproduce these exact results on any Windows 11 / Linux host:

```powershell
# 1. Run complete pytest automated test suite (56 tests)
py -3.12 -m pytest tests -v

# 2. Run Node-RED live integration test
py -3.12 -m pytest tests/test_integration_nodered.py -v

# 3. Verify Python bytecode syntax
py -3.12 -m py_compile backend/app/main.py

# 4. Run Frontend production build
cd frontend
npm run build
cd ..
```
