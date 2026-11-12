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
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'zones', label: 'Zones', icon: Layers },
    { id: 'loads', label: 'Loads', icon: Cpu },
    { id: 'optimizer', label: 'Optimization Centre', icon: Sliders },
    { id: 'scheduler', label: 'Load Scheduler', icon: Calendar },
    { id: 'analytics', label: 'Sustainability & Analytics', icon: BarChart3 },
    { id: 'iot', label: 'IoT Monitor', icon: Radio },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentTab('overview')}>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-white">EcoWatt</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  GRID GUARD
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">IoT Dynamic Energy Optimization System</p>
            </div>
          </div>

          {/* Controls & Scenario Picker */}
          <div className="flex items-center space-x-3">
            {/* Scenario dropdown */}
            <select
              value={activeScenario}
              onChange={(e) => onScenarioChange(e.target.value)}
              className="bg-slate-800 text-slate-200 text-xs rounded-lg px-3 py-1.5 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {Object.entries(scenarios).map(([key, item]) => (
                <option key={key} value={key}>
                  {item.name}
                </option>
              ))}
            </select>

            {/* Quick action buttons */}
            <button
              onClick={onTriggerOptimization}
              title="Execute Closed-Loop Optimization"
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition shadow-sm"
            >
              <Play className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Optimize</span>
            </button>

            <button
              onClick={onReset}
              title="Reset All Loads to Baseline"
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 flex items-center transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>

            {/* Critical Protection Badge */}
            <div className="hidden lg:flex items-center space-x-1.5 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>CRITICAL LOADS PROTECTED</span>
            </div>

            {/* Live WS Pill */}
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded-full text-xs font-medium bg-slate-800 border border-slate-700">
              <span className={`h-2 w-2 rounded-full ${isWsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-slate-300 text-[11px]">{isWsConnected ? 'Live' : 'Polling'}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex space-x-1 overflow-x-auto pb-2 -mb-px text-sm">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-medium whitespace-nowrap text-xs transition ${
                  isActive
                    ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
