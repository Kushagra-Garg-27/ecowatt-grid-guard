"""
Pydantic Schemas for Control, Actuators, and Optimization Config
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, model_validator


class LoadSchema(BaseModel):
    id: str
    name: str
    zone_id: str
    category: str  # CRITICAL, FLEXIBLE, DEFERRABLE
    rated_power_kw: float
    current_power_kw: float
    suitability_index: float
    min_operating_level: float
    max_operating_level: float
    control_type: str
    is_curtailed: bool
    curtailment_factor: float
    is_active: bool
    actuator_status: str
    lps_score: Optional[float] = None


class ActuatorCommand(BaseModel):
    command_id: str
    load_id: str
    action: str  # CURTAIL, MODULATE, RESTORE, SCHEDULE
    requested_level: float = Field(ge=0.0, le=1.0)
    expected_power_kw: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ActuatorAcknowledgement(BaseModel):
    command_id: str
    load_id: str
    status: str  # SUCCESS, FAILED, TIMEOUT
    actual_power_kw: float
    latency_ms: float = 0.0
    error_details: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ThresholdConfigRequest(BaseModel):
    demand_threshold_kw: float = Field(gt=0.0, description="P_threshold in kW")
    reserve_margin_kw: float = Field(ge=0.0, description="P_margin in kW")

    @property
    def target_demand_kw(self) -> float:
        return max(0.0, self.demand_threshold_kw - self.reserve_margin_kw)


class LPSWeightsRequest(BaseModel):
    w_s: float = Field(ge=0.0, le=1.0, description="Suitability weight")
    w_o: float = Field(ge=0.0, le=1.0, description="Occupancy inverse weight")
    w_p: float = Field(ge=0.0, le=1.0, description="Power magnitude weight")
    w_t: float = Field(ge=0.0, le=1.0, description="Tariff weight")

    @model_validator(mode="after")
    def check_weights_sum(self):
        total = self.w_s + self.w_o + self.w_p + self.w_t
        if abs(total - 1.0) > 1e-3:
            raise ValueError(f"Weights must sum to 1.0, current sum is {total:.4f}")
        return self


class ManualCommandRequest(BaseModel):
    load_id: str
    action: str
    target_level: float = Field(ge=0.0, le=1.0)


class OptimizationActionDetail(BaseModel):
    load_id: str
    load_name: str
    zone_id: str
    category: str
    lps: float
    action: str
    prior_power_kw: float
    new_power_kw: float
    expected_reduction_kw: float
    actual_reduction_kw: float
    actuator_status: str


class OptimizationResponse(BaseModel):
    event_id: str
    timestamp: datetime
    initial_demand_kw: float
    threshold_kw: float
    target_kw: float
    required_reduction_kw: float
    actual_reduction_kw: float
    residual_demand_kw: float
    target_achieved: bool
    actions_taken: List[OptimizationActionDetail]
    iterations_run: int
