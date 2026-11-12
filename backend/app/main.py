"""
EcoWatt Grid Guard - Main FastAPI Application
Coordinates IoT CoAP UDP Gateway, MQTT Broker/Client, Background Simulation Loop,
REST API, and WebSocket streaming.
"""
import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import settings
from backend.app.database.session import init_db
from backend.app.api.router import api_router
from backend.app.gateway.coap_server import coap_server_manager
from backend.app.communication.embedded_broker import embedded_mqtt_broker
from backend.app.communication.mqtt_client import mqtt_manager
from backend.app.sensors.coap_client import CoAPTelemetryClient
from backend.app.sensors.virtual_sensor import VirtualSensorManager
from backend.app.simulation.engine import simulation_engine
from backend.app.actuators.virtual_actuator import actuator_manager
from backend.app.actuators.restoration import restoration_engine
from backend.app.optimizer.engine import optimization_engine
from backend.app.gateway.aggregator import edge_aggregator
from backend.app.simulation.profiles import generate_time_of_use_tariff

# Configure Logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ecowatt.main")

# Active WebSocket Connections Pool
active_websockets: Set[WebSocket] = set()


async def broadcast_ws_data(data: dict):
    """Broadcast JSON packet to all connected dashboard WebSockets."""
    dead_sockets = set()
    try:
        json_str = json.dumps(data, default=str)
    except Exception as e:
        logger.error(f"Error serializing WS payload: {e}")
        return

    for ws in list(active_websockets):
        try:
            await ws.send_text(json_str)
        except Exception as e:
            logger.debug(f"WS send error, dropping client: {e}")
            dead_sockets.add(ws)
    active_websockets.difference_update(dead_sockets)


async def live_iot_simulation_loop():
    """
    Background worker simulating continuous IoT telemetry flow, CoAP transmission,
    MQTT broadcasting, and periodic demand reassessment.
    """
    coap_client = CoAPTelemetryClient(settings.COAP_HOST, settings.COAP_PORT)
    sensor_mgr = VirtualSensorManager(coap_client)

    logger.info("Live IoT simulation background loop initiated.")
    try:
        while True:
            await asyncio.sleep(2.0)  # Telemetry emit every 2 seconds

            step = simulation_engine.current_live_step % 96
            simulation_engine.current_live_step += 1

            # Zone occupancy lookup
            sim_res = simulation_engine.last_results.get(simulation_engine.current_live_scenario)
            curr_hour = (step * 15) / 60.0

            # Emit virtual sensor telemetry via CoAP over UDP
            for zid, node in sensor_mgr.sensors.items():
                zone_power = actuator_manager.get_zone_power(zid)
                # Approximate occupancy from zone
                occ = edge_aggregator.zone_states.get(zid, {}).get("occupancy", 5)
                await node.emit_telemetry(
                    current_power_kw=zone_power,
                    occupancy=occ,
                    lighting_level=1.0,
                    hvac_level=1.0,
                )

            # 1. Periodically check sensor health timeouts (mark DEGRADED/FAULTED if heartbeats cease)
            edge_aggregator.check_sensor_health_timeouts(timeout_seconds=15.0)

            # 2. Check for demand violations and trigger closed-loop control or progressive restoration
            total_power = actuator_manager.get_total_building_power()
            tariffs = generate_time_of_use_tariff(96)
            current_tariff = float(tariffs[step % 96])

            if total_power > optimization_engine.demand_threshold_kw:
                optimization_engine.run_optimization_cycle(
                    current_tariff=current_tariff,
                    scenario_id=simulation_engine.current_live_scenario,
                )
            elif total_power <= (optimization_engine.target_demand_kw - 0.20):
                # Progressive restoration if demand is safely below target by at least hysteresis margin
                restoration_engine.evaluate_and_restore(
                    current_demand_kw=total_power,
                    target_demand_kw=optimization_engine.target_demand_kw,
                    current_tariff=current_tariff,
                )

            # Publish live building demand to MQTT
            mqtt_manager.publish(
                "ecowatt/building/demand",
                {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "total_power_kw": total_power,
                    "threshold_kw": optimization_engine.demand_threshold_kw,
                    "target_kw": optimization_engine.target_demand_kw,
                    "status": "EXCEEDED" if total_power > optimization_engine.demand_threshold_kw else "NORMAL",
                },
            )

            # Broadcast live state to connected React Dashboards
            ws_payload = {
                "type": "LIVE_TELEMETRY",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "step": step,
                "hour_str": f"{int(curr_hour):02d}:{int((curr_hour%1)*60):02d}",
                "building_power_kw": total_power,
                "threshold_kw": optimization_engine.demand_threshold_kw,
                "target_kw": optimization_engine.target_demand_kw,
                "zones": edge_aggregator.zone_states,
                "loads": actuator_manager.get_all_loads_status(),
                "active_alarms": 1 if total_power > optimization_engine.demand_threshold_kw else 0,
            }
            await broadcast_ws_data(ws_payload)

    except asyncio.CancelledError:
        logger.info("Live IoT simulation background loop cancelled.")
    finally:
        await coap_client.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and graceful shutdown."""
    logger.info("Starting EcoWatt Grid Guard backend services...")

    # 1. Database Initialization
    await init_db()

    # 2. Run initial benchmark simulation
    simulation_engine.run_scenario("peak_demand_event")

    # 3. Start MQTT Broker (Embedded fallback if Mosquitto not running)
    if settings.MQTT_EMBEDDED_BROKER:
        await embedded_mqtt_broker.start()

    # 4. Start MQTT Client
    mqtt_manager.start()

    # 5. Start CoAP UDP Server
    try:
        await coap_server_manager.start()
    except Exception as e:
        logger.error(f"CoAP server failed to bind on UDP port {settings.COAP_PORT}: {e}")

    # 6. Start background IoT simulation loop
    sim_task = asyncio.create_task(live_iot_simulation_loop())

    yield

    # Shutdown sequence
    logger.info("Shutting down EcoWatt Grid Guard backend services...")
    sim_task.cancel()
    try:
        await sim_task
    except asyncio.CancelledError:
        pass

    await coap_server_manager.stop()
    mqtt_manager.stop()
    if settings.MQTT_EMBEDDED_BROKER:
        await embedded_mqtt_broker.stop()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="IoT-Based Dynamic Energy Optimization, Peak-Load Shifting and Carbon Reduction System",
    lifespan=lifespan,
)

# CORS Configuration for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount REST API
app.include_router(api_router, prefix="/api")


# WebSocket Endpoint for Live Frontend Streaming
@app.websocket("/ws/live")
async def websocket_live_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_websockets.add(websocket)
    logger.info("Dashboard WebSocket client connected.")
    try:
        while True:
            # Receive client ping or control messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        logger.info("Dashboard WebSocket client disconnected.")
    finally:
        active_websockets.discard(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)

