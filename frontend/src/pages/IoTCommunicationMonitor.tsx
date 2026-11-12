import React, { useState, useEffect } from 'react';
import {
  Radio,
  Wifi,
  Server,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { fetchIoTMonitor } from '../services/api';

export const IoTCommunicationMonitor: React.FC = () => {
  const [monitorData, setMonitorData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'coap' | 'mqtt' | 'events'>('coap');
  const [isLoading, setIsLoading] = useState(false);

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">IoT Protocol & Communication Monitor</h2>
          <p className="text-xs text-slate-400">
            Real-time packet inspection for CoAP (UDP:5683) and Mosquitto MQTT (TCP:1883)
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-xl border border-slate-700 flex items-center space-x-1.5 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Feeds</span>
        </button>
      </div>

      {/* Protocol Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CoAP UDP Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                <Wifi className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">CoAP Server (UDP:5683)</h3>
                <p className="text-[11px] text-slate-400">Constrained Application Protocol over UDP</p>
              </div>
            </div>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20">
              LISTENING
            </span>
          </div>
          <div className="text-xs text-slate-400 space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px]">
            <div>&bull; /telemetry/power &rarr; 2.04 CHANGED (active power kW)</div>
            <div>&bull; /telemetry/occupancy &rarr; 2.04 CHANGED (zone headcount)</div>
            <div>&bull; /telemetry/environment &rarr; 2.04 CHANGED (temp, lux)</div>
            <div>&bull; /telemetry/status &rarr; 2.04 CHANGED (node health)</div>
          </div>
        </div>

        {/* Mosquitto MQTT Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
                <Radio className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">MQTT Broker (TCP:1883)</h3>
                <p className="text-[11px] text-slate-400">Paho MQTT & Eclipse Mosquitto compatible</p>
              </div>
            </div>
            <span className="text-[10px] bg-cyan-500/10 text-cyan-400 font-semibold px-2 py-0.5 rounded-full border border-cyan-500/20">
              CONNECTED QoS 1
            </span>
          </div>
          <div className="text-xs text-slate-400 space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px]">
            <div>&bull; ecowatt/building/demand (Live status)</div>
            <div>&bull; ecowatt/load/{'{id}'}/command (Dispatches)</div>
            <div>&bull; ecowatt/load/{'{id}'}/ack (Actuator acks)</div>
            <div>&bull; ecowatt/optimization/events (Mitigation events)</div>
          </div>
        </div>
      </div>

      {/* Sensor Heartbeats */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Virtual Sensor Nodes Heartbeats
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {Object.entries(heartbeats).map(([sid, ts]: [string, any]) => (
            <div key={sid} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-xs">
              <div className="flex items-center space-x-1.5 text-slate-200 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="truncate">{sid}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1 truncate">
                {new Date(ts).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Packet Stream Viewer */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        {/* Subtabs */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('coap')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
              activeTab === 'coap' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            CoAP Telemetry Ingestion ({coapPackets.length})
          </button>
          <button
            onClick={() => setActiveTab('mqtt')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
              activeTab === 'mqtt' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            MQTT Broker Messages ({mqttMessages.length})
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
              activeTab === 'events' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Optimization Events ({optEvents.length})
          </button>
        </div>

        {/* Content Stream */}
        <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-xs pr-1">
          {activeTab === 'coap' &&
            coapPackets.slice().reverse().map((pkt: any, i: number) => (
              <div key={i} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">
                      COAP POST
                    </span>
                    <span className="text-slate-300 font-semibold">{pkt.type}</span>
                    <span className="text-slate-500 text-[10px]">
                      {new Date(pkt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="text-[11px] text-slate-400 mt-1 whitespace-pre-wrap">
                    {JSON.stringify(pkt.payload, null, 2)}
                  </pre>
                </div>
              </div>
            ))}

          {activeTab === 'mqtt' &&
            mqttMessages.slice().reverse().map((msg: any, i: number) => (
              <div key={i} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-bold">
                      MQTT PUB (QoS {msg.qos})
                    </span>
                    <span className="text-slate-300 font-semibold text-[11px]">{msg.topic}</span>
                  </div>
                  <span className="text-slate-500 text-[10px]">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <pre className="text-[11px] text-slate-400 whitespace-pre-wrap">
                  {JSON.stringify(msg.payload, null, 2)}
                </pre>
              </div>
            ))}

          {activeTab === 'events' &&
            optEvents.slice().reverse().map((evt: any, i: number) => (
              <div key={i} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-xs">{evt.event_id}</span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300">
                  Initial Demand: {evt.initial_demand_kw?.toFixed(2)} kW &rarr; Reduced: {evt.actual_reduction_kw?.toFixed(2)} kW (Target {evt.target_kw?.toFixed(2)} kW)
                </div>
                <div className="text-[11px] text-slate-400">
                  Status: <span className="text-emerald-400 font-semibold">{evt.status}</span> | Iterations: {evt.iterations_run}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

