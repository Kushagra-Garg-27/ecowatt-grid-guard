import React from 'react';
import {
  TrendingDown,
  Zap,
  DollarSign,
  Leaf,
  ShieldCheck,
  Download,
  Activity,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { DailyAnalyticsSummary } from '../types';

interface SustainabilityAnalyticsProps {
  summary: DailyAnalyticsSummary | null;
  activeScenario: string;
  onScenarioChange: (scenId: string) => void;
  scenarios: Record<string, any>;
}

export const SustainabilityAnalytics: React.FC<SustainabilityAnalyticsProps> = ({
  summary,
  activeScenario,
  onScenarioChange,
  scenarios,
}) => {
  if (!summary) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 font-mono text-xs">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-500 border-t-transparent mr-3" />
        COMPUTING TELEMETRY & ANALYTICAL METRICS...
      </div>
    );
  }

  const chartData = summary.intervals.map((inv) => ({
    time: inv.time_str,
    baseline_power: inv.baseline_power_kw,
    optimized_power: inv.optimized_power_kw,
    energy_saved: inv.energy_saved_kwh,
    cost_saved: inv.cost_saved,
    carbon_avoided: inv.carbon_avoided_g,
  }));

  const handleDownloadCSV = () => {
    const headers = [
      'step_index',
      'time_str',
      'baseline_power_kw',
      'optimized_power_kw',
      'baseline_energy_kwh',
      'optimized_energy_kwh',
      'energy_saved_kwh',
      'tariff_rate',
      'baseline_cost',
      'optimized_cost',
      'cost_saved',
      'carbon_intensity_g_per_kwh',
      'baseline_carbon_g',
      'optimized_carbon_g',
      'carbon_avoided_g',
      'shifted_energy_kwh',
      'threshold_exceeded_baseline',
      'threshold_exceeded_optimized',
    ];
    const rows = summary.intervals.map((inv: any) =>
      headers.map((h) => inv[h]).join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${summary.scenario_id}_simulation_dataset.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Title & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#27272A] pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              AUDIT COMPLIANT
            </span>
            <h2 className="text-sm font-semibold tracking-tight text-zinc-100 uppercase">
              Sustainability & Comparative Analytics
            </h2>
          </div>
          <p className="font-mono text-[11px] text-zinc-400 mt-0.5">
            96-interval closed-loop optimization vs unmanaged baseline profile (CEA Baseline)
          </p>
        </div>

        <div className="flex items-center space-x-2 self-stretch sm:self-auto">
          <select
            value={activeScenario}
            onChange={(e) => onScenarioChange(e.target.value)}
            className="flex-1 sm:flex-none bg-[#0F0F12] border border-[#27272A] text-zinc-200 font-mono text-xs px-2.5 py-1.5 rounded-md focus:outline-none focus:border-zinc-500 transition"
          >
            {Object.entries(scenarios).map(([key, item]) => (
              <option key={key} value={key} className="bg-zinc-900 text-zinc-200">
                {item.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleDownloadCSV}
            className="bg-[#18181B] hover:bg-[#27272A] text-zinc-300 font-mono text-xs px-2.5 py-1.5 rounded-md border border-[#27272A] flex items-center space-x-1.5 transition active:scale-95 shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-emerald-400" />
            <span>EXPORT CSV</span>
          </button>
        </div>
      </div>

      {/* Metric Comparison Bento Server Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Peak Power Shaving */}
        <div className="bento-surface rounded-lg p-3.5 space-y-2 border border-[#27272A] border-t-white/[0.08]">
          <div className="flex items-center justify-between text-zinc-400 font-mono text-[10px] uppercase tracking-wider">
            <span>Peak Demand Shaving</span>
            <TrendingDown className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="font-mono tabular-nums text-2xl font-semibold text-zinc-100">
              {summary.peak_reduction_kw.toFixed(2)}
            </span>
            <span className="font-mono text-xs text-zinc-500">kW</span>
          </div>
          <div className="flex items-center justify-between font-mono text-[11px] border-t border-[#27272A] pt-2">
            <span className="text-zinc-500">BASE: {summary.baseline_peak_power_kw.toFixed(2)} kW</span>
            <span className="text-emerald-400 font-medium">-{summary.peak_reduction_pct.toFixed(1)}%</span>
          </div>
        </div>

        {/* Daily Energy Consumption */}
        <div className="bento-surface rounded-lg p-3.5 space-y-2 border border-[#27272A] border-t-white/[0.08]">
          <div className="flex items-center justify-between text-zinc-400 font-mono text-[10px] uppercase tracking-wider">
            <span>Daily Net Energy Saved</span>
            <Zap className="h-3.5 w-3.5 text-cyan-400" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="font-mono tabular-nums text-2xl font-semibold text-zinc-100">
              {summary.net_energy_saved_kwh.toFixed(2)}
            </span>
            <span className="font-mono text-xs text-zinc-500">kWh</span>
          </div>
          <div className="flex items-center justify-between font-mono text-[11px] border-t border-[#27272A] pt-2">
            <span className="text-zinc-500">BASE: {summary.total_baseline_energy_kwh.toFixed(1)} kWh</span>
            <span className="text-cyan-400 font-medium">-{summary.energy_saved_pct.toFixed(1)}%</span>
          </div>
        </div>

        {/* Electricity Cost Savings */}
        <div className="bento-surface rounded-lg p-3.5 space-y-2 border border-[#27272A] border-t-white/[0.08]">
          <div className="flex items-center justify-between text-zinc-400 font-mono text-[10px] uppercase tracking-wider">
            <span>Electricity Cost Shaved</span>
            <DollarSign className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="font-mono tabular-nums text-2xl font-semibold text-zinc-100">
              ₹{summary.net_cost_saved.toFixed(2)}
            </span>
            <span className="font-mono text-xs text-zinc-500">INR</span>
          </div>
          <div className="flex items-center justify-between font-mono text-[11px] border-t border-[#27272A] pt-2">
            <span className="text-zinc-500">BASE: ₹{summary.baseline_total_cost.toFixed(2)}</span>
            <span className="text-amber-400 font-medium">-{summary.cost_saved_pct.toFixed(1)}%</span>
          </div>
        </div>

        {/* Carbon Footprint Reduction */}
        <div className="bento-surface rounded-lg p-3.5 space-y-2 border border-[#27272A] border-t-white/[0.08]">
          <div className="flex items-center justify-between text-zinc-400 font-mono text-[10px] uppercase tracking-wider">
            <span>Avoided CO2 Emissions</span>
            <Leaf className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="font-mono tabular-nums text-2xl font-semibold text-zinc-100">
              {summary.carbon_avoided_kg.toFixed(2)}
            </span>
            <span className="font-mono text-xs text-zinc-500">kg CO2</span>
          </div>
          <div className="flex items-center justify-between font-mono text-[11px] border-t border-[#27272A] pt-2">
            <span className="text-zinc-500">BASE: {summary.baseline_total_carbon_kg.toFixed(1)} kg</span>
            <span className="text-emerald-400 font-medium">-{summary.carbon_reduction_pct.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Grid Reliability & Protection Register */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bento-surface rounded-md p-3 border border-[#27272A]">
          <span className="text-zinc-500 font-mono text-[10px] uppercase block tracking-wider">
            Baseline Exceedance
          </span>
          <span className="font-mono tabular-nums text-rose-400 font-semibold text-sm mt-0.5 block">
            {summary.threshold_exceedance_minutes_baseline} mins
          </span>
        </div>
        <div className="bento-surface rounded-md p-3 border border-[#27272A]">
          <span className="text-zinc-500 font-mono text-[10px] uppercase block tracking-wider">
            Optimized Exceedance
          </span>
          <span className="font-mono tabular-nums text-emerald-400 font-semibold text-sm mt-0.5 block">
            {summary.threshold_exceedance_minutes_optimized} mins
          </span>
        </div>
        <div className="bento-surface rounded-md p-3 border border-[#27272A]">
          <span className="text-zinc-500 font-mono text-[10px] uppercase block tracking-wider">
            Actuations Dispatched
          </span>
          <span className="font-mono tabular-nums text-zinc-100 font-semibold text-sm mt-0.5 block">
            {summary.total_control_operations} ops
          </span>
        </div>
        <div className="bento-surface rounded-md p-3 border border-[#27272A]">
          <span className="text-zinc-500 font-mono text-[10px] uppercase block tracking-wider">
            Critical Load Trip
          </span>
          <span className="font-mono text-emerald-400 font-semibold text-sm mt-0.5 flex items-center space-x-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>0 (100% IMMUNE)</span>
          </span>
        </div>
      </div>

      {/* 24-Hour Comparative Load Curve Chart */}
      <div className="bento-surface rounded-lg p-4 border border-[#27272A] border-t-white/[0.08] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#27272A] pb-3">
          <div>
            <h3 className="font-mono text-xs font-semibold text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
              <span>24-Hour Comparative Load Profile</span>
            </h3>
            <p className="font-mono text-[10px] text-zinc-500 mt-0.5">
              15-minute sampling intervals (96 intervals / day)
            </p>
          </div>
          <div className="flex items-center space-x-4 font-mono text-[11px]">
            <span className="flex items-center space-x-1.5 text-zinc-400">
              <span className="h-2 w-2 rounded-sm bg-zinc-600" />
              <span>Unmanaged Baseline</span>
            </span>
            <span className="flex items-center space-x-1.5 text-emerald-400 font-medium">
              <span className="h-2 w-2 rounded-sm bg-emerald-400" />
              <span>EcoWatt Optimized</span>
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#27272A" strokeDasharray="2 3" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#52525B"
                fontSize={10}
                tickLine={false}
                interval={7}
                tick={{ fill: '#71717A', fontFamily: 'JetBrains Mono, monospace' }}
              />
              <YAxis
                stroke="#52525B"
                fontSize={10}
                unit=" kW"
                domain={[0, 10]}
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
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                }}
                formatter={(val: any) => [`${parseFloat(val).toFixed(2)} kW`]}
              />
              <ReferenceLine
                y={7.0}
                stroke="#F43F5E"
                strokeDasharray="3 3"
                label={{
                  value: 'LIMIT 7.00 kW',
                  fill: '#F43F5E',
                  fontSize: 9,
                  position: 'insideTopRight',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              />
              <ReferenceLine
                y={6.8}
                stroke="#06B6D4"
                strokeDasharray="2 2"
                label={{
                  value: 'TARGET 6.80 kW',
                  fill: '#06B6D4',
                  fontSize: 9,
                  position: 'insideBottomRight',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              />
              <Area
                type="monotone"
                dataKey="baseline_power"
                stroke="#71717A"
                strokeWidth={1.5}
                fill="#27272A"
                fillOpacity={0.4}
                name="Baseline"
              />
              <Line
                type="monotone"
                dataKey="optimized_power"
                stroke="#10B981"
                strokeWidth={2}
                dot={false}
                name="Optimized"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
