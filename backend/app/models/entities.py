"""
SQLAlchemy Entity Models for EcoWatt Grid Guard
"""
from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    Index,
)
from sqlalchemy.orm import relationship
from backend.app.database.session import Base


class ZoneStateModel(Base):
    """Zone state and sensor telemetry snapshot."""
    __tablename__ = "zone_states"

    id = Column(Integer, primary_key=True, autoincrement=True)
    zone_id = Column(String(50), nullable=False, index=True)  # e.g., 'classroom', 'computer_lab'
    name = Column(String(100), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    occupancy = Column(Integer, default=0)
    max_occupancy = Column(Integer, default=30)
    power_kw = Column(Float, default=0.0)
    voltage_v = Column(Float, default=230.0)
    current_a = Column(Float, default=0.0)
    temperature_c = Column(Float, default=22.0)
    lighting_state = Column(Float, default=1.0)  # 0.0 to 1.0 (dimming level)
    hvac_state = Column(Float, default=1.0)      # 0.0 to 1.0 (cooling/heating power factor)
    sensor_health = Column(String(20), default="HEALTHY")  # HEALTHY, DEGRADED, FAULTED


class LoadModel(Base):
    """Electrical load definitions, categories, and live actuator status."""
    __tablename__ = "loads"

    id = Column(String(50), primary_key=True)  # e.g., 'srv_cooling_1', 'cls_light_main'
    name = Column(String(100), nullable=False)
    zone_id = Column(String(50), nullable=False, index=True)
    category = Column(String(30), nullable=False)  # CRITICAL, FLEXIBLE, DEFERRABLE
    rated_power_kw = Column(Float, nullable=False)
    current_power_kw = Column(Float, nullable=False)
    suitability_index = Column(Float, default=0.5)  # S_k: 0.0 for critical loads
    min_operating_level = Column(Float, default=0.0)  # normalized 0.0 to 1.0
    max_operating_level = Column(Float, default=1.0)  # normalized 0.0 to 1.0
    control_type = Column(String(30), default="BINARY")  # BINARY, CONTINUOUS, SCHEDULED
    is_curtailed = Column(Boolean, default=False)
    curtailment_factor = Column(Float, default=0.0)  # reduction fraction
    is_active = Column(Boolean, default=True)
    actuator_status = Column(String(30), default="ONLINE")  # ONLINE, FAULTED, UNCERTAIN
    last_command_id = Column(String(100), nullable=True)
    last_updated = Column(DateTime, default=datetime.utcnow)


class TelemetryRecordModel(Base):
    """Historical sensor telemetry stream."""
    __tablename__ = "telemetry_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    zone_id = Column(String(50), nullable=False, index=True)
    sensor_id = Column(String(50), nullable=False)
    telemetry_type = Column(String(30), nullable=False)  # power, occupancy, environment, status
    payload_json = Column(Text, nullable=False)


class OptimizationEventModel(Base):
    """Log of closed-loop optimization actions and demand threshold mitigation."""
    __tablename__ = "optimization_events"

    id = Column(String(64), primary_key=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    scenario_id = Column(String(50), nullable=True)
    initial_demand_kw = Column(Float, nullable=False)
    threshold_kw = Column(Float, nullable=False)
    target_kw = Column(Float, nullable=False)
    required_reduction_kw = Column(Float, nullable=False)
    actions_taken = Column(Text, nullable=False)  # JSON serialized list of actions
    actual_reduction_kw = Column(Float, default=0.0)
    residual_demand_kw = Column(Float, default=0.0)
    target_achieved = Column(Boolean, default=False)
    iterations_run = Column(Integer, default=1)


class ActuatorCommandModel(Base):
    """Audit log of MQTT commands issued to virtual actuators."""
    __tablename__ = "actuator_commands"

    command_id = Column(String(64), primary_key=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    load_id = Column(String(50), nullable=False, index=True)
    action = Column(String(30), nullable=False)  # CURTAIL, MODULATE, RESTORE, SCHEDULE
    requested_level = Column(Float, default=1.0)  # operating target fraction (0.0 to 1.0)
    expected_power_kw = Column(Float, nullable=False)
    status = Column(String(30), default="PENDING")  # PENDING, ACKNOWLEDGED, TIMEOUT, FAILED


class ActuatorAckModel(Base):
    """Acknowledgements received from virtual actuators via MQTT."""
    __tablename__ = "actuator_acks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    command_id = Column(String(64), nullable=False, index=True)
    load_id = Column(String(50), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    status = Column(String(30), nullable=False)  # SUCCESS, FAILED, TIMEOUT
    actual_power_kw = Column(Float, nullable=False)
    latency_ms = Column(Float, default=0.0)
    error_details = Column(String(255), nullable=True)


class LoadScheduleModel(Base):
    """Deadline-constrained scheduling records for deferrable loads."""
    __tablename__ = "load_schedules"

    id = Column(String(64), primary_key=True)
    load_id = Column(String(50), nullable=False, index=True)
    earliest_start_step = Column(Integer, nullable=False)
    deadline_step = Column(Integer, nullable=False)
    required_energy_kwh = Column(Float, nullable=False)
    scheduled_start_step = Column(Integer, nullable=False)
    scheduled_end_step = Column(Integer, nullable=False)
    scheduled_power_kw = Column(Float, nullable=False)
    status = Column(String(30), default="SCHEDULED")  # SCHEDULED, RUNNING, COMPLETED, CANCELED


class EnergyMetricModel(Base):
    """Granular comparison of baseline vs optimized operation over 24-hour simulation."""
    __tablename__ = "energy_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scenario_id = Column(String(50), nullable=False, index=True)
    step_index = Column(Integer, nullable=False)  # 0 to 95 for 15-min intervals
    timestamp = Column(DateTime, nullable=False, index=True)
    baseline_power_kw = Column(Float, nullable=False)
    optimized_power_kw = Column(Float, nullable=False)
    baseline_energy_kwh = Column(Float, nullable=False)
    optimized_energy_kwh = Column(Float, nullable=False)
    energy_saved_kwh = Column(Float, nullable=False)
    tariff_rate = Column(Float, nullable=False)  # $/kWh
    baseline_cost = Column(Float, nullable=False)
    optimized_cost = Column(Float, nullable=False)
    cost_saved = Column(Float, nullable=False)
    carbon_intensity_g_per_kwh = Column(Float, nullable=False)  # gCO2/kWh
    baseline_carbon_g = Column(Float, nullable=False)
    optimized_carbon_g = Column(Float, nullable=False)
    carbon_avoided_g = Column(Float, nullable=False)
    shifted_energy_kwh = Column(Float, default=0.0)
    curtailed_loads_count = Column(Integer, default=0)
    threshold_exceeded_baseline = Column(Boolean, default=False)
    threshold_exceeded_optimized = Column(Boolean, default=False)


class SystemErrorModel(Base):
    """Communication failures, timeout alerts, and system warnings."""
    __tablename__ = "system_errors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    component = Column(String(50), nullable=False)  # COAP_CLIENT, GATEWAY, MQTT, ACTUATOR, OPTIMIZER
    severity = Column(String(20), default="WARNING")  # INFO, WARNING, ERROR, CRITICAL
    message = Column(String(255), nullable=False)
    details_json = Column(Text, nullable=True)
