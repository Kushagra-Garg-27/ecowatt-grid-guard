import React, { useState, useEffect } from 'react';
import {
  Radio,
  Wifi,
  RefreshCw,
  Terminal,
  ChevronRight,
} from 'lucide-react';
import { fetchIoTMonitor } from '../services/api';
import { SciFiCard } from '@/components/ui/moving-dot-card';

export const IoTCommunicationMonitor: React.FC = () => {
  const [monitorData, setMonitorData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'coap' | 'mqtt' | 'events'>('coap');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchIoTMonitor();
      setMonitorData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 4000);
    return () => clearInterval(timer);
  }, []);

  const coapPackets = monitorData?.coap_telemetry_history || [];
  const mqttMessages = monitorData?.mqtt_messages || [];
  const optEvents = monitorData?.optimization_events || [];
  const heartbeats = monitorData?.sensor_heartbeats || {};

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-2 border-b border-[#27272A] gap-2">
        <div>
          <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[#FAFAFA]">
            IOT HARDWARE PROTOCOL & PACKET INSPECTOR
          </h2>
          <p className="text-[11px] font-mono text-[#71717A] mt-0.5">
            Streaming packet inspection for CoAP (UDP:5683) and MQTT (TCP:1883 QoS 1)
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="bg-[#18181B] hover:bg-[#27272A] text-[#FAFAFA] text-[11px] font-mono px-3 py-1.5 rounded border border-[#27272A] flex items-center space-x-1.5 transition cursor-pointer"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          <span>POLL BUS</span>
        </button>
      </div>

      {/* Protocol Architecture Cards (Moving Dot Sci-Fi Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* CoAP UDP Card */}
        <SciFiCard accent="emerald" dotDuration="7s" innerClassName="p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-1 rounded bg-[#18181B] text-emerald-400 border border-[#27272A]">
                <Wifi className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-mono font-semibold text-[#FAFAFA]">COAP SERVER (UDP:5683)</h3>
                <p className="text-[10px] font-mono text-[#71717A]">Constrained Application Protocol Edge Gateway</p>
              </div>
            </div>
            <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 font-semibold px-2 py-0.5 rounded border border-emerald-500/20">
              UDP LISTENING
            </span>
          </div>
          <div className="text-[10px] text-[#A1A1AA] space-y-0.5 bg-[#121215]/80 p-2.5 rounded border border-[#27272A] font-mono">
            <div>&bull; /telemetry/power &rarr; 2.04 CHANGED (active demand kW)</div>
            <div>&bull; /telemetry/occupancy &rarr; 2.04 CHANGED (zone headcount)</div>
            <div>&bull; /telemetry/environment &rarr; 2.04 CHANGED (PZEM voltage/temp)</div>
            <div>&bull; /telemetry/status &rarr; 2.04 CHANGED (health telemetry)</div>
          </div>
        </SciFiCard>

        {/* MQTT Broker Card */}
        <SciFiCard accent="cyan" dotDuration="8s" innerClassName="p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-1 rounded bg-[#18181B] text-cyan-400 border border-[#27272A]">
                <Radio className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-mono font-semibold text-[#FAFAFA]">MQTT BROKER (TCP:1883)</h3>
                <p className="text-[10px] font-mono text-[#71717A]">Embedded Asyncio Broker &bull; QoS 1 Actuation</p>
              </div>
            </div>
            <span className="text-[10px] font-mono bg-cyan-500/10 text-cyan-400 font-semibold px-2 py-0.5 rounded border border-cyan-500/20">
              QOS 1 CONNECTED
            </span>
          </div>
          <div className="text-[10px] text-[#A1A1AA] space-y-0.5 bg-[#121215]/80 p-2.5 rounded border border-[#27272A] font-mono">
            <div>&bull; ecowatt/building/demand (Live power telemetry)</div>
            <div>&bull; ecowatt/load/{'{id}'}/command (Actuator dispatch)</div>
            <div>&bull; ecowatt/load/{'{id}'}/ack (Hardware feedback ack)</div>
            <div>&bull; ecowatt/optimization/events (Mitigation events)</div>
          </div>
        </SciFiCard>
      </div>

      {/* Sensor Node Heartbeats (5 Server Node Chips) */}
      <SciFiCard accent="emerald" dotDuration="11s" innerClassName="p-3 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[#71717A]">
          <span>EDGE SENSOR NODES HEARTBEAT REGISTER</span>
          <span className="text-emerald-400">SYNC INTERVAL: 3000ms</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {Object.entries(heartbeats).map(([sid, ts]: [string, any], i) => (
            <div key={sid} className="bg-[#121215]/80 p-2 rounded border border-[#27272A] text-xs font-mono">
              <div className="flex items-center space-x-1.5 text-[#FAFAFA] font-medium text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="truncate">NODE-ESP32-0{i + 1}</span>
              </div>
              <div className="text-[10px] text-[#71717A] mt-1 tabular-nums truncate">
                {new Date(ts).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </SciFiCard>

      {/* Streaming Packet Inspector (SciFiCard Terminal) */}
      <SciFiCard accent="cyan" dotDuration="14s" innerClassName="overflow-hidden">
        {/* Terminal Title Bar */}
        <div className="h-9 px-3.5 bg-[#121215] border-b border-[#27272A] flex items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-2">
            <Terminal className="h-3.5 w-3.5 text-[#71717A]" />
            <span className="text-[11px] font-semibold text-[#FAFAFA]">
              PACKET_INSPECTOR // BUFFER
            </span>
          </div>

          {/* Subtabs */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('coap')}
              className={`text-[10px] font-mono px-2 py-0.5 rounded transition cursor-pointer ${
                activeTab === 'coap'
                  ? 'bg-[#18181B] text-[#FAFAFA] border border-[#27272A]'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              COAP ({coapPackets.length})
            </button>
            <button
              onClick={() => setActiveTab('mqtt')}
              className={`text-[10px] font-mono px-2 py-0.5 rounded transition cursor-pointer ${
                activeTab === 'mqtt'
                  ? 'bg-[#18181B] text-[#FAFAFA] border border-[#27272A]'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              MQTT ({mqttMessages.length})
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`text-[10px] font-mono px-2 py-0.5 rounded transition cursor-pointer ${
                activeTab === 'events'
                  ? 'bg-[#18181B] text-[#FAFAFA] border border-[#27272A]'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              EVENTS ({optEvents.length})
            </button>
          </div>
        </div>

        {/* Column Headers */}
        <div className="h-7 px-3 bg-[#0F0F12] border-b border-[#27272A] grid grid-cols-12 gap-2 text-[10px] font-mono uppercase tracking-wider text-[#71717A] items-center">
          <div className="col-span-2">TIMESTAMP</div>
          <div className="col-span-2">TYPE / QOS</div>
          <div className="col-span-4">TOPIC / ENDPOINT</div>
          <div className="col-span-3">PAYLOAD / DATA</div>
          <div className="col-span-1 text-right">STATUS</div>
        </div>

        {/* Content Stream Rows */}
        <div className="max-h-96 overflow-y-auto font-mono text-xs divide-y divide-[#27272A]/60">
          {activeTab === 'coap' &&
            coapPackets.slice().reverse().map((pkt: any, i: number) => {
              const isExpanded = expandedRow === i;
              return (
                <div
                  key={i}
                  className="hover:bg-[#18181B] transition p-2.5 px-3 grid grid-cols-12 gap-2 items-center cursor-pointer"
                  onClick={() => setExpandedRow(isExpanded ? null : i)}
                >
                  <div className="col-span-2 text-[#71717A] tabular-nums text-[11px]">
                    {new Date(pkt.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="col-span-2">
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                      COAP POST
                    </span>
                  </div>
                  <div className="col-span-4 text-[#FAFAFA] font-medium truncate">
                    {pkt.endpoint}
                  </div>
                  <div className="col-span-3 text-[#A1A1AA] truncate font-mono text-[11px]">
                    {typeof pkt.payload === 'object'
                      ? JSON.stringify(pkt.payload)
                      : String(pkt.payload)}
                  </div>
                  <div className="col-span-1 text-right font-bold text-emerald-400 text-[11px]">
                    2.04 ACK
                  </div>
                  {isExpanded && (
                    <div className="col-span-12 mt-2 p-2 bg-[#09090B] rounded border border-[#27272A] text-[11px] text-[#A1A1AA] overflow-x-auto">
                      <pre>{JSON.stringify(pkt, null, 2)}</pre>
                    </div>
                  )}
                </div>
              );
            })}

          {activeTab === 'mqtt' &&
            mqttMessages.slice().reverse().map((msg: any, i: number) => (
              <div
                key={i}
                className="hover:bg-[#18181B] transition p-2.5 px-3 grid grid-cols-12 gap-2 items-center"
              >
                <div className="col-span-2 text-[#71717A] tabular-nums text-[11px]">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
                <div className="col-span-2">
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
                    QOS 1
                  </span>
                </div>
                <div className="col-span-4 text-[#FAFAFA] font-medium truncate">
                  {msg.topic}
                </div>
                <div className="col-span-3 text-[#A1A1AA] truncate font-mono text-[11px]">
                  {typeof msg.payload === 'object'
                    ? JSON.stringify(msg.payload)
                    : String(msg.payload)}
                </div>
                <div className="col-span-1 text-right font-bold text-cyan-400 text-[11px]">
                  DELIVERED
                </div>
              </div>
            ))}

          {activeTab === 'events' &&
            optEvents.slice().reverse().map((ev: any, i: number) => (
              <div
                key={i}
                className="hover:bg-[#18181B] transition p-2.5 px-3 grid grid-cols-12 gap-2 items-center"
              >
                <div className="col-span-2 text-[#71717A] tabular-nums text-[11px]">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </div>
                <div className="col-span-2">
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                    EVENT
                  </span>
                </div>
                <div className="col-span-4 text-[#FAFAFA] font-medium truncate">
                  {ev.action}
                </div>
                <div className="col-span-3 text-[#A1A1AA] truncate font-mono text-[11px]">
                  {ev.details || JSON.stringify(ev)}
                </div>
                <div className="col-span-1 text-right font-bold text-amber-400 text-[11px]">
                  LOGGED
                </div>
              </div>
            ))}
        </div>
      </SciFiCard>
    </div>
  );
};
