import React, { useState } from 'react';
import {
  Sliders,
  Car,
  Flame,
  BatteryCharging,
  DollarSign,
  Leaf,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { DailyAnalyticsSummary } from '../types';
import { SciFiCard } from '@/components/ui/moving-dot-card';

interface LoadSchedulerProps {
  summary: DailyAnalyticsSummary | null;
}

export const LoadScheduler: React.FC<LoadSchedulerProps> = ({ summary }) => {
  const [betaWeight, setBetaWeight] = useState<number>(0.6); // 0.6 = 60% cost, 40% carbon

  const deferrableLoads = [
    {
      id: 'BLD-EV-CHARGER-01',
      name: 'Level 2 EV Fleet Fast Charger',
      icon: Car,
      rated_power_kw: 2.2,
      energy_kwh: 6.6,
      duration_hrs: '3.0h (12 ticks)',
      earliest: '10:00 AM',
      deadline: '21:00 PM',
      baseline_window: '17:00 - 20:00 (Evening Peak)',
      scheduled_window: '11:30 - 14:30 (Solar Valley)',
      cost_saved: '₹28.40',
      carbon_avoided: '1.98 kg CO2',
      status: 'OPTIMALLY_SHIFTED',
    },
    {
      id: 'BLD-WATER-HEATER-01',
      name: 'Central Sanitary Water Heater',
      icon: Flame,
      rated_power_kw: 1.5,
      energy_kwh: 3.0,
      duration_hrs: '2.0h (8 ticks)',
      earliest: '07:00 AM',
      deadline: '20:00 PM',
      baseline_window: '17:00 - 19:00 (Evening Peak)',
      scheduled_window: '07:00 - 09:00 (Morning Off-Peak)',
      cost_saved: '₹13.50',
      carbon_avoided: '0.84 kg CO2',
      status: 'OPTIMALLY_SHIFTED',
    },
    {
      id: 'BLD-BATTERY-STORAGE-01',
      name: 'Auxiliary Battery Buffer Storage',
      icon: BatteryCharging,
      rated_power_kw: 1.0,
      energy_kwh: 2.5,
      duration_hrs: '2.5h (10 ticks)',
      earliest: '08:00 AM',
      deadline: '22:00 PM',
      baseline_window: '17:30 - 20:00 (Evening Peak)',
      scheduled_window: '12:00 - 14:30 (Solar Valley)',
      cost_saved: '₹11.25',
      carbon_avoided: '0.75 kg CO2',
      status: 'OPTIMALLY_SHIFTED',
    },
  ];

  const profileData =
    summary?.intervals.map((inv) => ({
      time: inv.time_str,
      tariff: inv.tariff_rate,
      carbon: inv.carbon_intensity_g_per_kwh,
    })) || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#27272A] pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
              DISPATCH SCHEDULER
            </span>
            <h2 className="text-sm font-semibold tracking-tight text-zinc-100 uppercase">
              Peak-Load Shifting & Deferrable Scheduler
            </h2>
          </div>
          <p className="font-mono text-[11px] text-zinc-400 mt-0.5">
            Temporal optimization minimizing: ∫ [β · Tariff(t) + (1 - β) · Carbon(t)] · P_load dt
          </p>
        </div>

        {/* Beta Weight Slider SciFiCard */}
        <SciFiCard accent="cyan" dotDuration="9s" innerClassName="px-3 py-1.5 flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5 text-zinc-400 font-mono text-[11px]">
            <Sliders className="h-3.5 w-3.5 text-cyan-400" />
            <span>WEIGHT (β):</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={betaWeight}
            onChange={(e) => setBetaWeight(parseFloat(e.target.value))}
            className="w-24 accent-cyan-500 cursor-pointer h-1 bg-zinc-800 rounded"
          />
          <div className="text-[11px] font-mono tabular-nums">
            <span className="text-amber-400 font-medium">{(betaWeight * 100).toFixed(0)}% COST</span>
            <span className="text-zinc-600 mx-1">/</span>
            <span className="text-emerald-400 font-medium">{((1 - betaWeight) * 100).toFixed(0)}% CO2</span>
          </div>
        </SciFiCard>
      </div>

      {/* Deferrable Loads Sci-Fi Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {deferrableLoads.map((dload, idx) => {
          const Icon = dload.icon;
          return (
            <SciFiCard
              key={dload.id}
              accent="cyan"
              dotDuration={`${7 + idx * 1.5}s`}
              innerClassName="p-3.5 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="h-8 w-8 rounded-md bg-[#18181B] border border-[#27272A] flex items-center justify-center text-cyan-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-200">{dload.name}</h3>
                    <div className="text-[10px] text-zinc-500 font-mono">{dload.id}</div>
                  </div>
                </div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  SHIFTED
                </span>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-2 font-mono text-xs bg-[#09090B]/80 p-2.5 rounded-md border border-[#27272A]">
                <div>
                  <span className="text-zinc-500 text-[10px] block uppercase">Rated Power</span>
                  <div className="font-semibold text-zinc-100 tabular-nums">{dload.rated_power_kw} kW</div>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] block uppercase">Total Energy</span>
                  <div className="font-semibold text-cyan-400 tabular-nums">{dload.energy_kwh} kWh</div>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] block uppercase">Earliest Start</span>
                  <div className="text-zinc-300 text-[11px]">{dload.earliest}</div>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] block uppercase">Hard Deadline</span>
                  <div className="text-zinc-300 text-[11px]">{dload.deadline}</div>
                </div>
              </div>

              {/* Windows */}
              <div className="space-y-1.5 font-mono text-xs">
                <div className="p-2 rounded bg-rose-950/20 border border-rose-500/30 text-[11px]">
                  <span className="text-zinc-500 block text-[9px] uppercase tracking-wider">Unmanaged Baseline</span>
                  <span className="text-rose-400 font-medium">{dload.baseline_window}</span>
                </div>
                <div className="p-2 rounded bg-emerald-950/20 border border-emerald-500/30 text-[11px]">
                  <span className="text-zinc-500 block text-[9px] uppercase tracking-wider">Optimized Shifted Window</span>
                  <span className="text-emerald-400 font-medium flex items-center space-x-1">
                    <Sparkles className="h-3 w-3 inline text-emerald-400 mr-1" />
                    <span>{dload.scheduled_window}</span>
                  </span>
                </div>
              </div>

              {/* Cost & Carbon Savings */}
              <div className="border-t border-[#27272A] pt-2.5 flex items-center justify-between font-mono text-xs">
                <div>
                  <span className="text-[10px] text-zinc-500 block uppercase">Cost Shaved</span>
                  <span className="text-amber-400 font-semibold tabular-nums">{dload.cost_saved}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-500 block uppercase">Avoided CO2</span>
                  <span className="text-emerald-400 font-semibold tabular-nums">{dload.carbon_avoided}</span>
                </div>
              </div>
            </SciFiCard>
          );
        })}
      </div>

      {/* Grid Signals: Tariff and Carbon Curves (SciFiCard) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Tariff Profile Chart */}
        <SciFiCard accent="amber" dotDuration="11s" innerClassName="p-3.5 space-y-2">
          <div className="flex items-center justify-between border-b border-[#27272A] pb-2">
            <div>
              <h3 className="font-mono text-xs font-semibold text-zinc-100 uppercase tracking-wider flex items-center space-x-1.5">
                <DollarSign className="h-3.5 w-3.5 text-amber-400" />
                <span>Time-of-Use Electricity Tariff (₹/kWh)</span>
              </h3>
              <p className="font-mono text-[10px] text-zinc-500">Peak tariff (₹12.00/kWh) active between 14:00 - 20:00</p>
            </div>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profileData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#27272A" strokeDasharray="2 3" vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="#52525B"
                  fontSize={10}
                  tickLine={false}
                  interval={11}
                  tick={{ fill: '#71717A', fontFamily: 'JetBrains Mono, monospace' }}
                />
                <YAxis
                  stroke="#52525B"
                  fontSize={10}
                  unit=" ₹"
                  domain={[0, 15]}
                  tickLine={false}
                  tick={{ fill: '#71717A', fontFamily: 'JetBrains Mono, monospace' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F0F12',
                    borderColor: '#27272A',
                    borderRadius: '0.375rem',
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                  formatter={(val: any) => [`₹${parseFloat(val).toFixed(2)} / kWh`, 'Tariff']}
                />
                <Line type="stepAfter" dataKey="tariff" stroke="#F59E0B" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SciFiCard>

        {/* Carbon Intensity Profile Chart */}
        <SciFiCard accent="emerald" dotDuration="12s" innerClassName="p-3.5 space-y-2">
          <div className="flex items-center justify-between border-b border-[#27272A] pb-2">
            <div>
              <h3 className="font-mono text-xs font-semibold text-zinc-100 uppercase tracking-wider flex items-center space-x-1.5">
                <Leaf className="h-3.5 w-3.5 text-emerald-400" />
                <span>Grid Carbon Intensity (gCO2/kWh) — Modeled Diurnal</span>
              </h3>
              <p className="font-mono text-[10px] text-zinc-500">Solar valley window (11:00 - 15:00 ~580 g/kWh)</p>
            </div>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profileData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#27272A" strokeDasharray="2 3" vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="#52525B"
                  fontSize={10}
                  tickLine={false}
                  interval={11}
                  tick={{ fill: '#71717A', fontFamily: 'JetBrains Mono, monospace' }}
                />
                <YAxis
                  stroke="#52525B"
                  fontSize={10}
                  unit=" g"
                  domain={[400, 1000]}
                  tickLine={false}
                  tick={{ fill: '#71717A', fontFamily: 'JetBrains Mono, monospace' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F0F12',
                    borderColor: '#27272A',
                    borderRadius: '0.375rem',
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                  formatter={(val: any) => [`${parseFloat(val).toFixed(1)} gCO2/kWh`, 'Carbon Intensity']}
                />
                <Line type="monotone" dataKey="carbon" stroke="#10B981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SciFiCard>
      </div>
    </div>
  );
};
