import React from 'react';
import {
  Activity,
  Layers,
  Cpu,
  Sliders,
  Calendar,
  BarChart3,
  Radio,
  Sparkles,
  Zap,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';

export interface NavTabItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

export const NAV_TABS: NavTabItem[] = [
  { id: 'overview', label: 'OVERVIEW', icon: Activity, description: 'Live Telemetry & Peak Load' },
  { id: 'zones', label: 'ZONES', icon: Layers, description: 'Spatial Zone Telemetry' },
  { id: 'loads', label: 'LOADS', icon: Cpu, description: 'Smart Actuator Dispatch' },
  { id: 'optimizer', label: 'OPTIMIZER', icon: Sliders, description: 'Closed-Loop LP Solver' },
  { id: 'scheduler', label: 'SCHEDULER', icon: Calendar, description: 'Dynamic TOU Scheduling' },
  { id: 'analytics', label: 'ANALYTICS', icon: BarChart3, description: 'Carbon & Cost Analytics' },
  { id: 'iot', label: 'IOT PACKETS', icon: Radio, description: 'CoAP / MQTT Packet Sniffer' },
  { id: 'architecture', label: 'FLOW BENTO', icon: Sparkles, description: 'System Architecture Flow' },
];

interface SidebarNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isWsConnected: boolean;
  activeScenario: string;
  onScenarioChange: (scenId: string) => void;
  scenarios: Record<string, any>;
  onReset: () => void;
  onTriggerOptimization: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  currentTab,
  setCurrentTab,
  isCollapsed,
  onToggleCollapse,
  isWsConnected,
  activeScenario,
  onScenarioChange,
  scenarios,
  onReset,
  onTriggerOptimization,
}) => {
  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 z-40 bg-[#09090B]/95 backdrop-blur border-r border-[#27272A] flex flex-col justify-between transition-all duration-300 ease-in-out select-none ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
      aria-label="Sidebar Navigation"
    >
      {/* Top Header & Navigation Links */}
      <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        {/* Brand & Collapse Toggle Header */}
        <div
          className={`h-14 border-b border-[#27272A]/70 flex items-center transition-all px-3 ${
            isCollapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          {isCollapsed ? (
            <button
              onClick={onToggleCollapse}
              title="Expand sidebar (Ctrl+B)"
              className="group relative h-9 w-9 rounded-md bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] flex items-center justify-center text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
            >
              <Zap className="h-4 w-4" />
              <span className="sr-only">Expand sidebar</span>
              {/* Tooltip */}
              <div className="pointer-events-none absolute left-full ml-3 px-2 py-1 rounded bg-[#18181B] text-[#FAFAFA] text-[11px] font-mono whitespace-nowrap border border-[#27272A] shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                Expand sidebar (Ctrl+B)
              </div>
            </button>
          ) : (
            <>
              <div
                onClick={() => setCurrentTab('overview')}
                className="flex items-center space-x-2.5 cursor-pointer group"
              >
                <div className="h-7 w-7 rounded bg-[#18181B] border border-[#27272A] flex items-center justify-center text-emerald-400 group-hover:border-emerald-500/50 transition">
                  <Zap className="h-3.5 w-3.5" />
                </div>
                <div className="flex items-center space-x-1.5 font-mono text-[11px] leading-tight">
                  <span className="text-[#FAFAFA] font-bold tracking-tight">ECOWATT</span>
                  <span className="text-[#52525B]">/</span>
                  <span className="text-[#A1A1AA]">CLUSTER-01</span>
                </div>
              </div>

              <button
                onClick={onToggleCollapse}
                title="Collapse sidebar (Ctrl+B)"
                className="h-7 w-7 rounded bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-[#71717A] hover:text-[#FAFAFA] flex items-center justify-center transition cursor-pointer"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
                <span className="sr-only">Collapse sidebar</span>
              </button>
            </>
          )}
        </div>

        {/* Live Status Indicator Pill */}
        <div className={`px-3 py-2.5 border-b border-[#27272A]/50 ${isCollapsed ? 'flex justify-center' : ''}`}>
          {isCollapsed ? (
            <div className="group relative">
              <div
                title="Simulation Live"
                className="h-7 w-7 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 cursor-default"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="pointer-events-none absolute left-full ml-3 px-2 py-1 rounded bg-[#18181B] text-[#FAFAFA] text-[11px] font-mono whitespace-nowrap border border-[#27272A] shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                Simulation Live • QoS 1
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono tracking-wide font-medium">
              <div className="flex items-center space-x-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>SIMULATION LIVE</span>
              </div>
              <span className="text-[10px] text-emerald-400/80 font-normal">QoS 1</span>
            </div>
          )}
        </div>

        {/* Navigation Tabs Section */}
        <div className="px-2 py-3 space-y-1">
          {!isCollapsed && (
            <div className="px-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-[#71717A]">
              Navigation
            </div>
          )}

          {NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;

            return (
              <div key={tab.id} className="relative group">
                <button
                  onClick={() => setCurrentTab(tab.id)}
                  className={`w-full flex items-center rounded-md font-mono text-xs transition cursor-pointer ${
                    isCollapsed
                      ? 'h-10 justify-center'
                      : 'h-9 px-2.5 space-x-2.5 text-left'
                  } ${
                    isActive
                      ? 'bg-[#18181B] text-[#FAFAFA] border border-[#27272A] shadow-xs font-semibold'
                      : 'text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#121215] border border-transparent'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive ? 'text-emerald-400' : 'text-[#71717A] group-hover:text-[#A1A1AA]'
                    }`}
                  />
                  {!isCollapsed && (
                    <span className="tracking-tight truncate text-[11px]">{tab.label}</span>
                  )}
                </button>

                {/* Floating Tooltip in Collapsed Mode */}
                {isCollapsed && (
                  <div className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 rounded bg-[#18181B] text-[#FAFAFA] text-[11px] font-mono whitespace-nowrap border border-[#27272A] shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                    <div className="font-semibold">{tab.label}</div>
                    <div className="text-[10px] text-[#71717A]">{tab.description}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick Simulation Controls in Sidebar */}
        <div className="px-2 pt-2 pb-3 border-t border-[#27272A]/50 space-y-2 mt-auto">
          {!isCollapsed && (
            <div className="px-2 text-[10px] font-mono uppercase tracking-wider text-[#71717A]">
              Scenario & Actions
            </div>
          )}

          {isCollapsed ? (
            <div className="flex flex-col items-center space-y-2">
              {/* Collapsed Optimize Button */}
              <div className="relative group">
                <button
                  onClick={onTriggerOptimization}
                  title="Optimize Now"
                  className="h-10 w-10 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition border border-emerald-500/40 cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                </button>
                <div className="pointer-events-none absolute left-full ml-3 px-2.5 py-1 rounded bg-[#18181B] text-[#FAFAFA] text-[11px] font-mono whitespace-nowrap border border-[#27272A] shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                  Trigger LP Optimization
                </div>
              </div>

              {/* Collapsed Reset Button */}
              <div className="relative group">
                <button
                  onClick={onReset}
                  title="Reset Simulation"
                  className="h-10 w-10 rounded-md bg-[#18181B] hover:bg-[#27272A] text-[#A1A1AA] hover:text-[#FAFAFA] border border-[#27272A] flex items-center justify-center transition cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <div className="pointer-events-none absolute left-full ml-3 px-2.5 py-1 rounded bg-[#18181B] text-[#FAFAFA] text-[11px] font-mono whitespace-nowrap border border-[#27272A] shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                  Reset All Loads to Baseline
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Scenario Selector */}
              <select
                value={activeScenario}
                onChange={(e) => onScenarioChange(e.target.value)}
                className="w-full bg-[#121215] text-[#FAFAFA] text-[11px] font-mono rounded border border-[#27272A] px-2.5 py-1.5 focus:border-[#71717A] focus:outline-none transition truncate cursor-pointer"
              >
                {Object.entries(scenarios).map(([key, item]) => (
                  <option key={key} value={key} className="bg-[#0F0F12] text-[#FAFAFA]">
                    {item.name}
                  </option>
                ))}
              </select>

              {/* Action Buttons Row */}
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={onTriggerOptimization}
                  className="flex-1 h-8 px-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[11px] font-semibold flex items-center justify-center space-x-1.5 transition border border-emerald-500/40 cursor-pointer"
                >
                  <Play className="h-3 w-3 fill-current" />
                  <span>OPTIMIZE</span>
                </button>
                <button
                  onClick={onReset}
                  title="Reset All Loads"
                  className="h-8 px-2.5 rounded bg-[#18181B] hover:bg-[#27272A] text-[#A1A1AA] hover:text-[#FAFAFA] border border-[#27272A] transition cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Diagnostics / Telemetry Info */}
      <div className="p-2.5 border-t border-[#27272A]/70 text-[10px] font-mono bg-[#0c0c0e]">
        {isCollapsed ? (
          <div className="group relative flex justify-center py-1">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                isWsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <div className="pointer-events-none absolute left-full ml-3 px-2 py-1 rounded bg-[#18181B] text-[#FAFAFA] text-[11px] font-mono whitespace-nowrap border border-[#27272A] shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
              {isWsConnected ? 'WebSocket: Connected (8000)' : 'WebSocket: Reconnecting...'}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 text-[#71717A]">
            <div className="flex items-center justify-between">
              <span className="text-[#52525B]">GATEWAY:</span>
              <span className={`font-semibold ${isWsConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isWsConnected ? 'LIVE WS' : 'POLLING'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#52525B]">LOSS:</span>
              <span className="text-emerald-400 font-semibold tabular-nums">0.00%</span>
            </div>
            <div className="text-[9px] text-[#52525B] truncate pt-0.5 border-t border-[#27272A]/40">
              CoAP UDP:5683 • MQTT:1883
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default SidebarNav;
