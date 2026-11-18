import React from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { NAV_TABS } from './SidebarNav';

interface TopBarProps {
  currentTab: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeScenario: string;
  onScenarioChange: (scenId: string) => void;
  scenarios: Record<string, any>;
  onReset: () => void;
  onTriggerOptimization: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentTab,
  isCollapsed,
  onToggleCollapse,
  activeScenario,
  onScenarioChange,
  scenarios,
  onReset,
  onTriggerOptimization,
}) => {
  const currentTabObj = NAV_TABS.find((t) => t.id === currentTab) || NAV_TABS[0];

  return (
    <header className="sticky top-0 z-30 h-12 bg-[#09090B]/90 backdrop-blur border-b border-[#27272A] px-3 sm:px-5 flex items-center justify-between text-xs font-mono">
      {/* Left: Sidebar Toggle + Breadcrumb */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
          className="h-8 w-8 rounded bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-[#A1A1AA] hover:text-[#FAFAFA] flex items-center justify-center transition cursor-pointer"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4 text-emerald-400" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
          <span className="sr-only">Toggle Sidebar</span>
        </button>

        <div className="h-4 w-px bg-[#27272A]" />

        {/* View Breadcrumb */}
        <div className="flex items-center space-x-2 text-[11px]">
          <span className="text-[#71717A] hidden sm:inline">ECOWATT</span>
          <span className="text-[#52525B] hidden sm:inline">/</span>
          <span className="text-[#FAFAFA] font-bold tracking-tight">
            {currentTabObj.label}
          </span>
          <span className="text-[#52525B] hidden md:inline">•</span>
          <span className="text-[#71717A] text-[10px] hidden md:inline truncate max-w-[200px]">
            {currentTabObj.description}
          </span>
        </div>
      </div>

      {/* Right: Telemetry Badges & Quick Command Bar */}
      <div className="flex items-center space-x-2.5">
        {/* Telemetry Stat Badges */}
        <div className="hidden xl:flex items-center space-x-2 text-[10px] tabular-nums text-[#71717A]">
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
            <span className="text-emerald-400 font-semibold">100% PROTECTED</span>
          </div>
        </div>

        {/* Scenario Selector Dropdown */}
        <select
          value={activeScenario}
          onChange={(e) => onScenarioChange(e.target.value)}
          className="bg-[#121215] text-[#FAFAFA] text-[11px] font-mono rounded border border-[#27272A] px-2.5 py-1 focus:border-[#71717A] focus:outline-none transition max-w-[170px] sm:max-w-[220px] truncate cursor-pointer"
        >
          {Object.entries(scenarios).map(([key, item]) => (
            <option key={key} value={key} className="bg-[#0F0F12] text-[#FAFAFA]">
              {item.name}
            </option>
          ))}
        </select>

        {/* Optimization Button */}
        <button
          onClick={onTriggerOptimization}
          title="Execute Closed-Loop Optimization"
          className="h-7 px-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[11px] font-semibold flex items-center space-x-1.5 transition border border-emerald-500/40 cursor-pointer"
        >
          <Play className="h-3 w-3 fill-current" />
          <span className="hidden sm:inline">OPTIMIZE</span>
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
    </header>
  );
};

export default TopBar;
