"""
Unit Tests for Sustainability Analytics and Metric Calculations
Section 18 Requirements:
  - Energy, cost, and carbon accounting
  - Verification of CEA India grid carbon intensity bounds
  - Threshold exceedance duration
"""
import pytest
import numpy as np
from backend.app.analytics.sustainability import SustainabilityCalculator
from backend.app.simulation.profiles import generate_grid_carbon_intensity


def test_energy_cost_carbon_calculations():
    # 4 intervals (1 hour total with 15-min intervals)
    steps = 4
    baseline_power = np.array([8.0, 8.0, 8.0, 8.0])  # 8 kW constant
    optimized_power = np.array([6.0, 6.0, 6.0, 6.0])  # 6 kW constant
    tariffs = np.array([7.50, 7.50, 7.50, 7.50])  # INR 7.50 / kWh
    carbon = np.array([650.0, 650.0, 650.0, 650.0])  # 650 g/kWh

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

    # Baseline cost = 8 kWh * 7.50 = 60.0 INR
    assert abs(summary.baseline_total_cost - 60.0) < 1e-2
    # Optimized cost = 6 kWh * 7.50 = 45.0 INR
    assert abs(summary.optimized_total_cost - 45.0) < 1e-2
    # Cost saved = 15.0 INR (25%)
    assert abs(summary.net_cost_saved - 15.0) < 1e-2

    # Baseline carbon = 8 kWh * 650g = 5200g = 5.20 kg
    assert abs(summary.baseline_total_carbon_kg - 5.20) < 1e-2
    # Optimized carbon = 6 kWh * 650g = 3900g = 3.90 kg
    assert abs(summary.optimized_total_carbon_kg - 3.90) < 1e-2
    assert abs(summary.carbon_avoided_kg - 1.30) < 1e-2

    # Peak reduction = 8 kW to 6 kW = 2 kW (25%)
    assert abs(summary.peak_reduction_kw - 2.0) < 1e-2
    assert abs(summary.peak_reduction_pct - 25.0) < 1e-1


def test_threshold_exceedance_duration():
    # 4 intervals of 15 min = 60 mins total
    baseline_power = np.array([8.0, 7.5, 6.0, 5.0])  # Steps 0 and 1 exceed 7.0 kW
    optimized_power = np.array([6.8, 6.8, 6.0, 5.0])  # Zero exceedances of 7.0 kW
    tariffs = np.array([7.50, 7.50, 7.50, 7.50])
    carbon = np.array([650.0, 650.0, 650.0, 650.0])

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


def test_cea_carbon_intensity_profile_bounds():
    """Verify that modeled carbon intensity strictly conforms to official CEA India baseline ranges."""
    carbon = generate_grid_carbon_intensity(96)
    assert len(carbon) == 96

    # 1. Bounds check: all values strictly between 550 and 920 gCO2/kWh
    assert np.all(carbon >= 550.0), f"Carbon intensity dropped below 550 gCO2/kWh: min={np.min(carbon)}"
    assert np.all(carbon <= 920.0), f"Carbon intensity exceeded 920 gCO2/kWh: max={np.max(carbon)}"

    # 2. Solar midday depression check (11:00 to 15:00, steps 44 to 60): intensity must be < 620 gCO2/kWh
    midday_carbon = carbon[44:60]
    assert np.mean(midday_carbon) < 620.0, f"Midday solar depression failed: mean={np.mean(midday_carbon)}"

    # 3. Evening peak peaker surge check (17:00 to 21:00, steps 68 to 84): intensity must exceed 850 gCO2/kWh
    evening_carbon = carbon[68:84]
    assert np.max(evening_carbon) >= 880.0, f"Evening peaker surge failed: max={np.max(evening_carbon)}"

    # 4. Diurnal differential: evening peak must be significantly higher than solar midday
    assert np.mean(evening_carbon) - np.mean(midday_carbon) > 250.0
