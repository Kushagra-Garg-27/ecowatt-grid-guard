"""
EcoWatt Grid Guard - Core Configuration
"""
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator

# Base Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
PROJECT_ROOT = BASE_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"
SCENARIOS_DIR = DATA_DIR / "scenarios"
GENERATED_DIR = DATA_DIR / "generated"

for p in (DATA_DIR, SCENARIOS_DIR, GENERATED_DIR):
    p.mkdir(parents=True, exist_ok=True)


class Settings(BaseSettings):
    """System-wide configuration settings with validation."""
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # General
    PROJECT_NAME: str = "EcoWatt Grid Guard"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Server
    HOST: str = "127.0.0.1"
    PORT: int = 8000

    # Database
    DATABASE_URL: str = f"sqlite+aiosqlite:///{DATA_DIR.as_posix()}/ecowatt.db"

    # CoAP Communication
    COAP_HOST: str = "127.0.0.1"
    COAP_PORT: int = 5683
    COAP_TIMEOUT_SECONDS: float = 3.0

    # MQTT Communication
    MQTT_BROKER_HOST: str = "127.0.0.1"
    MQTT_BROKER_PORT: int = 1883
    MQTT_KEEP_ALIVE: int = 60
    MQTT_QOS: int = 1
    MQTT_CLIENT_ID: str = "ecowatt_core_gateway"
    MQTT_EMBEDDED_BROKER: bool = True  # Auto-start embedded asyncio MQTT broker if external broker unreachable

    # Optimization Engine Parameters
    DEFAULT_DEMAND_THRESHOLD_KW: float = 7.00
    DEFAULT_RESERVE_MARGIN_KW: float = 0.20
    MAX_REFERENCE_POWER_KW: float = 10.00
    MAX_REFERENCE_TARIFF: float = 0.50  # $/kWh reference maximum

    # Load Priority Score Weights (must sum to 1.0)
    WEIGHT_SUITABILITY: float = 0.40
    WEIGHT_OCCUPANCY: float = 0.20
    WEIGHT_POWER: float = 0.20
    WEIGHT_TARIFF: float = 0.20

    # Load Shifting Scheduler Objective Weight
    # beta * norm_tariff + (1 - beta) * norm_carbon
    DEFAULT_BETA_COST_WEIGHT: float = 0.60

    # Simulation Settings
    DEFAULT_INTERVAL_MINUTES: int = 15
    SIMULATION_RANDOM_SEED: int = 42

    # Hysteresis for restoration (kW buffer below target before restoring loads)
    RESTORATION_HYSTERESIS_KW: float = 0.50

    @property
    def TARGET_DEMAND_KW(self) -> float:
        """P_target = P_threshold - P_margin"""
        return max(0.0, self.DEFAULT_DEMAND_THRESHOLD_KW - self.DEFAULT_RESERVE_MARGIN_KW)

    def validate_weights(self) -> bool:
        total = (
            self.WEIGHT_SUITABILITY
            + self.WEIGHT_OCCUPANCY
            + self.WEIGHT_POWER
            + self.WEIGHT_TARIFF
        )
        return abs(total - 1.0) < 1e-4


settings = Settings()
