import React from 'react';
import {
  ShieldCheck,
  Activity,
  Layers,
  Cpu,
  Sliders,
  Calendar,
  BarChart3,
  Radio,
  Play,
  RotateCcw,
  Sparkles,
  Server,
  Zap,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isWsConnected: boolean;
  activeScenario: string;
  onScenarioChange: (scenId: string) => void;
  scenarios: Record<string, any>;
  onReset: () => void;
  onTriggerOptimization: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  isWsConnected,
  activeScenario,
  onScenarioChange,
  scenarios,
  onReset,
  onTriggerOptimization,
}) => {
  const tabs = [
    { id: 'overview', label: 'OVERVIEW', icon: Activity },
    { id: 'zones', label: 'ZONES', icon: Layers },
    { id: 'loads', label: 'LOADS', icon: Cpu },
    { id: 'optimizer', label: 'OPTIMIZER', icon: Sliders },
    { id: 'scheduler', label: 'SCHEDULER', icon: Calendar },
    { id: 'analytics', label: 'ANALYTICS', icon: BarChart3 },
    { id: 'iot', label: 'IOT PACKETS', icon: Radio },
    { id: 'architecture', label: 'FLOW BENTO', icon: Sparkles },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#09090B]/95 backdrop-blur border-b border-[#27272A]">
      {/* Top Simulation Telemetry & Command Bar */}
      <div className="h-12 px-3 sm:px-5 flex items-center justify-between border-b border-[#27272A]/70 text-xs">
        {/* Left: Project Emblem + Breadcrumb + Status Badge */}
        <div className="flex items-center space-x-3">
          <div
            onClick={() => setCurrentTab('overview')}
            className="flex items-center space-x-2.5 cursor-pointer group"
          >
            <div className="h-7 w-7 rounded bg-[#18181B] border border-[#27272A] flex items-center justify-center text-emerald-400 group-hover:border-emerald-500/50 transition">
              <Zap className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center space-x-1.5 font-mono text-[11px]">
              <span className="text-[#FAFAFA] font-bold tracking-tight">ECOWATT</span>
              <span className="text-[#52525B]">/</span>
              <span className="text-[#A1A1AA] hidden sm:inline">CLUSTER-01</span>
            </div>
          </div>

          <div className="h-3.5 w-px bg-[#27272A]" />

          {/* Active Simulation Status Pill */}
          <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono tracking-wide font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">SIMULATION LIVE</span>
            <span className="sm:hidden">LIVE</span>
          </div>
        </div>

        {/* Center / Right: Technical Telemetry Badges & Controls */}
        <div className="flex items-center space-x-2.5">
          {/* Readout Badges */}
          <div className="hidden xl:flex items-center space-x-2 text-[10px] font-mono tabular-nums text-[#71717A]">
            <div className="px-2 py-0.5 rounded bg-[#121215] border border-[#27272A]">
              <span className="text-[#52525B]">TICK:</span>{' '}
              <span className="text-[#A1A1AA]">15-MIN</span>
            </div>
            <div className="px-2 py-0.5 rounded bg-[#121215] border border-[#27272A]">
              <span className="text-[#52525B]">PROTO:</span>{' '}
              <span className="text-[#A1A1AA]">UDP:5683 / MQTT:1883</span>
            </div>
            <div className="px-2 py-0.5 rounded bg-[#121215] border border-[#27272A]">
              <span className="text-[#52525B]">LOSS:</span>{' '}
              <span className="text-emerald-400 font-semibold">0.00%</span>
            </div>
            <div className="px-2 py-0.5 rounded bg-[#121215] border border-[#27272A]">
              <span className="text-[#52525B]">CRITICAL:</span>{' '}
              <span className="text-emerald-400 font-semibold">100% IMMUNE</span>
            </div>
          </div>

          {/* Scenario Selector Dropdown */}
          <select
            value={activeScenario}
            onChange={(e) => onScenarioChange(e.target.value)}
            className="bg-[#121215] text-[#FAFAFA] text-[11px] font-mono rounded border border-[#27272A] px-2.5 py-1 focus:border-[#71717A] focus:outline-none transition max-w-[180px] sm:max-w-none truncate cursor-pointer"
          >
            {Object.entries(scenarios).map(([key, item]) => (
              <option key={key} value={key} className="bg-[#0F0F12] text-[#FAFAFA]">
                {item.name}
              </option>
            ))}
          </select>

          {/* Optimization Command Button */}
          <button
            onClick={onTriggerOptimization}
            title="Execute Closed-Loop Optimization"
            className="h-7 px-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[11px] font-semibold flex items-center space-x-1.5 transition border border-emerald-500/40 shadow-none cursor-pointer"
          >
            <Play className="h-3 w-3 fill-current" />
            <span className="hidden md:inline">OPTIMIZE</span>
          </button>

          {/* Reset Button */}
          <button
            onClick={onReset}
            title="Reset All Loads to Baseline"
            className="h-7 px-2 rounded bg-[#18181B] hover:bg-[#27272A] text-[#A1A1AA] hover:text-[#FAFAFA] border border-[#27272A] transition cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Secondary Rail / Segmented Navigation Control */}
      <div className="h-9 px-3 sm:px-5 flex items-center space-x-1 overflow-x-auto bg-[#09090B] text-xs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-[11px] font-mono whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'bg-[#18181B] text-[#FAFAFA] border border-[#27272A] shadow-xs'
                  : 'text-[#71717A] hover:text-[#A1A1AA] hover:bg-[#121215] border border-transparent'
              }`}
            >
              <Icon className={`h-3 w-3 ${isActive ? 'text-emerald-400' : 'text-[#71717A]'}`} />
              <span className="tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
