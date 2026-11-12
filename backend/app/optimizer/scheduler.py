"""
Deadline-Constrained Peak-Load Shifting Scheduler for Deferrable Loads
Implements Section 11 Formulation:
  Minimize Integral of [beta * normalized_tariff + (1 - beta) * normalized_carbon] * scheduled_power
  Subject to:
    - Earliest start <= t <= deadline
    - Required energy delivered
    - Total demand + scheduled_power <= threshold
"""
import logging
import numpy as np
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from backend.app.core.config import settings
from backend.app.simulation.profiles import get_time_string

logger = logging.getLogger("ecowatt.optimizer.scheduler")


class ScheduledWindow(BaseModel):
    load_id: str
    load_name: str
    rated_power_kw: float
    required_energy_kwh: float
    earliest_time: str
    deadline_time: str
    scheduled_steps: List[int]
    scheduled_times: List[str]
    delivered_energy_kwh: float
    avg_tariff_baseline: float
    avg_tariff_scheduled: float
    cost_saved_by_shifting: float
    avg_carbon_baseline: float
    avg_carbon_scheduled: float
    carbon_avoided_by_shifting_g: float
    beta_cost_weight: float


class PeakLoadScheduler:
    """Optimizes temporal scheduling of deferrable electrical loads."""

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
    ) -> ScheduledWindow:
        """
        Schedule deferrable load to minimize combined cost and carbon footprint
        while respecting deadline and avoiding target demand exceedances.
        Accounts for already scheduled deferrable loads to prevent stacking.
        """
        steps = len(tariffs)
        earliest = max(0, min(steps - 1, earliest_step))
        deadline = max(earliest, min(steps - 1, deadline_step))
        limit_kw = target_demand_kw if target_demand_kw is not None else (threshold_kw - settings.DEFAULT_RESERVE_MARGIN_KW)

        step_hours = 0.25
        kwh_per_step = rated_power_kw * step_hours
        needed_steps = int(np.ceil(required_energy_kwh / kwh_per_step))
        window_size = deadline - earliest + 1

        if needed_steps > window_size:
            needed_steps = window_size

        max_t = np.max(tariffs) if np.max(tariffs) > 0 else 1.0
        max_c = np.max(carbon_intensity) if np.max(carbon_intensity) > 0 else 1.0

        norm_tariffs = tariffs / max_t
        norm_carbon = carbon_intensity / max_c

        # Step composite cost index: beta * norm_tariff + (1 - beta) * norm_carbon
        composite_index = self.beta * norm_tariffs + (1.0 - self.beta) * norm_carbon

        existing_kw = already_scheduled_kw if already_scheduled_kw is not None else np.zeros(steps)

        # Evaluate candidate intervals within [earliest, deadline]
        candidate_scores = []
        for s in range(earliest, deadline + 1):
            projected_total = base_demand[s] + existing_kw[s] + rated_power_kw
            # Severe penalty if scheduling breaches target demand
            penalty = 100.0 if projected_total > limit_kw else 0.0
            # Additional small penalty for higher demand to smooth load
            level_penalty = (projected_total / limit_kw) * 0.5
            score = composite_index[s] + penalty + level_penalty
            candidate_scores.append((s, score, projected_total))

        # Sort candidate steps by lowest composite score
        candidate_scores.sort(key=lambda x: x[1])

        # Pick the top N intervals
        selected_steps = sorted([s for s, score, _ in candidate_scores[:needed_steps]])
        delivered_energy = len(selected_steps) * kwh_per_step

        # Unmanaged baseline comparison
        unmanaged_start = unmanaged_start_step if unmanaged_start_step is not None else earliest
        unmanaged_steps = list(range(unmanaged_start, min(steps, unmanaged_start + needed_steps)))

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

        return ScheduledWindow(
            load_id=load_id,
            load_name=load_name,
            rated_power_kw=rated_power_kw,
            required_energy_kwh=required_energy_kwh,
            earliest_time=get_time_string(earliest),
            deadline_time=get_time_string(deadline),
            scheduled_steps=selected_steps,
            scheduled_times=[get_time_string(s) for s in selected_steps],
            delivered_energy_kwh=delivered_energy,
            avg_tariff_baseline=round(float(np.mean(unmanaged_tariffs)), 3) if unmanaged_tariffs else 0.0,
            avg_tariff_scheduled=round(float(np.mean(scheduled_tariffs)), 3) if scheduled_tariffs else 0.0,
            cost_saved_by_shifting=cost_saved,
            avg_carbon_baseline=round(float(np.mean(unmanaged_carbon)), 1) if unmanaged_carbon else 0.0,
            avg_carbon_scheduled=round(float(np.mean(scheduled_carbon)), 1) if scheduled_carbon else 0.0,
            carbon_avoided_by_shifting_g=carbon_avoided,
            beta_cost_weight=self.beta,
        )


peak_load_scheduler = PeakLoadScheduler()
