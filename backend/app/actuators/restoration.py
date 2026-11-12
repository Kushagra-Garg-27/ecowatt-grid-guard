"""
Progressive Load Restoration Engine with Closed-Loop Hysteresis
Restores curtailed electrical loads in ASCENDING order of Load Priority Score (LPS),
ensuring that essential comfort/convenience loads are recovered first without
causing new demand threshold violations.
"""
import uuid
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from backend.app.core.config import settings
from backend.app.actuators.virtual_actuator import actuator_manager
from backend.app.optimizer.lps import lps_calculator
from backend.app.gateway.aggregator import edge_aggregator

logger = logging.getLogger("ecowatt.actuators.restoration")


class ProgressiveRestorationEngine:
    """Restores loads progressively in ascending LPS order under closed-loop safety verification."""

    def __init__(self, hysteresis_kw: float = settings.RESTORATION_HYSTERESIS_KW):
        self.hysteresis_kw = hysteresis_kw

    def evaluate_and_restore(
        self,
        current_demand_kw: float,
        target_demand_kw: float,
        current_tariff: float,
        safety_buffer_kw: float = 0.05,
    ) -> List[Dict[str, Any]]:
        """
        Check if demand is sufficiently below target by at least hysteresis_kw.
        If headroom exists, restore loads in ASCENDING LPS order (least suitable for curtailment restored first).
        Remeasures total power after each step to prevent any overshoot.
        """
        available_headroom = round(target_demand_kw - current_demand_kw, 3)
        if available_headroom < self.hysteresis_kw:
            return []

        curtailed_candidates = []
        for lid, act in actuator_manager.actuators.items():
            if act.is_curtailed and act.status not in ("FAULTED", "UNCERTAIN") and act.load_def.category != "CRITICAL":
                # Compute current LPS
                zone_info = edge_aggregator.zone_states.get(act.load_def.zone_id, {})
                occ = zone_info.get("occupancy", 0)
                max_occ = zone_info.get("max_occupancy", 30)

                lps = lps_calculator.calculate_lps(
                    suitability_index=act.load_def.suitability_index,
                    zone_occupancy=occ,
                    max_occupancy=max_occ,
                    current_power_kw=act.current_power_kw,
                    current_tariff=current_tariff,
                    is_critical=False,
                )
                power_needed = round(act.load_def.rated_power_kw - act.current_power_kw, 3)
                if power_needed > 0.001:
                    curtailed_candidates.append({
                        "actuator": act,
                        "lps": lps,
                        "power_needed": power_needed,
                    })

        # Sort in ASCENDING order of LPS (lowest LPS = highest priority for recovery)
        curtailed_candidates.sort(key=lambda x: x["lps"])

        restored_actions = []
        live_power = current_demand_kw

        for item in curtailed_candidates:
            act = item["actuator"]
            needed = item["power_needed"]

            # Strict closed-loop check: post-restoration demand must not breach target minus safety buffer
            if (live_power + needed) <= (target_demand_kw - safety_buffer_kw):
                cmd_id = f"cmd_rst_{uuid.uuid4().hex[:8]}"
                ack = act.execute_command(
                    action="RESTORE",
                    requested_level=1.0,
                    command_id=cmd_id,
                )

                # Remeasure actual power
                remeasured_total = actuator_manager.get_total_building_power()
                actual_restored = round(remeasured_total - live_power, 3)
                live_power = remeasured_total

                restored_actions.append({
                    "load_id": act.load_id,
                    "load_name": act.load_def.name,
                    "lps": item["lps"],
                    "action": "RESTORE_100_PCT",
                    "restored_power_kw": needed,
                    "actual_change_kw": actual_restored,
                    "post_restoration_power_kw": live_power,
                    "status": ack["status"],
                })
                logger.info(
                    f"Progressively restored load {act.load_id} (LPS={item['lps']:.3f}, "
                    f"power={needed:.2f}kW, post_power={live_power:.2f}kW)"
                )
            else:
                logger.debug(
                    f"Skipping restoration of {act.load_id} ({needed:.2f}kW): "
                    f"would result in {live_power + needed:.2f}kW > target {target_demand_kw:.2f}kW"
                )

        return restored_actions


restoration_engine = ProgressiveRestorationEngine()
