"""
Integration Tests for Node-RED Visual IoT Flow Execution
Validates Node-RED flow topology, MQTT broker configuration, topic bindings,
and executes Node-RED JavaScript function nodes via Node.js runtime against
real EcoWatt MQTT telemetry and control payloads.
"""
import json
import subprocess
import pytest
from pathlib import Path
from backend.app.communication.mqtt_client import mqtt_manager


@pytest.fixture
def nodered_flows():
    flow_file = Path("nodered/flows.json")
    assert flow_file.exists(), "nodered/flows.json does not exist!"
    with open(flow_file, "r", encoding="utf-8") as f:
        flows = json.load(f)
    return flows


def test_nodered_flow_structure_and_broker_configuration(nodered_flows):
    """Verify Node-RED flow contains all required nodes, valid wiring, and correct broker bindings."""
    assert len(nodered_flows) >= 15, f"Expected at least 15 nodes, found {len(nodered_flows)}"

    # 1. Broker configuration verification
    broker_nodes = [n for n in nodered_flows if n.get("type") == "mqtt-broker"]
    assert len(broker_nodes) == 1, "Expected exactly 1 MQTT broker configuration node"
    broker = broker_nodes[0]
    assert broker.get("broker") in ("127.0.0.1", "localhost")
    assert broker.get("port") in (1883, "1883")

    # 2. Topic binding verification
    expected_sub_topics = {
        "ecowatt/building/demand",
        "ecowatt/load/+/command",
        "ecowatt/load/+/ack",
        "ecowatt/optimization/events",
    }
    sub_nodes = [n for n in nodered_flows if n.get("type") == "mqtt in"]
    actual_sub_topics = {n.get("topic") for n in sub_nodes}
    assert expected_sub_topics.issubset(actual_sub_topics), f"Missing sub topics: {expected_sub_topics - actual_sub_topics}"

    pub_nodes = [n for n in nodered_flows if n.get("type") == "mqtt out"]
    actual_pub_topics = {n.get("topic") for n in pub_nodes}
    assert "ecowatt/alerts" in actual_pub_topics, "Missing 'ecowatt/alerts' publisher node"


def test_nodered_javascript_functions_execution(nodered_flows):
    """
    Execute the exact JavaScript code from Node-RED function nodes in the Node.js runtime
    to verify behavioral accuracy and schema compatibility.
    """
    func_nodes = {n.get("name"): n.get("func") for n in nodered_flows if n.get("type") == "function"}
    assert "Demand Threshold Evaluator" in func_nodes
    assert "Critical Load Safety Auditor" in func_nodes
    assert "Ack Latency & Health Tracker" in func_nodes

    # Helper to run JS code via Node.js CLI
    def execute_js_node(code: str, msg_payload: dict, topic: str = ""):
        js_wrapper = f"""
        let msg = {{ topic: {json.dumps(topic)}, payload: {json.dumps(msg_payload)} }};
        function runNode(msg) {{
            {code}
        }}
        const res = runNode(msg);
        console.log(JSON.stringify(res));
        """
        proc = subprocess.run(
            ["node", "-e", js_wrapper],
            capture_output=True,
            text=True,
            check=True
        )
        return json.loads(proc.stdout.strip())

    evaluator_code = func_nodes["Demand Threshold Evaluator"]
    auditor_code = func_nodes["Critical Load Safety Auditor"]
    tracker_code = func_nodes["Ack Latency & Health Tracker"]

    # 1. Test Demand Threshold Evaluator with Peak Exceedance (8.60 kW > 7.00 kW)
    peak_payload = {
        "timestamp": "2026-11-14T12:00:00Z",
        "total_power_kw": 8.60,
        "threshold_kw": 7.00,
        "target_kw": 6.80,
    }
    res_peak = execute_js_node(evaluator_code, peak_payload)
    # Output 0 is alert, Output 1 is null
    alert_out = res_peak[0]
    normal_out = res_peak[1]
    assert alert_out is not None, "Exceedance did not trigger alert on output 0"
    assert normal_out is None
    assert alert_out["payload"]["alert"] == "CRITICAL_DEMAND_EXCEEDANCE"
    assert abs(alert_out["payload"]["required_reduction_kw"] - 1.80) < 1e-3

    # 2. Test Demand Threshold Evaluator with Normal Demand (6.79 kW <= 7.00 kW)
    normal_payload = {
        "timestamp": "2026-11-14T12:15:00Z",
        "total_power_kw": 6.79,
        "threshold_kw": 7.00,
        "target_kw": 6.80,
    }
    res_normal = execute_js_node(evaluator_code, normal_payload)
    assert res_normal[0] is None
    assert res_normal[1] is not None
    assert res_normal[1]["payload"]["status"] == "NORMAL"
    assert abs(res_normal[1]["payload"]["headroom_kw"] - 0.21) < 1e-2

    # 3. Test Critical Load Safety Auditor Interception
    crit_cmd = {
        "command_id": "cmd_test_001",
        "action": "CURTAIL",
        "requested_level": 0.0,
    }
    res_crit = execute_js_node(auditor_code, crit_cmd, topic="ecowatt/load/srv_it_rack_1/command")
    assert res_crit[0] is not None, "Critical load curtailment was not intercepted!"
    assert res_crit[0]["payload"]["violation"] == "SECURITY_AUDIT_FAIL"
    assert res_crit[0]["payload"]["load_id"] == "srv_it_rack_1"

    # 4. Test Critical Load Safety Auditor Permitting Flexible Load
    flex_cmd = {
        "command_id": "cmd_test_002",
        "action": "MODULATE",
        "requested_level": 0.5,
    }
    res_flex = execute_js_node(auditor_code, flex_cmd, topic="ecowatt/load/cls_lighting_dim/command")
    assert res_flex[0] is None, "Flexible load should not be flagged as violation!"
    assert res_flex[1] is not None

    # 5. Test Ack Latency & Health Tracker
    ack_payload = {
        "command_id": "cmd_test_003",
        "load_id": "cls_lighting_dim",
        "status": "SUCCESS",
        "actual_power_kw": 0.35,
        "latency_ms": 38.5,
    }
    res_ack = execute_js_node(tracker_code, ack_payload)
    assert res_ack["payload"]["load_id"] == "cls_lighting_dim"
    assert res_ack["payload"]["status"] == "SUCCESS"
    assert res_ack["payload"]["latency_ms"] == 38.5
