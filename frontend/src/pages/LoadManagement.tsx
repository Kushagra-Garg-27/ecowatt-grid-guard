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
import { SciFiCard } from '@/components/ui/moving-dot-card';

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
        text: `CRITICAL LOAD PROTECTION: ${load.name} cannot be curtailed under system safety invariants.`,
        type: 'error',
      });
      return;
    }

    setExecutingLoadId(load.id);
    setFeedbackMsg(null);
    try {
      await sendLoadCommand(load.id, action, targetLevel);
      setFeedbackMsg({
        text: `MQTT command dispatched for ${load.name}: ${action} (target ${(targetLevel * 100).toFixed(0)}%)`,
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-2 border-b border-[#27272A] gap-2">
        <div>
          <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[#FAFAFA]">
            ELECTRICAL LOAD INVENTORY & ACTUATOR DISPATCH
          </h2>
          <p className="text-[11px] font-mono text-[#71717A] mt-0.5">
            Real-time MQTT QoS 1 actuator feedback &bull; Critical loads hardware/software locked
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1 bg-[#09090B] border border-[#27272A] p-0.5 rounded text-[11px] font-mono">
          {['ALL', 'CRITICAL', 'FLEXIBLE', 'DEFERRABLE'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-2.5 py-1 rounded transition cursor-pointer ${
                filterCategory === cat
                  ? 'bg-[#18181B] text-[#FAFAFA] border border-[#27272A] shadow-xs'
                  : 'text-[#71717A] hover:text-[#A1A1AA] border border-transparent'
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
          className={`p-2.5 rounded border text-xs font-mono flex items-center justify-between ${
            feedbackMsg.type === 'error'
              ? 'bg-[#160B0E] border-rose-500/40 text-rose-300'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-[#71717A] hover:text-[#FAFAFA] font-bold ml-4 cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* Loads Table / Grid */}
      <SciFiCard accent="cyan" dotDuration="14s" innerClassName="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#121215] text-[#71717A] uppercase tracking-wider text-[10px] border-b border-[#27272A]">
              <tr>
                <th className="py-2.5 px-3">LOAD ID & NAME</th>
                <th className="py-2.5 px-3">ZONE</th>
                <th className="py-2.5 px-3">CATEGORY</th>
                <th className="py-2.5 px-3">RATED POWER</th>
                <th className="py-2.5 px-3">ACTIVE POWER</th>
                <th className="py-2.5 px-3">LPS SCORE</th>
                <th className="py-2.5 px-3">ACTUATOR</th>
                <th className="py-2.5 px-3 text-right">MANUAL DISPATCH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272A]/60 text-[#A1A1AA] tabular-nums">
              {filteredLoads.map((load) => {
                const isCritical = load.category === 'CRITICAL';
                const isExecuting = executingLoadId === load.id;

                return (
                  <tr key={load.id} className="hover:bg-[#18181B] transition">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-[#FAFAFA]">{load.name}</div>
                      <div className="text-[10px] text-[#71717A]">{load.id}</div>
                    </td>
                    <td className="py-2.5 px-3 text-[#A1A1AA] uppercase text-[11px]">
                      {load.zone_id.replace('_', ' ')}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
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
                    <td className="py-2.5 px-3 text-[#71717A]">{load.rated_power_kw.toFixed(2)} kW</td>
                    <td className="py-2.5 px-3 font-bold text-[#FAFAFA]">
                      {load.current_power_kw.toFixed(2)} kW
                    </td>
                    <td className="py-2.5 px-3">
                      {isCritical ? (
                        <span className="text-[10px] text-[#52525B]">0.000 [IMMUNE]</span>
                      ) : (
                        <span className="font-semibold text-emerald-400">
                          {load.lps_score !== undefined ? load.lps_score.toFixed(3) : '-'}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            load.actuator_status === 'ONLINE'
                              ? 'bg-emerald-400'
                              : load.actuator_status === 'UNCERTAIN'
                              ? 'bg-amber-400'
                              : 'bg-rose-400'
                          }`}
                        />
                        <span className="text-[11px] text-[#FAFAFA]">{load.actuator_status}</span>
                        {load.is_curtailed && (
                          <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1 py-0.2 rounded border border-amber-500/20">
                            -{(load.curtailment_factor * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {isCritical ? (
                        <span className="inline-flex items-center space-x-1 text-[10px] text-[#71717A] bg-[#121215] px-2 py-0.5 rounded border border-[#27272A]">
                          <ShieldAlert className="h-3 w-3 text-rose-400" />
                          <span>LOCKED ON</span>
                        </span>
                      ) : (
                        <div className="inline-flex items-center space-x-1">
                          {load.control_type === 'CONTINUOUS' && (
                            <button
                              disabled={isExecuting}
                              onClick={() => handleCommand(load, 'MODULATE', 0.5)}
                              className="px-2 py-0.5 bg-[#18181B] hover:bg-[#27272A] text-[#FAFAFA] rounded border border-[#27272A] text-[10px] transition cursor-pointer"
                            >
                              50%
                            </button>
                          )}
                          <button
                            disabled={isExecuting}
                            onClick={() => handleCommand(load, 'CURTAIL', 0.0)}
                            className="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded border border-rose-500/30 text-[10px] transition cursor-pointer"
                          >
                            SHED
                          </button>
                          <button
                            disabled={isExecuting}
                            onClick={() => handleCommand(load, 'RESTORE', 1.0)}
                            className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 text-[10px] transition cursor-pointer"
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
      </SciFiCard>
    </div>
  );
};
