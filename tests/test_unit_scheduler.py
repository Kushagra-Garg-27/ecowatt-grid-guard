"""
Unit Tests for Peak-Load Shifting Scheduler
Comprehensive validation of constrained optimization, edge cases, and feasibility reporting.
"""
import pytest
import numpy as np
from backend.app.optimizer.scheduler import PeakLoadScheduler, ScheduleStatus


@pytest.fixture
def base_tariffs_and_carbon():
    steps = 96
    tariffs = np.full(steps, 7.50)  # INR 7.50 normal
    tariffs[56:72] = 12.00          # Afternoon/evening peak (14:00 - 18:00)
    tariffs[0:24] = 4.50            # Off-peak night (00:00 - 06:00)
    carbon = np.full(steps, 650.0)  # CEA India avg
    carbon[56:72] = 850.0           # Peak thermal
    carbon[0:24] = 580.0            # Night baseload / wind
    return tariffs, carbon


def test_scheduler_deadline_and_energy_delivery(base_tariffs_and_carbon):
    """Case 1: Sufficient scheduling capacity with standard deadline & energy delivery."""
    tariffs, carbon = base_tariffs_and_carbon
    steps = 96
    base_demand = np.full(steps, 4.0)
    scheduler = PeakLoadScheduler(beta_cost_weight=0.50)

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
        target_demand_kw=6.8,
        unmanaged_start_step=60,  # Unmanaged at peak
    )

    # Verify delivered energy and status
    assert result.status == ScheduleStatus.FULLY_SCHEDULED
    assert result.is_feasible is True
    assert len(result.scheduled_steps) == 8
    assert abs(result.delivered_energy_kwh - 4.4) < 1e-2
    assert abs(result.scheduled_energy_kwh - 4.4) < 1e-2
    assert result.shortfall_kwh == 0.0
    assert result.remaining_energy_kwh == 0.0

    # Verify scheduled intervals are strictly within earliest and deadline
    for s in result.scheduled_steps:
        assert 40 <= s <= 80

    # Verify that scheduled steps avoided the peak tariff (steps 56:72)
    for s in result.scheduled_steps:
        assert tariffs[s] < 12.00

    # Verify financial savings
    assert result.cost_saved_by_shifting > 0.0


def test_scheduler_insufficient_scheduling_capacity(base_tariffs_and_carbon):
    """Case 2: Insufficient scheduling capacity (window/headroom smaller than needed energy)."""
    tariffs, carbon = base_tariffs_and_carbon
    steps = 96
    # Base demand high everywhere except 3 steps
    base_demand = np.full(steps, 6.0)
    base_demand[40:43] = 4.0  # Headroom = 6.8 - 4.0 = 2.8 kW (fits 2.0 kW) for only 3 intervals

    scheduler = PeakLoadScheduler()
    # Needs 6 intervals (3.0 kWh / (2.0 kW * 0.25h) = 6 intervals)
    result = scheduler.schedule_deferrable_load(
        load_id="test_load_insufficient",
        load_name="Test Insufficient Capacity",
        rated_power_kw=2.0,
        required_energy_kwh=3.0,
        earliest_step=30,
        deadline_step=60,
        tariffs=tariffs,
        carbon_intensity=carbon,
        base_demand=base_demand,
        threshold_kw=7.0,
        target_demand_kw=6.8,
    )

    assert result.status == ScheduleStatus.PARTIALLY_SCHEDULED
    assert result.is_feasible is False
    assert len(result.scheduled_steps) == 3
    # Delivered: 3 intervals * 0.5 kWh = 1.5 kWh
    assert abs(result.scheduled_energy_kwh - 1.5) < 1e-2
    assert abs(result.shortfall_kwh - 1.5) < 1e-2
    assert abs(result.remaining_energy_kwh - 1.5) < 1e-2
    assert len(result.feasibility_reasons) > 0


def test_scheduler_no_available_time_slots(base_tariffs_and_carbon):
    """Case 3: No available time slots within window with sufficient headroom."""
    tariffs, carbon = base_tariffs_and_carbon
    steps = 96
    # Demand is 6.0 kW everywhere. Target is 6.8 kW -> headroom is 0.8 kW
    base_demand = np.full(steps, 6.0)
    scheduler = PeakLoadScheduler()

    # Load needs 2.0 kW (> 0.8 kW headroom)
    result = scheduler.schedule_deferrable_load(
        load_id="test_ev_no_slots",
        load_name="EV No Slots",
        rated_power_kw=2.0,
        required_energy_kwh=4.0,
        earliest_step=40,
        deadline_step=60,
        tariffs=tariffs,
        carbon_intensity=carbon,
        base_demand=base_demand,
        threshold_kw=7.0,
        target_demand_kw=6.8,
    )

    assert result.status == ScheduleStatus.INFEASIBLE
    assert result.is_feasible is False
    assert len(result.scheduled_steps) == 0
    assert result.scheduled_energy_kwh == 0.0
    assert abs(result.shortfall_kwh - 4.0) < 1e-2
    assert "No feasible intervals" in result.feasibility_reasons[0]


def test_scheduler_deadline_already_passed(base_tariffs_and_carbon):
    """Case 4: Deadline already passed (deadline_step < earliest_step)."""
    tariffs, carbon = base_tariffs_and_carbon
    steps = 96
    base_demand = np.full(steps, 3.0)
    scheduler = PeakLoadScheduler()

    # earliest 50 > deadline 40
    result = scheduler.schedule_deferrable_load(
        load_id="test_ev_passed",
        load_name="EV Passed",
        rated_power_kw=2.0,
        required_energy_kwh=4.0,
        earliest_step=50,
        deadline_step=40,
        tariffs=tariffs,
        carbon_intensity=carbon,
        base_demand=base_demand,
        threshold_kw=7.0,
        target_demand_kw=6.8,
    )

    assert result.status == ScheduleStatus.MISSED_DEADLINE
    assert result.is_feasible is False
    assert len(result.scheduled_steps) == 0
    assert result.shortfall_kwh == 4.0
    assert "Deadline already passed" in result.feasibility_reasons[0]


def test_scheduler_load_power_greater_than_headroom(base_tariffs_and_carbon):
    """Case 5: Load power is physically larger than any conceivable headroom."""
    tariffs, carbon = base_tariffs_and_carbon
    steps = 96
    # Target demand is 6.8 kW. Base demand is 2.0 kW -> max headroom 4.8 kW
    base_demand = np.full(steps, 2.0)
    scheduler = PeakLoadScheduler()

    # Load power is 7.5 kW (> 6.8 kW target alone!)
    result = scheduler.schedule_deferrable_load(
        load_id="giant_load",
        load_name="Giant Industrial Load",
        rated_power_kw=7.5,
        required_energy_kwh=7.5,
        earliest_step=10,
        deadline_step=50,
        tariffs=tariffs,
        carbon_intensity=carbon,
        base_demand=base_demand,
        threshold_kw=7.0,
        target_demand_kw=6.8,
    )

    assert result.status == ScheduleStatus.INFEASIBLE
    assert result.is_feasible is False
    assert len(result.scheduled_steps) == 0
    assert result.shortfall_kwh == 7.5


def test_scheduler_competing_deferrable_loads(base_tariffs_and_carbon):
    """Case 6: Multiple deferrable loads competing for capacity without stacking."""
    tariffs, carbon = base_tariffs_and_carbon
    steps = 96
    base_demand = np.full(steps, 4.0)  # 4.0 kW base -> 2.8 kW headroom under 6.8 kW limit
    scheduler = PeakLoadScheduler()

    # Load 1: 2.0 kW, 2.0 kWh (needs 4 intervals). Fits headroom (4.0 + 2.0 = 6.0 <= 6.8 kW)
    sched_1 = scheduler.schedule_deferrable_load(
        load_id="ev_compete_1",
        load_name="EV 1",
        rated_power_kw=2.0,
        required_energy_kwh=2.0,
        earliest_step=10,
        deadline_step=20,
        tariffs=tariffs,
        carbon_intensity=carbon,
        base_demand=base_demand,
        target_demand_kw=6.8,
    )
    assert sched_1.status == ScheduleStatus.FULLY_SCHEDULED
    assert len(sched_1.scheduled_steps) == 4

    # Build already_scheduled profile
    already_sched_kw = np.zeros(steps)
    for s in sched_1.scheduled_steps:
        already_sched_kw[s] += sched_1.rated_power_kw

    # Load 2: 1.5 kW, 1.5 kWh (needs 4 intervals).
    # On the 4 intervals of Load 1, total would be 4.0 + 2.0 + 1.5 = 7.5 kW > 6.8 kW target!
    # Load 2 must NOT stack onto Load 1's intervals.
    sched_2 = scheduler.schedule_deferrable_load(
        load_id="ev_compete_2",
        load_name="EV 2",
        rated_power_kw=1.5,
        required_energy_kwh=1.5,
        earliest_step=10,
        deadline_step=20,
        tariffs=tariffs,
        carbon_intensity=carbon,
        base_demand=base_demand,
        already_scheduled_kw=already_sched_kw,
        target_demand_kw=6.8,
    )
    assert sched_2.status == ScheduleStatus.FULLY_SCHEDULED
    assert len(sched_2.scheduled_steps) == 4

    # Crucial check: verify Load 1 and Load 2 never share the same interval
    overlap = set(sched_1.scheduled_steps).intersection(set(sched_2.scheduled_steps))
    assert len(overlap) == 0, f"Conflicting schedules overlapped at steps {overlap}!"

    # Verify combined demand never exceeds target
    total_combined = base_demand + already_sched_kw
    for s in sched_2.scheduled_steps:
        total_combined[s] += sched_2.rated_power_kw
    assert np.max(total_combined) <= 6.80 + 1e-4


def test_scheduler_zero_energy_requirement(base_tariffs_and_carbon):
    """Case 7: Zero energy requirement (E = 0) returns completed status."""
    tariffs, carbon = base_tariffs_and_carbon
    steps = 96
    base_demand = np.full(steps, 4.0)
    scheduler = PeakLoadScheduler()

    result = scheduler.schedule_deferrable_load(
        load_id="test_zero_req",
        load_name="Zero Req Load",
        rated_power_kw=2.0,
        required_energy_kwh=0.0,
        earliest_step=10,
        deadline_step=30,
        tariffs=tariffs,
        carbon_intensity=carbon,
        base_demand=base_demand,
        target_demand_kw=6.8,
    )

    assert result.status == ScheduleStatus.COMPLETED
    assert result.is_feasible is True
    assert len(result.scheduled_steps) == 0
    assert result.scheduled_energy_kwh == 0.0
    assert result.shortfall_kwh == 0.0


def test_scheduler_energy_exactly_equals_capacity(base_tariffs_and_carbon):
    """Case 8: Energy requirement exactly equals available capacity."""
    tariffs, carbon = base_tariffs_and_carbon
    steps = 96
    # Only exactly 4 intervals have base demand <= 4.0 kW (headroom >= 2.8 kW)
    base_demand = np.full(steps, 6.0)
    base_demand[15:19] = 4.0  # Exactly 4 intervals with headroom

    scheduler = PeakLoadScheduler()
    # Load needs exactly 4 intervals: 2.0 kW * 4 * 0.25h = 2.0 kWh
    result = scheduler.schedule_deferrable_load(
        load_id="exact_fit",
        load_name="Exact Fit Load",
        rated_power_kw=2.0,
        required_energy_kwh=2.0,
        earliest_step=10,
        deadline_step=30,
        tariffs=tariffs,
        carbon_intensity=carbon,
        base_demand=base_demand,
        target_demand_kw=6.8,
    )

    assert result.status == ScheduleStatus.FULLY_SCHEDULED
    assert result.is_feasible is True
    assert result.scheduled_steps == [15, 16, 17, 18]
    assert abs(result.scheduled_energy_kwh - 2.0) < 1e-2
    assert result.shortfall_kwh == 0.0


def test_scheduler_target_lower_than_critical_demand(base_tariffs_and_carbon):
    """Case 9: Target demand lower than unavoidable critical-load base demand."""
    tariffs, carbon = base_tariffs_and_carbon
    steps = 96
    # Unavoidable server room / critical load is 7.2 kW
    base_demand = np.full(steps, 7.2)
    scheduler = PeakLoadScheduler()

    # Target is 6.8 kW -> headroom is -0.4 kW
    result = scheduler.schedule_deferrable_load(
        load_id="deferrable_impossible",
        load_name="Impossible Deferrable",
        rated_power_kw=1.0,
        required_energy_kwh=2.0,
        earliest_step=10,
        deadline_step=40,
        tariffs=tariffs,
        carbon_intensity=carbon,
        base_demand=base_demand,
        target_demand_kw=6.8,
    )

    assert result.status == ScheduleStatus.INFEASIBLE
    assert result.is_feasible is False
    assert len(result.scheduled_steps) == 0
    assert result.shortfall_kwh == 2.0


def test_scheduler_interrupted_load_rescheduling(base_tariffs_and_carbon):
    """Case 10: Load interrupted during active scheduling interval and dynamically rescheduled."""
    tariffs, carbon = base_tariffs_and_carbon
    steps = 96
    base_demand = np.full(steps, 4.0)
    scheduler = PeakLoadScheduler()

    # Original target was 4.4 kWh. Load delivered 2.2 kWh before interruption at step 50.
    # Needs to reschedule remaining 2.2 kWh from step 52 to deadline 80.
    rescheduled = scheduler.reschedule_interrupted_load(
        load_id="interrupted_ev",
        load_name="Interrupted EV",
        rated_power_kw=2.2,
        delivered_so_far_kwh=2.2,
        target_energy_kwh=4.4,
        current_step=52,
        deadline_step=80,
        tariffs=tariffs,
        carbon_intensity=carbon,
        base_demand=base_demand,
        target_demand_kw=6.8,
    )

    assert rescheduled.status == ScheduleStatus.FULLY_SCHEDULED
    assert rescheduled.is_feasible is True
    # 2.2 kWh remaining at 2.2 kW * 0.25h = 0.55 kWh/step -> exactly 4 steps needed
    assert len(rescheduled.scheduled_steps) == 4
    assert abs(rescheduled.scheduled_energy_kwh - 2.2) < 1e-2
    assert rescheduled.shortfall_kwh == 0.0
    for s in rescheduled.scheduled_steps:
        assert s >= 52
        assert s <= 80
