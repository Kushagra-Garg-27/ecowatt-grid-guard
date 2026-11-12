import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Play,
  RotateCcw,
  Zap,
  Target,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  History,
  TrendingDown,
  Info,
} from 'lucide-react';
import { BuildingStatus, LoadItem, OptimizationResponse, LPSWeights, ThresholdConfig } from '../types';
import {
  runOptimization,
  fetchThresholdConfig,
  updateThresholdConfig,
  fetchLPSWeights,
  updateLPSWeights,
} from '../services/api';

interface OptimizationCentreProps {
  status: BuildingStatus | null;
  loads: LoadItem[];
  onRefresh: () => void;
}

export const OptimizationCentre: React.FC<OptimizationCentreProps> = ({ status, loads, onRefresh }) => {
  const [lastOptResult, setLastOptResult] = useState<OptimizationResponse | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [thresholdInput, setThresholdInput] = useState<number>(7.0);
  const [marginInput, setMarginInput] = useState<number>(0.2);
  const [weights, setWeights] = useState<LPSWeights>({ w_s: 0.4, w_o: 0.2, w_p: 0.2, w_t: 0.2 });
  const [configMsg, setConfigMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchThresholdConfig().then((cfg) => {
      if (cfg) {
        setThresholdInput(cfg.demand_threshold_kw);
        setMarginInput(cfg.reserve_margin_kw);
      }
    });
    fetchLPSWeights().then((w) => {
      if (w) setWeights(w);
    });
  }, []);

  const handleRunOpt = async () => {
    setIsOptimizing(true);
    try {
      const res = await runOptimization();
      setLastOptResult(res);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Optimization error');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSaveThreshold = async () => {
    try {
      await updateThresholdConfig({
        demand_threshold_kw: thresholdInput,
        reserve_margin_kw: marginInput,
      });
      setConfigMsg('Threshold configuration saved successfully.');
      setTimeout(() => setConfigMsg(null), 3000);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveWeights = async () => {
    try {
      await updateLPSWeights(weights);
      setConfigMsg('LPS multi-criteria weights updated successfully.');
      setTimeout(() => setConfigMsg(null), 3000);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const weightSum = weights.w_s + weights.w_o + weights.w_p + weights.w_t;
  const isWeightValid = Math.abs(weightSum - 1.0) < 0.005;

  const currentPower = status?.current_power_kw || 0;
  const threshold = status?.demand_threshold_kw || 7.0;
  const target = status?.target_demand_kw || 6.8;
  const requiredReduction = Math.max(0, currentPower - target);

  // Ranked flexible loads by descending LPS
  const rankedFlexibleLoads = loads
    .filter((l) => l.category !== 'CRITICAL' && l.suitability_index > 0)
    .sort((a, b) => (b.lps_score || 0) - (a.lps_score || 0));

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Closed-Loop Optimization Centre</h2>
          <p className="text-xs text-slate-400">
            Iterative load selection via Load Priority Score (LPS), actuator feedback & remeasurement
          </p>
        </div>

        <button
          onClick={handleRunOpt}
          disabled={isOptimizing}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center space-x-2 shadow-sm transition"
        >
          <Play className="h-4 w-4" />
          <span>{isOptimizing ? 'Optimizing...' : 'Execute Closed-Loop Optimization'}</span>
        </button>
      </div>

      {configMsg && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs">
          {configMsg}
        </div>
      )}

      {/* Control Equation & Threshold Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">Stage A: Total Demand</div>
          <div className="text-2xl font-bold text-white mt-1">
            {currentPower.toFixed(2)} <span className="text-xs text-slate-400 font-normal">kW</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Status:{' '}
            <span className={currentPower > threshold ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'}>
              {currentPower > threshold ? 'Exceeds Threshold' : 'Normal Operational'}
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">P_threshold & P_margin</div>
          <div className="text-2xl font-bold text-white mt-1">
            {threshold.toFixed(2)} <span className="text-xs text-slate-400 font-normal">kW</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">Reserve Margin: {marginInput.toFixed(2)} kW</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">P_target Demand</div>
          <div className="text-2xl font-bold text-cyan-400 mt-1">
            {target.toFixed(2)} <span className="text-xs text-slate-400 font-normal">kW</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">P_threshold - P_margin</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">Required Reduction (P_req)</div>
          <div className="text-2xl font-bold text-rose-400 mt-1">
            {requiredReduction.toFixed(2)} <span className="text-xs text-slate-400 font-normal">kW</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">max(0, P_total - P_target)</div>
        </div>
      </div>

      {/* LPS Equation Info Box */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
        <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400">
          <Info className="h-4 w-4" />
          <span>Load Priority Score (LPS) Formulation & Ranking Principle</span>
        </div>
        <p className="text-xs text-slate-300 font-mono bg-slate-950 p-2.5 rounded-xl border border-slate-800">
          LPS_k(t) = w_s · S_k + w_o · (1 - Occ_j(t) / Occ_max,j) + w_p · (P_k(t) / P_max) + w_t · (Tariff(t) / Tariff_max)
        </p>
        <p className="text-[11px] text-slate-400">
          Critical loads have S_k = 0 and are strictly excluded. Higher LPS indicates higher suitability for demand curtailment without compromising mission-critical operations or occupant safety.
        </p>
      </div>

      {/* Two Column Configuration: Thresholds & Weights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Threshold Configuration */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Demand Threshold Parameters</h3>
            <button
              onClick={handleSaveThreshold}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition"
            >
              Save Thresholds
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>P_threshold (kW):</span>
                <span className="font-mono font-bold text-white">{thresholdInput.toFixed(2)} kW</span>
              </div>
              <input
                type="range"
                min="4.0"
                max="10.0"
                step="0.1"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(parseFloat(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>P_margin (Reserve Buffer, kW):</span>
                <span className="font-mono font-bold text-white">{marginInput.toFixed(2)} kW</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={marginInput}
                onChange={(e) => setMarginInput(parseFloat(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>

            <div className="p-2.5 bg-slate-950 rounded-xl text-[11px] text-slate-400 flex justify-between">
              <span>Resulting Target Demand (P_target):</span>
              <span className="font-mono font-bold text-cyan-400">
                {Math.max(0, thresholdInput - marginInput).toFixed(2)} kW
              </span>
            </div>
          </div>
        </div>

        {/* Multi-Criteria Weights */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">LPS Weight Configuration</h3>
              <p className={`text-[11px] ${isWeightValid ? 'text-slate-400' : 'text-rose-400 font-semibold'}`}>
                Sum: {weightSum.toFixed(2)} (Must equal 1.00)
              </p>
            </div>
            <button
              onClick={handleSaveWeights}
              disabled={!isWeightValid}
              className="text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-emerald-400 font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition"
            >
              Save Weights
            </button>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <div className="flex justify-between text-slate-300 mb-0.5">
                <span>w_s (Curtailment Suitability):</span>
                <span className="font-mono font-bold">{weights.w_s.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.w_s}
                onChange={(e) => setWeights({ ...weights, w_s: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-0.5">
                <span>w_o (Inverse Zone Occupancy):</span>
                <span className="font-mono font-bold">{weights.w_o.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.w_o}
                onChange={(e) => setWeights({ ...weights, w_o: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-0.5">
                <span>w_p (Power Magnitude):</span>
                <span className="font-mono font-bold">{weights.w_p.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.w_p}
                onChange={(e) => setWeights({ ...weights, w_p: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-0.5">
                <span>w_t (Tariff Sensitivity):</span>
                <span className="font-mono font-bold">{weights.w_t.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.w_t}
                onChange={(e) => setWeights({ ...weights, w_t: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stage B Eligible Load Curtailment Queue (Descending LPS) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Stage B: Eligible Curtailment Queue (Descending LPS)</h3>
            <p className="text-xs text-slate-400">
              Ranked in priority order for mitigation; critical loads strictly filtered out
            </p>
          </div>
          <span className="text-xs text-emerald-400 font-semibold">{rankedFlexibleLoads.length} Flexible Loads</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">Load Name & ID</th>
                <th className="py-2.5 px-3">Zone</th>
                <th className="py-2.5 px-3">Suitability (S_k)</th>
                <th className="py-2.5 px-3">Rated Power</th>
                <th className="py-2.5 px-3">Current Power</th>
                <th className="py-2.5 px-3 text-right">LPS Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {rankedFlexibleLoads.map((load, idx) => (
                <tr key={load.id} className="hover:bg-slate-800/30">
                  <td className="py-2 px-3 font-bold text-slate-400">#{idx + 1}</td>
                  <td className="py-2 px-3">
                    <span className="font-semibold text-white">{load.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono ml-2">({load.id})</span>
                  </td>
                  <td className="py-2 px-3 capitalize">{load.zone_id.replace('_', ' ')}</td>
                  <td className="py-2 px-3 font-mono">{load.suitability_index.toFixed(2)}</td>
                  <td className="py-2 px-3 font-mono">{load.rated_power_kw.toFixed(2)} kW</td>
                  <td className="py-2 px-3 font-mono font-semibold text-white">{load.current_power_kw.toFixed(2)} kW</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                    {load.lps_score ? load.lps_score.toFixed(3) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stage D Actuation Results / Execution History */}
      {lastOptResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Last Optimization Cycle Result</span>
              </h3>
              <p className="text-xs text-slate-400">Event ID: {lastOptResult.event_id}</p>
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                lastOptResult.target_achieved
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}
            >
              {lastOptResult.status}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[11px]">Initial Demand</span>
              <div className="font-mono font-bold text-white text-base">
                {lastOptResult.initial_demand_kw.toFixed(2)} kW
              </div>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[11px]">Actual Demand Reduction</span>
              <div className="font-mono font-bold text-emerald-400 text-base">
                -{lastOptResult.actual_reduction_kw.toFixed(2)} kW
              </div>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[11px]">Residual Demand</span>
              <div className="font-mono font-bold text-cyan-400 text-base">
                {lastOptResult.residual_demand_kw.toFixed(2)} kW
              </div>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[11px]">Iterations Run</span>
              <div className="font-mono font-bold text-white text-base">{lastOptResult.iterations_run}</div>
            </div>
          </div>

          {/* Action List */}
          {lastOptResult.actions_taken.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300">Actuator Dispatches & Acknowledgements:</div>
              <div className="space-y-1.5">
                {lastOptResult.actions_taken.map((act, i) => (
                  <div
                    key={i}
                    className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-white">{act.load_name}</span>
                      <span className="text-[10px] text-slate-400 ml-2 font-mono">({act.load_id})</span>
                      <div className="text-[11px] text-slate-400">
                        Action: <span className="text-amber-400">{act.action}</span> | LPS: {act.lps.toFixed(3)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald-400">
                        -{act.actual_reduction_kw.toFixed(2)} kW
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {act.prior_power_kw.toFixed(2)}kW &rarr; {act.new_power_kw.toFixed(2)}kW
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

