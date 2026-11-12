import React from 'react';
import {
  Zap,
  Target,
  TrendingDown,
  DollarSign,
  Leaf,
  AlertTriangle,
  Scissors,
  Calendar,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { BuildingStatus, ZoneSummary, DailyAnalyticsSummary } from '../types';

interface OverviewProps {
  status: BuildingStatus | null;
  zones: ZoneSummary[];
  summary: DailyAnalyticsSummary | null;
  onNavigateTab: (tab: string) => void;
}

export const OverviewDashboard: React.FC<OverviewProps> = ({ status, zones, summary, onNavigateTab }) => {
  if (!status) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mr-3" />
        Loading building telemetry...
      </div>
    );
  }

  const isExceeded = status.current_power_kw > status.demand_threshold_kw;
  const powerMargin = (status.demand_threshold_kw - status.current_power_kw).toFixed(2);

  const chartData = summary?.intervals.map((inv) => ({
    time: inv.time_str,
    baseline: inv.baseline_power_kw,
    optimized: inv.optimized_power_kw,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Exceedance Alert Banner */}
      {isExceeded && (
        <div className="bg-rose-950/70 border border-rose-500/50 rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-rose-950/40 animate-pulse">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-rose-500/20 rounded-xl text-rose-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-rose-200">Demand Threshold Exceeded!</h4>
              <p className="text-xs text-rose-300">
                Current active power ({status.current_power_kw.toFixed(2)} kW) exceeds configured limit (
                {status.demand_threshold_kw.toFixed(2)} kW). Target demand is {status.target_demand_kw.toFixed(2)} kW.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('optimizer')}
            className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow"
          >
            Open Optimizer
          </button>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Power */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Current Active Power</span>
            <Zap className={`h-4 w-4 ${isExceeded ? 'text-rose-400' : 'text-emerald-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className={`text-3xl font-bold tracking-tight ${isExceeded ? 'text-rose-400' : 'text-white'}`}>
              {status.current_power_kw.toFixed(2)}
            </span>
            <span className="text-slate-400 text-sm">kW</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2.5">
            <span>Threshold: {status.demand_threshold_kw.toFixed(2)} kW</span>
            <span className={isExceeded ? 'text-rose-400 font-medium' : 'text-emerald-400'}>
              {isExceeded ? `+${Math.abs(parseFloat(powerMargin))} kW Excess` : `${powerMargin} kW Headroom`}
            </span>
          </div>
        </div>

        {/* Card 2: Target & Peak */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Demand Target & Peak</span>
            <Target className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-bold tracking-tight text-white">{status.target_demand_kw.toFixed(2)}</span>
            <span className="text-slate-400 text-sm">kW Target</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2.5">
            <span>Today's Peak</span>
            <span className="text-cyan-400 font-semibold">{status.peak_demand_today_kw.toFixed(2)} kW</span>
          </div>
        </div>

        {/* Card 3: Energy & Cost */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Est. Daily Electricity Cost</span>
            <DollarSign className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-bold tracking-tight text-white">${status.estimated_cost_today.toFixed(2)}</span>
            <span className="text-slate-400 text-sm">USD</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2.5">
            <span>Energy Consumed</span>
            <span className="text-slate-200 font-semibold">{status.current_energy_kwh.toFixed(1)} kWh</span>
          </div>
        </div>

        {/* Card 4: Carbon Emissions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Est. Carbon Footprint</span>
            <Leaf className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-bold tracking-tight text-white">{status.estimated_carbon_kg_today.toFixed(1)}</span>
            <span className="text-slate-400 text-sm">kg CO2</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2.5">
            <span>Avoided Emissions</span>
            <span className="text-emerald-400 font-semibold">
              {summary ? `${summary.carbon_avoided_kg.toFixed(2)} kg` : '0.00 kg'}
            </span>
          </div>
        </div>
      </div>

      {/* Secondary Status Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Critical Loads</div>
            <div className="text-xs font-semibold text-emerald-400">100% Protected</div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center space-x-3">
          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
            <Scissors className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Curtailed Loads</div>
            <div className="text-xs font-semibold text-slate-200">{status.curtailed_loads_count} Active</div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center space-x-3">
          <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Shifted Loads</div>
            <div className="text-xs font-semibold text-slate-200">{status.shifted_loads_count} Scheduled</div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Feedback Loop</div>
            <div className="text-xs font-semibold text-emerald-400">Closed-Loop Active</div>
          </div>
        </div>
      </div>

      {/* Chart: 24h Demand Trend */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">24-Hour Building Demand vs Limit</h3>
            <p className="text-xs text-slate-400">96 intervals (15-min) comparing baseline and optimized load curves</p>
          </div>
          <div className="flex items-center space-x-4 text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-500" />
              <span className="text-slate-400">Baseline (Unmanaged)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-emerald-400 font-medium">Optimized Demand</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span className="text-rose-400">Threshold (7.0 kW)</span>
            </div>
          </div>
        </div>

        <div className="h-72 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="optGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#64748b" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#64748b" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="#475569" fontSize={11} interval={7} />
              <YAxis stroke="#475569" fontSize={11} unit=" kW" domain={[0, 10]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                formatter={(val: any) => [`${parseFloat(val).toFixed(2)} kW`]}
              />
              <ReferenceLine y={status.demand_threshold_kw} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: 'Threshold 7.0kW', fill: '#f43f5e', fontSize: 10, position: 'top' }} />
              <ReferenceLine y={status.target_demand_kw} stroke="#06b6d4" strokeDasharray="3 3" label={{ value: 'Target 6.8kW', fill: '#06b6d4', fontSize: 10, position: 'bottom' }} />
              <Area type="monotone" dataKey="baseline" stroke="#64748b" strokeWidth={1.5} fillOpacity={1} fill="url(#baseGrad)" name="Baseline" />
              <Area type="monotone" dataKey="optimized" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#optGrad)" name="Optimized" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Five Zones Snapshot */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Building Zones Operational Status</h3>
          <button
            onClick={() => onNavigateTab('zones')}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
          >
            View All Zones &rarr;
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {zones.map((z) => (
            <div key={z.zone_id} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                <span className="truncate">{z.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  z.sensor_health === 'HEALTHY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                }`}>
                  {z.sensor_health}
                </span>
              </div>
              <div className="mt-2 text-xl font-bold text-white">
                {z.power_kw.toFixed(2)} <span className="text-xs font-normal text-slate-400">kW</span>
              </div>
              <div className="mt-2 space-y-1 text-[11px] text-slate-400">
                <div className="flex justify-between">
                  <span>Occupancy:</span>
                  <span className="text-slate-200 font-medium">{z.occupancy} / {z.max_occupancy}</span>
                </div>
                <div className="flex justify-between">
                  <span>Temp:</span>
                  <span className="text-slate-200 font-medium">{z.temperature_c.toFixed(1)} °C</span>
                </div>
                <div className="flex justify-between">
                  <span>Voltage/Current:</span>
                  <span className="text-slate-200 font-medium">{z.voltage_v.toFixed(0)}V / {z.current_a.toFixed(1)}A</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
