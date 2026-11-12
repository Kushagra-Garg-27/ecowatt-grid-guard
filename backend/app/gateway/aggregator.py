"""
EcoWatt Edge Gateway - Telemetry Aggregator and State Estimator
Aggregates zone-level telemetry, validates readings, monitors sensor health,
detects stale/duplicate packets, and maintains real-time building state.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pydantic import ValidationError
from backend.app.schemas.telemetry import (
    PowerTelemetry,
    OccupancyTelemetry,
    EnvironmentTelemetry,
    StatusTelemetry,
    ZoneSummary,
)

logger = logging.getLogger("ecowatt.gateway.aggregator")

ZONES_METADATA = {
    "classroom": {"name": "Classroom 101", "max_occupancy": 35},
    "computer_lab": {"name": "Advanced Computing Laboratory", "max_occupancy": 40},
    "office": {"name": "Faculty & Admin Office", "max_occupancy": 15},
    "corridor": {"name": "Main Corridor & Entrance", "max_occupancy": 25},
    "server_room": {"name": "Central Server & Telecom Room", "max_occupancy": 3},
}


class EdgeAggregator:
    """Edge Gateway Aggregator for Building Telemetry with Health & Integrity Monitoring."""

    def __init__(self):
        self.zone_states: Dict[str, Dict[str, Any]] = {}
        self.sensor_heartbeats: Dict[str, datetime] = {}
        self.sensor_health_status: Dict[str, str] = {}
        self.telemetry_history: List[Dict[str, Any]] = []
        self.max_history = 500
        self.duplicate_packets_count = 0
        self.stale_packets_count = 0
        self._initialize_zones()

    def _initialize_zones(self):
        now = datetime.now(timezone.utc)
        for zone_id, meta in ZONES_METADATA.items():
            self.zone_states[zone_id] = {
                "zone_id": zone_id,
                "name": meta["name"],
                "occupancy": 0,
                "max_occupancy": meta["max_occupancy"],
                "power_kw": 0.0,
                "voltage_v": 230.0,
                "current_a": 0.0,
                "power_factor": 0.95,
                "temperature_c": 22.0,
                "humidity_pct": 45.0,
                "lux_level": 350.0,
                "lighting_state": 1.0,
                "hvac_state": 1.0,
                "sensor_health": "HEALTHY",
                "last_seen": now,
                "packet_count": 0,
            }

    def _check_packet_freshness(self, zone_id: str, sensor_id: str, pkt_time: datetime) -> str:
        """
        Check whether packet is FRESH, DUPLICATE, or STALE relative to last seen reading.
        Returns: 'FRESH', 'DUPLICATE', or 'STALE'.
        """
        if pkt_time.tzinfo is None:
            pkt_time = pkt_time.replace(tzinfo=timezone.utc)

        last_time = self.sensor_heartbeats.get(sensor_id)
        if last_time is None:
            # First telemetry packet from this sensor is always fresh
            return "FRESH"

        if last_time.tzinfo is None:
            last_time = last_time.replace(tzinfo=timezone.utc)

        diff = (pkt_time - last_time).total_seconds()
        if abs(diff) < 1e-4:
            return "DUPLICATE"
        elif diff < -0.01:
            return "STALE"
        return "FRESH"

    def process_power_telemetry(self, raw_data: Dict[str, Any]) -> bool:
        """Validate and process power telemetry from CoAP endpoint."""
        try:
            packet = PowerTelemetry(**raw_data)
        except ValidationError as e:
            logger.error(f"Power telemetry validation failed: {e}")
            return False

        zone_id = packet.zone_id
        if zone_id not in self.zone_states:
            return False

        freshness = self._check_packet_freshness(zone_id, packet.sensor_id, packet.timestamp)

        if freshness == "DUPLICATE":
            self.duplicate_packets_count += 1
            logger.debug(f"Duplicate power packet ignored from sensor {packet.sensor_id}")
            return True

        if freshness == "STALE":
            self.stale_packets_count += 1
            logger.warning(
                f"Stale power packet rejected from sensor {packet.sensor_id} (timestamp {packet.timestamp.isoformat()} < last seen)"
            )
            self._record_telemetry("power_stale", packet.model_dump())
            return False

        zone = self.zone_states[zone_id]
        zone["power_kw"] = round(packet.power_kw, 3)
        zone["voltage_v"] = round(packet.voltage_v, 1)
        zone["current_a"] = round(packet.current_a, 2)
        zone["power_factor"] = round(packet.power_factor, 2)
        zone["sensor_health"] = packet.sensor_health
        zone["last_seen"] = packet.timestamp
        zone["packet_count"] += 1

        self.sensor_heartbeats[packet.sensor_id] = packet.timestamp
        self.sensor_health_status[packet.sensor_id] = packet.sensor_health

        self._record_telemetry("power", packet.model_dump())
        return True

    def process_occupancy_telemetry(self, raw_data: Dict[str, Any]) -> bool:
        """Validate and process occupancy telemetry from CoAP endpoint."""
        try:
            packet = OccupancyTelemetry(**raw_data)
        except ValidationError as e:
            logger.error(f"Occupancy telemetry validation failed: {e}")
            return False

        zone_id = packet.zone_id
        if zone_id not in self.zone_states:
            return False

        freshness = self._check_packet_freshness(zone_id, packet.sensor_id, packet.timestamp)

        if freshness == "DUPLICATE":
            self.duplicate_packets_count += 1
            logger.debug(f"Duplicate occupancy packet ignored from sensor {packet.sensor_id}")
            return True

        if freshness == "STALE":
            self.stale_packets_count += 1
            logger.warning(f"Stale occupancy packet rejected from sensor {packet.sensor_id}")
            self._record_telemetry("occupancy_stale", packet.model_dump())
            return False

        zone = self.zone_states[zone_id]
        zone["occupancy"] = packet.occupancy
        zone["max_occupancy"] = packet.max_occupancy
        zone["sensor_health"] = packet.sensor_health
        zone["last_seen"] = packet.timestamp
        zone["packet_count"] += 1

        self.sensor_heartbeats[packet.sensor_id] = packet.timestamp
        self.sensor_health_status[packet.sensor_id] = packet.sensor_health

        self._record_telemetry("occupancy", packet.model_dump())
        return True

    def process_environment_telemetry(self, raw_data: Dict[str, Any]) -> bool:
        """Validate and process environmental telemetry from CoAP endpoint."""
        try:
            packet = EnvironmentTelemetry(**raw_data)
        except ValidationError as e:
            logger.error(f"Environment telemetry validation failed: {e}")
            return False

        zone_id = packet.zone_id
        if zone_id not in self.zone_states:
            return False

        freshness = self._check_packet_freshness(zone_id, packet.sensor_id, packet.timestamp)

        if freshness == "DUPLICATE":
            self.duplicate_packets_count += 1
            logger.debug(f"Duplicate environment packet ignored from sensor {packet.sensor_id}")
            return True

        if freshness == "STALE":
            self.stale_packets_count += 1
            logger.warning(f"Stale environment packet rejected from sensor {packet.sensor_id}")
            self._record_telemetry("environment_stale", packet.model_dump())
            return False

        zone = self.zone_states[zone_id]
        zone["temperature_c"] = round(packet.temperature_c, 1)
        zone["humidity_pct"] = round(packet.humidity_pct, 1)
        zone["lux_level"] = round(packet.lux_level, 0)
        zone["sensor_health"] = packet.sensor_health
        zone["last_seen"] = packet.timestamp
        zone["packet_count"] += 1

        self.sensor_heartbeats[packet.sensor_id] = packet.timestamp
        self.sensor_health_status[packet.sensor_id] = packet.sensor_health

        self._record_telemetry("environment", packet.model_dump())
        return True

    def process_status_telemetry(self, raw_data: Dict[str, Any]) -> bool:
        """Validate and process node status/health telemetry."""
        try:
            packet = StatusTelemetry(**raw_data)
        except ValidationError as e:
            logger.error(f"Status telemetry validation failed: {e}")
            return False

        zone_id = packet.zone_id
        if zone_id in self.zone_states:
            self.zone_states[zone_id]["sensor_health"] = packet.sensor_health
            self.zone_states[zone_id]["last_seen"] = packet.timestamp

        self.sensor_heartbeats[packet.sensor_id] = packet.timestamp
        self.sensor_health_status[packet.sensor_id] = packet.sensor_health

        self._record_telemetry("status", packet.model_dump())
        return True

    def check_sensor_health_timeouts(self, timeout_seconds: float = 30.0) -> Dict[str, str]:
        """
        Mark sensor status as DEGRADED or FAULTED if heartbeat expires.
        Returns dictionary of zones and sensors with degraded or faulted health.
        """
        now = datetime.now(timezone.utc)
        abnormal_devices: Dict[str, str] = {}

        # 1. Check zones
        for zone_id, zone in self.zone_states.items():
            last = zone["last_seen"]
            if last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            delta = (now - last).total_seconds()
            if delta > timeout_seconds * 2:
                zone["sensor_health"] = "FAULTED"
                abnormal_devices[zone_id] = "FAULTED"
            elif delta > timeout_seconds:
                zone["sensor_health"] = "DEGRADED"
                abnormal_devices[zone_id] = "DEGRADED"

        # 2. Check individual sensors
        for sensor_id, last_hb in self.sensor_heartbeats.items():
            if last_hb.tzinfo is None:
                last_hb = last_hb.replace(tzinfo=timezone.utc)
            delta = (now - last_hb).total_seconds()
            if delta > timeout_seconds * 2:
                self.sensor_health_status[sensor_id] = "FAULTED"
                abnormal_devices[sensor_id] = "FAULTED"
            elif delta > timeout_seconds:
                self.sensor_health_status[sensor_id] = "DEGRADED"
                abnormal_devices[sensor_id] = "DEGRADED"

        return abnormal_devices

    def get_building_total_power(self) -> float:
        """Sum active power across all zones (kW)."""
        return round(sum(z["power_kw"] for z in self.zone_states.values()), 3)

    def get_building_total_occupancy(self) -> int:
        """Sum occupancy across all zones."""
        return sum(z["occupancy"] for z in self.zone_states.values())

    def get_zone_summaries(self) -> List[ZoneSummary]:
        """Return structured summary list for all 5 zones."""
        summaries = []
        for zone_id, z in self.zone_states.items():
            summaries.append(
                ZoneSummary(
                    zone_id=zone_id,
                    name=z["name"],
                    occupancy=z["occupancy"],
                    max_occupancy=z["max_occupancy"],
                    power_kw=z["power_kw"],
                    voltage_v=z["voltage_v"],
                    current_a=z["current_a"],
                    temperature_c=z["temperature_c"],
                    lighting_state=z["lighting_state"],
                    hvac_state=z["hvac_state"],
                    sensor_health=z["sensor_health"],
                    timestamp=z["last_seen"],
                )
            )
        return summaries

    def _record_telemetry(self, telemetry_type: str, payload: Dict[str, Any]):
        entry = {
            "type": telemetry_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": payload,
        }
        self.telemetry_history.append(entry)
        if len(self.telemetry_history) > self.max_history:
            self.telemetry_history.pop(0)


# Global singleton instance for edge gateway
edge_aggregator = EdgeAggregator()
