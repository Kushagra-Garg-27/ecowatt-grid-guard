import React from 'react';
import {
  Users,
  Zap,
  Gauge,
  Thermometer,
  Sun,
  Wind,
  Radio,
  CheckCircle2,
  AlertCircle,
  Server,
  BookOpen,
  Monitor,
  Briefcase,
  Compass,
} from 'lucide-react';
import { ZoneSummary, LoadItem } from '../types';

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
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">Building Zones & Telemetry Nodes</h2>
        <p className="text-xs text-slate-400">
          Real-time sensor telemetry ingested from 5 virtual IoT nodes over CoAP (UDP:5683)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        {zones.map((zone) => {
          const Icon = getZoneIcon(zone.zone_id);
          const zoneLoads = loads.filter((l) => l.zone_id === zone.zone_id);
          const occPct = Math.round((zone.occupancy / zone.max_occupancy) * 100);

          return (
            <div
              key={zone.zone_id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition space-y-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{zone.name}</h3>
                    <p className="text-[11px] text-slate-400 font-mono">ID: {zone.zone_id}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      zone.sensor_health === 'HEALTHY'
                        ? 'bg-emerald-400'
                        : zone.sensor_health === 'DEGRADED'
                        ? 'bg-amber-400'
                        : 'bg-rose-400 animate-ping'
                    }`}
                  />
                  <span className="text-[11px] text-slate-300 font-medium">{zone.sensor_health}</span>
                </div>
              </div>

              {/* Power Banner */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-400 text-xs">
                  <Zap className="h-4 w-4 text-emerald-400" />
                  <span>Subsystem Power</span>
                </div>
                <div className="text-lg font-bold text-white">
                  {zone.power_kw.toFixed(2)} <span className="text-xs font-normal text-slate-400">kW</span>
                </div>
              </div>

              {/* Sensor Readouts Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Occupancy */}
                <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-2.5">
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span className="flex items-center space-x-1">
                      <Users className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Occupancy</span>
                    </span>
                    <span className="font-semibold text-slate-200">{occPct}%</span>
                  </div>
                  <div className="mt-1 text-sm font-bold text-white">
                    {zone.occupancy} <span className="text-[10px] text-slate-400 font-normal">/ {zone.max_occupancy} max</span>
                  </div>
                  <div className="w-full bg-slate-700 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-cyan-500 h-full rounded-full transition-all" style={{ width: `${Math.min(100, occPct)}%` }} />
                  </div>
                </div>

                {/* Temperature */}
                <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-2.5">
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span className="flex items-center space-x-1">
                      <Thermometer className="h-3.5 w-3.5 text-amber-400" />
                      <span>Temperature</span>
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-bold text-white">
                    {zone.temperature_c.toFixed(1)} <span className="text-[10px] text-slate-400 font-normal">°C</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">Setpoint 22.0 °C</div>
                </div>

                {/* Voltage & Current */}
                <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-2.5">
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span className="flex items-center space-x-1">
                      <Gauge className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Grid Bus</span>
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-bold text-white">
                    {zone.voltage_v.toFixed(0)}V <span className="text-[10px] text-slate-400 font-normal">/ {zone.current_a.toFixed(1)}A</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">pf: 0.95</div>
                </div>

                {/* HVAC & Lighting */}
                <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-2.5">
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span className="flex items-center space-x-1">
                      <Sun className="h-3.5 w-3.5 text-yellow-400" />
                      <span>Light & HVAC</span>
                    </span>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-white flex items-center justify-between">
                    <span>Light: {Math.round(zone.lighting_state * 100)}%</span>
                    <span>HVAC: {Math.round(zone.hvac_state * 100)}%</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">CoAP UDP 5683</div>
                </div>
              </div>

              {/* Connected Loads Section */}
              <div className="border-t border-slate-800/80 pt-3">
                <div className="text-[11px] font-semibold text-slate-400 mb-2">Connected Electrical Loads:</div>
                <div className="space-y-1.5">
                  {zoneLoads.map((load) => (
                    <div
                      key={load.id}
                      className="flex items-center justify-between text-xs bg-slate-950/40 px-2.5 py-1.5 rounded-lg border border-slate-800/50"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            load.category === 'CRITICAL'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : load.category === 'FLEXIBLE'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          }`}
                        >
                          {load.category}
                        </span>
                        <span className="text-slate-300 truncate">{load.name}</span>
                      </div>
                      <div className="font-mono text-slate-200 text-xs pl-2 font-medium">
                        {load.current_power_kw.toFixed(2)} kW
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

