"""
Multi-Stage Edge Optimization Engine
Implements Stages A, B, C, and D of the EcoWatt Control Loop:
- Stage A: Demand threshold detection (P_total > P_threshold, P_target = P_threshold - P_margin)
- Stage B: Load selection based on descending LPS (strictly protecting critical loads)
- Stage C: Selective curtailment & continuous modulation respecting physical limits
- Stage D: Iterative closed-loop actuation, post-actuation remeasurement, and failure handling
"""
import uuid
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
from backend.app.core.config import settings
from backend.app.optimizer.lps import lps_calculator
from backend.app.actuators.virtual_actuator import actuator_manager, VirtualActuator
from backend.app.gateway.aggregator import edge_aggregator
from backend.app.communication.mqtt_client import mqtt_manager

logger = logging.getLogger("ecowatt.optimizer.engine")


class MultiStageOptimizationEngine:
    """Closed-loop demand optimization and selective load curtailment engine."""

    def __init__(
        self,
        demand_threshold_kw: float = settings.DEFAULT_DEMAND_THRESHOLD_KW,
        reserve_margin_kw: float = settings.DEFAULT_RESERVE_MARGIN_KW,
    ):
        self.demand_threshold_kw = demand_threshold_kw
        self.reserve_margin_kw = reserve_margin_kw
        self.optimization_events: List[Dict[str, Any]] = []

    @property
    def target_demand_kw(self) -> float:
        """P_target = P_threshold - P_margin (Consistent target demand)."""
        return max(0.0, self.demand_threshold_kw - self.reserve_margin_kw)

    def update_thresholds(self, threshold_kw: float, margin_kw: float):
        self.demand_threshold_kw = max(0.1, threshold_kw)
        self.reserve_margin_kw = max(0.0, margin_kw)

    def run_optimization_cycle(
        self,
        current_tariff: float,
        scenario_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Execute full iterative closed-loop optimization cycle.
        Returns detailed record of optimization actions and performance.
        """
        event_id = f"opt_evt_{uuid.uuid4().hex[:8]}"
        initial_demand = actuator_manager.get_total_building_power()

        # Stage A: Threshold Detection
        # Check P_total > P_threshold
        if initial_demand <= self.demand_threshold_kw:
            # No violation: check if restoration is possible
            return {
                "event_id": event_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "scenario_id": scenario_id,
                "initial_demand_kw": initial_demand,
                "threshold_kw": self.demand_threshold_kw,
                "target_kw": self.target_demand_kw,
                "required_reduction_kw": 0.0,
                "actual_reduction_kw": 0.0,
                "residual_demand_kw": initial_demand,
                "target_achieved": True,
                "actions_taken": [],
                "iterations_run": 0,
                "status": "NORMAL_WITHIN_THRESHOLD",
            }

        # Calculate required demand reduction
        # P_required = max(0, P_total - P_target)
        required_reduction = round(initial_demand - self.target_demand_kw, 3)
        logger.info(
            f"Demand Threshold Exceeded! Initial={initial_demand:.2f}kW, "
            f"Threshold={self.demand_threshold_kw:.2f}kW, Target={self.target_demand_kw:.2f}kW, "
            f"Required Reduction={required_reduction:.2f}kW"
        )

        actions_taken: List[Dict[str, Any]] = []
        iteration = 0
        max_iterations = 25

        # Stage D: Iterative Closed-Loop Control Loop
        while iteration < max_iterations:
            iteration += 1
            current_actual_power = actuator_manager.get_total_building_power()
            residual_excess = round(current_actual_power - self.target_demand_kw, 3)

            # Check stopping condition: demand reached target or within tolerance
            if residual_excess <= 0.01:
                logger.info(f"Optimization converged at iteration {iteration}: Target achieved! Power={current_actual_power:.2f}kW")
                break

            # Stage B: Load Selection & LPS Ranking
            candidate_loads = self._rank_eligible_loads(current_tariff)
            if not candidate_loads:
                logger.warning("No further eligible flexible loads available for curtailment!")
                break

            # Select top-ranked load by descending LPS
            best_candidate = candidate_loads[0]
            actuator: VirtualActuator = best_candidate["actuator"]
            lps_score: float = best_candidate["lps"]

            # Stage C: Determine Curtailment Action & Target Level
            prior_power = actuator.current_power_kw
            target_level, expected_red = self._compute_curtailment_action(actuator, residual_excess)

            cmd_id = f"cmd_opt_{uuid.uuid4().hex[:8]}"

            # Issue command via MQTT
            mqtt_cmd_payload = {
                "command_id": cmd_id,
                "load_id": actuator.load_id,
                "action": "CURTAIL" if target_level == 0.0 else "MODULATE",
                "requested_level": target_level,
                "expected_reduction_kw": expected_red,
            }
            mqtt_manager.publish(f"ecowatt/load/{actuator.load_id}/command", mqtt_cmd_payload)

            # Actuator executes and returns acknowledgement
            ack = actuator.execute_command(
                action="CURTAIL" if target_level == 0.0 else "MODULATE",
                requested_level=target_level,
                command_id=cmd_id,
            )

            # Stage D Feedback & Failure Handling:
            # If ack failed / timeout: mark state uncertain, remeasure actual power
            if ack["status"] == "TIMEOUT" or ack["status"] == "FAILED":
                logger.warning(f"Actuator {actuator.load_id} failed acknowledgement: {ack.get('error_details')}")
                actuator.status = "UNCERTAIN"
                # Post-actuation remeasurement
                remeasured_power = actuator_manager.get_total_building_power()
                actual_red = round(prior_power - actuator.current_power_kw, 3)
                actions_taken.append({
                    "load_id": actuator.load_id,
                    "load_name": actuator.load_def.name,
                    "zone_id": actuator.load_def.zone_id,
                    "category": actuator.load_def.category,
                    "lps": lps_score,
                    "action": "ATTEMPTED_CURTAIL_TIMEOUT",
                    "prior_power_kw": prior_power,
                    "new_power_kw": actuator.current_power_kw,
                    "expected_reduction_kw": expected_red,
                    "actual_reduction_kw": actual_red,
                    "actuator_status": actuator.status,
                })
                # Continue loop to next eligible load
                continue

            # Acknowledgement succeeded: remeasure actual power
            actual_reduction = round(prior_power - actuator.current_power_kw, 3)
            actions_taken.append({
                "load_id": actuator.load_id,
                "load_name": actuator.load_def.name,
                "zone_id": actuator.load_def.zone_id,
                "category": actuator.load_def.category,
                "lps": lps_score,
                "action": "MODULATE" if target_level > 0.0 else "CURTAIL_OFF",
                "prior_power_kw": prior_power,
                "new_power_kw": actuator.current_power_kw,
                "expected_reduction_kw": expected_red,
                "actual_reduction_kw": actual_reduction,
                "actuator_status": actuator.status,
            })

        # Final state verification
        final_demand = actuator_manager.get_total_building_power()
        final_reduction = round(initial_demand - final_demand, 3)
        target_achieved = final_demand <= (self.target_demand_kw + 0.05)

        event_result = {
            "event_id": event_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "scenario_id": scenario_id,
            "initial_demand_kw": initial_demand,
            "threshold_kw": self.demand_threshold_kw,
            "target_kw": self.target_demand_kw,
            "required_reduction_kw": required_reduction,
            "actual_reduction_kw": final_reduction,
            "residual_demand_kw": final_demand,
            "target_achieved": target_achieved,
            "actions_taken": actions_taken,
            "iterations_run": iteration,
            "status": "TARGET_ACHIEVED" if target_achieved else "PARTIALLY_MITIGATED",
        }

        self.optimization_events.append(event_result)
        # Disseminate optimization event over MQTT
        mqtt_manager.publish("ecowatt/optimization/events", event_result)

        return event_result

    def _rank_eligible_loads(self, current_tariff: float) -> List[Dict[str, Any]]:
        """
        Rank candidate loads by DESCENDING LPS score.
        Strictly excludes critical loads and faulted actuators.
        """
        candidates = []
        for lid, act in actuator_manager.actuators.items():
            l_def = act.load_def

            # 1. Exclude critical loads
            if l_def.category == "CRITICAL" or l_def.suitability_index <= 0.0:
                continue

            # 2. Exclude faulted or uncertain actuators
            if act.status in ("FAULTED", "UNCERTAIN"):
                continue

            # 3. Check if load has further curtailment capacity
            if act.current_level <= l_def.min_operating_level:
                continue

            # Zone occupancy evaluation
            zone_info = edge_aggregator.zone_states.get(l_def.zone_id, {})
            occ = zone_info.get("occupancy", 0)
            max_occ = zone_info.get("max_occupancy", 30)

            # Compute LPS
            lps = lps_calculator.calculate_lps(
                suitability_index=l_def.suitability_index,
                zone_occupancy=occ,
                max_occupancy=max_occ,
                current_power_kw=act.current_power_kw,
                current_tariff=current_tariff,
                is_critical=False,
            )

            candidates.append({
                "actuator": act,
                "lps": lps,
            })

        # Rank in DESCENDING order of LPS
        candidates.sort(key=lambda x: x["lps"], reverse=True)
        return candidates

    def _compute_curtailment_action(self, actuator: VirtualActuator, residual_excess_kw: float) -> Tuple[float, float]:
        """Compute target operating level and expected reduction respecting device constraints."""
        l_def = actuator.load_def

        if l_def.control_type == "BINARY":
            # Binary load: can only turn completely off
            target_level = 0.0
            expected_reduction = actuator.current_power_kw
        else:
            # Continuous modulation (HVAC compressor, dimmable lighting)
            # Determine how much reduction is needed
            current_kw = actuator.current_power_kw
            min_kw = l_def.rated_power_kw * l_def.min_operating_level
            max_possible_reduction = current_kw - min_kw

            needed_reduction = min(max_possible_reduction, residual_excess_kw)
            new_target_kw = max(min_kw, current_kw - needed_reduction)
            target_level = round(new_target_kw / l_def.rated_power_kw, 2)
            expected_reduction = round(current_kw - (l_def.rated_power_kw * target_level), 3)

        return target_level, expected_reduction


optimization_engine = MultiStageOptimizationEngine()
