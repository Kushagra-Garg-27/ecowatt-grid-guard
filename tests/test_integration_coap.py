"""
Integration Tests for Real CoAP Communication over UDP (aiocoap)
Section 8 Requirements
"""
import pytest
import asyncio
from datetime import datetime, timezone
import aiocoap
from backend.app.gateway.coap_server import CoAPServerManager
from backend.app.gateway.aggregator import EdgeAggregator
from backend.app.sensors.coap_client import CoAPTelemetryClient


@pytest.mark.asyncio
async def test_real_coap_telemetry_flow():
    test_port = 56839
    aggregator = EdgeAggregator()
    server = CoAPServerManager(host="127.0.0.1", port=test_port)

    # Start CoAP UDP server
    await server.start()
    client = CoAPTelemetryClient(gateway_host="127.0.0.1", gateway_port=test_port)

    try:
        # Send Power Telemetry
        power_payload = {
            "sensor_id": "sensor_cls_01",
            "zone_id": "classroom",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "sensor_health": "HEALTHY",
            "power_kw": 2.45,
            "voltage_v": 229.4,
            "current_a": 11.2,
            "power_factor": 0.95,
        }
        p_ok = await client.send_telemetry("telemetry/power", power_payload, timeout=2.5)
        assert p_ok is True

        # Send Occupancy Telemetry
        occ_payload = {
            "sensor_id": "sensor_cls_01",
            "zone_id": "classroom",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "sensor_health": "HEALTHY",
            "occupancy": 28,
            "max_occupancy": 35,
            "motion_detected": True,
        }
        o_ok = await client.send_telemetry("telemetry/occupancy", occ_payload, timeout=2.5)
        assert o_ok is True

        # Send Environment Telemetry
        env_payload = {
            "sensor_id": "sensor_cls_01",
            "zone_id": "classroom",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "sensor_health": "HEALTHY",
            "temperature_c": 22.8,
            "humidity_pct": 46.5,
            "lux_level": 420.0,
        }
        e_ok = await client.send_telemetry("telemetry/environment", env_payload, timeout=2.5)
        assert e_ok is True

    finally:
        await client.close()
        await server.stop()

