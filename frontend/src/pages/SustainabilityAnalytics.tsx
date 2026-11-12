import React from 'react';
import {
  TrendingDown,
  Zap,
  DollarSign,
  Leaf,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Download,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
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
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mr-3" />
        Computing analytical metrics...
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
    // Convert intervals to CSV
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
    <div className="space-y-6">
      {/* Title & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Sustainability & Comparative Analytics</h2>
          <p className="text-xs text-slate-400">
            Unmanaged baseline vs EcoWatt closed-loop optimization (24-Hour / 96-interval evaluation)
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={activeScenario}
            onChange={(e) => onScenarioChange(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {Object.entries(scenarios).map(([key, item]) => (
              <option key={key} value={key}>
                {item.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleDownloadCSV}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-1.5 rounded-xl border border-slate-700 flex items-center space-x-1.5 transition shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Metric Comparison Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Peak Power Shaving */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Peak Demand Shaving</span>
            <TrendingDown className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {summary.peak_reduction_kw.toFixed(2)} <span className="text-xs text-slate-400 font-normal">kW</span>
          </div>
          <div className="flex items-center justify-between text-xs border-t border-slate-800/80 pt-2">
            <span className="text-slate-400">Baseline Peak: {summary.baseline_peak_power_kw.toFixed(2)} kW</span>
            <span className="text-emerald-400 font-bold">-{summary.peak_reduction_pct.toFixed(1)}%</span>
          </div>
        </div>

        {/* Daily Energy Consumption */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Daily Net Energy Saved</span>
            <Zap className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {summary.net_energy_saved_kwh.toFixed(2)} <span className="text-xs text-slate-400 font-normal">kWh</span>
          </div>
          <div className="flex items-center justify-between text-xs border-t border-slate-800/80 pt-2">
            <span className="text-slate-400">Base: {summary.total_baseline_energy_kwh.toFixed(1)} kWh</span>
            <span className="text-cyan-400 font-bold">-{summary.energy_saved_pct.toFixed(1)}%</span>
          </div>
        </div>

        {/* Electricity Cost Savings */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Electricity Cost Shaved</span>
            <DollarSign className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            ${summary.net_cost_saved.toFixed(2)} <span className="text-xs text-slate-400 font-normal">USD</span>
          </div>
          <div className="flex items-center justify-between text-xs border-t border-slate-800/80 pt-2">
            <span className="text-slate-400">Base Cost: ${summary.baseline_total_cost.toFixed(2)}</span>
            <span className="text-amber-400 font-bold">-{summary.cost_saved_pct.toFixed(1)}%</span>
          </div>
        </div>

        {/* Carbon Footprint Reduction */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Avoided CO2 Emissions</span>
            <Leaf className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {summary.carbon_avoided_kg.toFixed(2)} <span className="text-xs text-slate-400 font-normal">kg CO2</span>
          </div>
          <div className="flex items-center justify-between text-xs border-t border-slate-800/80 pt-2">
            <span className="text-slate-400">Base: {summary.baseline_total_carbon_kg.toFixed(1)} kg</span>
            <span className="text-emerald-400 font-bold">-{summary.carbon_reduction_pct.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Grid Reliability & Protection Table */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <span className="text-slate-400 text-[11px] block">Threshold Exceedance Baseline</span>
          <span className="text-rose-400 font-bold text-sm">{summary.threshold_exceedance_minutes_baseline} mins</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <span className="text-slate-400 text-[11px] block">Threshold Exceedance Optimized</span>
          <span className="text-emerald-400 font-bold text-sm">{summary.threshold_exceedance_minutes_optimized} mins</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <span className="text-slate-400 text-[11px] block">Control Actuations Run</span>
          <span className="text-white font-bold text-sm">{summary.total_control_operations} operations</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <span className="text-slate-400 text-[11px] block">Critical Load Interruptions</span>
          <span className="text-emerald-400 font-bold text-sm flex items-center space-x-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>0 (Zero Interrupted)</span>
          </span>
        </div>
      </div>

      {/* 24-Hour Comparative Load Curve Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-white">24-Hour Comparative Load Profile</h3>
            <p className="text-xs text-slate-400">15-minute intervals (96 intervals / day)</p>
          </div>
          <div className="flex items-center space-x-4 text-xs">
            <span className="flex items-center space-x-1.5 text-slate-400">
              <span className="h-2 w-2 rounded-full bg-slate-500" />
              <span>Unmanaged Baseline</span>
            </span>
            <span className="flex items-center space-x-1.5 text-emerald-400 font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>EcoWatt Optimized</span>
            </span>
          </div>
        </div>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#475569" fontSize={11} interval={7} />
              <YAxis stroke="#475569" fontSize={11} unit=" kW" domain={[0, 10]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }}
                formatter={(val: any) => [`${parseFloat(val).toFixed(2)} kW`]}
              />
              <ReferenceLine y={7.0} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: 'Threshold 7.0 kW', fill: '#f43f5e', fontSize: 10 }} />
              <ReferenceLine y={6.8} stroke="#06b6d4" strokeDasharray="3 3" label={{ value: 'Target 6.8 kW', fill: '#06b6d4', fontSize: 10 }} />
              <Area type="monotone" dataKey="baseline_power" stroke="#64748b" strokeWidth={1.5} fill="#334155" fillOpacity={0.2} name="Baseline" />
              <Line type="monotone" dataKey="optimized_power" stroke="#10b981" strokeWidth={2.5} dot={false} name="Optimized" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
