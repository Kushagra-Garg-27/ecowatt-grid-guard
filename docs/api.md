# EcoWatt Grid Guard — REST API & WebSocket Reference

The backend exposes a high-performance REST API and WebSocket stream powered by FastAPI and Pydantic v2.

Interactive Swagger UI documentation is available at `http://127.0.0.1:8000/docs`.

---

## 1. System & Building Status Endpoints

### `GET /api/health`
Check core system service health.
- **Response `200 OK`**:
```json
{
  "status": "HEALTHY",
  "version": "1.0.0",
  "coap_port": 5683,
  "mqtt_broker": "127.0.0.1:1883",
  "database": "sqlite_ready",
  "timestamp": "2026-11-12T13:10:30.883639Z"
}
```

### `GET /api/building/status`
Retrieve aggregated building-level KPIs, current demand, threshold, and safety flags.
- **Response `200 OK`**:
```json
{
  "timestamp": "2026-11-12T13:10:30.887363Z",
  "current_power_kw": 6.84,
  "demand_threshold_kw": 7.00,
  "target_demand_kw": 6.80,
  "peak_demand_today_kw": 8.60,
  "current_energy_kwh": 118.5,
  "estimated_cost_today": 32.81,
  "estimated_carbon_kg_today": 35.78,
  "active_alarms_count": 0,
  "curtailed_loads_count": 2,
  "shifted_loads_count": 3,
  "critical_load_protected": true,
  "active_scenario": "peak_demand_event"
}
```

### `GET /api/building/zones`
Retrieve sensor telemetry and environmental state for all 5 zones.
- **Response `200 OK`**:
```json
[
  {
    "zone_id": "classroom",
    "name": "Classroom 101",
    "occupancy": 28,
    "max_occupancy": 35,
    "power_kw": 2.45,
    "voltage_v": 229.4,
    "current_a": 11.2,
    "temperature_c": 22.8,
    "lighting_state": 1.0,
    "hvac_state": 1.0,
    "sensor_health": "HEALTHY",
    "timestamp": "2026-11-12T13:10:30.887Z"
  }
]
```

---

## 2. Electrical Load Management

### `GET /api/loads`
Fetch the complete inventory of 19 building loads, live power, LPS scores, and actuator states.
- **Response `200 OK`**:
```json
[
  {
    "id": "cls_hvac",
    "name": "Classroom Variable Air Volume (VAV) Heat Pump",
    "zone_id": "classroom",
    "category": "FLEXIBLE",
    "rated_power_kw": 1.40,
    "current_power_kw": 1.40,
    "suitability_index": 0.75,
    "min_operating_level": 0.45,
    "max_operating_level": 1.0,
    "control_type": "CONTINUOUS",
    "is_curtailed": false,
    "curtailment_factor": 0.0,
    "is_active": true,
    "actuator_status": "ONLINE",
    "lps_score": 0.5824
  }
]
```

### `POST /api/loads/{load_id}/command`
Dispatch manual demonstration commands to smart actuators.
- **Request Body**:
```json
{
  "load_id": "cls_hvac",
  "action": "MODULATE",
  "target_level": 0.50
}
```
- **Response `200 OK`**:
```json
{
  "command_id": "cmd_man_e8b912a4",
  "load_id": "cls_hvac",
  "status": "SUCCESS",
  "actual_power_kw": 0.70,
  "actual_change_kw": 0.70,
  "operating_level": 0.50,
  "latency_ms": 42.0,
  "timestamp": "2026-11-12T13:15:00.123Z"
}
```
- **Response `403 Forbidden`** (if attempting to curtail a critical load):
```json
{
  "detail": "CRITICAL LOAD PROTECTION: Critical electrical loads cannot be curtailed or overridden."
}
```

---

## 3. Closed-Loop Optimization & Configuration

### `POST /api/optimization/run`
Trigger on-demand execution of the closed-loop optimization cycle.
- **Response `200 OK`**:
```json
{
  "event_id": "opt_evt_92fa1b40",
  "timestamp": "2026-11-12T13:18:22.012Z",
  "initial_demand_kw": 8.60,
  "threshold_kw": 7.00,
  "target_kw": 6.80,
  "required_reduction_kw": 1.80,
  "actual_reduction_kw": 1.67,
  "residual_demand_kw": 6.93,
  "target_achieved": true,
  "actions_taken": [
    {
      "load_id": "lab_sockets_aux",
      "load_name": "Computer Lab Auxiliary Peripheral Sockets",
      "zone_id": "computer_lab",
      "category": "FLEXIBLE",
      "lps": 0.742,
      "action": "CURTAIL_OFF",
      "prior_power_kw": 0.70,
      "new_power_kw": 0.00,
      "expected_reduction_kw": 0.70,
      "actual_reduction_kw": 0.70,
      "actuator_status": "ONLINE"
    }
  ],
  "iterations_run": 3,
  "status": "TARGET_ACHIEVED"
}
```

### `POST /api/config/threshold`
Update $P_{threshold}$ and $P_{margin}$.
```json
{
  "demand_threshold_kw": 7.00,
  "reserve_margin_kw": 0.20
}
```

### `POST /api/config/weights`
Update multi-criteria LPS weights (sum must equal 1.0).
```json
{
  "w_s": 0.40,
  "w_o": 0.20,
  "w_p": 0.20,
  "w_t": 0.20
}
```

---

## 4. Simulation & Analytics Endpoints

### `GET /api/simulation/scenarios`
List all 10 predefined reproducible test scenarios.

### `GET /api/simulation/results/{scenario_id}`
Retrieve 24-hour comparative metrics and 96-step time series for a scenario.

### `POST /api/simulation/start?scenario_id=peak_demand_event`
Start 24-hour simulation and activate live background stepping.

### `POST /api/simulation/reset`
Reset all 19 loads to nominal uncurtailed baseline operation.

---

## 5. WebSocket Streaming

### `WS /ws/live`
Clients connect to `/ws/live` to receive real-time JSON packets emitted every 2 seconds:
```json
{
  "type": "LIVE_TELEMETRY",
  "timestamp": "2026-11-12T13:20:00Z",
  "step": 56,
  "hour_str": "14:00",
  "building_power_kw": 6.84,
  "threshold_kw": 7.00,
  "target_kw": 6.80,
  "zones": { ... },
  "loads": [ ... ],
  "active_alarms": 0
}
```

