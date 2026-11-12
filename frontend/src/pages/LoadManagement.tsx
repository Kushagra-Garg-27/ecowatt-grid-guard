import React, { useState } from 'react';
import {
  ShieldAlert,
  Power,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { LoadItem } from '../types';
import { sendLoadCommand } from '../services/api';

interface LoadManagementProps {
  loads: LoadItem[];
  onRefresh: () => void;
}

export const LoadManagement: React.FC<LoadManagementProps> = ({ loads, onRefresh }) => {
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [executingLoadId, setExecutingLoadId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const filteredLoads = loads.filter((l) => {
    if (filterCategory === 'ALL') return true;
    return l.category === filterCategory;
  });

  const handleCommand = async (load: LoadItem, action: string, targetLevel: number) => {
    if (load.category === 'CRITICAL' && targetLevel < 1.0) {
      setFeedbackMsg({
        text: `CRITICAL PROTECTION: ${load.name} cannot be curtailed under system safety rules.`,
        type: 'error',
      });
      return;
    }

    setExecutingLoadId(load.id);
    setFeedbackMsg(null);
    try {
      await sendLoadCommand(load.id, action, targetLevel);
      setFeedbackMsg({
        text: `Command sent for ${load.name}: ${action} (target ${(targetLevel * 100).toFixed(0)}%)`,
        type: 'success',
      });
      onRefresh();
    } catch (err: any) {
      setFeedbackMsg({
        text: err.message || 'Actuator execution error',
        type: 'error',
      });
    } finally {
      setExecutingLoadId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Electrical Load Inventory & Actuator Control</h2>
          <p className="text-xs text-slate-400">
            Control smart actuators via MQTT (QoS 1). Critical loads are hardware & software protected.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
          {['ALL', 'CRITICAL', 'FLEXIBLE', 'DEFERRABLE'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                filterCategory === cat
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMsg && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            feedbackMsg.type === 'error'
              ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-white font-bold ml-4">
            &times;
          </button>
        </div>
      )}

      {/* Loads Table / Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Load Name & ID</th>
                <th className="py-3 px-3">Zone</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Rated Power</th>
                <th className="py-3 px-3">Current Power</th>
                <th className="py-3 px-3">LPS Score</th>
                <th className="py-3 px-3">Actuator State</th>
                <th className="py-3 px-4 text-right">Manual Demonstration Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredLoads.map((load) => {
                const isCritical = load.category === 'CRITICAL';
                const isExecuting = executingLoadId === load.id;

                return (
                  <tr key={load.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{load.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{load.id}</div>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-300 capitalize">
                      {load.zone_id.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          isCritical
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : load.category === 'FLEXIBLE'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                        }`}
                      >
                        {load.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono">{load.rated_power_kw.toFixed(2)} kW</td>
                    <td className="py-3 px-3 font-mono font-bold text-white">
                      {load.current_power_kw.toFixed(2)} kW
                    </td>
                    <td className="py-3 px-3">
                      {isCritical ? (
                        <span className="text-[10px] text-slate-500 font-mono">0.000 (Protected)</span>
                      ) : (
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-semibold text-emerald-400">
                            {load.lps_score !== undefined ? load.lps_score.toFixed(3) : '-'}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            load.actuator_status === 'ONLINE'
                              ? 'bg-emerald-400'
                              : load.actuator_status === 'UNCERTAIN'
                              ? 'bg-amber-400'
                              : 'bg-rose-400'
                          }`}
                        />
                        <span className="text-[11px]">{load.actuator_status}</span>
                        {load.is_curtailed && (
                          <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.2 rounded">
                            Curtailed -{(load.curtailment_factor * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isCritical ? (
                        <span className="inline-flex items-center space-x-1 text-[11px] text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                          <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                          <span>Protected: Locked ON</span>
                        </span>
                      ) : (
                        <div className="inline-flex items-center space-x-1.5">
                          {/* Modulate to 50% */}
                          {load.control_type === 'CONTINUOUS' && (
                            <button
                              disabled={isExecuting}
                              onClick={() => handleCommand(load, 'MODULATE', 0.5)}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-[11px] font-medium transition"
                            >
                              50%
                            </button>
                          )}
                          {/* Switch OFF / Curtail */}
                          <button
                            disabled={isExecuting}
                            onClick={() => handleCommand(load, 'CURTAIL', 0.0)}
                            className="px-2 py-1 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 rounded border border-rose-800/50 text-[11px] font-medium transition"
                          >
                            Curtail
                          </button>
                          {/* Restore 100% */}
                          <button
                            disabled={isExecuting}
                            onClick={() => handleCommand(load, 'RESTORE', 1.0)}
                            className="px-2 py-1 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 rounded border border-emerald-800/50 text-[11px] font-medium transition"
                          >
                            100%
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
