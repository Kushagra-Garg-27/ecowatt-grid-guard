export type LoadCategory = 'CRITICAL' | 'FLEXIBLE' | 'DEFERRABLE';
export type ActuatorStatus = 'ONLINE' | 'FAULTED' | 'UNCERTAIN';
export type SensorHealth = 'HEALTHY' | 'DEGRADED' | 'FAULTED';

export interface BuildingStatus {
  timestamp: string;
  current_power_kw: number;
  demand_threshold_kw: number;
  target_demand_kw: number;
  peak_demand_today_kw: number;
  current_energy_kwh: number;
  estimated_cost_today: number;
  estimated_carbon_kg_today: number;
  active_alarms_count: number;
  curtailed_loads_count: number;
  shifted_loads_count: number;
  critical_load_protected: boolean;
  active_scenario: string;
}

export interface ZoneSummary {
  zone_id: string;
  name: string;
  occupancy: number;
  max_occupancy: number;
  power_kw: number;
  voltage_v: number;
  current_a: number;
  temperature_c: number;
  lighting_state: number;
  hvac_state: number;
  sensor_health: SensorHealth;
  timestamp: string;
}

export interface LoadItem {
  id: string;
  name: string;
  zone_id: string;
  category: LoadCategory;
  rated_power_kw: number;
  current_power_kw: number;
  suitability_index: number;
  min_operating_level: number;
  max_operating_level: number;
  control_type: string;
  is_curtailed: boolean;
  curtailment_factor: number;
  is_active: boolean;
  actuator_status: ActuatorStatus;
  lps_score?: number;
}

export interface IntervalMetric {
  step_index: number;
  time_str: string;
  baseline_power_kw: number;
  optimized_power_kw: number;
  baseline_energy_kwh: number;
  optimized_energy_kwh: number;
  energy_saved_kwh: number;
  tariff_rate: number;
  baseline_cost: number;
  optimized_cost: number;
  cost_saved: number;
  carbon_intensity_g_per_kwh: number;
  baseline_carbon_g: number;
  optimized_carbon_g: number;
  carbon_avoided_g: number;
  shifted_energy_kwh: number;
  curtailed_loads_count: number;
  threshold_exceeded_baseline: boolean;
  threshold_exceeded_optimized: boolean;
}

export interface DailyAnalyticsSummary {
  scenario_id: string;
  scenario_name: string;
  total_baseline_energy_kwh: number;
  total_optimized_energy_kwh: number;
  net_energy_saved_kwh: number;
  energy_saved_pct: number;
  baseline_peak_power_kw: number;
  optimized_peak_power_kw: number;
  peak_reduction_kw: number;
  peak_reduction_pct: number;
  baseline_total_cost: number;
  optimized_total_cost: number;
  net_cost_saved: number;
  cost_saved_pct: number;
  baseline_total_carbon_kg: number;
  optimized_total_carbon_kg: number;
  carbon_avoided_kg: number;
  carbon_reduction_pct: number;
  total_shifted_energy_kwh: number;
  threshold_exceedance_minutes_baseline: number;
  threshold_exceedance_minutes_optimized: number;
  total_control_operations: number;
  total_actuator_failures: number;
  critical_load_interruptions: number;
  intervals: IntervalMetric[];
}

export interface OptimizationActionDetail {
  load_id: string;
  load_name: string;
  zone_id: string;
  category: string;
  lps: number;
  action: string;
  prior_power_kw: number;
  new_power_kw: number;
  expected_reduction_kw: number;
  actual_reduction_kw: number;
  actuator_status: string;
}

export interface OptimizationResponse {
  event_id: string;
  timestamp: string;
  scenario_id?: string;
  initial_demand_kw: number;
  threshold_kw: number;
  target_kw: number;
  required_reduction_kw: number;
  actual_reduction_kw: number;
  residual_demand_kw: number;
  target_achieved: boolean;
  actions_taken: OptimizationActionDetail[];
  iterations_run: number;
  status: string;
}

export interface LPSWeights {
  w_s: number;
  w_o: number;
  w_p: number;
  w_t: number;
}

export interface ThresholdConfig {
  demand_threshold_kw: number;
  reserve_margin_kw: number;
  target_demand_kw?: number;
}

