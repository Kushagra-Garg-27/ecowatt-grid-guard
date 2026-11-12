"""
Integration Tests for FastAPI REST Endpoints
Section 14 Requirements
"""
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_api_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "HEALTHY"
    assert data["version"] == "1.0.0"


def test_api_building_status():
    res = client.get("/api/building/status")
    assert res.status_code == 200
    data = res.json()
    assert "current_power_kw" in data
    assert "demand_threshold_kw" in data
    assert "target_demand_kw" in data
    assert data["critical_load_protected"] is True


def test_api_zones():
    res = client.get("/api/building/zones")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 5  # Exactly 5 zones
    zone_ids = [z["zone_id"] for z in data]
    assert "classroom" in zone_ids
    assert "computer_lab" in zone_ids
    assert "office" in zone_ids
    assert "corridor" in zone_ids
    assert "server_room" in zone_ids


def test_api_loads_and_critical_protection():
    res = client.get("/api/loads")
    assert res.status_code == 200
    loads = res.json()
    assert len(loads) == 19

    # Attempt manual override on critical load
    res_crit = client.post(
        "/api/loads/srv_it_rack_1/command",
        json={"load_id": "srv_it_rack_1", "action": "CURTAIL", "target_level": 0.0},
    )
    # Must be rejected with 403 Forbidden!
    assert res_crit.status_code == 403


def test_api_threshold_configuration():
    res = client.post(
        "/api/config/threshold",
        json={"demand_threshold_kw": 7.50, "reserve_margin_kw": 0.30},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["demand_threshold_kw"] == 7.50
    assert data["target_demand_kw"] == 7.20

    # Reset back to 7.00
    client.post(
        "/api/config/threshold",
        json={"demand_threshold_kw": 7.00, "reserve_margin_kw": 0.20},
    )


def test_api_weights_configuration():
    res = client.post(
        "/api/config/weights",
        json={"w_s": 0.35, "w_o": 0.25, "w_p": 0.20, "w_t": 0.20},
    )
    assert res.status_code == 200

    # Invalid weights sum
    res_bad = client.post(
        "/api/config/weights",
        json={"w_s": 0.8, "w_o": 0.8, "w_p": 0.8, "w_t": 0.8},
    )
    assert res_bad.status_code == 422  # Validation error
