import React, { useState, useEffect } from 'react';
import type { CustomNode } from '../store/store';
import { useStore } from '../store/store';

interface MetadataEventViewerProps {
  selectedNode: CustomNode;
}

export type MetadataFormat = 'JSON' | 'CEF' | 'IPFIX';

interface EventRecord {
  id: string;
  timestamp: string;
  type: 'HTTP' | 'DNS' | 'TLS' | 'DB' | 'SIP';
  jsonDoc: Record<string, any>;
  cefStr: string;
  ipfixStr: string;
}

const SAMPLE_TEMPLATES = [
  {
    type: 'HTTP' as const,
    app: 'Salesforce API',
    uri: '/api/v2/deals/update',
    method: 'POST',
    status: 200,
    domain: 'api.salesforce.com',
    bytes: 14200,
    latency: 14.2
  },
  {
    type: 'DNS' as const,
    app: 'DNS Protocol',
    uri: 'auth.company.internal',
    method: 'QUERY',
    status: 'NOERROR',
    domain: 'dns.internal',
    bytes: 140,
    latency: 2.1
  },
  {
    type: 'TLS' as const,
    app: 'HTTPS / TLS 1.3',
    uri: 'auth.salesforce.com:443',
    method: 'HANDSHAKE',
    status: 'ESTABLISHED',
    domain: 'auth.salesforce.com',
    bytes: 3400,
    latency: 22.8
  },
  {
    type: 'DB' as const,
    app: 'PostgreSQL Service',
    uri: 'SELECT * FROM customer_accounts WHERE id=?',
    method: 'SELECT',
    status: 200,
    domain: 'db-prod-01.internal',
    bytes: 840,
    latency: 3.5
  },
  {
    type: 'SIP' as const,
    app: 'VoIP Signalling',
    uri: 'sip:user102@voip.company.com',
    method: 'INVITE',
    status: 100,
    domain: 'voip.company.com',
    bytes: 620,
    latency: 8.9
  }
];

export const MetadataEventViewer: React.FC<MetadataEventViewerProps> = ({ selectedNode }) => {
  const isRunning = useStore(state => state.isRunning);
  const updateNodeData = useStore(state => state.updateNodeData);

  const format = (selectedNode.data?.metadataFormat as MetadataFormat) || 'JSON';
  const [activeFormat, setActiveFormat] = useState<MetadataFormat>(format);
  const [events, setEvents] = useState<EventRecord[]>([]);

  // Update format in store when changed locally
  const handleFormatChange = (newFormat: MetadataFormat) => {
    setActiveFormat(newFormat);
    updateNodeData(selectedNode.id, { metadataFormat: newFormat });
  };

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      const tmpl = SAMPLE_TEMPLATES[Math.floor(Math.random() * SAMPLE_TEMPLATES.length)];
      const now = new Date();
      const timeISO = now.toISOString();
      const randomSubnet = Math.floor(Math.random() * 254) + 1;
      const srcIp = `192.168.${randomSubnet}.${Math.floor(Math.random() * 200) + 10}`;
      const dstIp = `10.0.${randomSubnet}.${Math.floor(Math.random() * 100) + 5}`;
      const srcPort = Math.floor(Math.random() * 40000) + 1024;

      const newJson = {
        event_type: `${tmpl.type}_EVENT`,
        timestamp: timeISO,
        application: tmpl.app,
        src_ip: srcIp,
        src_port: srcPort,
        dst_ip: dstIp,
        dst_port: tmpl.type === 'HTTP' || tmpl.type === 'TLS' ? 443 : tmpl.type === 'DNS' ? 53 : tmpl.type === 'DB' ? 5432 : 5060,
        uri_query: tmpl.uri,
        http_method: tmpl.method,
        response_code: tmpl.status,
        latency_ms: tmpl.latency,
        bytes_sent: tmpl.bytes,
        format_version: 'GigaSMART AMI v6.4'
      };

      const newCef = `CEF:0|Gigamon|GigaSMART_AMI|6.4|${tmpl.type}_EVENT|${tmpl.app}|3|src=${srcIp} spt=${srcPort} dst=${dstIp} dpt=${newJson.dst_port} request=${tmpl.uri} cs1=${tmpl.method} outcome=${tmpl.status} duration=${tmpl.latency}`;

      const newIpfix = `IPFIX-REC | FlowID: ${Math.floor(Math.random() * 900000) + 100000} | Src: ${srcIp}:${srcPort} -> Dst: ${dstIp}:${newJson.dst_port} | App: ${tmpl.app} | Octets: ${tmpl.bytes} | Pkts: ${Math.floor(tmpl.bytes / 1400) + 1}`;

      const record: EventRecord = {
        id: Math.random().toString(36).slice(2),
        timestamp: now.toLocaleTimeString(),
        type: tmpl.type,
        jsonDoc: newJson,
        cefStr: newCef,
        ipfixStr: newIpfix
      };

      setEvents(prev => [record, ...prev.slice(0, 7)]);
    }, 1200);

    return () => clearInterval(interval);
  }, [isRunning]);

  return (
    <div className="panel-section flex-col gap-3 bg-[#161b22] p-3 rounded-lg border border-[#30363d] mt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold text-sm flex items-center gap-1">
            📄 Application Event Documents
          </span>
          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
            AMI Extracted
          </span>
        </div>

        {/* Format Selector Pills */}
        <div className="flex gap-1 bg-[#0d1117] p-1 rounded-md border border-[#30363d]">
          {(['JSON', 'CEF', 'IPFIX'] as MetadataFormat[]).map(fmt => (
            <button
              key={fmt}
              onClick={() => handleFormatChange(fmt)}
              className={`px-2 py-0.5 text-xs rounded font-semibold transition-colors ${
                activeFormat === fmt
                  ? 'bg-[#ff9800] text-black shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {fmt}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-gray-400 leading-normal">
        Rather than forwarding raw binary packet streams (10 Gbps), GigaSMART extracts key-value <strong>{activeFormat}</strong> event documents (e.g. HTTP, DNS, TLS) for SIEMs and cloud storage tools.
      </div>

      {/* Bandwidth Savings Banner */}
      <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-500/30 rounded p-2 text-xs">
        <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
          <span className="text-sm">⚡</span>
          <span>95.2% Bandwidth Reduction</span>
        </div>
        <div className="text-gray-300 font-mono text-[11px]">
          ~1,420 events/sec (45 Mbps vs 10 Gbps Raw)
        </div>
      </div>

      {/* Live Stream Terminal Log */}
      <div className="bg-[#090d12] border border-[#21262d] rounded-md p-2 font-mono text-[11px] max-h-56 overflow-y-auto flex-col gap-2">
        {events.length === 0 ? (
          <div className="text-gray-500 italic text-center py-4">
            {isRunning ? 'Listening for network event records...' : 'Start simulation (▶) to stream live metadata event documents.'}
          </div>
        ) : (
          events.map((evt) => (
            <div key={evt.id} className="p-1.5 rounded bg-[#161b22]/70 border border-[#30363d]/50 text-gray-200">
              <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                <span className="text-amber-400 font-bold">[{evt.timestamp}] {evt.type} Event Record</span>
                <span className="text-gray-500 font-mono">{activeFormat}</span>
              </div>

              {activeFormat === 'JSON' && (
                <pre className="text-cyan-300 text-[10px] overflow-x-auto m-0 p-0 leading-tight">
                  {JSON.stringify(evt.jsonDoc, null, 2)}
                </pre>
              )}

              {activeFormat === 'CEF' && (
                <div className="text-amber-300 text-[10px] break-all leading-tight">
                  {evt.cefStr}
                </div>
              )}

              {activeFormat === 'IPFIX' && (
                <div className="text-blue-300 text-[10px] break-all leading-tight">
                  {evt.ipfixStr}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
