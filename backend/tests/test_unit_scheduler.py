"""
Unit Tests for Peak-Load Shifting Scheduler
Section 11 Requirements
"""
import pytest
import numpy as np
from backend.app.optimizer.scheduler import PeakLoadScheduler


def test_scheduler_deadline_and_energy_delivery():
    scheduler = PeakLoadScheduler(beta_cost_weight=0.50)
    steps = 96
    # 24h tariff: cheap at 0-20, expensive at 56-72
    tariffs = np.full(steps, 0.20)
    tariffs[56:72] = 0.50  # Afternoon peak
    carbon = np.full(steps, 300.0)
    base_demand = np.full(steps, 4.0)

    # Schedule EV: 2.2 kW, 4.4 kWh (needs 8 steps of 0.25h)
    result = scheduler.schedule_deferrable_load(
        load_id="test_ev",
        load_name="Test EV",
        rated_power_kw=2.2,
        required_energy_kwh=4.4,
        earliest_step=40,  # 10:00
        deadline_step=80,  # 20:00
        tariffs=tariffs,
        carbon_intensity=carbon,
        base_demand=base_demand,
        threshold_kw=7.0,
        unmanaged_start_step=60,  # Unmanaged at peak
    )

    # Verify delivered energy
    assert len(result.scheduled_steps) == 8
    assert abs(result.delivered_energy_kwh - 4.4) < 1e-2

    # Verify scheduled intervals are strictly within earliest and deadline
    for s in result.scheduled_steps:
        assert s >= 40
        assert s <= 80

    # Verify that scheduled steps avoided the peak tariff (steps 56:72)
    for s in result.scheduled_steps:
        assert tariffs[s] < 0.50

    # Verify financial savings
    assert result.cost_saved_by_shifting > 0.0

