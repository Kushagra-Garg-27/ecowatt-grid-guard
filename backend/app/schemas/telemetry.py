"""
Pydantic Schemas for IoT Telemetry (CoAP / JSON serialization)
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class BaseTelemetry(BaseModel):
    sensor_id: str
    zone_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    sensor_health: str = Field(default="HEALTHY")


class PowerTelemetry(BaseTelemetry):
    power_kw: float = Field(ge=0.0, description="Active power consumption in kW")
    voltage_v: float = Field(default=230.0, description="Measured line voltage in V")
    current_a: float = Field(default=0.0, description="Measured current in A")
    power_factor: float = Field(default=0.95, ge=0.0, le=1.0)


class OccupancyTelemetry(BaseTelemetry):
    occupancy: int = Field(ge=0, description="Current zone headcount")
    max_occupancy: int = Field(default=30, ge=1)
    motion_detected: bool = Field(default=True)


class EnvironmentTelemetry(BaseTelemetry):
    temperature_c: float = Field(default=22.5, description="Ambient temperature in °C")
    humidity_pct: float = Field(default=45.0, description="Relative humidity %")
    lux_level: float = Field(default=350.0, description="Relative ambient light index (0-1000, uncalibrated proxy)")


class StatusTelemetry(BaseTelemetry):
    battery_level: Optional[float] = Field(default=100.0, ge=0.0, le=100.0)
    uptime_seconds: int = Field(default=3600)
    firmware_version: str = Field(default="1.2.0")
    error_code: Optional[int] = Field(default=0)


class ZoneSummary(BaseModel):
    zone_id: str
    name: str
    occupancy: int
    max_occupancy: int
    power_kw: float
    voltage_v: float
    current_a: float
    temperature_c: float
    lighting_state: float
    hvac_state: float
    sensor_health: str
    timestamp: datetime

