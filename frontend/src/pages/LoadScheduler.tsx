import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Zap,
  TrendingDown,
  DollarSign,
  Leaf,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Car,
  Flame,
  BatteryCharging,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
} from 'recharts';
import { DailyAnalyticsSummary } from '../types';

interface LoadSchedulerProps {
  summary: DailyAnalyticsSummary | null;
}

export const LoadScheduler: React.FC<LoadSchedulerProps> = ({ summary }) => {
  const [betaWeight, setBetaWeight] = useState<number>(0.6); // 0.6 = 60% cost, 40% carbon

  const deferrableLoads = [
    {
      id: 'bld_ev_charger_1',
      name: 'Level 2 EV Fleet Fast Charger',
      icon: Car,
      rated_power_kw: 2.2,
      energy_kwh: 6.6,
      duration_hrs: '3.0h (12 intervals)',
      earliest: '10:00 AM',
      deadline: '21:00 PM',
      baseline_window: '17:00 - 20:00 (Evening Peak)',
      scheduled_window: '11:30 - 14:30 (Solar Valley)',
      cost_saved: '$1.38',
      carbon_avoided: '2.14 kg CO2',
      status: 'OPTIMALLY_SHIFTED',
    },
    {
      id: 'bld_water_heater',
      name: 'Central Sanitary Water Heater',
      icon: Flame,
      rated_power_kw: 1.5,
      energy_kwh: 3.0,
      duration_hrs: '2.0h (8 intervals)',
      earliest: '07:00 AM',
      deadline: '20:00 PM',
      baseline_window: '17:00 - 19:00 (Evening Peak)',
      scheduled_window: '07:00 - 09:00 (Morning Off-Peak)',
      cost_saved: '$0.63',
      carbon_avoided: '0.86 kg CO2',
      status: 'OPTIMALLY_SHIFTED',
    },
    {
      id: 'bld_battery_storage',
      name: 'Auxiliary Battery Buffer Storage',
      icon: BatteryCharging,
      rated_power_kw: 1.0,
      energy_kwh: 2.5,
      duration_hrs: '2.5h (10 intervals)',
      earliest: '08:00 AM',
      deadline: '22:00 PM',
      baseline_window: '17:30 - 20:00 (Evening Peak)',
      scheduled_window: '12:00 - 14:30 (Solar Valley)',
      cost_saved: '$0.52',
      carbon_avoided: '0.78 kg CO2',
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Peak-Load Shifting & Deferrable Scheduler</h2>
          <p className="text-xs text-slate-400">
            Temporal scheduling minimizing: Integral of [beta · Tariff(t) + (1 - beta) · Carbon(t)] · P_load
          </p>
        </div>

        {/* Beta Weight Slider */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5 text-slate-300">
            <Sliders className="h-4 w-4 text-cyan-400" />
            <span>Beta Tradeoff:</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={betaWeight}
            onChange={(e) => setBetaWeight(parseFloat(e.target.value))}
            className="w-28 accent-cyan-500"
          />
          <div className="text-[11px] font-mono">
            <span className="text-amber-400">{(betaWeight * 100).toFixed(0)}% Cost</span> /{' '}
            <span className="text-emerald-400">{((1 - betaWeight) * 100).toFixed(0)}% CO2</span>
          </div>
        </div>
      </div>

      {/* Deferrable Loads Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {deferrableLoads.map((dload) => {
          const Icon = dload.icon;
          return (
            <div
              key={dload.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 hover:border-slate-700 transition"
            >
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{dload.name}</h3>
                  <div className="text-[11px] text-slate-400 font-mono">{dload.id}</div>
                </div>
              </div>

              {/* Energy Specs */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <div>
                  <span className="text-slate-400 text-[10px]">Rated Power</span>
                  <div className="font-bold text-white text-sm">{dload.rated_power_kw} kW</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px]">Required Energy</span>
                  <div className="font-bold text-cyan-400 text-sm">{dload.energy_kwh} kWh</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px]">Earliest Start</span>
                  <div className="text-slate-300 font-medium">{dload.earliest}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px]">Hard Deadline</span>
                  <div className="text-slate-300 font-medium">{dload.deadline}</div>
                </div>
              </div>

              {/* Temporal Comparison */}
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-900/30 text-[11px]">
                  <span className="text-slate-400 block text-[10px]">Unmanaged Baseline Window:</span>
                  <span className="text-rose-400 font-semibold">{dload.baseline_window}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-900/30 text-[11px]">
                  <span className="text-slate-400 block text-[10px]">Optimized Shifted Window:</span>
                  <span className="text-emerald-400 font-semibold">{dload.scheduled_window}</span>
                </div>
              </div>

              {/* Economic & Carbon Savings */}
              <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Cost Shifting</span>
                  <span className="text-amber-400 font-bold">{dload.cost_saved}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Avoided Emissions</span>
                  <span className="text-emerald-400 font-bold">{dload.carbon_avoided}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid Signals: Tariff and Carbon Curves */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Tariff Profile Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center space-x-1.5">
                <DollarSign className="h-4 w-4 text-amber-400" />
                <span>Time-of-Use Electricity Tariff ($/kWh)</span>
              </h3>
              <p className="text-xs text-slate-400">Peak tariff ($0.45/kWh) active between 14:00 - 20:00</p>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profileData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#475569" fontSize={10} interval={11} />
                <YAxis stroke="#475569" fontSize={10} unit=" $" domain={[0, 0.55]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }}
                  formatter={(val: any) => [`$${parseFloat(val).toFixed(2)} / kWh`, 'Tariff']}
                />
                <Line type="stepAfter" dataKey="tariff" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Carbon Intensity Profile Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center space-x-1.5">
                <Leaf className="h-4 w-4 text-emerald-400" />
                <span>Grid Carbon Intensity (gCO2/kWh)</span>
              </h3>
              <p className="text-xs text-slate-400">Low carbon solar window (11:00 - 15:00 ~180 g/kWh)</p>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profileData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#475569" fontSize={10} interval={11} />
                <YAxis stroke="#475569" fontSize={10} unit=" g" domain={[100, 600]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }}
                  formatter={(val: any) => [`${parseFloat(val).toFixed(1)} gCO2/kWh`, 'Carbon Intensity']}
                />
                <Line type="monotone" dataKey="carbon" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
