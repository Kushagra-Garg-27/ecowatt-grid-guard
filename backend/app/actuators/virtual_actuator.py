"""
Virtual Actuator System for EcoWatt Grid Guard
Simulates smart switches, dimmable ballasts, inverter heat pump throttles,
acknowledgement generation, and fault injection over MQTT.
"""
import copy
import logging
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from backend.app.simulation.scenarios import BUILDING_LOADS, LoadDefinition
from backend.app.communication.mqtt_client import mqtt_manager

logger = logging.getLogger("ecowatt.actuators.virtual")


class VirtualActuator:
    """Represents a physical IoT actuator controlling an electrical load."""

    def __init__(self, load_def: LoadDefinition):
        self.load_def = load_def
        self.load_id = load_def.id
        self.current_level = 1.0  # Normalized operating fraction (0.0 to 1.0)
        self.current_power_kw = load_def.nominal_baseline_kw
        self.is_curtailed = False
        self.curtailment_factor = 0.0
        self.status = "ONLINE"  # ONLINE, FAULTED, UNCERTAIN
        self.fail_simulation = False  # For scenario testing

    def execute_command(self, action: str, requested_level: float, command_id: str) -> Dict[str, Any]:
        """
        Execute command on the physical load.
        Enforces critical load protection and physical operating constraints.
        """
        # Critical load protection rule
        if self.load_def.category == "CRITICAL" and (action == "CURTAIL" or requested_level < 1.0):
            logger.critical(f"CRITICAL LOAD PROTECTION: Attempted curtailment of {self.load_id} rejected!")
            return {
                "command_id": command_id,
                "load_id": self.load_id,
                "status": "REJECTED_CRITICAL_PROTECTED",
                "actual_power_kw": self.current_power_kw,
                "latency_ms": 15.0,
                "error_details": "Critical electrical loads cannot be curtailed under any circumstance.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        # Simulated actuator failure / timeout test
        if self.fail_simulation:
            self.status = "UNCERTAIN"
            logger.warning(f"Actuator {self.load_id} simulated failure/timeout triggered for command {command_id}")
            return {
                "command_id": command_id,
                "load_id": self.load_id,
                "status": "TIMEOUT",
                "actual_power_kw": self.current_power_kw,
                "latency_ms": 3000.0,
                "error_details": "Actuator failed to acknowledge within timeout window.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        # Clamp requested level within device constraints
        target_level = max(self.load_def.min_operating_level, min(self.load_def.max_operating_level, requested_level))

        if self.load_def.control_type == "BINARY":
            # Binary switches snap to 0 or 1
            target_level = 0.0 if target_level < 0.5 else 1.0

        old_power = self.current_power_kw
        self.current_level = target_level
        self.current_power_kw = round(self.load_def.rated_power_kw * target_level, 3)

        if target_level < 1.0:
            self.is_curtailed = True
            self.curtailment_factor = round(1.0 - target_level, 3)
        else:
            self.is_curtailed = False
            self.curtailment_factor = 0.0

        self.status = "ONLINE"
        actual_change = round(old_power - self.current_power_kw, 3)

        ack = {
            "command_id": command_id,
            "load_id": self.load_id,
            "status": "SUCCESS",
            "actual_power_kw": self.current_power_kw,
            "actual_change_kw": actual_change,
            "operating_level": self.current_level,
            "latency_ms": 42.0,
            "error_details": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # Disseminate acknowledgement over MQTT
        mqtt_manager.publish(f"ecowatt/load/{self.load_id}/ack", ack)
        return ack


class ActuatorManager:
    """Manages all actuators across building zones."""

    def __init__(self):
        self.actuators: Dict[str, VirtualActuator] = {}
        self.pending_acks: Dict[str, asyncio.Future] = {}
        self._initialize_actuators()

    def _initialize_actuators(self):
        for l_def in BUILDING_LOADS:
            self.actuators[l_def.id] = VirtualActuator(l_def)

    def set_fault_injection(self, failed_load_id: Optional[str]):
        """Inject failure into a specific load actuator for testing."""
        for lid, act in self.actuators.items():
            act.fail_simulation = (lid == failed_load_id)
            if act.fail_simulation:
                act.status = "FAULTED"
            else:
                if act.status in ("FAULTED", "UNCERTAIN"):
                    act.status = "ONLINE"

    def get_load_actuator(self, load_id: str) -> Optional[VirtualActuator]:
        return self.actuators.get(load_id)

    def get_zone_power(self, zone_id: str) -> float:
        """Calculate total actual power currently drawn by all loads in a zone."""
        return sum(act.current_power_kw for act in self.actuators.values() if act.load_def.zone_id == zone_id)

    def get_total_building_power(self) -> float:
        """Calculate total actual power currently drawn across all building loads."""
        return round(sum(act.current_power_kw for act in self.actuators.values()), 3)

    def get_all_loads_status(self) -> List[Dict[str, Any]]:
        """Return full load status list for API and dashboard."""
        results = []
        for lid, act in self.actuators.items():
            results.append({
                "id": act.load_id,
                "name": act.load_def.name,
                "zone_id": act.load_def.zone_id,
                "category": act.load_def.category,
                "rated_power_kw": act.load_def.rated_power_kw,
                "current_power_kw": act.current_power_kw,
                "suitability_index": act.load_def.suitability_index,
                "min_operating_level": act.load_def.min_operating_level,
                "max_operating_level": act.load_def.max_operating_level,
                "control_type": act.load_def.control_type,
                "is_curtailed": act.is_curtailed,
                "curtailment_factor": act.curtailment_factor,
                "is_active": act.current_level > 0.0,
                "actuator_status": act.status,
            })
        return results

    def reset_all_loads(self):
        """Restore all loads to nominal 100% baseline operating level."""
        for act in self.actuators.values():
            act.current_level = 1.0
            act.current_power_kw = act.load_def.nominal_baseline_kw
            act.is_curtailed = False
            act.curtailment_factor = 0.0
            act.status = "ONLINE"


actuator_manager = ActuatorManager()
