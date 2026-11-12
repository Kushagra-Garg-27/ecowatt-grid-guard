"""
Lightweight Embedded Asyncio MQTT 3.1.1 Broker
Provides out-of-the-box local MQTT brokering on port 1883 without requiring
external Mosquitto installation, while seamlessly interoperating with standard
Paho-MQTT clients and Node-RED.
"""
import asyncio
import logging
import struct
from typing import Dict, Set, Tuple, Optional

logger = logging.getLogger("ecowatt.communication.embedded_broker")


class MQTTClientSession:
    def __init__(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        self.reader = reader
        self.writer = writer
        self.client_id = ""
        self.subscriptions: Set[str] = set()

    def matches(self, topic: str, filter_topic: str) -> bool:
        """Check if topic matches MQTT wildcard filter (+ and #)."""
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


class EmbeddedMQTTBroker:
    """Asyncio-based lightweight MQTT 3.1.1 broker."""

    def __init__(self, host: str = "127.0.0.1", port: int = 1883):
        self.host = host
        self.port = port
        self.server: Optional[asyncio.Server] = None
        self.sessions: Set[MQTTClientSession] = set()
        self.is_running = False

    async def start(self) -> bool:
        if self.is_running:
            return True
        try:
            self.server = await asyncio.start_server(self._handle_client, self.host, self.port)
            self.is_running = True
            logger.info(f"Embedded MQTT Broker listening on {self.host}:{self.port}")
            return True
        except OSError as e:
            logger.info(f"Port {self.port} already in use (possibly external Mosquitto). Broker will connect to existing broker: {e}")
            self.is_running = False
            return False

    async def stop(self):
        self.is_running = False
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            self.server = None
        for session in list(self.sessions):
            try:
                session.writer.close()
            except Exception:
                pass
        self.sessions.clear()
        logger.info("Embedded MQTT Broker stopped.")

    async def _handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        session = MQTTClientSession(reader, writer)
        self.sessions.add(session)
        try:
            while self.is_running:
                header = await reader.read(1)
                if not header:
                    break
                packet_type = header[0] >> 4
                flags = header[0] & 0x0F

                # Read remaining length (variable length encoding)
                multiplier = 1
                length = 0
                while True:
                    byte_data = await reader.read(1)
                    if not byte_data:
                        return
                    digit = byte_data[0]
                    length += (digit & 127) * multiplier
                    multiplier *= 128
                    if (digit & 128) == 0:
                        break

                payload = await reader.readexactly(length) if length > 0 else b""

                if packet_type == 1:  # CONNECT
                    # Parse client_id if present
                    if len(payload) >= 12:
                        proto_len = struct.unpack("!H", payload[:2])[0]
                        offset = 2 + proto_len + 1 + 1 + 2
                        if offset + 2 <= len(payload):
                            cid_len = struct.unpack("!H", payload[offset:offset + 2])[0]
                            session.client_id = payload[offset + 2:offset + 2 + cid_len].decode("utf-8", errors="ignore")
                    # Send CONNACK (0x20, length 2, flags 0, return code 0)
                    writer.write(bytes([0x20, 0x02, 0x00, 0x00]))
                    await writer.drain()

                elif packet_type == 3:  # PUBLISH
                    qos = (flags >> 1) & 0x03
                    if len(payload) >= 2:
                        topic_len = struct.unpack("!H", payload[:2])[0]
                        topic = payload[2:2 + topic_len].decode("utf-8", errors="ignore")
                        msg_offset = 2 + topic_len
                        msg_id = None
                        if qos > 0:
                            msg_id = struct.unpack("!H", payload[msg_offset:msg_offset + 2])[0]
                            msg_offset += 2
                        msg_payload = payload[msg_offset:]

                        # If QoS 1, respond with PUBACK
                        if qos == 1 and msg_id is not None:
                            ack_pkt = bytes([0x40, 0x02]) + struct.pack("!H", msg_id)
                            writer.write(ack_pkt)
                            await writer.drain()

                        # Broadcast to all matching subscribers
                        await self._broadcast(topic, msg_payload)

                elif packet_type == 8:  # SUBSCRIBE
                    msg_id = struct.unpack("!H", payload[:2])[0]
                    idx = 2
                    sub_qoses = []
                    while idx < len(payload):
                        t_len = struct.unpack("!H", payload[idx:idx + 2])[0]
                        t_str = payload[idx + 2:idx + 2 + t_len].decode("utf-8", errors="ignore")
                        idx += 2 + t_len
                        req_qos = payload[idx]
                        idx += 1
                        session.subscriptions.add(t_str)
                        sub_qoses.append(req_qos)

                    # Send SUBACK (0x90)
                    suback_len = 2 + len(sub_qoses)
                    suback = bytes([0x90, suback_len]) + struct.pack("!H", msg_id) + bytes(sub_qoses)
                    writer.write(suback)
                    await writer.drain()

                elif packet_type == 12:  # PINGREQ
                    writer.write(bytes([0xD0, 0x00]))  # PINGRESP
                    await writer.drain()

                elif packet_type == 14:  # DISCONNECT
                    break

        except (asyncio.IncompleteReadError, ConnectionResetError):
            pass
        except Exception as e:
            logger.debug(f"MQTT client session exception: {e}")
        finally:
            self.sessions.discard(session)
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass

    async def _broadcast(self, topic: str, payload_bytes: bytes):
        """Dispatch published message to matching client sessions."""
        topic_encoded = topic.encode("utf-8")
        rem_len = 2 + len(topic_encoded) + len(payload_bytes)

        # Encode remaining length
        rem_bytes = bytearray()
        val = rem_len
        while True:
            encoded_byte = val % 128
            val //= 128
            if val > 0:
                encoded_byte |= 128
            rem_bytes.append(encoded_byte)
            if val == 0:
                break

        # Fixed header: PUBLISH, QoS 0, retain 0
        pkt = bytes([0x30]) + bytes(rem_bytes) + struct.pack("!H", len(topic_encoded)) + topic_encoded + payload_bytes

        for s in list(self.sessions):
            for sub_filter in s.subscriptions:
                if s.matches(topic, sub_filter):
                    try:
                        s.writer.write(pkt)
                        await s.writer.drain()
                    except Exception:
                        pass
                    break


embedded_mqtt_broker = EmbeddedMQTTBroker()

