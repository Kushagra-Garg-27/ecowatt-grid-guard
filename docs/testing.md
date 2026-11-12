# EcoWatt Grid Guard — Test Report & Verification Results

## 1. Test Summary

- **Total Test Cases**: 23
- **Passed**: 23
- **Failed**: 0
- **Duration**: 2.41 seconds
- **Test Framework**: `pytest` v9.1.1, `pytest-asyncio` v1.4.0, `httpx` v0.28.1

---

## 2. Detailed Test Breakdown

### 2.1 Unit Tests

| Test Case | Description | Assertion & Invariant | Result |
| :--- | :--- | :--- | :--- |
| `test_lps_standard_calculation` | Validates multi-criteria LPS formulation | $LPS_k = 0.670 \pm 0.001$ matches manual derivation | **PASSED** |
| `test_critical_load_strictly_zero_lps` | Ensures critical loads receive $LPS = 0$ | Critical load returns $0.000$ strictly | **PASSED** |
| `test_zero_suitability_returns_zero_lps`| Ensures $S_k = 0$ loads return $LPS = 0$ | Returns $0.000$ | **PASSED** |
| `test_division_by_zero_and_boundary_handling` | Robustness with 0 max occupancy and negative powers | Clamped gracefully in $[0, 1]$ | **PASSED** |
| `test_weight_normalization` | Rebalances weights if sum $\ne 1.0$ | Weights rebalanced to sum $1.0000$ | **PASSED** |
| `test_energy_cost_carbon_calculations` | Validates energy (kWh), ToU cost ($), and carbon (kg) | $8\text{ kWh} \to 6\text{ kWh}$, $25\%$ savings verified | **PASSED** |
| `test_threshold_exceedance_duration` | Validates exceedance minute calculation | Exactly 30 min baseline exceedance vs 0 min optimized | **PASSED** |
| `test_critical_load_rejection` | Actuator safety check for critical loads | Rejects curtailment command with `REJECTED_CRITICAL_PROTECTED` | **PASSED** |
| `test_flexible_load_modulation` | Modulates flexible HVAC compressor | Power throttled to target fraction | **PASSED** |
| `test_flexible_load_clamping_to_minimum` | Enforces minimum operating level constraint | Cannot curtail below configured $P_{min}$ | **PASSED** |
| `test_simulated_actuator_failure` | Simulates actuator timeout and recovery | Marks status as `UNCERTAIN` upon timeout | **PASSED** |
| `test_scheduler_deadline_and_energy_delivery` | Deadline-constrained deferrable load scheduling | Exactly delivers required energy before deadline | **PASSED** |

### 2.2 Integration Tests

| Test Case | Description | Protocol / Component | Result |
| :--- | :--- | :--- | :--- |
| `test_real_coap_telemetry_flow` | Transmits real CoAP packets over UDP port | CoAP client & server on UDP:56839 | **PASSED** |
| `test_mqtt_pub_sub_pipeline` | Publishes & subscribes via Paho MQTT | MQTT broker on TCP:18839 | **PASSED** |
| `test_api_health` | Checks `/api/health` REST endpoint | FastAPI HTTP `200 OK` | **PASSED** |
| `test_api_building_status` | Checks `/api/building/status` KPIs | FastAPI HTTP `200 OK` | **PASSED** |
| `test_api_zones` | Confirms all 5 building zones returned | FastAPI HTTP `200 OK` (5 zones) | **PASSED** |
| `test_api_loads_and_critical_protection` | Tests load inventory and 403 on critical override | HTTP `403 Forbidden` on critical curtailment | **PASSED** |
| `test_api_threshold_configuration` | Updates $P_{threshold}$ and $P_{margin}$ via API | HTTP `200 OK` and persists | **PASSED** |
| `test_api_weights_configuration` | Updates LPS weights via API | HTTP `200 OK` with sum validation | **PASSED** |

### 2.3 System Acceptance Tests

| Test Case | Acceptance Criteria | Measured Result | Status |
| :--- | :--- | :--- | :--- |
| `test_peak_demand_demonstration_scenario` | Baseline peak $\approx 8.60\text{ kW}$, target $\le 7.00\text{ kW}$, critical interruptions $= 0$ | Base peak: $8.60\text{ kW}$, Opt peak: $6.93\text{ kW}$, Red: $19.5\%$, Crit interruptions: $0$ | **PASSED** |
| `test_all_ten_scenarios_execute_with_zero_critical_interruptions` | All 10 scenarios complete with 0 critical interruptions | 10/10 scenarios passed with $0$ critical interruptions | **PASSED** |
| `test_failed_actuator_acknowledgement_scenario` | Missing ack triggers remeasurement and secondary curtailment | Failures detected, remeasured, and mitigated | **PASSED** |

