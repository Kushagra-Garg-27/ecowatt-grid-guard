import React, { useState } from 'react';
import { InkOrbitFeatures } from '@/components/ui/ink-orbit-features';
import { MovingDotCard } from '@/components/ui/moving-dot-card';
import { Sparkles, Radio, Zap, Shield, Cpu } from 'lucide-react';

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
    <div className="space-y-4">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bento-surface rounded-lg p-3.5 sm:p-4 border border-[#27272A] border-t-white/[0.08]">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              INTERACTIVE BENTO
            </span>
            <h2 className="text-sm font-semibold tracking-tight text-zinc-100 uppercase">
              System Architecture & Feature Flow
            </h2>
          </div>
          <p className="font-mono text-[11px] text-zinc-400 mt-0.5 max-w-2xl">
            Live interactive bento diagram showcasing telemetry flow, protocol gateway synchronization, and scrubbable predictive load forecasting.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-[#09090B] p-0.5 rounded-md border border-[#27272A] text-xs shrink-0 font-mono">
          <button
            onClick={() => setActiveMode('ecowatt')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition ${
              activeMode === 'ecowatt'
                ? 'bg-[#18181B] text-emerald-400 border border-[#27272A] shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            EcoWatt Microgrid Mode
          </button>
          <button
            onClick={() => setActiveMode('demo')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition ${
              activeMode === 'demo'
                ? 'bg-[#18181B] text-cyan-400 border border-[#27272A] shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Default SaaS Template Mode
          </button>
        </div>
      </div>

      {/* Embedded InkOrbitFeatures Component */}
      <div className="rounded-lg overflow-hidden border border-[#27272A]">
        {activeMode === 'ecowatt' ? (
          <InkOrbitFeatures {...ecowattProps} />
        ) : (
          <InkOrbitFeatures theme="dark" />
        )}
      </div>

      {/* Moving Dot Cards Showcase (21st.dev Component) */}
      <div className="bento-surface rounded-lg p-4 border border-[#27272A] border-t-white/[0.08] space-y-3">
        <div className="flex items-center justify-between border-b border-[#27272A] pb-2.5">
          <div className="flex items-center space-x-2">
            <Cpu className="h-4 w-4 text-cyan-400" />
            <h3 className="font-mono text-xs font-semibold text-zinc-100 uppercase tracking-wider">
              Telemetry Counters & Sci-Fi Radar Cards (Moving Dot Card)
            </h3>
          </div>
          <span className="font-mono text-[10px] text-zinc-500">
            @minhxthanh/moving-dot-card &bull; 21st.dev
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 py-3">
          <MovingDotCard
            target={842000}
            duration={2500}
            label="Packets Ingested"
            sublabel="CoAP UDP (5683) Stream"
          />
          <MovingDotCard
            target={1820}
            duration={2000}
            label="Peak Power Cut"
            sublabel="Demand Shaved vs 7.0 kW"
            formatter={(v) => `${(v / 1000).toFixed(2)} kW`}
          />
          <MovingDotCard
            target={100}
            duration={1500}
            label="Critical Immunity"
            sublabel="0 Shedding Violations"
            formatter={(v) => `${v}%`}
          />
        </div>
      </div>

      {/* Architectural Pillars Context Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bento-surface rounded-lg p-3.5 space-y-1.5 border border-[#27272A] border-t-white/[0.08]">
          <div className="flex items-center space-x-2 font-mono text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
            <Radio className="h-3.5 w-3.5" />
            <span>CoAP Telemetry Ingestion</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Lightweight UDP datagrams on port 5683 stream 15-minute power, voltage, current, and occupancy readings from 5 campus building zones.
          </p>
        </div>

        <div className="bento-surface rounded-lg p-3.5 space-y-1.5 border border-[#27272A] border-t-white/[0.08]">
          <div className="flex items-center space-x-2 font-mono text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
            <Zap className="h-3.5 w-3.5" />
            <span>Closed-Loop MQTT Control</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            QoS 1 actuation commands modulate flexible loads and reschedule deferrable EV charging, verified through post-actuation remeasurement.
          </p>
        </div>

        <div className="bento-surface rounded-lg p-3.5 space-y-1.5 border border-[#27272A] border-t-white/[0.08]">
          <div className="flex items-center space-x-2 font-mono text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
            <Shield className="h-3.5 w-3.5" />
            <span>Critical Load Immunity</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Server rooms and safety systems are assigned a Suitability Index of 0 (S_k = 0), guaranteeing 100% protection against load shedding.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ArchitectureFeatures;
