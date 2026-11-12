"""
Integration Tests for MQTT Communication and Brokering
Section 12 Requirements
"""
import pytest
import asyncio
from backend.app.communication.embedded_broker import EmbeddedMQTTBroker
from backend.app.communication.mqtt_client import MQTTManager


@pytest.mark.asyncio
async def test_mqtt_pub_sub_pipeline():
    test_port = 18839
    broker = EmbeddedMQTTBroker(host="127.0.0.1", port=test_port)
    started = await broker.start()
    assert started is True

    mqtt_mgr = MQTTManager(broker_host="127.0.0.1", broker_port=test_port, client_id="test_client_mgr")
    mqtt_mgr.start()

    received_messages = []

    def on_demand_msg(topic, payload):
        received_messages.append({"topic": topic, "payload": payload})

    mqtt_mgr.subscribe("ecowatt/building/demand", on_demand_msg)

    # Wait for connection
    for _ in range(20):
        if mqtt_mgr.is_connected:
            break
        await asyncio.sleep(0.1)

    assert mqtt_mgr.is_connected is True

    # Publish message
    test_payload = {"total_power_kw": 6.85, "threshold_kw": 7.00}
    published = mqtt_mgr.publish("ecowatt/building/demand", test_payload)
    assert published is True

    # Wait for callback
    for _ in range(20):
        if len(received_messages) > 0:
            break
        await asyncio.sleep(0.1)

    assert len(received_messages) == 1
    assert received_messages[0]["payload"]["total_power_kw"] == 6.85

    mqtt_mgr.stop()
    await broker.stop()

