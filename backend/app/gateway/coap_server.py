"""
EcoWatt CoAP Server over UDP (aiocoap implementation)
Exposes endpoints:
  /telemetry/power
  /telemetry/occupancy
  /telemetry/environment
  /telemetry/status
"""
import json
import logging
import asyncio
from datetime import datetime, timezone
import aiocoap
import aiocoap.resource as resource
from backend.app.core.config import settings
from backend.app.gateway.aggregator import edge_aggregator

logger = logging.getLogger("ecowatt.gateway.coap_server")


class PowerTelemetryResource(resource.Resource):
    """Handles POST /telemetry/power"""

    async def render_post(self, request):
        try:
            payload = json.loads(request.payload.decode("utf-8"))
            success = edge_aggregator.process_power_telemetry(payload)
            if success:
                res = json.dumps({"status": "SUCCESS", "code": 204, "msg": "Power telemetry ingested"}).encode("utf-8")
                return aiocoap.Message(code=aiocoap.CHANGED, payload=res)
            else:
                res = json.dumps({"status": "ERROR", "code": 400, "msg": "Validation failed"}).encode("utf-8")
                return aiocoap.Message(code=aiocoap.BAD_REQUEST, payload=res)
        except Exception as e:
            logger.error(f"Error handling /telemetry/power: {e}")
            res = json.dumps({"status": "ERROR", "code": 500, "msg": str(e)}).encode("utf-8")
            return aiocoap.Message(code=aiocoap.INTERNAL_SERVER_ERROR, payload=res)


class OccupancyTelemetryResource(resource.Resource):
    """Handles POST /telemetry/occupancy"""

    async def render_post(self, request):
        try:
            payload = json.loads(request.payload.decode("utf-8"))
            success = edge_aggregator.process_occupancy_telemetry(payload)
            if success:
                res = json.dumps({"status": "SUCCESS", "code": 204, "msg": "Occupancy telemetry ingested"}).encode("utf-8")
                return aiocoap.Message(code=aiocoap.CHANGED, payload=res)
            else:
                res = json.dumps({"status": "ERROR", "code": 400, "msg": "Validation failed"}).encode("utf-8")
                return aiocoap.Message(code=aiocoap.BAD_REQUEST, payload=res)
        except Exception as e:
            logger.error(f"Error handling /telemetry/occupancy: {e}")
            res = json.dumps({"status": "ERROR", "code": 500, "msg": str(e)}).encode("utf-8")
            return aiocoap.Message(code=aiocoap.INTERNAL_SERVER_ERROR, payload=res)


class EnvironmentTelemetryResource(resource.Resource):
    """Handles POST /telemetry/environment"""

    async def render_post(self, request):
        try:
            payload = json.loads(request.payload.decode("utf-8"))
            success = edge_aggregator.process_environment_telemetry(payload)
            if success:
                res = json.dumps({"status": "SUCCESS", "code": 204, "msg": "Environment telemetry ingested"}).encode("utf-8")
                return aiocoap.Message(code=aiocoap.CHANGED, payload=res)
            else:
                res = json.dumps({"status": "ERROR", "code": 400, "msg": "Validation failed"}).encode("utf-8")
                return aiocoap.Message(code=aiocoap.BAD_REQUEST, payload=res)
        except Exception as e:
            logger.error(f"Error handling /telemetry/environment: {e}")
            res = json.dumps({"status": "ERROR", "code": 500, "msg": str(e)}).encode("utf-8")
            return aiocoap.Message(code=aiocoap.INTERNAL_SERVER_ERROR, payload=res)


class StatusTelemetryResource(resource.Resource):
    """Handles POST /telemetry/status"""

    async def render_post(self, request):
        try:
            payload = json.loads(request.payload.decode("utf-8"))
            success = edge_aggregator.process_status_telemetry(payload)
            if success:
                res = json.dumps({"status": "SUCCESS", "code": 204, "msg": "Node status updated"}).encode("utf-8")
                return aiocoap.Message(code=aiocoap.CHANGED, payload=res)
            else:
                res = json.dumps({"status": "ERROR", "code": 400, "msg": "Validation failed"}).encode("utf-8")
                return aiocoap.Message(code=aiocoap.BAD_REQUEST, payload=res)
        except Exception as e:
            logger.error(f"Error handling /telemetry/status: {e}")
            res = json.dumps({"status": "ERROR", "code": 500, "msg": str(e)}).encode("utf-8")
            return aiocoap.Message(code=aiocoap.INTERNAL_SERVER_ERROR, payload=res)


class CoAPServerManager:
    """Manages the lifecycle of the aiocoap UDP server."""

    def __init__(self, host: str = settings.COAP_HOST, port: int = settings.COAP_PORT):
        self.host = host
        self.port = port
        self.server_context: aiocoap.Context = None
        self.is_running = False

    async def start(self):
        if self.is_running:
            return

        root = resource.Site()
        root.add_resource(["telemetry", "power"], PowerTelemetryResource())
        root.add_resource(["telemetry", "occupancy"], OccupancyTelemetryResource())
        root.add_resource(["telemetry", "environment"], EnvironmentTelemetryResource())
        root.add_resource(["telemetry", "status"], StatusTelemetryResource())

        try:
            self.server_context = await aiocoap.Context.create_server_context(
                root,
                bind=(self.host, self.port),
            )
            self.is_running = True
            logger.info(f"CoAP UDP Server listening on {self.host}:{self.port}")
        except Exception as e:
            logger.error(f"Failed to start CoAP Server on {self.host}:{self.port}: {e}")
            raise

    async def stop(self):
        if self.server_context and self.is_running:
            try:
                await self.server_context.shutdown()
            except Exception as e:
                logger.warning(f"CoAP server shutdown warning: {e}")
            self.is_running = False
            logger.info("CoAP Server stopped.")


coap_server_manager = CoAPServerManager()
