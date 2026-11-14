"""
Unit Tests for Virtual Actuators, Safety Invariants, and Restoration
Section 13 Requirements
"""
import pytest
from backend.app.actuators.virtual_actuator import actuator_manager, ActuatorManager
from backend.app.actuators.restoration import restoration_engine
from backend.app.simulation.scenarios import LoadDefinition


def test_critical_load_rejection():
    mgr = ActuatorManager()
    # Server IT Rack 1 is CRITICAL
    act = mgr.get_load_actuator("srv_it_rack_1")
    assert act is not None
    assert act.load_def.category == "CRITICAL"

    # Attempt to curtail critical load
    ack = act.execute_command(action="CURTAIL", requested_level=0.0, command_id="test_cmd_crit")
    assert ack["status"] == "REJECTED_CRITICAL_PROTECTED"
    assert act.current_level == 1.0  # Must remain at 100%
    assert act.is_curtailed is False


def test_flexible_load_modulation():
    mgr = ActuatorManager()
    # Classroom HVAC is FLEXIBLE, min operating level 0.45, rated 1.40 kW
    act = mgr.get_load_actuator("cls_hvac")
    assert act is not None

    ack = act.execute_command(action="MODULATE", requested_level=0.60, command_id="test_cmd_mod")
    assert ack["status"] == "SUCCESS"
    assert act.current_level == 0.60
    assert abs(act.current_power_kw - (1.40 * 0.60)) < 1e-3
    assert act.is_curtailed is True


def test_flexible_load_clamping_to_minimum():
    mgr = ActuatorManager()
    # Classroom HVAC min operating level is 0.45
    act = mgr.get_load_actuator("cls_hvac")
    assert act is not None

    # Request 0.10 (below min 0.45)
    ack = act.execute_command(action="MODULATE", requested_level=0.10, command_id="test_cmd_clamp")
    assert ack["status"] == "SUCCESS"
    assert act.current_level == 0.45  # Clamped to min operating level!


def test_simulated_actuator_failure():
    mgr = ActuatorManager()
    mgr.set_fault_injection("lab_sockets_aux")
    act = mgr.get_load_actuator("lab_sockets_aux")
    assert act is not None

    ack = act.execute_command(action="CURTAIL", requested_level=0.0, command_id="test_cmd_fail")
    assert ack["status"] == "TIMEOUT"
    assert act.status == "UNCERTAIN"

    # Reset
    mgr.set_fault_injection(None)
    assert act.status == "ONLINE"


def test_progressive_restoration_safety_margin_against_actual_measured_demand():
    """
    Verify that progressive restoration reads actual measured demand from actuators,
    enforces safety_buffer_kw (0.05 kW) below target demand, and never causes
    actual measured demand to breach (target_demand - safety_buffer).
    """
    # 1. Reset all actuators; set deferrable loads to off-peak idle (0 kW)
    for lid, act in actuator_manager.actuators.items():
        if act.load_def.category == "DEFERRABLE":
            act.current_level = 0.0
            act.current_power_kw = 0.0
            act.is_curtailed = False
        else:
            act.current_level = 1.0
            act.current_power_kw = act.load_def.rated_power_kw
            act.is_curtailed = False
        act.status = "ONLINE"

    # 2. Curtail multiple flexible loads to create headroom
    cls_hvac = actuator_manager.get_load_actuator("cls_hvac")
    cls_light = actuator_manager.get_load_actuator("cls_light_main")
    cor_light = actuator_manager.get_load_actuator("cor_light_main")

    cls_hvac.execute_command(action="MODULATE", requested_level=0.45, command_id="cmd_c1")
    cls_light.execute_command(action="CURTAIL", requested_level=0.0, command_id="cmd_c2")
    cor_light.execute_command(action="CURTAIL", requested_level=0.0, command_id="cmd_c3")

    curtailed_power = actuator_manager.get_total_building_power()
    # Configure target demand with 0.50 kW headroom above curtailed power
    target_demand = round(curtailed_power + 0.50, 2)
    safety_buffer = 0.05
    safety_ceiling = round(target_demand - safety_buffer, 2)

    # 3. Trigger progressive restoration
    restored = restoration_engine.evaluate_and_restore(
        target_demand_kw=target_demand,
        current_tariff=7.50,
        safety_buffer_kw=safety_buffer,
    )

    # 4. Read final actual measured demand from actuators
    final_measured_demand = actuator_manager.get_total_building_power()

    # 5. Core safety invariant: actual measured demand must NEVER exceed safety ceiling!
    assert final_measured_demand <= (safety_ceiling + 1e-4), (
        f"Restoration safety violation: actual measured demand {final_measured_demand:.3f} kW "
        f"breached safety ceiling {safety_ceiling:.3f} kW!"
    )

    # Verify restored loads were properly recorded
    for r in restored:
        assert r["post_restoration_power_kw"] <= (safety_ceiling + 1e-4)
        assert r["status"] == "SUCCESS"


def test_actuator_command_validation_rejections():
    """
    Verify actuator input validation rejects malformed payloads,
    unsupported actions, and out-of-range operating levels.
    """
    mgr = ActuatorManager()
    act = mgr.get_load_actuator("cls_hvac")
    assert act is not None

    # 1. Missing or empty command ID
    ack_empty_cmd = act.execute_command(action="MODULATE", requested_level=0.5, command_id="")
    assert ack_empty_cmd["status"] == "REJECTED_INVALID_PAYLOAD"
    assert "Command ID" in ack_empty_cmd["error_details"]
    assert ack_empty_cmd["is_measured_power"] is False

    ack_none_cmd = act.execute_command(action="MODULATE", requested_level=0.5, command_id=None)
    assert ack_none_cmd["status"] == "REJECTED_INVALID_PAYLOAD"

    # 2. Unsupported action
    ack_bad_action = act.execute_command(action="OVERCLOCK", requested_level=0.5, command_id="cmd_bad_act")
    assert ack_bad_action["status"] == "REJECTED_UNSUPPORTED_ACTION"
    assert "OVERCLOCK" in ack_bad_action["error_details"]
    assert ack_bad_action["is_measured_power"] is False

    # 3. Out-of-range operating level
    ack_neg_level = act.execute_command(action="MODULATE", requested_level=-0.1, command_id="cmd_neg")
    assert ack_neg_level["status"] == "REJECTED_INVALID_OPERATING_LEVEL"
    assert ack_neg_level["is_measured_power"] is False

    ack_high_level = act.execute_command(action="MODULATE", requested_level=1.5, command_id="cmd_high")
    assert ack_high_level["status"] == "REJECTED_INVALID_OPERATING_LEVEL"
    assert ack_high_level["is_measured_power"] is False


def test_actuator_acknowledgement_fields():
    """
    Verify that an accepted command returns all required telemetry fields,
    including command_id, load_id, timestamp, estimated_power_kw, and is_measured_power.
    """
    mgr = ActuatorManager()
    act = mgr.get_load_actuator("lab_sockets_aux")
    assert act is not None

    ack = act.execute_command(action="CURTAIL", requested_level=0.0, command_id="cmd_valid_ack_test")
    assert ack["status"] == "SUCCESS"
    assert ack["command_id"] == "cmd_valid_ack_test"
    assert ack["load_id"] == "lab_sockets_aux"
    assert "timestamp" in ack
    assert "estimated_power_kw" in ack
    assert ack["is_measured_power"] is False
    assert ack["actual_power_kw"] == 0.0

