"""
Integration Tests for Real CoAP Communication over UDP (aiocoap)
Section 8 Requirements:
  - UDP packet transmission and response
  - Duplicate message handling
  - Stale telemetry rejection
  - Sensor heartbeat timeout and health transitions (HEALTHY -> DEGRADED -> FAULTED)
  - CoAP client timeout fallback
"""
import pytest
import asyncio
from datetime import datetime, timezone, timedelta
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


def test_aggregator_duplicate_and_stale_telemetry_handling():
    """Verify aggregator gracefully detects duplicate packets and rejects stale out-of-order packets."""
    aggregator = EdgeAggregator()
    t_now = datetime.now(timezone.utc)

    # 1. First fresh packet
    pkt1 = {
        "sensor_id": "sensor_pwr_cls",
        "zone_id": "classroom",
        "timestamp": t_now.isoformat(),
        "sensor_health": "HEALTHY",
        "power_kw": 3.0,
        "voltage_v": 230.0,
        "current_a": 13.0,
        "power_factor": 0.95,
    }
    assert aggregator.process_power_telemetry(pkt1) is True
    assert aggregator.zone_states["classroom"]["power_kw"] == 3.0
    assert aggregator.zone_states["classroom"]["packet_count"] == 1
    assert aggregator.duplicate_packets_count == 0

    # 2. Duplicate packet (same timestamp)
    assert aggregator.process_power_telemetry(pkt1) is True
    assert aggregator.duplicate_packets_count == 1
    # Packet count should NOT double increment on duplicate
    assert aggregator.zone_states["classroom"]["packet_count"] == 1

    # 3. Newer packet
    t_newer = t_now + timedelta(seconds=15)
    pkt2 = {
        "sensor_id": "sensor_pwr_cls",
        "zone_id": "classroom",
        "timestamp": t_newer.isoformat(),
        "sensor_health": "HEALTHY",
        "power_kw": 3.5,
        "voltage_v": 230.0,
        "current_a": 15.2,
        "power_factor": 0.95,
    }
    assert aggregator.process_power_telemetry(pkt2) is True
    assert aggregator.zone_states["classroom"]["power_kw"] == 3.5
    assert aggregator.zone_states["classroom"]["packet_count"] == 2

    # 4. Stale packet (timestamp older than t_newer)
    t_stale = t_now - timedelta(seconds=30)
    pkt_stale = {
        "sensor_id": "sensor_pwr_cls",
        "zone_id": "classroom",
        "timestamp": t_stale.isoformat(),
        "sensor_health": "HEALTHY",
        "power_kw": 1.0,  # Old stale reading
        "voltage_v": 230.0,
        "current_a": 4.3,
        "power_factor": 0.95,
    }
    res_stale = aggregator.process_power_telemetry(pkt_stale)
    assert res_stale is False
    assert aggregator.stale_packets_count == 1
    # Ensure stale reading was NOT allowed to overwrite the live zone power!
    assert aggregator.zone_states["classroom"]["power_kw"] == 3.5


def test_sensor_health_timeout_transitions():
    """Verify sensor heartbeat transitions from HEALTHY -> DEGRADED -> FAULTED on silence."""
    aggregator = EdgeAggregator()
    t_now = datetime.now(timezone.utc)

    # Ingest telemetry to register sensor and zone
    pkt = {
        "sensor_id": "sensor_office_01",
        "zone_id": "office",
        "timestamp": t_now.isoformat(),
        "sensor_health": "HEALTHY",
        "power_kw": 1.2,
        "voltage_v": 230.0,
        "current_a": 5.2,
        "power_factor": 0.95,
    }
    aggregator.process_power_telemetry(pkt)
    assert aggregator.zone_states["office"]["sensor_health"] == "HEALTHY"

    # 1. Within timeout: remains healthy
    abnormal = aggregator.check_sensor_health_timeouts(timeout_seconds=30.0)
    assert aggregator.zone_states["office"]["sensor_health"] == "HEALTHY"
    assert "office" not in abnormal

    # 2. Simulated time shift: 35 seconds elapsed (> 30s timeout, < 60s 2x timeout)
    aggregator.zone_states["office"]["last_seen"] = t_now - timedelta(seconds=35)
    aggregator.sensor_heartbeats["sensor_office_01"] = t_now - timedelta(seconds=35)
    abnormal = aggregator.check_sensor_health_timeouts(timeout_seconds=30.0)
    assert aggregator.zone_states["office"]["sensor_health"] == "DEGRADED"
    assert abnormal.get("office") == "DEGRADED"

    # 3. Simulated time shift: 70 seconds elapsed (> 60s 2x timeout)
    aggregator.zone_states["office"]["last_seen"] = t_now - timedelta(seconds=70)
    aggregator.sensor_heartbeats["sensor_office_01"] = t_now - timedelta(seconds=70)
    abnormal = aggregator.check_sensor_health_timeouts(timeout_seconds=30.0)
    assert aggregator.zone_states["office"]["sensor_health"] == "FAULTED"
    assert abnormal.get("office") == "FAULTED"


@pytest.mark.asyncio
async def test_coap_client_timeout_fallback():
    """Verify CoAP client handles unreachable gateway gracefully with timeout fallback."""
    # Use unused port where no server is listening
    unreachable_port = 59998
    client = CoAPTelemetryClient(gateway_host="127.0.0.1", gateway_port=unreachable_port)
    try:
        payload = {
            "sensor_id": "timeout_sensor",
            "zone_id": "classroom",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "sensor_health": "HEALTHY",
            "power_kw": 1.0,
            "voltage_v": 230.0,
            "current_a": 4.3,
            "power_factor": 0.95,
        }
        # Short timeout (0.5s) to confirm graceful fallback without crash
        ok = await client.send_telemetry("telemetry/power", payload, timeout=0.5)
        assert ok is False
    finally:
        await client.close()
