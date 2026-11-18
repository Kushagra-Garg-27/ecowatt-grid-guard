import React, { useState, useEffect, useCallback } from 'react';
import { SidebarNav } from './components/SidebarNav';
import { TopBar } from './components/TopBar';
import { InteractiveDotGrid } from './components/ui/interactive-dot-grid';
import { OverviewDashboard } from './pages/OverviewDashboard';
import { BuildingZones } from './pages/BuildingZones';
import { LoadManagement } from './pages/LoadManagement';
import { OptimizationCentre } from './pages/OptimizationCentre';
import { LoadScheduler } from './pages/LoadScheduler';
import { SustainabilityAnalytics } from './pages/SustainabilityAnalytics';
import { IoTCommunicationMonitor } from './pages/IoTCommunicationMonitor';
import { ArchitectureFeatures } from './pages/ArchitectureFeatures';
import { useWebSocket } from './hooks/useWebSocket';
import {
  fetchBuildingStatus,
  fetchBuildingZones,
  fetchLoads,
  fetchScenarios,
  fetchScenarioResults,
  startSimulation,
  resetSimulation,
  runOptimization,
} from './services/api';
import { BuildingStatus, ZoneSummary, LoadItem, DailyAnalyticsSummary } from './types';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [status, setStatus] = useState<BuildingStatus | null>(null);
  const [zones, setZones] = useState<ZoneSummary[]>([]);
  const [loads, setLoads] = useState<LoadItem[]>([]);
  const [summary, setSummary] = useState<DailyAnalyticsSummary | null>(null);
  const [scenarios, setScenarios] = useState<Record<string, any>>({});
  const [activeScenario, setActiveScenario] = useState<string>('peak_demand_event');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ecowatt_sidebar_collapsed');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ecowatt_sidebar_collapsed', JSON.stringify(isCollapsed));
    } catch (e) {
      console.error('Failed to save sidebar state', e);
    }
  }, [isCollapsed]);

  // Global keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load initial data
  const refreshData = useCallback(async () => {
    try {
      const [sData, zData, lData] = await Promise.all([
        fetchBuildingStatus(),
        fetchBuildingZones(),
        fetchLoads(),
      ]);
      setStatus(sData);
      setZones(zData);
      setLoads(lData);
    } catch (e) {
      console.error('Data fetch error:', e);
    }
  }, []);

  const loadScenarioAnalytics = useCallback(async (scenId: string) => {
    try {
      const res = await fetchScenarioResults(scenId);
      setSummary(res);
    } catch (e) {
      console.error('Scenario results error:', e);
    }
  }, []);

  useEffect(() => {
    fetchScenarios().then((scens) => {
      if (scens) setScenarios(scens);
    });
    refreshData();
    loadScenarioAnalytics(activeScenario);

    const interval = setInterval(refreshData, 3000);
    return () => clearInterval(interval);
  }, [refreshData, loadScenarioAnalytics, activeScenario]);

  // Handle incoming WebSocket live messages
  const handleWebSocketMessage = useCallback(
    (data: any) => {
      if (data.type === 'LIVE_TELEMETRY') {
        setStatus((prev) =>
          prev
            ? {
                ...prev,
                current_power_kw: data.building_power_kw,
                demand_threshold_kw: data.threshold_kw,
                target_demand_kw: data.target_kw,
                active_alarms_count: data.active_alarms,
              }
            : null
        );

        if (data.zones) {
          setZones((prev) =>
            prev.map((z) => {
              const liveZ = data.zones[z.zone_id];
              return liveZ
                ? {
                    ...z,
                    power_kw: liveZ.power_kw,
                    occupancy: liveZ.occupancy,
                    temperature_c: liveZ.temperature_c,
                    voltage_v: liveZ.voltage_v,
                    current_a: liveZ.current_a,
                    sensor_health: liveZ.sensor_health,
                  }
                : z;
            })
          );
        }
      }
    },
    []
  );

  const { isConnected: isWsConnected } = useWebSocket(handleWebSocketMessage);

  const handleScenarioChange = async (scenId: string) => {
    setActiveScenario(scenId);
    await startSimulation(scenId);
    await loadScenarioAnalytics(scenId);
    await refreshData();
  };

  const handleReset = async () => {
    await resetSimulation();
    await refreshData();
  };

  const handleTriggerOptimization = async () => {
    await runOptimization();
    await refreshData();
  };

  return (
    <div className="relative min-h-screen bg-white text-[#FAFAFA] flex flex-row font-sans overflow-x-hidden selection:bg-zinc-800 selection:text-white">
      {/* Interactive Dot Grid Background (Canvas-based physics) */}
      <InteractiveDotGrid />

      {/* Collapsible Left Navigation Bar */}
      <SidebarNav
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
        isWsConnected={isWsConnected}
        activeScenario={activeScenario}
        onScenarioChange={handleScenarioChange}
        scenarios={scenarios}
        onReset={handleReset}
        onTriggerOptimization={handleTriggerOptimization}
      />

      {/* Main Workspace Area (Offset by sidebar width with smooth transition) */}
      <div
        className={`relative z-10 flex flex-col flex-1 min-w-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'ml-16' : 'ml-60'
        }`}
      >
        <TopBar
          currentTab={currentTab}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
          activeScenario={activeScenario}
          onScenarioChange={handleScenarioChange}
          scenarios={scenarios}
          onReset={handleReset}
          onTriggerOptimization={handleTriggerOptimization}
        />

        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-5 py-4">
          {currentTab === 'overview' && (
            <OverviewDashboard
              status={status}
              zones={zones}
              summary={summary}
              onNavigateTab={setCurrentTab}
            />
          )}

          {currentTab === 'zones' && <BuildingZones zones={zones} loads={loads} />}

          {currentTab === 'loads' && <LoadManagement loads={loads} onRefresh={refreshData} />}

          {currentTab === 'optimizer' && (
            <OptimizationCentre status={status} loads={loads} onRefresh={refreshData} />
          )}

          {currentTab === 'scheduler' && <LoadScheduler summary={summary} />}

          {currentTab === 'analytics' && (
            <SustainabilityAnalytics
              summary={summary}
              activeScenario={activeScenario}
              onScenarioChange={handleScenarioChange}
              scenarios={scenarios}
            />
          )}

          {currentTab === 'iot' && <IoTCommunicationMonitor />}

          {currentTab === 'architecture' && (
            <ArchitectureFeatures onNavigateTab={setCurrentTab} />
          )}
        </main>

        <footer className="bg-[#09090B]/90 backdrop-blur border-t border-[#27272A] py-3 text-center text-xs text-[#71717A] font-mono mt-auto">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>ECOWATT GRID GUARD &bull; CLOSED-LOOP IOT DEMAND OPTIMIZATION &bull; PATENT ARCHITECTURE</span>
            <span className="text-[11px] text-[#A1A1AA] tabular-nums">
              CoAP UDP:5683 &bull; MQTT QoS 1:1883 &bull; FastAPI 0.115 &bull; React 19
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
