"""
Pydantic Schemas for Sustainability Analytics, Energy, Cost, and Emissions
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class IntervalMetric(BaseModel):
    step_index: int
    time_str: str
    baseline_power_kw: float
    optimized_power_kw: float
    baseline_energy_kwh: float
    optimized_energy_kwh: float
    energy_saved_kwh: float
    tariff_rate: float
    baseline_cost: float
    optimized_cost: float
    cost_saved: float
    carbon_intensity_g_per_kwh: float
    baseline_carbon_g: float
    optimized_carbon_g: float
    carbon_avoided_g: float
    shifted_energy_kwh: float
    curtailed_loads_count: int
    threshold_exceeded_baseline: bool
    threshold_exceeded_optimized: bool


class DailyAnalyticsSummary(BaseModel):
    scenario_id: str
    scenario_name: str
    total_baseline_energy_kwh: float
    total_optimized_energy_kwh: float
    net_energy_saved_kwh: float
    energy_saved_pct: float

    baseline_peak_power_kw: float
    optimized_peak_power_kw: float
    peak_reduction_kw: float
    peak_reduction_pct: float

    baseline_total_cost: float
    optimized_total_cost: float
    net_cost_saved: float
    cost_saved_pct: float

    baseline_total_carbon_kg: float
    optimized_total_carbon_kg: float
    carbon_avoided_kg: float
    carbon_reduction_pct: float

    total_shifted_energy_kwh: float
    threshold_exceedance_minutes_baseline: int
    threshold_exceedance_minutes_optimized: int
    total_control_operations: int
    total_actuator_failures: int
    critical_load_interruptions: int

    # Deferrable load scheduling lifecycle tracking
    deferrable_schedules: List[Dict[str, Any]] = Field(default_factory=list)
    total_deferrable_requested_kwh: float = 0.0
    total_deferrable_scheduled_kwh: float = 0.0
    total_deferrable_shortfall_kwh: float = 0.0

    intervals: List[IntervalMetric]


class BuildingLiveStatus(BaseModel):
    timestamp: datetime
    current_power_kw: float
    demand_threshold_kw: float
    target_demand_kw: float
    peak_demand_today_kw: float
    current_energy_kwh: float
    estimated_cost_today: float
    estimated_carbon_kg_today: float
    active_alarms_count: int
    curtailed_loads_count: int
    shifted_loads_count: int
    critical_load_protected: bool
    active_scenario: str

