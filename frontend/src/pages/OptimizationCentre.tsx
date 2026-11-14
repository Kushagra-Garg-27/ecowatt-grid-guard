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
      setConfigMsg('Threshold parameters committed.');
      setTimeout(() => setConfigMsg(null), 3000);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveWeights = async () => {
    try {
      await updateLPSWeights(weights);
      setConfigMsg('LPS multi-criteria weights updated.');
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

  const rankedFlexibleLoads = loads
    .filter((l) => l.category !== 'CRITICAL' && l.suitability_index > 0)
    .sort((a, b) => (b.lps_score || 0) - (a.lps_score || 0));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-2 border-b border-[#27272A] gap-2">
        <div>
          <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[#FAFAFA]">
            DEMAND OPTIMIZATION & CLOSED-LOOP CONTROL CENTRE
          </h2>
          <p className="text-[11px] font-mono text-[#71717A] mt-0.5">
            Stage-based Load Priority Score (LPS) heuristic mitigation engine with iterative feedback
          </p>
        </div>

        <button
          onClick={handleRunOpt}
          disabled={isOptimizing}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-mono text-[11px] font-semibold px-3 py-1.5 rounded flex items-center space-x-1.5 transition cursor-pointer border border-emerald-500/40"
        >
          <Play className={`h-3 w-3 fill-current ${isOptimizing ? 'animate-spin' : ''}`} />
          <span>{isOptimizing ? 'SOLVING DISPATCH...' : 'TRIGGER OPTIMIZATION'}</span>
        </button>
      </div>

      {configMsg && (
        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono">
          {configMsg}
        </div>
      )}

      {/* Primary Metrics Row (Bento Surface Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bento-surface p-3 space-y-1">
          <div className="text-[10px] font-mono uppercase text-[#71717A]">CURRENT TOTAL DEMAND</div>
          <div className="text-xl font-mono font-bold tabular-nums text-[#FAFAFA]">
            {currentPower.toFixed(2)} <span className="text-[10px] text-[#71717A] font-normal">kW</span>
          </div>
          <div className="text-[9px] font-mono text-[#71717A]">P_total from 5 zones</div>
        </div>

        <div className="bento-surface p-3 space-y-1">
          <div className="text-[10px] font-mono uppercase text-[#71717A]">CONTRACT THRESHOLD</div>
          <div className="text-xl font-mono font-bold tabular-nums text-rose-400">
            {threshold.toFixed(2)} <span className="text-[10px] text-[#71717A] font-normal">kW</span>
          </div>
          <div className="text-[9px] font-mono text-[#71717A]">Utility ceiling limit</div>
        </div>

        <div className="bento-surface p-3 space-y-1">
          <div className="text-[10px] font-mono uppercase text-[#71717A]">TARGET DEMAND</div>
          <div className="text-xl font-mono font-bold tabular-nums text-cyan-400">
            {target.toFixed(2)} <span className="text-[10px] text-[#71717A] font-normal">kW</span>
          </div>
          <div className="text-[9px] font-mono text-[#71717A]">P_threshold - P_margin</div>
        </div>

        <div className="bento-surface p-3 space-y-1">
          <div className="text-[10px] font-mono uppercase text-[#71717A]">REQUIRED MITIGATION</div>
          <div className="text-xl font-mono font-bold tabular-nums text-amber-400">
            {requiredReduction.toFixed(2)} <span className="text-[10px] text-[#71717A] font-normal">kW</span>
          </div>
          <div className="text-[9px] font-mono text-[#71717A]">max(0, P_total - P_target)</div>
        </div>
      </div>

      {/* LPS Equation Info Box */}
      <div className="bento-surface p-3 space-y-2">
        <div className="flex items-center space-x-2 text-xs font-mono font-semibold text-emerald-400">
          <Info className="h-3.5 w-3.5" />
          <span>LOAD PRIORITY SCORE (LPS) MULTI-CRITERIA FORMULATION</span>
        </div>
        <p className="text-[11px] font-mono text-[#A1A1AA] bg-[#121215] p-2 rounded border border-[#27272A] overflow-x-auto">
          LPS_k(t) = w_s &bull; S_k + w_o &bull; (1 - Occ_j(t) / Occ_max,j) + w_p &bull; (P_k(t) / P_max) + w_t &bull; (Tariff(t) / Tariff_max)
        </p>
        <p className="text-[10px] font-mono text-[#71717A]">
          Critical loads have S_k = 0 and are mathematically excluded from curtailment. Higher LPS indicates higher suitability for shedding without affecting occupant safety or critical operations.
        </p>
      </div>

      {/* Two Column Configuration: Thresholds & Weights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* Threshold Configuration */}
        <div className="bento-surface p-3.5 space-y-3 font-mono">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-semibold text-[#FAFAFA] uppercase">DEMAND THRESHOLD CONFIG</h3>
            <button
              onClick={handleSaveThreshold}
              className="text-[10px] font-mono bg-[#18181B] hover:bg-[#27272A] text-emerald-400 font-medium px-2.5 py-1 rounded border border-[#27272A] transition cursor-pointer"
            >
              SAVE PARAMETERS
            </button>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <div className="flex justify-between text-[#A1A1AA] text-[11px] mb-1">
                <span>P_THRESHOLD (kW):</span>
                <span className="font-bold tabular-nums text-[#FAFAFA]">{thresholdInput.toFixed(2)} kW</span>
              </div>
              <input
                type="range"
                min="4.0"
                max="10.0"
                step="0.1"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[#A1A1AA] text-[11px] mb-1">
                <span>P_MARGIN (BUFFER kW):</span>
                <span className="font-bold tabular-nums text-[#FAFAFA]">{marginInput.toFixed(2)} kW</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={marginInput}
                onChange={(e) => setMarginInput(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="p-2 bg-[#121215] rounded border border-[#27272A] text-[10px] flex justify-between tabular-nums">
              <span className="text-[#71717A]">RESULTING P_TARGET:</span>
              <span className="font-bold text-cyan-400">
                {Math.max(0, thresholdInput - marginInput).toFixed(2)} kW
              </span>
            </div>
          </div>
        </div>

        {/* Multi-Criteria Weights */}
        <div className="bento-surface p-3.5 space-y-3 font-mono">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-mono font-semibold text-[#FAFAFA] uppercase">LPS CRITERIA WEIGHTS</h3>
              <p className={`text-[10px] tabular-nums ${isWeightValid ? 'text-[#71717A]' : 'text-rose-400 font-semibold'}`}>
                SUM: {weightSum.toFixed(2)} (MUST EQUAL 1.00)
              </p>
            </div>
            <button
              onClick={handleSaveWeights}
              disabled={!isWeightValid}
              className="text-[10px] font-mono bg-[#18181B] hover:bg-[#27272A] disabled:opacity-40 text-emerald-400 font-medium px-2.5 py-1 rounded border border-[#27272A] transition cursor-pointer"
            >
              SAVE WEIGHTS
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <div className="flex justify-between text-[#A1A1AA] text-[10px] mb-0.5">
                <span>w_s (SUITABILITY):</span>
                <span className="font-bold tabular-nums text-[#FAFAFA]">{weights.w_s.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.w_s}
                onChange={(e) => setWeights({ ...weights, w_s: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[#A1A1AA] text-[10px] mb-0.5">
                <span>w_o (INVERSE OCCUPANCY):</span>
                <span className="font-bold tabular-nums text-[#FAFAFA]">{weights.w_o.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.w_o}
                onChange={(e) => setWeights({ ...weights, w_o: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[#A1A1AA] text-[10px] mb-0.5">
                <span>w_p (POWER DRAW):</span>
                <span className="font-bold tabular-nums text-[#FAFAFA]">{weights.w_p.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.w_p}
                onChange={(e) => setWeights({ ...weights, w_p: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[#A1A1AA] text-[10px] mb-0.5">
                <span>w_t (TARIFF RATE):</span>
                <span className="font-bold tabular-nums text-[#FAFAFA]">{weights.w_t.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.w_t}
                onChange={(e) => setWeights({ ...weights, w_t: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stage B Eligible Load Curtailment Queue (Descending LPS) */}
      <div className="bento-surface overflow-hidden space-y-2">
        <div className="p-3 pb-0 flex items-center justify-between font-mono">
          <div>
            <h3 className="text-xs font-semibold uppercase text-[#FAFAFA]">STAGE B: ELIGIBLE CURTAILMENT QUEUE (DESCENDING LPS)</h3>
            <p className="text-[10px] text-[#71717A]">
              Dynamic ranking for selective load shedding; critical infrastructure strictly excluded
            </p>
          </div>
          <span className="text-[11px] text-emerald-400 font-semibold">{rankedFlexibleLoads.length} ELIGIBLE</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#121215] text-[#71717A] uppercase text-[10px] border-b border-[#27272A]">
              <tr>
                <th className="py-2 px-3">RANK</th>
                <th className="py-2 px-3">LOAD ID & NAME</th>
                <th className="py-2 px-3">ZONE</th>
                <th className="py-2 px-3">SUITABILITY (S_K)</th>
                <th className="py-2 px-3">RATED POWER</th>
                <th className="py-2 px-3">ACTIVE POWER</th>
                <th className="py-2 px-3 text-right">LPS SCORE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272A]/60 text-[#A1A1AA] tabular-nums">
              {rankedFlexibleLoads.map((load, idx) => (
                <tr key={load.id} className="hover:bg-[#18181B] transition">
                  <td className="py-1.5 px-3 font-bold text-[#71717A]">#{idx + 1}</td>
                  <td className="py-1.5 px-3">
                    <span className="font-semibold text-[#FAFAFA]">{load.name}</span>
                    <span className="text-[10px] text-[#71717A] ml-2">({load.id})</span>
                  </td>
                  <td className="py-1.5 px-3 uppercase text-[10px]">{load.zone_id.replace('_', ' ')}</td>
                  <td className="py-1.5 px-3">{load.suitability_index.toFixed(2)}</td>
                  <td className="py-1.5 px-3 text-[#71717A]">{load.rated_power_kw.toFixed(2)} kW</td>
                  <td className="py-1.5 px-3 font-semibold text-[#FAFAFA]">{load.current_power_kw.toFixed(2)} kW</td>
                  <td className="py-1.5 px-3 text-right font-bold text-emerald-400">
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
        <div className="bento-surface p-3.5 space-y-3 font-mono">
          <div className="flex items-center justify-between border-b border-[#27272A] pb-2">
            <div>
              <h3 className="text-xs font-semibold text-[#FAFAFA] flex items-center space-x-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>LAST CLOSED-LOOP OPTIMIZATION RESULT</span>
              </h3>
              <p className="text-[10px] text-[#71717A]">EVENT ID: {lastOptResult.event_id}</p>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                lastOptResult.target_achieved
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}
            >
              {lastOptResult.status}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs tabular-nums">
            <div className="bg-[#121215] p-2 rounded border border-[#27272A]">
              <span className="text-[#71717A] text-[10px]">INITIAL DEMAND</span>
              <div className="font-bold text-[#FAFAFA] text-sm mt-0.5">
                {lastOptResult.initial_demand_kw.toFixed(2)} kW
              </div>
            </div>
            <div className="bg-[#121215] p-2 rounded border border-[#27272A]">
              <span className="text-[#71717A] text-[10px]">ACTUAL REDUCTION</span>
              <div className="font-bold text-emerald-400 text-sm mt-0.5">
                -{lastOptResult.actual_reduction_kw.toFixed(2)} kW
              </div>
            </div>
            <div className="bg-[#121215] p-2 rounded border border-[#27272A]">
              <span className="text-[#71717A] text-[10px]">RESIDUAL DEMAND</span>
              <div className="font-bold text-cyan-400 text-sm mt-0.5">
                {lastOptResult.residual_demand_kw.toFixed(2)} kW
              </div>
            </div>
            <div className="bg-[#121215] p-2 rounded border border-[#27272A]">
              <span className="text-[#71717A] text-[10px]">ITERATIONS</span>
              <div className="font-bold text-[#FAFAFA] text-sm mt-0.5">{lastOptResult.iterations_run}</div>
            </div>
          </div>

          {/* Action List */}
          {lastOptResult.actions_taken.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-[#27272A]">
              <div className="text-[10px] font-semibold text-[#71717A] uppercase">ACTUATOR COMMANDS & ACKNOWLEDGEMENTS:</div>
              <div className="space-y-1">
                {lastOptResult.actions_taken.map((act, i) => (
                  <div
                    key={i}
                    className="p-2 bg-[#121215] rounded border border-[#27272A] flex items-center justify-between text-[11px] tabular-nums"
                  >
                    <div>
                      <span className="font-semibold text-[#FAFAFA]">{act.load_name}</span>
                      <span className="text-[10px] text-[#71717A] ml-2">({act.load_id})</span>
                      <div className="text-[10px] text-[#71717A]">
                        ACTION: <span className="text-amber-400">{act.action}</span> &bull; LPS: {act.lps.toFixed(3)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-400">
                        -{act.actual_reduction_kw.toFixed(2)} kW
                      </div>
                      <div className="text-[10px] text-[#71717A]">
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
