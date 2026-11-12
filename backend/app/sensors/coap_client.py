"""
EcoWatt CoAP Client (aiocoap implementation)
Sends sensor telemetry packets to the Edge Gateway CoAP UDP Server.
"""
import json
import logging
import asyncio
from typing import Dict, Any, Optional
import aiocoap
from backend.app.core.config import settings

logger = logging.getLogger("ecowatt.sensors.coap_client")


class CoAPTelemetryClient:
    """CoAP client for transmitting sensor readings over UDP."""

    def __init__(self, gateway_host: str = settings.COAP_HOST, gateway_port: int = settings.COAP_PORT):
        self.gateway_host = gateway_host
        self.gateway_port = gateway_port
        self.client_context: Optional[aiocoap.Context] = None

    async def _get_context(self) -> aiocoap.Context:
        if self.client_context is None:
            self.client_context = await aiocoap.Context.create_client_context()
        return self.client_context

    async def send_telemetry(self, endpoint_path: str, data: Dict[str, Any], timeout: float = 3.0) -> bool:
        """
        Transmit a telemetry JSON payload via CoAP POST over UDP.
        e.g., endpoint_path = "telemetry/power"
        """
        uri = f"coap://{self.gateway_host}:{self.gateway_port}/{endpoint_path.lstrip('/')}"
        payload_bytes = json.dumps(data).encode("utf-8")

        request = aiocoap.Message(
            code=aiocoap.POST,
            uri=uri,
            payload=payload_bytes,
        )

        try:
            ctx = await self._get_context()
            response = await asyncio.wait_for(ctx.request(request).response, timeout=timeout)
            if response.code in (aiocoap.CHANGED, aiocoap.CREATED, aiocoap.CONTENT):
                return True
            else:
                logger.warning(f"CoAP server responded with non-success code: {response.code}")
                return False
        except asyncio.TimeoutError:
            logger.error(f"CoAP transmission timed out for {uri}")
            return False
        except Exception as e:
            logger.error(f"CoAP transmission failure for {uri}: {e}")
            return False

    async def close(self):
        if self.client_context:
            try:
                await self.client_context.shutdown()
            except Exception as e:
                logger.debug(f"Error shutting down CoAP client context: {e}")
            self.client_context = None

