"""
Unit Tests for Virtual Actuators, Safety Invariants, and Restoration
Section 13 Requirements
"""
import pytest
from backend.app.actuators.virtual_actuator import ActuatorManager
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

