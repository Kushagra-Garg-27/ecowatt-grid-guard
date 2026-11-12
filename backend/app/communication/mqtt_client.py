"""
EcoWatt MQTT Client Management (Paho MQTT integration)
Handles topic publication, subscriptions, connection monitoring, and message history.
"""
import json
import logging
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, Callable, List, Optional
import paho.mqtt.client as mqtt
from backend.app.core.config import settings

logger = logging.getLogger("ecowatt.communication.mqtt_client")


class MQTTManager:
    """Manages Paho MQTT client connection, subscriptions, and publication."""

    def __init__(
        self,
        broker_host: str = settings.MQTT_BROKER_HOST,
        broker_port: int = settings.MQTT_BROKER_PORT,
        client_id: str = settings.MQTT_CLIENT_ID,
        qos: int = settings.MQTT_QOS,
    ):
        self.broker_host = broker_host
        self.broker_port = broker_port
        self.client_id = client_id
        self.qos = qos
        self.client: Optional[mqtt.Client] = None
        self.is_connected = False
        self.subscriptions: Dict[str, List[Callable[[str, Dict[str, Any]], None]]] = {}
        self.message_history: List[Dict[str, Any]] = []
        self.max_history = 300

    def start(self):
        """Initialize and start Paho MQTT network loop in background thread."""
        try:
            self.client = mqtt.Client(
                callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
                client_id=self.client_id,
            )
        except Exception:
            self.client = mqtt.Client(client_id=self.client_id)

        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message

        try:
            self.client.connect_async(self.broker_host, self.broker_port, keepalive=settings.MQTT_KEEP_ALIVE)
            self.client.loop_start()
            logger.info(f"MQTT Client loop started for {self.broker_host}:{self.broker_port}")
        except Exception as e:
            logger.error(f"Failed to connect to MQTT broker {self.broker_host}:{self.broker_port}: {e}")

    def stop(self):
        """Stop MQTT client and disconnect cleanly."""
        if self.client:
            try:
                self.client.loop_stop()
                self.client.disconnect()
            except Exception as e:
                logger.warning(f"MQTT disconnect warning: {e}")
            self.is_connected = False
            self.client = None
            logger.info("MQTT Client stopped.")

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            self.is_connected = True
            logger.info(f"Connected to MQTT broker at {self.broker_host}:{self.broker_port}")
            # Re-subscribe to registered topics
            for topic in self.subscriptions.keys():
                self.client.subscribe(topic, qos=self.qos)
        else:
            self.is_connected = False
            logger.error(f"MQTT connection failed with code {rc}")

    def _on_disconnect(self, client, userdata, *args, **kwargs):
        self.is_connected = False
        logger.warning(f"Disconnected from MQTT broker (args={args})")

    def _on_message(self, client, userdata, msg):
        topic = msg.topic
        try:
            payload_str = msg.payload.decode("utf-8")
            payload = json.loads(payload_str)
        except Exception:
            payload = {"raw": msg.payload.decode("utf-8", errors="ignore")}

        # Store in message history for dashboard monitor
        self.message_history.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "topic": topic,
            "payload": payload,
            "qos": msg.qos,
        })
        if len(self.message_history) > self.max_history:
            self.message_history.pop(0)

        # Notify exact and wildcard subscribers
        for sub_topic, callbacks in self.subscriptions.items():
            if self._matches(topic, sub_topic):
                for cb in callbacks:
                    try:
                        cb(topic, payload)
                    except Exception as e:
                        logger.error(f"Error in MQTT callback for {topic}: {e}")

    def _matches(self, topic: str, filter_topic: str) -> bool:
        if filter_topic == "#" or filter_topic == topic:
            return True
        t_parts = topic.split("/")
        f_parts = filter_topic.split("/")
        i = 0
        while i < len(f_parts):
            if f_parts[i] == "#":
                return True
            if i >= len(t_parts):
                return False
            if f_parts[i] != "+" and f_parts[i] != t_parts[i]:
                return False
            i += 1
        return i == len(t_parts)

    def subscribe(self, topic: str, callback: Callable[[str, Dict[str, Any]], None]):
        """Subscribe to an MQTT topic with a message callback."""
        if topic not in self.subscriptions:
            self.subscriptions[topic] = []
            if self.is_connected and self.client:
                self.client.subscribe(topic, qos=self.qos)
        self.subscriptions[topic].append(callback)

    def publish(self, topic: str, payload: Dict[str, Any], qos: Optional[int] = None) -> bool:
        """Publish JSON payload to MQTT topic."""
        if not self.client:
            return False
        effective_qos = qos if qos is not None else self.qos
        try:
            payload_bytes = json.dumps(payload).encode("utf-8")
            result = self.client.publish(topic, payload_bytes, qos=effective_qos)
            return result.rc == mqtt.MQTT_ERR_SUCCESS
        except Exception as e:
            logger.error(f"Failed to publish to {topic}: {e}")
            return False


mqtt_manager = MQTTManager()
