import React, { useState } from 'react';
import { InkOrbitFeatures } from '@/components/ui/ink-orbit-features';
import { Sparkles, Radio, Zap, Shield, Cpu, RefreshCw, BarChart2 } from 'lucide-react';

interface ArchitectureFeaturesProps {
  onNavigateTab: (tab: string) => void;
}

export const ArchitectureFeatures: React.FC<ArchitectureFeaturesProps> = ({ onNavigateTab }) => {
  const [activeMode, setActiveMode] = useState<'ecowatt' | 'demo'>('ecowatt');

  const ecowattProps = {
    theme: 'dark' as const,
    brand: 'EcoWatt Guard',
    tag: 'Patent-Pending Microgrid Architecture',
    title: 'Autonomous *Edge IoT*\nDemand Shaving & Optimization',
    collaboration: {
      title: '5-Zone Sensor & Telemetry Stream',
      description:
        'CoAP UDP (5683) and MQTT feeds stream 15-minute power, occupancy, and thermal states directly into the edge gateway without cloud latency.',
    },
    reports: {
      title: 'Automated Demand Audit Reports',
      description:
        'Continuous generation of 96-interval dispatch compliance, Time-of-Use tariff savings, and CEA carbon accounting audits.',
    },
    integrations: {
      title: 'IoT Protocol Gateway',
      description:
        'Connects embedded MQTT brokers, CoAP UDP sensor nodes, ESP32 PZEM actuators, and Node-RED visual automation.',
      tools: ['CoAP', 'MQTT', 'FastAPI', 'Node-RED'],
    },
    insights: {
      title: 'Predictive Peak Shaving Forecast',
      description:
        'Real-time load forecasting models campus demand trajectories to pre-schedule deferrable loads and suppress peak demand to 6.79 kW.',
      values: [6.2, 6.4, 6.3, 6.8, 7.2, 7.5, 7.9, 8.4, 8.6, 7.8, 6.9, 6.79],
      forecastFrom: 8,
    },
  };

  return (
    <div className="space-y-6">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="h-4 w-4" />
            </span>
            <h2 className="text-base font-semibold text-white tracking-tight">
              Interactive System Architecture & Feature Flow
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Live interactive bento diagram showcasing telemetry flow, protocol gateway synchronization, and scrubbable predictive load forecasting.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs shrink-0">
          <button
            onClick={() => setActiveMode('ecowatt')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeMode === 'ecowatt'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            EcoWatt Microgrid Mode
          </button>
          <button
            onClick={() => setActiveMode('demo')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeMode === 'demo'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            Default SaaS Template Mode
          </button>
        </div>
      </div>

      {/* Embedded InkOrbitFeatures Component */}
      <div className="rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl">
        {activeMode === 'ecowatt' ? (
          <InkOrbitFeatures {...ecowattProps} />
        ) : (
          <InkOrbitFeatures theme="dark" />
        )}
      </div>

      {/* Architectural Pillars Context Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400">
            <Radio className="h-4 w-4" />
            <span>CoAP Telemetry Ingestion</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Lightweight UDP datagrams on port 5683 stream 15-minute power, voltage, current, and occupancy readings from 5 campus building zones.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center space-x-2 text-xs font-semibold text-cyan-400">
            <Zap className="h-4 w-4" />
            <span>Closed-Loop MQTT Control</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            QoS 1 actuation commands modulate flexible loads and reschedule deferrable EV charging, verified through post-actuation remeasurement.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center space-x-2 text-xs font-semibold text-amber-400">
            <Shield className="h-4 w-4" />
            <span>Critical Load Immunity</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Server rooms and safety systems are assigned a Suitability Index of 0 ($S_k = 0$), guaranteeing 100% protection against load shedding.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ArchitectureFeatures;
