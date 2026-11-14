"""
EcoWatt Sustainability Analytics & Metric Calculations
Section 18 Formulation:
  - Energy Conservation (kWh) from active load curtailment & modulation
  - Energy Shifted (kWh) from deferrable load rescheduling
  - Cost calculations under time-of-use tariffs
  - Time-varying carbon emissions accounting
  - Peak demand reduction percentage
"""
import numpy as np
from typing import List, Dict, Any, Optional
from backend.app.schemas.analytics import DailyAnalyticsSummary, IntervalMetric
from backend.app.simulation.profiles import get_time_string


class SustainabilityCalculator:
    """Calculates rigorous energy, economic, and environmental metrics."""

    @staticmethod
    def compute_daily_summary(
        scenario_id: str,
        scenario_name: str,
        baseline_power_kw: np.ndarray,
        optimized_power_kw: np.ndarray,
        tariffs: np.ndarray,
        carbon_intensity: np.ndarray,
        shifted_energy_kwh: float,
        control_operations_count: int,
        actuator_failures_count: int,
        critical_interruptions_count: int,
        threshold_kw: float = 7.00,
        interval_hours: float = 0.25,  # 15 minutes = 0.25h
        shifted_energy_profile: Optional[np.ndarray] = None,
        deferrable_schedules: Optional[List[Dict[str, Any]]] = None,
        total_deferrable_requested_kwh: float = 0.0,
        total_deferrable_scheduled_kwh: float = 0.0,
        total_deferrable_shortfall_kwh: float = 0.0,
    ) -> DailyAnalyticsSummary:
        """
        Derive full daily metrics from 96-step time series.
        Separates energy conservation from temporal load shifting.
        """
        steps = len(baseline_power_kw)
        intervals: List[IntervalMetric] = []

        # Granular calculation per interval
        baseline_energy_arr = baseline_power_kw * interval_hours
        optimized_energy_arr = optimized_power_kw * interval_hours
        energy_saved_arr = np.maximum(0.0, baseline_energy_arr - optimized_energy_arr)

        baseline_cost_arr = baseline_energy_arr * tariffs
        optimized_cost_arr = optimized_energy_arr * tariffs
        cost_saved_arr = baseline_cost_arr - optimized_cost_arr

        baseline_carbon_arr = baseline_energy_arr * carbon_intensity  # grams
        optimized_carbon_arr = optimized_energy_arr * carbon_intensity  # grams
        carbon_avoided_arr = baseline_carbon_arr - optimized_carbon_arr

        thresh_exceed_base = baseline_power_kw > threshold_kw
        thresh_exceed_opt = optimized_power_kw > threshold_kw

        for s in range(steps):
            intervals.append(
                IntervalMetric(
                    step_index=s,
                    time_str=get_time_string(s, int(interval_hours * 60)),
                    baseline_power_kw=round(float(baseline_power_kw[s]), 3),
                    optimized_power_kw=round(float(optimized_power_kw[s]), 3),
                    baseline_energy_kwh=round(float(baseline_energy_arr[s]), 3),
                    optimized_energy_kwh=round(float(optimized_energy_arr[s]), 3),
                    energy_saved_kwh=round(float(energy_saved_arr[s]), 3),
                    tariff_rate=round(float(tariffs[s]), 3),
                    baseline_cost=round(float(baseline_cost_arr[s]), 3),
                    optimized_cost=round(float(optimized_cost_arr[s]), 3),
                    cost_saved=round(float(cost_saved_arr[s]), 3),
                    carbon_intensity_g_per_kwh=round(float(carbon_intensity[s]), 1),
                    baseline_carbon_g=round(float(baseline_carbon_arr[s]), 1),
                    optimized_carbon_g=round(float(optimized_carbon_arr[s]), 1),
                    carbon_avoided_g=round(float(carbon_avoided_arr[s]), 1),
                    shifted_energy_kwh=(
                        round(float(shifted_energy_profile[s]), 3)
                        if shifted_energy_profile is not None
                        else (round(shifted_energy_kwh / steps, 3) if shifted_energy_kwh > 0 else 0.0)
                    ),
                    curtailed_loads_count=1 if (baseline_power_kw[s] - optimized_power_kw[s]) > 0.05 else 0,
                    threshold_exceeded_baseline=bool(thresh_exceed_base[s]),
                    threshold_exceeded_optimized=bool(thresh_exceed_opt[s]),
                )
            )

        # Aggregate totals
        total_base_energy = float(np.sum(baseline_energy_arr))
        total_opt_energy = float(np.sum(optimized_energy_arr))
        net_energy_saved = max(0.0, total_base_energy - total_opt_energy)
        energy_saved_pct = (net_energy_saved / total_base_energy * 100.0) if total_base_energy > 0 else 0.0

        base_peak = float(np.max(baseline_power_kw))
        opt_peak = float(np.max(optimized_power_kw))
        peak_red_kw = max(0.0, base_peak - opt_peak)
        peak_red_pct = ((base_peak - opt_peak) / base_peak * 100.0) if base_peak > 0 else 0.0

        total_base_cost = float(np.sum(baseline_cost_arr))
        total_opt_cost = float(np.sum(optimized_cost_arr))
        net_cost_saved = max(0.0, total_base_cost - total_opt_cost)
        cost_saved_pct = (net_cost_saved / total_base_cost * 100.0) if total_base_cost > 0 else 0.0

        total_base_carbon_kg = float(np.sum(baseline_carbon_arr)) / 1000.0
        total_opt_carbon_kg = float(np.sum(optimized_carbon_arr)) / 1000.0
        carbon_avoided_kg = max(0.0, total_base_carbon_kg - total_opt_carbon_kg)
        carbon_red_pct = (carbon_avoided_kg / total_base_carbon_kg * 100.0) if total_base_carbon_kg > 0 else 0.0

        minutes_per_step = int(interval_hours * 60)
        exceed_mins_base = int(np.sum(thresh_exceed_base) * minutes_per_step)
        exceed_mins_opt = int(np.sum(thresh_exceed_opt) * minutes_per_step)

        return DailyAnalyticsSummary(
            scenario_id=scenario_id,
            scenario_name=scenario_name,
            total_baseline_energy_kwh=round(total_base_energy, 2),
            total_optimized_energy_kwh=round(total_opt_energy, 2),
            net_energy_saved_kwh=round(net_energy_saved, 2),
            energy_saved_pct=round(energy_saved_pct, 1),
            baseline_peak_power_kw=round(base_peak, 2),
            optimized_peak_power_kw=round(opt_peak, 2),
            peak_reduction_kw=round(peak_red_kw, 2),
            peak_reduction_pct=round(peak_red_pct, 1),
            baseline_total_cost=round(total_base_cost, 2),
            optimized_total_cost=round(total_opt_cost, 2),
            net_cost_saved=round(net_cost_saved, 2),
            cost_saved_pct=round(cost_saved_pct, 1),
            baseline_total_carbon_kg=round(total_base_carbon_kg, 2),
            optimized_total_carbon_kg=round(total_opt_carbon_kg, 2),
            carbon_avoided_kg=round(carbon_avoided_kg, 2),
            carbon_reduction_pct=round(carbon_red_pct, 1),
            total_shifted_energy_kwh=round(shifted_energy_kwh, 2),
            threshold_exceedance_minutes_baseline=exceed_mins_base,
            threshold_exceedance_minutes_optimized=exceed_mins_opt,
            total_control_operations=control_operations_count,
            total_actuator_failures=actuator_failures_count,
            critical_load_interruptions=critical_interruptions_count,
            deferrable_schedules=deferrable_schedules or [],
            total_deferrable_requested_kwh=round(total_deferrable_requested_kwh, 2),
            total_deferrable_scheduled_kwh=round(total_deferrable_scheduled_kwh, 2),
            total_deferrable_shortfall_kwh=round(total_deferrable_shortfall_kwh, 2),
            intervals=intervals,
        )

