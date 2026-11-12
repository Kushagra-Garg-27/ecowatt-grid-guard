"""
Deterministic Simulation Scenarios & Load Configuration
Section 6 & 19 Requirements
"""
import copy
from typing import Dict, List, Any
from pydantic import BaseModel


class LoadDefinition(BaseModel):
    id: str
    name: str
    zone_id: str
    category: str  # CRITICAL, FLEXIBLE, DEFERRABLE
    rated_power_kw: float
    nominal_baseline_kw: float
    suitability_index: float  # S_k: 0.0 for CRITICAL
    min_operating_level: float  # 0.0 to 1.0
    max_operating_level: float  # 1.0
    control_type: str  # BINARY, CONTINUOUS, SCHEDULED
    restoration_priority: int  # Ordering preference
    deferrable_energy_kwh: float = 0.0
    earliest_step: int = 0
    deadline_step: int = 95


# Canonical building loads specification
BUILDING_LOADS: List[LoadDefinition] = [
    # --- CRITICAL LOADS (S_k = 0.0, Never Curtailed) ---
    LoadDefinition(
        id="srv_it_rack_1",
        name="Server IT Primary Blade Chassis",
        zone_id="server_room",
        category="CRITICAL",
        rated_power_kw=1.80,
        nominal_baseline_kw=1.75,
        suitability_index=0.0,
        min_operating_level=1.0,
        max_operating_level=1.0,
        control_type="BINARY",
        restoration_priority=1,
    ),
    LoadDefinition(
        id="srv_it_rack_2",
        name="Server Storage SAN & Gateway",
        zone_id="server_room",
        category="CRITICAL",
        rated_power_kw=1.20,
        nominal_baseline_kw=1.15,
        suitability_index=0.0,
        min_operating_level=1.0,
        max_operating_level=1.0,
        control_type="BINARY",
        restoration_priority=2,
    ),
    LoadDefinition(
        id="srv_cool_pri",
        name="Server Room Precision Cooling Primary",
        zone_id="server_room",
        category="CRITICAL",
        rated_power_kw=1.50,
        nominal_baseline_kw=1.45,
        suitability_index=0.0,
        min_operating_level=1.0,
        max_operating_level=1.0,
        control_type="CONTINUOUS",
        restoration_priority=3,
    ),
    LoadDefinition(
        id="cls_emerg_light",
        name="Classroom Emergency Pathway Lighting",
        zone_id="classroom",
        category="CRITICAL",
        rated_power_kw=0.08,
        nominal_baseline_kw=0.08,
        suitability_index=0.0,
        min_operating_level=1.0,
        max_operating_level=1.0,
        control_type="BINARY",
        restoration_priority=4,
    ),
    LoadDefinition(
        id="cor_emerg_light",
        name="Corridor Emergency Exit Luminaire",
        zone_id="corridor",
        category="CRITICAL",
        rated_power_kw=0.12,
        nominal_baseline_kw=0.12,
        suitability_index=0.0,
        min_operating_level=1.0,
        max_operating_level=1.0,
        control_type="BINARY",
        restoration_priority=5,
    ),
    LoadDefinition(
        id="srv_safety_sys",
        name="Fire Suppression & Facility Safety Node",
        zone_id="server_room",
        category="CRITICAL",
        rated_power_kw=0.20,
        nominal_baseline_kw=0.20,
        suitability_index=0.0,
        min_operating_level=1.0,
        max_operating_level=1.0,
        control_type="BINARY",
        restoration_priority=6,
    ),

    # --- FLEXIBLE LOADS (Modulated or Selectively Curtailed) ---
    LoadDefinition(
        id="cls_light_main",
        name="Classroom LED Array",
        zone_id="classroom",
        category="FLEXIBLE",
        rated_power_kw=0.60,
        nominal_baseline_kw=0.58,
        suitability_index=0.65,
        min_operating_level=0.35,  # Can dim down to 35% without dark room
        max_operating_level=1.0,
        control_type="CONTINUOUS",
        restoration_priority=10,
    ),
    LoadDefinition(
        id="lab_light_main",
        name="Computer Lab High-Efficiency Illumination",
        zone_id="computer_lab",
        category="FLEXIBLE",
        rated_power_kw=0.80,
        nominal_baseline_kw=0.78,
        suitability_index=0.60,
        min_operating_level=0.40,
        max_operating_level=1.0,
        control_type="CONTINUOUS",
        restoration_priority=11,
    ),
    LoadDefinition(
        id="off_light_main",
        name="Faculty Office Dimmable Troffers",
        zone_id="office",
        category="FLEXIBLE",
        rated_power_kw=0.45,
        nominal_baseline_kw=0.42,
        suitability_index=0.70,
        min_operating_level=0.30,
        max_operating_level=1.0,
        control_type="CONTINUOUS",
        restoration_priority=12,
    ),
    LoadDefinition(
        id="cor_light_main",
        name="Corridor Architectural Accent & Downlights",
        zone_id="corridor",
        category="FLEXIBLE",
        rated_power_kw=0.35,
        nominal_baseline_kw=0.32,
        suitability_index=0.85,  # Highly suitable for dimming
        min_operating_level=0.20,
        max_operating_level=1.0,
        control_type="CONTINUOUS",
        restoration_priority=13,
    ),
    LoadDefinition(
        id="cls_hvac",
        name="Classroom Variable Air Volume (VAV) Heat Pump",
        zone_id="classroom",
        category="FLEXIBLE",
        rated_power_kw=1.40,
        nominal_baseline_kw=1.35,
        suitability_index=0.75,
        min_operating_level=0.45,  # Modulate compressor
        max_operating_level=1.0,
        control_type="CONTINUOUS",
        restoration_priority=14,
    ),
    LoadDefinition(
        id="lab_hvac",
        name="Computer Lab Thermal Conditioning Unit",
        zone_id="computer_lab",
        category="FLEXIBLE",
        rated_power_kw=1.80,
        nominal_baseline_kw=1.75,
        suitability_index=0.70,
        min_operating_level=0.50,
        max_operating_level=1.0,
        control_type="CONTINUOUS",
        restoration_priority=15,
    ),
    LoadDefinition(
        id="off_hvac",
        name="Office Inverter AC Unit",
        zone_id="office",
        category="FLEXIBLE",
        rated_power_kw=1.10,
        nominal_baseline_kw=1.05,
        suitability_index=0.80,
        min_operating_level=0.40,
        max_operating_level=1.0,
        control_type="CONTINUOUS",
        restoration_priority=16,
    ),
    LoadDefinition(
        id="lab_sockets_aux",
        name="Computer Lab Auxiliary Peripheral Sockets",
        zone_id="computer_lab",
        category="FLEXIBLE",
        rated_power_kw=0.75,
        nominal_baseline_kw=0.70,
        suitability_index=0.90,  # High suitability: can turn off printers/monitors in standby
        min_operating_level=0.0,
        max_operating_level=1.0,
        control_type="BINARY",
        restoration_priority=20,
    ),
    LoadDefinition(
        id="off_sockets_aux",
        name="Office Coffee Machine & Water Dispenser",
        zone_id="office",
        category="FLEXIBLE",
        rated_power_kw=0.50,
        nominal_baseline_kw=0.45,
        suitability_index=0.95,  # Highest suitability
        min_operating_level=0.0,
        max_operating_level=1.0,
        control_type="BINARY",
        restoration_priority=21,
    ),
    LoadDefinition(
        id="cls_projector_aux",
        name="Classroom AV Console & Smartboard",
        zone_id="classroom",
        category="FLEXIBLE",
        rated_power_kw=0.40,
        nominal_baseline_kw=0.35,
        suitability_index=0.55,
        min_operating_level=0.0,
        max_operating_level=1.0,
        control_type="BINARY",
        restoration_priority=22,
    ),

    # --- DEFERRABLE LOADS (Rescheduled to low cost/carbon windows) ---
    LoadDefinition(
        id="bld_ev_charger_1",
        name="Building Level 2 EV Fleet Charger",
        zone_id="corridor",  # Associated with outdoor/parking zone
        category="DEFERRABLE",
        rated_power_kw=2.20,
        nominal_baseline_kw=2.20,
        suitability_index=0.90,
        min_operating_level=0.0,
        max_operating_level=1.0,
        control_type="SCHEDULED",
        restoration_priority=30,
        deferrable_energy_kwh=6.60,  # 3 hours of full charging
        earliest_step=40,   # 10:00 AM
        deadline_step=84,   # 21:00 PM
    ),
    LoadDefinition(
        id="bld_water_heater",
        name="Building Sanitary Storage Water Heater",
        zone_id="office",
        category="DEFERRABLE",
        rated_power_kw=1.50,
        nominal_baseline_kw=1.50,
        suitability_index=0.85,
        min_operating_level=0.0,
        max_operating_level=1.0,
        control_type="SCHEDULED",
        restoration_priority=31,
        deferrable_energy_kwh=3.00,  # 2 hours
        earliest_step=28,   # 07:00 AM
        deadline_step=80,   # 20:00 PM
    ),
    LoadDefinition(
        id="bld_battery_storage",
        name="Auxiliary Emergency Battery Buffer Charging",
        zone_id="server_room",
        category="DEFERRABLE",
        rated_power_kw=1.00,
        nominal_baseline_kw=1.00,
        suitability_index=0.80,
        min_operating_level=0.0,
        max_operating_level=1.0,
        control_type="SCHEDULED",
        restoration_priority=32,
        deferrable_energy_kwh=2.50,  # 2.5 hours
        earliest_step=32,   # 08:00 AM
        deadline_step=88,   # 22:00 PM
    ),
]


# Scenario Configuration Details (Section 19: 10 test scenarios)
SCENARIO_CONFIGS: Dict[str, Dict[str, Any]] = {
    "peak_demand_event": {
        "name": "Peak-Demand Event (Demonstration Scenario)",
        "description": "Baseline peak demand reaches ~8.60 kW during afternoon lab & EV charging overlap. P_threshold is 7.00 kW, target 6.80 kW.",
        "threshold_kw": 7.00,
        "reserve_margin_kw": 0.20,
        "occupancy_multiplier": 1.0,
        "enable_ev_at_peak": True,
        "simulated_actuator_fault": None,
        "simulated_sensor_fault": None,
        "beta_cost_weight": 0.60,
    },
    "normal_operation": {
        "name": "Normal Building Operation",
        "description": "Typical day with moderate occupancy and staggered deferrable schedule.",
        "threshold_kw": 7.00,
        "reserve_margin_kw": 0.20,
        "occupancy_multiplier": 0.85,
        "enable_ev_at_peak": False,
        "simulated_actuator_fault": None,
        "simulated_sensor_fault": None,
        "beta_cost_weight": 0.50,
    },
    "high_tariff_surge": {
        "name": "High Electricity Tariff Event",
        "description": "Grid price spike during peak hours, heavily weighting financial savings in LPS.",
        "threshold_kw": 6.50,
        "reserve_margin_kw": 0.25,
        "occupancy_multiplier": 1.0,
        "enable_ev_at_peak": True,
        "simulated_actuator_fault": None,
        "simulated_sensor_fault": None,
        "beta_cost_weight": 0.90,  # High cost focus
    },
    "high_carbon_period": {
        "name": "High Carbon-Intensity Period",
        "description": "Grid generation relies on fossil peaker plants; optimizer prioritizes low-carbon windows for deferrable loads.",
        "threshold_kw": 7.00,
        "reserve_margin_kw": 0.20,
        "occupancy_multiplier": 1.0,
        "enable_ev_at_peak": True,
        "simulated_actuator_fault": None,
        "simulated_sensor_fault": None,
        "beta_cost_weight": 0.15,  # High carbon reduction focus
    },
    "low_occupancy": {
        "name": "Low Occupancy (Semester Break)",
        "description": "Minimal student attendance allows aggressive classroom & lab flexible load curtailment.",
        "threshold_kw": 5.50,
        "reserve_margin_kw": 0.20,
        "occupancy_multiplier": 0.20,
        "enable_ev_at_peak": False,
        "simulated_actuator_fault": None,
        "simulated_sensor_fault": None,
        "beta_cost_weight": 0.60,
    },
    "high_occupancy": {
        "name": "High Occupancy (Examination Day)",
        "description": "100% full capacity across all lecture halls and laboratories.",
        "threshold_kw": 8.00,
        "reserve_margin_kw": 0.30,
        "occupancy_multiplier": 1.20,
        "enable_ev_at_peak": True,
        "simulated_actuator_fault": None,
        "simulated_sensor_fault": None,
        "beta_cost_weight": 0.60,
    },
    "deferrable_ev_charging": {
        "name": "Deferrable EV Fleet Charging Optimization",
        "description": "Demonstrates deadline-constrained temporal shifting of 2.2 kW EV charge from peak afternoon to solar dip / off-peak.",
        "threshold_kw": 7.00,
        "reserve_margin_kw": 0.20,
        "occupancy_multiplier": 0.95,
        "enable_ev_at_peak": True,
        "simulated_actuator_fault": None,
        "simulated_sensor_fault": None,
        "beta_cost_weight": 0.60,
    },
    "failed_actuator_ack": {
        "name": "Failed Actuator Acknowledgement & Remeasurement",
        "description": "Simulates unresponsive actuator on lab sockets; gateway detects timeout, remeasures power, and curtails next eligible load.",
        "threshold_kw": 7.00,
        "reserve_margin_kw": 0.20,
        "occupancy_multiplier": 1.0,
        "enable_ev_at_peak": True,
        "simulated_actuator_fault": "lab_sockets_aux",  # Will fail/timeout
        "simulated_sensor_fault": None,
        "beta_cost_weight": 0.60,
    },
    "sensor_comm_failure": {
        "name": "Sensor Communication Failure & Gateway Fallback",
        "description": "Office environmental sensor packet loss handled gracefully with last-known-good state and warning.",
        "threshold_kw": 7.00,
        "reserve_margin_kw": 0.20,
        "occupancy_multiplier": 1.0,
        "enable_ev_at_peak": True,
        "simulated_actuator_fault": None,
        "simulated_sensor_fault": "office",
        "beta_cost_weight": 0.60,
    },
    "demand_recovery_restoration": {
        "name": "Demand Recovery & Progressive Load Restoration",
        "description": "Simulates evening demand drop below hysteresis threshold, progressively restoring curtailed loads in ascending LPS order.",
        "threshold_kw": 7.00,
        "reserve_margin_kw": 0.20,
        "occupancy_multiplier": 0.9,
        "enable_ev_at_peak": False,
        "simulated_actuator_fault": None,
        "simulated_sensor_fault": None,
        "beta_cost_weight": 0.60,
    },
}

