import React from 'react';
import {
  Users,
  Zap,
  Gauge,
  Thermometer,
  Sun,
  Server,
  BookOpen,
  Monitor,
  Briefcase,
  Compass,
} from 'lucide-react';
import { ZoneSummary, LoadItem } from '../types';
import { SciFiCard } from '@/components/ui/moving-dot-card';

interface BuildingZonesProps {
  zones: ZoneSummary[];
  loads: LoadItem[];
}

export const BuildingZones: React.FC<BuildingZonesProps> = ({ zones, loads }) => {
  const getZoneIcon = (id: string) => {
    switch (id) {
      case 'server_room':
        return Server;
      case 'classroom':
        return BookOpen;
      case 'computer_lab':
        return Monitor;
      case 'office':
        return Briefcase;
      case 'corridor':
      default:
        return Compass;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-2 border-b border-[#27272A] gap-2">
        <div>
          <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[#FAFAFA]">
            BUILDING TELEMETRY NODES & SUB-ZONES
          </h2>
          <p className="text-[11px] font-mono text-[#71717A] mt-0.5">
            Real-time multi-sensor telemetry ingested from 5 ESP32 edge nodes over CoAP (UDP:5683)
          </p>
        </div>
        <div className="flex items-center space-x-2 text-[10px] font-mono text-[#71717A]">
          <span className="px-2 py-0.5 rounded bg-[#18181B] border border-[#27272A]">
            INGESTION: COAP UDP
          </span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
            NODES: 5/5 ONLINE
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {zones.map((zone, idx) => {
          const Icon = getZoneIcon(zone.zone_id);
          const zoneLoads = loads.filter((l) => l.zone_id === zone.zone_id);
          const occPct = Math.round((zone.occupancy / zone.max_occupancy) * 100);

          return (
            <SciFiCard
              key={zone.zone_id}
              accent={zone.sensor_health === 'HEALTHY' ? 'emerald' : 'rose'}
              dotDuration={`${6 + idx * 1.5}s`}
              innerClassName="p-4 space-y-3"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="h-8 w-8 rounded bg-[#18181B] border border-[#27272A] flex items-center justify-center text-emerald-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#FAFAFA]">{zone.name}</div>
                    <div className="text-[10px] text-[#71717A] font-mono">
                      NODE-ESP32-0{idx + 1} &bull; {zone.zone_id}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-[#18181B] border border-[#27272A] text-[10px] font-mono">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      zone.sensor_health === 'HEALTHY'
                        ? 'bg-emerald-400'
                        : zone.sensor_health === 'DEGRADED'
                        ? 'bg-amber-400'
                        : 'bg-rose-400 animate-ping'
                    }`}
                  />
                  <span className={zone.sensor_health === 'HEALTHY' ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                    {zone.sensor_health}
                  </span>
                </div>
              </div>

              {/* Power Banner with Sci-Fi Gradient */}
              <div className="bg-[#121215]/80 border border-[#27272A] rounded p-2.5 flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-[#71717A] text-[11px] font-mono">
                  <Zap className="h-3.5 w-3.5 text-emerald-400" />
                  <span>ACTIVE DEMAND</span>
                </div>
                <div className="text-xl font-mono font-bold tabular-nums text-transparent bg-clip-text bg-[linear-gradient(45deg,#fff,#10b981)]">
                  {zone.power_kw.toFixed(2)} <span className="text-[11px] font-normal text-[#71717A]">kW</span>
                </div>
              </div>

              {/* Sensor Readouts Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                {/* Occupancy */}
                <div className="bg-[#121215]/80 border border-[#27272A] rounded p-2 space-y-1">
                  <div className="flex items-center justify-between text-[#71717A] text-[10px]">
                    <span className="flex items-center space-x-1">
                      <Users className="h-3 w-3 text-cyan-400" />
                      <span>OCCUPANCY</span>
                    </span>
                    <span className="tabular-nums text-[#FAFAFA] font-semibold">{occPct}%</span>
                  </div>
                  <div className="text-xs font-bold tabular-nums text-[#FAFAFA]">
                    {zone.occupancy} <span className="text-[10px] text-[#71717A] font-normal">/ {zone.max_occupancy} MAX</span>
                  </div>
                  <div className="w-full bg-[#18181B] h-1 rounded-full overflow-hidden border border-[#27272A]">
                    <div className="bg-cyan-500 h-full rounded-full transition-all" style={{ width: `${Math.min(100, occPct)}%` }} />
                  </div>
                </div>

                {/* Temperature */}
                <div className="bg-[#121215]/80 border border-[#27272A] rounded p-2 space-y-1">
                  <div className="flex items-center justify-between text-[#71717A] text-[10px]">
                    <span className="flex items-center space-x-1">
                      <Thermometer className="h-3 w-3 text-amber-400" />
                      <span>TEMPERATURE</span>
                    </span>
                  </div>
                  <div className="text-xs font-bold tabular-nums text-[#FAFAFA]">
                    {zone.temperature_c.toFixed(1)} <span className="text-[10px] text-[#71717A] font-normal">°C</span>
                  </div>
                  <div className="text-[9px] text-[#71717A] tabular-nums">SETPOINT: 22.0 °C</div>
                </div>

                {/* Voltage & Current */}
                <div className="bg-[#121215]/80 border border-[#27272A] rounded p-2 space-y-1">
                  <div className="flex items-center justify-between text-[#71717A] text-[10px]">
                    <span className="flex items-center space-x-1">
                      <Gauge className="h-3 w-3 text-indigo-400" />
                      <span>GRID BUS</span>
                    </span>
                  </div>
                  <div className="text-xs font-bold tabular-nums text-[#FAFAFA]">
                    {zone.voltage_v.toFixed(0)}V <span className="text-[10px] text-[#71717A] font-normal">/ {zone.current_a.toFixed(1)}A</span>
                  </div>
                  <div className="text-[9px] text-[#71717A]">PF: 0.95 NOMINAL</div>
                </div>

                {/* HVAC & Lighting */}
                <div className="bg-[#121215]/80 border border-[#27272A] rounded p-2 space-y-1">
                  <div className="flex items-center justify-between text-[#71717A] text-[10px]">
                    <span className="flex items-center space-x-1">
                      <Sun className="h-3 w-3 text-yellow-400" />
                      <span>LIGHT & HVAC</span>
                    </span>
                  </div>
                  <div className="text-[10px] font-semibold text-[#FAFAFA] flex items-center justify-between tabular-nums">
                    <span>L: {Math.round(zone.lighting_state * 100)}%</span>
                    <span>H: {Math.round(zone.hvac_state * 100)}%</span>
                  </div>
                  <div className="text-[9px] text-[#71717A]">ACTUATION: MQTT</div>
                </div>
              </div>

              {/* Connected Loads Section */}
              <div className="border-t border-[#27272A] pt-2.5 space-y-1.5 font-mono">
                <div className="text-[10px] uppercase tracking-wider text-[#71717A]">CONNECTED ELECTRICAL LOADS:</div>
                <div className="space-y-1">
                  {zoneLoads.map((load) => (
                    <div
                      key={load.id}
                      className="flex items-center justify-between text-[11px] bg-[#121215]/80 px-2 py-1 rounded border border-[#27272A]"
                    >
                      <div className="flex items-center space-x-1.5 truncate">
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                            load.category === 'CRITICAL'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : load.category === 'FLEXIBLE'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          }`}
                        >
                          {load.category}
                        </span>
                        <span className="text-[#A1A1AA] truncate">{load.name}</span>
                      </div>
                      <div className="text-[#FAFAFA] font-medium tabular-nums pl-2">
                        {load.current_power_kw.toFixed(2)} kW
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SciFiCard>
          );
        })}
      </div>
    </div>
  );
};
