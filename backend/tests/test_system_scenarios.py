"""
System Acceptance Tests Across All 10 Simulation Scenarios
Section 19 & 20 Requirements
"""
import pytest
from pathlib import Path
from backend.app.simulation.engine import simulation_engine
from backend.app.simulation.scenarios import SCENARIO_CONFIGS
from backend.app.core.config import GENERATED_DIR


def test_peak_demand_demonstration_scenario():
    """Verify primary peak demand scenario meets section 7 requirements."""
    summary = simulation_engine.run_scenario("peak_demand_event")

    # Baseline peak around 8.60 kW
    assert abs(summary.baseline_peak_power_kw - 8.60) < 0.20
    # Configured threshold 7.00 kW
    assert summary.optimized_peak_power_kw <= 7.05
    # Peak reduction achieved
    assert summary.peak_reduction_kw > 1.20
    assert summary.peak_reduction_pct > 15.0

    # Critical loads 100% protected
    assert summary.critical_load_interruptions == 0

    # CSV file was created
    csv_file = GENERATED_DIR / "peak_demand_event_simulation_results.csv"
    assert csv_file.exists()


def test_all_ten_scenarios_execute_with_zero_critical_interruptions():
    """Verify all 10 simulation scenarios complete and protect critical loads."""
    for scen_id in SCENARIO_CONFIGS.keys():
        summary = simulation_engine.run_scenario(scen_id)
        assert summary.scenario_id == scen_id
        # Invariant: Zero critical load interruptions in all scenarios
        assert summary.critical_load_interruptions == 0
        assert summary.total_baseline_energy_kwh > 0.0
        assert summary.total_optimized_energy_kwh > 0.0


def test_failed_actuator_acknowledgement_scenario():
    """Verify actuator failure handling and fallback remeasurement."""
    summary = simulation_engine.run_scenario("failed_actuator_ack")
    assert summary.critical_load_interruptions == 0
    # Actuator failure counter recorded failures
    assert summary.total_actuator_failures >= 1
