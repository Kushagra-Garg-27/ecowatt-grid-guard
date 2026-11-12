import {
  BuildingStatus,
  ZoneSummary,
  LoadItem,
  DailyAnalyticsSummary,
  OptimizationResponse,
  ThresholdConfig,
  LPSWeights,
} from '../types';

const API_BASE = '/api';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function fetchBuildingStatus(): Promise<BuildingStatus> {
  const res = await fetch(`${API_BASE}/building/status`);
  if (!res.ok) throw new Error('Failed to fetch building status');
  return res.json();
}

export async function fetchBuildingZones(): Promise<ZoneSummary[]> {
  const res = await fetch(`${API_BASE}/building/zones`);
  if (!res.ok) throw new Error('Failed to fetch zones');
  return res.json();
}

export async function fetchLoads(): Promise<LoadItem[]> {
  const res = await fetch(`${API_BASE}/loads`);
  if (!res.ok) throw new Error('Failed to fetch loads');
  return res.json();
}

export async function sendLoadCommand(loadId: string, action: string, targetLevel: number) {
  const res = await fetch(`${API_BASE}/loads/${loadId}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ load_id: loadId, action, target_level: targetLevel }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Command failed');
  }
  return res.json();
}

export async function runOptimization(): Promise<OptimizationResponse> {
  const res = await fetch(`${API_BASE}/optimization/run`, { method: 'POST' });
  if (!res.ok) throw new Error('Optimization failed');
  return res.json();
}

export async function fetchThresholdConfig(): Promise<ThresholdConfig> {
  const res = await fetch(`${API_BASE}/config/threshold`);
  return res.json();
}

export async function updateThresholdConfig(config: ThresholdConfig): Promise<ThresholdConfig> {
  const res = await fetch(`${API_BASE}/config/threshold`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function fetchLPSWeights(): Promise<LPSWeights> {
  const res = await fetch(`${API_BASE}/config/weights`);
  return res.json();
}

export async function updateLPSWeights(weights: LPSWeights): Promise<any> {
  const res = await fetch(`${API_BASE}/config/weights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(weights),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Weights update failed');
  }
  return res.json();
}

export async function fetchScenarios(): Promise<Record<string, any>> {
  const res = await fetch(`${API_BASE}/simulation/scenarios`);
  return res.json();
}

export async function fetchScenarioResults(scenarioId: string): Promise<DailyAnalyticsSummary> {
  const res = await fetch(`${API_BASE}/simulation/results/${scenarioId}`);
  if (!res.ok) throw new Error('Failed to fetch scenario results');
  return res.json();
}

export async function startSimulation(scenarioId: string) {
  const res = await fetch(`${API_BASE}/simulation/start?scenario_id=${encodeURIComponent(scenarioId)}`, {
    method: 'POST',
  });
  return res.json();
}

export async function stopSimulation() {
  const res = await fetch(`${API_BASE}/simulation/stop`, { method: 'POST' });
  return res.json();
}

export async function resetSimulation() {
  const res = await fetch(`${API_BASE}/simulation/reset`, { method: 'POST' });
  return res.json();
}

export async function fetchIoTMonitor(): Promise<any> {
  const res = await fetch(`${API_BASE}/iot/monitor`);
  return res.json();
}
