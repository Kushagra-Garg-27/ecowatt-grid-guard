import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
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
    <div className="min-h-screen bg-[#09090B] text-[#FAFAFA] flex flex-col font-sans">
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isWsConnected={isWsConnected}
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

      <footer className="bg-[#09090B] border-t border-[#27272A] py-3 text-center text-xs text-[#71717A] font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>ECOWATT GRID GUARD &bull; CLOSED-LOOP IOT DEMAND OPTIMIZATION &bull; PATENT ARCHITECTURE</span>
          <span className="text-[11px] text-[#A1A1AA] tabular-nums">
            CoAP UDP:5683 &bull; MQTT QoS 1:1883 &bull; FastAPI 0.115 &bull; React 19
          </span>
        </div>
      </footer>
    </div>
  );
};

export default App;
