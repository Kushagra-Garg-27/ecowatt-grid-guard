"""
Virtual IoT Sensor Nodes for the 5 Building Zones
Generates realistic electrical, occupancy, and environmental telemetry
and transmits it to the Edge Gateway via CoAP over UDP.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import numpy as np
from backend.app.sensors.coap_client import CoAPTelemetryClient

logger = logging.getLogger("ecowatt.sensors.virtual_sensor")


class ZoneSensorNode:
    """Represents a multi-parameter IoT sensor node installed in a zone."""

    def __init__(
        self,
        zone_id: str,
        sensor_id: str,
        coap_client: CoAPTelemetryClient,
        max_occupancy: int,
        base_temp_c: float = 22.0,
    ):
        self.zone_id = zone_id
        self.sensor_id = sensor_id
        self.coap_client = coap_client
        self.max_occupancy = max_occupancy
        self.current_temp_c = base_temp_c
        self.health_status = "HEALTHY"  # HEALTHY, DEGRADED, FAULTED
        self.fault_simulation = False

    async def emit_telemetry(
        self,
        current_power_kw: float,
        occupancy: int,
        lighting_level: float = 1.0,
        hvac_level: float = 1.0,
        rng: Optional[np.random.RandomState] = None,
    ) -> Dict[str, bool]:
        """Generate and transmit CoAP telemetry packets for power, occupancy, environment, and status."""
        if rng is None:
            rng = np.random.RandomState()

        # If simulated fault is active, drop packet to test gateway resilience
        if self.fault_simulation:
            logger.warning(f"Sensor node {self.sensor_id} ({self.zone_id}) simulating communication failure.")
            return {"power": False, "occupancy": False, "environment": False, "status": False}

        now = datetime.now(timezone.utc).isoformat()

        # Electrical Physics Simulation:
        # P = V * I * pf -> I = (P * 1000) / (V * pf)
        # Small voltage drop under heavy load
        v_noise = rng.normal(0, 0.5)
        voltage_v = max(215.0, min(240.0, 230.0 - 0.4 * current_power_kw + v_noise))
        power_factor = 0.98 if self.zone_id == "server_room" else 0.95
        current_a = (current_power_kw * 1000.0) / (voltage_v * power_factor) if voltage_v > 0 else 0.0

        # Thermal Dynamics Simulation:
        # Heat added by occupants (approx 100W/person) and electrical loads, removed by HVAC
        heat_load = (occupancy * 0.10) + (current_power_kw * 0.20)
        cooling = hvac_level * 1.5
        target_temp = 22.0 + (heat_load - cooling) * 0.8
        self.current_temp_c += 0.15 * (target_temp - self.current_temp_c) + rng.normal(0, 0.05)
        self.current_temp_c = round(float(self.current_temp_c), 1)

        # Ambient lighting (lux)
        lux_level = round(float(lighting_level * 450.0 + (50.0 if occupancy > 0 else 10.0)), 0)

        # 1. Power packet
        power_payload = {
            "sensor_id": self.sensor_id,
            "zone_id": self.zone_id,
            "timestamp": now,
            "sensor_health": self.health_status,
            "power_kw": round(float(current_power_kw), 3),
            "voltage_v": round(float(voltage_v), 1),
            "current_a": round(float(current_a), 2),
            "power_factor": power_factor,
        }

        # 2. Occupancy packet
        occupancy_payload = {
            "sensor_id": self.sensor_id,
            "zone_id": self.zone_id,
            "timestamp": now,
            "sensor_health": self.health_status,
            "occupancy": int(occupancy),
            "max_occupancy": self.max_occupancy,
            "motion_detected": occupancy > 0,
        }

        # 3. Environment packet
        env_payload = {
            "sensor_id": self.sensor_id,
            "zone_id": self.zone_id,
            "timestamp": now,
            "sensor_health": self.health_status,
            "temperature_c": self.current_temp_c,
            "humidity_pct": 45.0 + rng.normal(0, 1.0),
            "lux_level": lux_level,
        }

        # 4. Status packet
        status_payload = {
            "sensor_id": self.sensor_id,
            "zone_id": self.zone_id,
            "timestamp": now,
            "sensor_health": self.health_status,
            "battery_level": 100.0,
            "uptime_seconds": 86400,
            "firmware_version": "1.2.0",
        }

        # Send CoAP packets
        p_ok = await self.coap_client.send_telemetry("telemetry/power", power_payload)
        o_ok = await self.coap_client.send_telemetry("telemetry/occupancy", occupancy_payload)
        e_ok = await self.coap_client.send_telemetry("telemetry/environment", env_payload)
        s_ok = await self.coap_client.send_telemetry("telemetry/status", status_payload)

        return {"power": p_ok, "occupancy": o_ok, "environment": e_ok, "status": s_ok}


class VirtualSensorManager:
    """Manages the pool of 5 zone sensor nodes."""

    def __init__(self, coap_client: CoAPTelemetryClient):
        self.coap_client = coap_client
        self.sensors: Dict[str, ZoneSensorNode] = {
            "classroom": ZoneSensorNode("classroom", "sensor_cls_01", coap_client, max_occupancy=35),
            "computer_lab": ZoneSensorNode("computer_lab", "sensor_lab_01", coap_client, max_occupancy=40),
            "office": ZoneSensorNode("office", "sensor_off_01", coap_client, max_occupancy=15),
            "corridor": ZoneSensorNode("corridor", "sensor_cor_01", coap_client, max_occupancy=25),
            "server_room": ZoneSensorNode("server_room", "sensor_srv_01", coap_client, max_occupancy=3, base_temp_c=19.5),
        }

    def set_fault_injection(self, target_zone: Optional[str]):
        """Inject or clear communication fault for testing."""
        for zid, node in self.sensors.items():
            node.fault_simulation = (zid == target_zone)
            if node.fault_simulation:
                node.health_status = "FAULTED"
            else:
                node.health_status = "HEALTHY"

