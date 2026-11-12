"""
Deadline-Constrained Peak-Load Shifting Scheduler for Deferrable Loads
Implements Section 11 Formulation:
  Minimize Integral of [beta * normalized_tariff + (1 - beta) * normalized_carbon] * scheduled_power
  Subject to:
    - Earliest start <= t <= deadline
    - Required energy delivered
    - Total demand + scheduled_power <= target_demand_kw
"""
import logging
from enum import Enum
from typing import List, Dict, Any, Optional
import numpy as np
from pydantic import BaseModel, Field
from backend.app.core.config import settings
from backend.app.simulation.profiles import get_time_string

logger = logging.getLogger("ecowatt.optimizer.scheduler")


class ScheduleStatus(str, Enum):
    FULLY_SCHEDULED = "FULLY_SCHEDULED"
    PARTIALLY_SCHEDULED = "PARTIALLY_SCHEDULED"
    INFEASIBLE = "INFEASIBLE"
    COMPLETED = "COMPLETED"
    MISSED_DEADLINE = "MISSED_DEADLINE"


class ScheduledWindow(BaseModel):
    load_id: str
    load_name: str
    rated_power_kw: float
    required_energy_kwh: float  # Requested energy (backward-compatible)
    requested_energy_kwh: float = 0.0
    scheduled_energy_kwh: float = 0.0
    remaining_energy_kwh: float = 0.0
    shortfall_kwh: float = 0.0
    status: ScheduleStatus = ScheduleStatus.FULLY_SCHEDULED
    is_feasible: bool = True
    feasibility_reasons: List[str] = Field(default_factory=list)
    earliest_time: str
    deadline_time: str
    scheduled_steps: List[int]
    scheduled_times: List[str]
    delivered_energy_kwh: float  # Equal to scheduled_energy_kwh
    avg_tariff_baseline: float
    avg_tariff_scheduled: float
    cost_saved_by_shifting: float
    avg_carbon_baseline: float
    avg_carbon_scheduled: float
    carbon_avoided_by_shifting_g: float
    beta_cost_weight: float


class PeakLoadScheduler:
    """Optimizes temporal scheduling of deferrable electrical loads under strict constraints."""

    def __init__(self, beta_cost_weight: float = settings.DEFAULT_BETA_COST_WEIGHT):
        self.beta = max(0.0, min(1.0, beta_cost_weight))

    def update_beta(self, beta: float):
        self.beta = max(0.0, min(1.0, beta))

    def schedule_deferrable_load(
        self,
        load_id: str,
        load_name: str,
        rated_power_kw: float,
        required_energy_kwh: float,
        earliest_step: int,
        deadline_step: int,
        tariffs: np.ndarray,
        carbon_intensity: np.ndarray,
        base_demand: np.ndarray,
        already_scheduled_kw: Optional[np.ndarray] = None,
        threshold_kw: float = settings.DEFAULT_DEMAND_THRESHOLD_KW,
        target_demand_kw: Optional[float] = None,
        unmanaged_start_step: Optional[int] = None,
        step_hours: float = 0.25,
    ) -> ScheduledWindow:
        """
        Schedule deferrable load to minimize combined cost and carbon footprint
        while strictly respecting deadline and target demand limit.

        Treats scheduling as a constrained optimization problem:
          - Target limit: target_demand_kw = threshold_kw - reserve_margin
          - Strictly forbids scheduling intervals that exceed target limit.
          - Accurately tracks shortfall and reports partial or infeasible schedules.
        """
        steps = len(tariffs)
        requested_kwh = max(0.0, float(required_energy_kwh))
        limit_kw = target_demand_kw if target_demand_kw is not None else (threshold_kw - settings.DEFAULT_RESERVE_MARGIN_KW)
        limit_kw = round(float(limit_kw), 3)

        kwh_per_step = rated_power_kw * step_hours if rated_power_kw > 0 else 0.0
        needed_steps = int(np.ceil(requested_kwh / kwh_per_step)) if kwh_per_step > 0 else 0

        # Safe time formatting helper
        safe_earliest_idx = max(0, min(steps - 1, earliest_step)) if steps > 0 else 0
        safe_deadline_idx = max(0, min(steps - 1, deadline_step)) if steps > 0 else 0
        earliest_time_str = get_time_string(safe_earliest_idx)
        deadline_time_str = get_time_string(safe_deadline_idx)

        # 1. Edge Case: Zero energy requirement
        if requested_kwh <= 0.0 or needed_steps == 0:
            return ScheduledWindow(
                load_id=load_id,
                load_name=load_name,
                rated_power_kw=rated_power_kw,
                required_energy_kwh=0.0,
                requested_energy_kwh=0.0,
                scheduled_energy_kwh=0.0,
                remaining_energy_kwh=0.0,
                shortfall_kwh=0.0,
                status=ScheduleStatus.COMPLETED,
                is_feasible=True,
                feasibility_reasons=["Zero energy requested; load already completed."],
                earliest_time=earliest_time_str,
                deadline_time=deadline_time_str,
                scheduled_steps=[],
                scheduled_times=[],
                delivered_energy_kwh=0.0,
                avg_tariff_baseline=0.0,
                avg_tariff_scheduled=0.0,
                cost_saved_by_shifting=0.0,
                avg_carbon_baseline=0.0,
                avg_carbon_scheduled=0.0,
                carbon_avoided_by_shifting_g=0.0,
                beta_cost_weight=self.beta,
            )

        # 2. Edge Case: Deadline already passed or invalid window
        if deadline_step < earliest_step or deadline_step < 0 or earliest_step >= steps:
            reason = "Deadline already passed or invalid window (deadline < earliest)" if deadline_step < earliest_step else "Scheduling window outside simulation horizon"
            return ScheduledWindow(
                load_id=load_id,
                load_name=load_name,
                rated_power_kw=rated_power_kw,
                required_energy_kwh=requested_kwh,
                requested_energy_kwh=requested_kwh,
                scheduled_energy_kwh=0.0,
                remaining_energy_kwh=requested_kwh,
                shortfall_kwh=requested_kwh,
                status=ScheduleStatus.MISSED_DEADLINE,
                is_feasible=False,
                feasibility_reasons=[reason],
                earliest_time=earliest_time_str,
                deadline_time=deadline_time_str,
                scheduled_steps=[],
                scheduled_times=[],
                delivered_energy_kwh=0.0,
                avg_tariff_baseline=0.0,
                avg_tariff_scheduled=0.0,
                cost_saved_by_shifting=0.0,
                avg_carbon_baseline=0.0,
                avg_carbon_scheduled=0.0,
                carbon_avoided_by_shifting_g=0.0,
                beta_cost_weight=self.beta,
            )

        earliest = max(0, min(steps - 1, earliest_step))
        deadline = max(earliest, min(steps - 1, deadline_step))

        max_t = np.max(tariffs) if np.max(tariffs) > 0 else 1.0
        max_c = np.max(carbon_intensity) if np.max(carbon_intensity) > 0 else 1.0
        norm_tariffs = tariffs / max_t
        norm_carbon = carbon_intensity / max_c
        composite_index = self.beta * norm_tariffs + (1.0 - self.beta) * norm_carbon

        existing_kw = already_scheduled_kw if already_scheduled_kw is not None else np.zeros(steps)

        # 3. Evaluate candidate intervals within [earliest, deadline]
        # Strictly enforce target limit constraint: base + existing + load <= limit_kw
        feasible_candidates = []
        infeasible_reasons_detail = []

        for s in range(earliest, deadline + 1):
            projected_total = base_demand[s] + existing_kw[s] + rated_power_kw
            headroom = limit_kw - (base_demand[s] + existing_kw[s])

            if projected_total <= (limit_kw + 1e-4):
                # Strictly feasible slot
                # Score combines ToU tariff, carbon intensity, and small load leveling term
                level_factor = (projected_total / limit_kw) * 0.1
                score = composite_index[s] + level_factor
                feasible_candidates.append((s, score, projected_total))
            else:
                infeasible_reasons_detail.append(
                    f"Step {s} ({get_time_string(s)}): projected {projected_total:.2f}kW exceeds limit {limit_kw:.2f}kW (headroom {headroom:.2f}kW < {rated_power_kw:.2f}kW)"
                )

        # Sort feasible steps by lowest composite score (cheapest & greenest first)
        feasible_candidates.sort(key=lambda x: x[1])
        num_available = len(feasible_candidates)

        # 4. Determine schedule status and selected steps
        if num_available == 0:
            status = ScheduleStatus.INFEASIBLE
            is_feasible = False
            selected_steps = []
            delivered_energy = 0.0
            shortfall = requested_kwh
            remaining = requested_kwh
            reasons = [
                f"No feasible intervals available within window [{earliest_time_str} - {deadline_time_str}]. "
                f"Demand target {limit_kw:.2f} kW affords insufficient headroom for rated load {rated_power_kw:.2f} kW."
            ]
        elif num_available < needed_steps:
            status = ScheduleStatus.PARTIALLY_SCHEDULED
            is_feasible = False
            selected_steps = sorted([s for s, _, _ in feasible_candidates])
            delivered_energy = round(len(selected_steps) * kwh_per_step, 3)
            shortfall = round(max(0.0, requested_kwh - delivered_energy), 3)
            remaining = shortfall
            reasons = [
                f"Insufficient capacity: requested {needed_steps} intervals ({requested_kwh:.2f} kWh), "
                f"but only {num_available} feasible intervals ({delivered_energy:.2f} kWh) exist under target {limit_kw:.2f} kW. "
                f"Shortfall is {shortfall:.2f} kWh."
            ]
        else:
            status = ScheduleStatus.FULLY_SCHEDULED
            is_feasible = True
            selected_steps = sorted([s for s, _, _ in feasible_candidates[:needed_steps]])
            delivered_energy = round(min(requested_kwh, len(selected_steps) * kwh_per_step), 3)
            shortfall = 0.0
            remaining = 0.0
            reasons = []

        # 5. Baseline comparison & cost/carbon savings
        if len(selected_steps) > 0:
            unmanaged_start = unmanaged_start_step if unmanaged_start_step is not None else earliest
            unmanaged_steps = list(range(unmanaged_start, min(steps, unmanaged_start + len(selected_steps))))

            scheduled_tariffs = [tariffs[s] for s in selected_steps]
            unmanaged_tariffs = [tariffs[s] for s in unmanaged_steps]

            scheduled_carbon = [carbon_intensity[s] for s in selected_steps]
            unmanaged_carbon = [carbon_intensity[s] for s in unmanaged_steps]

            cost_scheduled = sum(t * kwh_per_step for t in scheduled_tariffs)
            cost_unmanaged = sum(t * kwh_per_step for t in unmanaged_tariffs)
            cost_saved = round(max(0.0, cost_unmanaged - cost_scheduled), 3)

            carbon_scheduled = sum(c * kwh_per_step for c in scheduled_carbon)
            carbon_unmanaged = sum(c * kwh_per_step for c in unmanaged_carbon)
            carbon_avoided = round(max(0.0, carbon_unmanaged - carbon_scheduled), 2)

            avg_t_base = round(float(np.mean(unmanaged_tariffs)), 3) if unmanaged_tariffs else 0.0
            avg_t_sched = round(float(np.mean(scheduled_tariffs)), 3)
            avg_c_base = round(float(np.mean(unmanaged_carbon)), 1) if unmanaged_carbon else 0.0
            avg_c_sched = round(float(np.mean(scheduled_carbon)), 1)
        else:
            cost_saved = 0.0
            carbon_avoided = 0.0
            avg_t_base = 0.0
            avg_t_sched = 0.0
            avg_c_base = 0.0
            avg_c_sched = 0.0

        return ScheduledWindow(
            load_id=load_id,
            load_name=load_name,
            rated_power_kw=rated_power_kw,
            required_energy_kwh=requested_kwh,
            requested_energy_kwh=requested_kwh,
            scheduled_energy_kwh=delivered_energy,
            remaining_energy_kwh=remaining,
            shortfall_kwh=shortfall,
            status=status,
            is_feasible=is_feasible,
            feasibility_reasons=reasons,
            earliest_time=earliest_time_str,
            deadline_time=deadline_time_str,
            scheduled_steps=selected_steps,
            scheduled_times=[get_time_string(s) for s in selected_steps],
            delivered_energy_kwh=delivered_energy,
            avg_tariff_baseline=avg_t_base,
            avg_tariff_scheduled=avg_t_sched,
            cost_saved_by_shifting=cost_saved,
            avg_carbon_baseline=avg_c_base,
            avg_carbon_scheduled=avg_c_sched,
            carbon_avoided_by_shifting_g=carbon_avoided,
            beta_cost_weight=self.beta,
        )

    def reschedule_interrupted_load(
        self,
        load_id: str,
        load_name: str,
        rated_power_kw: float,
        delivered_so_far_kwh: float,
        target_energy_kwh: float,
        current_step: int,
        deadline_step: int,
        tariffs: np.ndarray,
        carbon_intensity: np.ndarray,
        base_demand: np.ndarray,
        already_scheduled_kw: Optional[np.ndarray] = None,
        threshold_kw: float = settings.DEFAULT_DEMAND_THRESHOLD_KW,
        target_demand_kw: Optional[float] = None,
        step_hours: float = 0.25,
    ) -> ScheduledWindow:
        """
        Dynamically reschedule remaining energy for an interrupted deferrable load
        from the current time step up to the deadline.
        """
        remaining_needed_kwh = max(0.0, target_energy_kwh - delivered_so_far_kwh)
        return self.schedule_deferrable_load(
            load_id=load_id,
            load_name=load_name,
            rated_power_kw=rated_power_kw,
            required_energy_kwh=remaining_needed_kwh,
            earliest_step=current_step,
            deadline_step=deadline_step,
            tariffs=tariffs,
            carbon_intensity=carbon_intensity,
            base_demand=base_demand,
            already_scheduled_kw=already_scheduled_kw,
            threshold_kw=threshold_kw,
            target_demand_kw=target_demand_kw,
            unmanaged_start_step=current_step,
            step_hours=step_hours,
        )


peak_load_scheduler = PeakLoadScheduler()
