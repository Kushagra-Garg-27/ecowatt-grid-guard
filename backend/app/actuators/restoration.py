"""
Progressive Load Restoration Engine with Closed-Loop Hysteresis
Restores curtailed electrical loads in ASCENDING order of Load Priority Score (LPS),
ensuring that essential comfort/convenience loads are recovered first without
causing new demand threshold violations.

Strictly verifies safety against actual measured demand from actuators/meters,
not just unverified open-loop estimates.
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
        current_demand_kw: Optional[float] = None,
        target_demand_kw: float = 6.80,
        current_tariff: float = 7.50,
        safety_buffer_kw: float = 0.05,
    ) -> List[Dict[str, Any]]:
        """
        Check if demand is sufficiently below target by at least hysteresis_kw.
        If headroom exists, restore loads in ASCENDING LPS order (least suitable for curtailment restored first).
        
        Strict Closed-Loop Validation:
        1. Reads actual measured power directly from physical/virtual actuators via actuator_manager.
        2. Verifies that projected actual demand (live_measured + power_needed) does not breach
           target_demand_kw - safety_buffer_kw (e.g. 6.80 - 0.05 = 6.75 kW).
        3. Remeasures actual demand immediately post-actuation.
        4. If post-actuation measured power reaches or exceeds the safety ceiling, halts restoration immediately.
        """
        # Always obtain fresh actual measured power directly from real-time actuator readings
        actual_measured_demand = actuator_manager.get_total_building_power()
        active_demand = actual_measured_demand if current_demand_kw is None else max(actual_measured_demand, current_demand_kw)

        available_headroom = round(target_demand_kw - active_demand, 3)
        if available_headroom < self.hysteresis_kw:
            logger.debug(
                f"Progressive restoration skipped: available headroom {available_headroom:.2f}kW "
                f"< hysteresis threshold {self.hysteresis_kw:.2f}kW (Measured Demand: {active_demand:.2f}kW, Target: {target_demand_kw:.2f}kW)"
            )
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

        for item in curtailed_candidates:
            # Query actual measured demand immediately before considering candidate
            live_measured_power = actuator_manager.get_total_building_power()
            act = item["actuator"]
            needed = item["power_needed"]

            projected_power = round(live_measured_power + needed, 3)
            safety_ceiling = round(target_demand_kw - safety_buffer_kw, 3)

            # Strict closed-loop check: post-restoration demand must not breach safety ceiling
            if projected_power <= safety_ceiling:
                cmd_id = f"cmd_rst_{uuid.uuid4().hex[:8]}"
                ack = act.execute_command(
                    action="RESTORE",
                    requested_level=1.0,
                    command_id=cmd_id,
                )

                # Remeasure actual power immediately after actuation
                post_actuation_measured = actuator_manager.get_total_building_power()
                actual_restored = round(post_actuation_measured - live_measured_power, 3)

                restored_actions.append({
                    "load_id": act.load_id,
                    "load_name": act.load_def.name,
                    "lps": item["lps"],
                    "action": "RESTORE_100_PCT",
                    "restored_power_kw": needed,
                    "actual_change_kw": actual_restored,
                    "post_restoration_power_kw": post_actuation_measured,
                    "safety_ceiling_kw": safety_ceiling,
                    "status": ack["status"],
                })
                logger.info(
                    f"Progressively restored load {act.load_id} (LPS={item['lps']:.3f}, "
                    f"power={needed:.2f}kW, post_measured={post_actuation_measured:.2f}kW <= {safety_ceiling:.2f}kW)"
                )

                # Critical safety gate: if actual measured power reaches or exceeds safety ceiling, halt
                if post_actuation_measured >= safety_ceiling:
                    logger.info(
                        f"Halting progressive restoration: post-actuation demand {post_actuation_measured:.2f}kW "
                        f"reached safety ceiling {safety_ceiling:.2f}kW (Target: {target_demand_kw:.2f}kW)."
                    )
                    break
            else:
                logger.debug(
                    f"Skipping restoration of {act.load_id} ({needed:.2f}kW): "
                    f"projected demand {projected_power:.2f}kW would breach safety ceiling {safety_ceiling:.2f}kW"
                )

        return restored_actions


restoration_engine = ProgressiveRestorationEngine()
