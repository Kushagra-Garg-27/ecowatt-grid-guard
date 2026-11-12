"""
Main API Router for EcoWatt Grid Guard
"""
import uuid
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from backend.app.core.config import settings
from backend.app.gateway.aggregator import edge_aggregator
from backend.app.actuators.virtual_actuator import actuator_manager
from backend.app.actuators.restoration import restoration_engine
from backend.app.optimizer.engine import optimization_engine
from backend.app.optimizer.lps import lps_calculator
from backend.app.optimizer.scheduler import peak_load_scheduler
from backend.app.simulation.engine import simulation_engine
from backend.app.simulation.scenarios import SCENARIO_CONFIGS, BUILDING_LOADS
from backend.app.simulation.profiles import generate_time_of_use_tariff, generate_grid_carbon_intensity
from backend.app.schemas.telemetry import ZoneSummary
from backend.app.schemas.control import (
    LoadSchema,
    ThresholdConfigRequest,
    LPSWeightsRequest,
    ManualCommandRequest,
    OptimizationResponse,
)
from backend.app.schemas.analytics import DailyAnalyticsSummary, BuildingLiveStatus

logger = logging.getLogger("ecowatt.api")
api_router = APIRouter()


# -------------------------------------------------------------
# System Health & Building Live Status
# -------------------------------------------------------------
@api_router.get("/health")
async def get_health():
    return {
        "status": "HEALTHY",
        "version": settings.VERSION,
        "coap_port": settings.COAP_PORT,
        "mqtt_broker": f"{settings.MQTT_BROKER_HOST}:{settings.MQTT_BROKER_PORT}",
        "database": "sqlite_ready",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@api_router.get("/building/status", response_model=BuildingLiveStatus)
async def get_building_status():
    """Returns aggregated real-time building KPIs."""
    current_power = actuator_manager.get_total_building_power()
    active_loads = actuator_manager.get_all_loads_status()
    curtailed_count = sum(1 for l in active_loads if l["is_curtailed"])
    shifted_count = sum(1 for l in active_loads if l["category"] == "DEFERRABLE" and l["is_curtailed"])

    # Historical / simulated energy today
    sim_res = simulation_engine.last_results.get(simulation_engine.current_live_scenario)
    energy_today = sim_res.total_optimized_energy_kwh if sim_res else round(current_power * 4.5, 2)
    cost_today = sim_res.optimized_total_cost if sim_res else round(energy_today * 0.28, 2)
    carbon_today = sim_res.optimized_total_carbon_kg if sim_res else round(energy_today * 0.32, 2)
    peak_today = sim_res.optimized_peak_power_kw if sim_res else round(max(current_power, 7.00), 2)

    return BuildingLiveStatus(
        timestamp=datetime.now(timezone.utc),
        current_power_kw=current_power,
        demand_threshold_kw=optimization_engine.demand_threshold_kw,
        target_demand_kw=optimization_engine.target_demand_kw,
        peak_demand_today_kw=peak_today,
        current_energy_kwh=energy_today,
        estimated_cost_today=cost_today,
        estimated_carbon_kg_today=carbon_today,
        active_alarms_count=1 if current_power > optimization_engine.demand_threshold_kw else 0,
        curtailed_loads_count=curtailed_count,
        shifted_loads_count=shifted_count,
        critical_load_protected=True,
        active_scenario=simulation_engine.current_live_scenario,
    )


@api_router.get("/building/zones", response_model=List[ZoneSummary])
async def get_building_zones():
    """Returns telemetry and operational state for all 5 zones."""
    # Synchronize live actuator power to zone aggregator
    for zid, zstate in edge_aggregator.zone_states.items():
        zstate["power_kw"] = actuator_manager.get_zone_power(zid)
    return edge_aggregator.get_zone_summaries()


@api_router.get("/loads", response_model=List[LoadSchema])
async def get_all_loads():
    """Returns full electrical load inventory, category, status, and LPS."""
    loads_raw = actuator_manager.get_all_loads_status()
    # Current tariff rate
    tariffs = generate_time_of_use_tariff(96)
    curr_tariff = float(tariffs[simulation_engine.current_live_step % 96])

    results = []
    for l in loads_raw:
        zstate = edge_aggregator.zone_states.get(l["zone_id"], {})
        occ = zstate.get("occupancy", 0)
        max_occ = zstate.get("max_occupancy", 30)

        score = lps_calculator.calculate_lps(
            suitability_index=l["suitability_index"],
            zone_occupancy=occ,
            max_occupancy=max_occ,
            current_power_kw=l["current_power_kw"],
            current_tariff=curr_tariff,
            is_critical=(l["category"] == "CRITICAL"),
        )
        l_copy = dict(l)
        l_copy["lps_score"] = score
        results.append(LoadSchema(**l_copy))

    return results


@api_router.post("/loads/{load_id}/command")
async def execute_manual_load_command(load_id: str, payload: ManualCommandRequest):
    """
    Manual demonstration override for load control.
    Strictly forbids manual override from curtailing CRITICAL LOADS.
    """
    actuator = actuator_manager.get_load_actuator(load_id)
    if not actuator:
        raise HTTPException(status_code=404, detail=f"Load {load_id} not found.")

    if actuator.load_def.category == "CRITICAL" and payload.action in ("CURTAIL", "OFF", "MODULATE") and payload.target_level < 1.0:
        raise HTTPException(
            status_code=403,
            detail="CRITICAL LOAD PROTECTION: Critical electrical loads cannot be curtailed or overridden.",
        )

    cmd_id = f"cmd_man_{uuid.uuid4().hex[:8]}"
    ack = actuator.execute_command(
        action=payload.action,
        requested_level=payload.target_level,
        command_id=cmd_id,
    )
    return ack


# -------------------------------------------------------------
# Closed-Loop Optimization & Configuration
# -------------------------------------------------------------
@api_router.post("/optimization/run")
async def trigger_optimization():
    """Trigger manual on-demand closed-loop optimization cycle."""
    tariffs = generate_time_of_use_tariff(96)
    curr_tariff = float(tariffs[simulation_engine.current_live_step % 96])
    result = optimization_engine.run_optimization_cycle(
        current_tariff=curr_tariff,
        scenario_id=simulation_engine.current_live_scenario,
    )
    return result


@api_router.post("/config/threshold")
async def set_demand_threshold(cfg: ThresholdConfigRequest):
    """Configure P_threshold and reserve margin P_margin."""
    optimization_engine.update_thresholds(cfg.demand_threshold_kw, cfg.reserve_margin_kw)
    return {
        "status": "UPDATED",
        "demand_threshold_kw": optimization_engine.demand_threshold_kw,
        "reserve_margin_kw": optimization_engine.reserve_margin_kw,
        "target_demand_kw": optimization_engine.target_demand_kw,
    }


@api_router.get("/config/threshold")
async def get_demand_threshold():
    return {
        "demand_threshold_kw": optimization_engine.demand_threshold_kw,
        "reserve_margin_kw": optimization_engine.reserve_margin_kw,
        "target_demand_kw": optimization_engine.target_demand_kw,
    }


@api_router.post("/config/weights")
async def set_lps_weights(weights: LPSWeightsRequest):
    """Configure LPS multi-criteria weights."""
    lps_calculator.update_weights(weights.w_s, weights.w_o, weights.w_p, weights.w_t)
    return {
        "status": "UPDATED",
        "weights": {
            "w_s": lps_calculator.w_s,
            "w_o": lps_calculator.w_o,
            "w_p": lps_calculator.w_p,
            "w_t": lps_calculator.w_t,
        },
    }


@api_router.get("/config/weights")
async def get_lps_weights():
    return {
        "w_s": lps_calculator.w_s,
        "w_o": lps_calculator.w_o,
        "w_p": lps_calculator.w_p,
        "w_t": lps_calculator.w_t,
    }


# -------------------------------------------------------------
# Simulation Scenarios & Results
# -------------------------------------------------------------
@api_router.get("/simulation/scenarios")
async def get_simulation_scenarios():
    """List all 10 available simulation scenarios with metadata."""
    return SCENARIO_CONFIGS


@api_router.get("/simulation/results/{scenario_id}", response_model=DailyAnalyticsSummary)
async def get_scenario_results(scenario_id: str):
    """Retrieve 24-hour comparative metrics for a specific scenario."""
    if scenario_id in simulation_engine.last_results:
        return simulation_engine.last_results[scenario_id]
    summary = simulation_engine.run_scenario(scenario_id)
    return summary


@api_router.post("/simulation/start")
async def start_simulation(scenario_id: str = "peak_demand_event"):
    """Run full 24-hour simulation scenario and activate live mode."""
    summary = simulation_engine.run_scenario(scenario_id)
    simulation_engine.current_live_scenario = scenario_id
    simulation_engine.is_live_running = True
    return {
        "status": "SIMULATION_COMPLETED_AND_ACTIVE",
        "scenario_id": scenario_id,
        "summary": summary,
    }


@api_router.post("/simulation/stop")
async def stop_simulation():
    simulation_engine.is_live_running = False
    return {"status": "STOPPED"}


@api_router.post("/simulation/reset")
async def reset_simulation():
    actuator_manager.reset_all_loads()
    simulation_engine.current_live_step = 0
    return {"status": "RESET_TO_NOMINAL"}


@api_router.get("/metrics")
async def get_metrics_summary():
    """Returns baseline vs optimized analytics for the active scenario."""
    curr_scen = simulation_engine.current_live_scenario
    if curr_scen not in simulation_engine.last_results:
        simulation_engine.run_scenario(curr_scen)
    return simulation_engine.last_results[curr_scen]


@api_router.get("/iot/monitor")
async def get_iot_monitor():
    """Returns IoT telemetry events, CoAP activity, and MQTT message logs."""
    from backend.app.communication.mqtt_client import mqtt_manager
    return {
        "coap_telemetry_history": edge_aggregator.telemetry_history[-50:],
        "mqtt_messages": mqtt_manager.message_history[-50:],
        "sensor_heartbeats": {
            sid: ts.isoformat() for sid, ts in edge_aggregator.sensor_heartbeats.items()
        },
        "optimization_events": optimization_engine.optimization_events[-20:],
    }
