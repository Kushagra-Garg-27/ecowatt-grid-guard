"""
Unit Tests for Sustainability Analytics and Metric Calculations
Section 18 Requirements
"""
import pytest
import numpy as np
from backend.app.analytics.sustainability import SustainabilityCalculator


def test_energy_cost_carbon_calculations():
    # 4 intervals (1 hour total with 15-min intervals)
    steps = 4
    baseline_power = np.array([8.0, 8.0, 8.0, 8.0])  # 8 kW constant
    optimized_power = np.array([6.0, 6.0, 6.0, 6.0])  # 6 kW constant
    tariffs = np.array([0.20, 0.20, 0.20, 0.20])  # $0.20 / kWh
    carbon = np.array([300.0, 300.0, 300.0, 300.0])  # 300 g/kWh

    summary = SustainabilityCalculator.compute_daily_summary(
        scenario_id="unit_test",
        scenario_name="Unit Test",
        baseline_power_kw=baseline_power,
        optimized_power_kw=optimized_power,
        tariffs=tariffs,
        carbon_intensity=carbon,
        shifted_energy_kwh=0.0,
        control_operations_count=2,
        actuator_failures_count=0,
        critical_interruptions_count=0,
        threshold_kw=7.0,
        interval_hours=0.25,
    )

    # 8 kW for 1 hour = 8 kWh baseline
    assert abs(summary.total_baseline_energy_kwh - 8.0) < 1e-2
    # 6 kW for 1 hour = 6 kWh optimized
    assert abs(summary.total_optimized_energy_kwh - 6.0) < 1e-2
    # Energy saved = 2 kWh (25%)
    assert abs(summary.net_energy_saved_kwh - 2.0) < 1e-2
    assert abs(summary.energy_saved_pct - 25.0) < 1e-1

    # Baseline cost = 8 kWh * $0.20 = $1.60
    assert abs(summary.baseline_total_cost - 1.60) < 1e-2
    # Optimized cost = 6 kWh * $0.20 = $1.20
    assert abs(summary.optimized_total_cost - 1.20) < 1e-2
    # Cost saved = $0.40 (25%)
    assert abs(summary.net_cost_saved - 0.40) < 1e-2

    # Baseline carbon = 8 kWh * 300g = 2400g = 2.40 kg
    assert abs(summary.baseline_total_carbon_kg - 2.40) < 1e-2
    # Optimized carbon = 6 kWh * 300g = 1800g = 1.80 kg
    assert abs(summary.optimized_total_carbon_kg - 1.80) < 1e-2
    assert abs(summary.carbon_avoided_kg - 0.60) < 1e-2

    # Peak reduction = 8 kW to 6 kW = 2 kW (25%)
    assert abs(summary.peak_reduction_kw - 2.0) < 1e-2
    assert abs(summary.peak_reduction_pct - 25.0) < 1e-1


def test_threshold_exceedance_duration():
    # 4 intervals of 15 min = 60 mins total
    baseline_power = np.array([8.0, 7.5, 6.0, 5.0])  # Steps 0 and 1 exceed 7.0 kW
    optimized_power = np.array([6.8, 6.8, 6.0, 5.0])  # Zero exceedances of 7.0 kW
    tariffs = np.array([0.20, 0.20, 0.20, 0.20])
    carbon = np.array([300.0, 300.0, 300.0, 300.0])

    summary = SustainabilityCalculator.compute_daily_summary(
        scenario_id="unit_test_exceed",
        scenario_name="Exceed Test",
        baseline_power_kw=baseline_power,
        optimized_power_kw=optimized_power,
        tariffs=tariffs,
        carbon_intensity=carbon,
        shifted_energy_kwh=0.0,
        control_operations_count=1,
        actuator_failures_count=0,
        critical_interruptions_count=0,
        threshold_kw=7.0,
        interval_hours=0.25,
    )

    # 2 intervals exceeding 7.0 kW = 2 * 15 = 30 minutes
    assert summary.threshold_exceedance_minutes_baseline == 30
    # 0 intervals exceeding in optimized
    assert summary.threshold_exceedance_minutes_optimized == 0
