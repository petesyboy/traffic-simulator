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
  type: 'HTTP' | 'DNS' | 'TLS' | 'DB' | 'SIP' | 'SSH' | 'C2' | 'EXFIL';
  jsonDoc: Record<string, any>;
  cefStr: string;
  ipfixStr: string;
  isThreat?: boolean;
  severity?: 'critical' | 'high';
  threatLabel?: string;
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

// Security-relevant events, mixed in at a lower rate and flagged/highlighted
// differently from ordinary application traffic (see isThreat below).
const THREAT_TEMPLATES = [
  {
    type: 'SSH' as const,
    app: 'SSH Remote Login',
    uri: 'root@203.0.113.44 (Unrecognised Geo: RU)',
    method: 'LOGIN',
    status: 'AUTH_SUCCESS',
    domain: 'external-untrusted',
    bytes: 2100,
    latency: 180,
    severity: 'critical' as const,
    threatLabel: 'Suspicious SSH Login — Root, Unrecognised Geo'
  },
  {
    type: 'SSH' as const,
    app: 'SSH Brute Force',
    uri: 'admin@203.0.113.44 (x14 attempts / 30s)',
    method: 'LOGIN',
    status: 'AUTH_FAILED',
    domain: 'external-untrusted',
    bytes: 340,
    latency: 40,
    severity: 'high' as const,
    threatLabel: 'SSH Brute-Force Attempt Detected'
  },
  {
    type: 'C2' as const,
    app: 'Suspected C2 Beacon',
    uri: 'beacon.evil-domain.net/checkin',
    method: 'POST',
    status: 200,
    domain: 'beacon.evil-domain.net',
    bytes: 512,
    latency: 90,
    severity: 'critical' as const,
    threatLabel: 'Possible C2 Beacon — Periodic Callback Pattern'
  },
  {
    type: 'EXFIL' as const,
    app: 'Unusual Data Transfer',
    uri: '/backup/customer_records.zip',
    method: 'PUT',
    status: 200,
    domain: 'unknown-external-host',
    bytes: 480000000,
    latency: 3200,
    severity: 'high' as const,
    threatLabel: 'Large Outbound Transfer — Possible Data Exfiltration'
  }
];

// Fraction of generated events drawn from THREAT_TEMPLATES instead of normal traffic.
const THREAT_RATE = 0.2;

export const MetadataEventViewer: React.FC<MetadataEventViewerProps> = ({ selectedNode }) => {
  const isRunning = useStore(state => state.isRunning);
  const updateNodeData = useStore(state => state.updateNodeData);

  const format = (selectedNode.data?.metadataFormat as MetadataFormat) || 'JSON';
  const [activeFormat, setActiveFormat] = useState<MetadataFormat>(format);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [isHoveringLog, setIsHoveringLog] = useState(false);

  const handleFormatChange = (newFormat: MetadataFormat) => {
    setActiveFormat(newFormat);
    updateNodeData(selectedNode.id, { metadataFormat: newFormat });
  };

  // Compact single-line summary for each event
  const formatOneLiner = (evt: EventRecord): string => {
    const prefix = evt.isThreat ? `🚨 ${evt.threatLabel} — ` : '';
    if (activeFormat === 'JSON') {
      return `${prefix}{"${evt.type}","${evt.jsonDoc.application}","${evt.jsonDoc.src_ip}→${evt.jsonDoc.dst_ip}:${evt.jsonDoc.dst_port}","${evt.jsonDoc.uri_query}",${evt.jsonDoc.response_code},${evt.jsonDoc.latency_ms}ms}`;
    }
    if (activeFormat === 'CEF') {
      return `${prefix}CEF:0|Gigamon|AMI|${evt.type}|src=${evt.jsonDoc.src_ip} dst=${evt.jsonDoc.dst_ip} req=${evt.jsonDoc.uri_query} rc=${evt.jsonDoc.response_code}`;
    }
    return `${prefix}IPFIX|${evt.jsonDoc.src_ip}:${evt.jsonDoc.src_port}→${evt.jsonDoc.dst_ip}:${evt.jsonDoc.dst_port}|${evt.jsonDoc.application}|${evt.jsonDoc.bytes_sent}B`;
  };

  const fmtColor = activeFormat === 'JSON' ? 'text-cyan-300' : activeFormat === 'CEF' ? 'text-amber-300' : 'text-blue-300';

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      const isThreat = Math.random() < THREAT_RATE;
      const pool = isThreat ? THREAT_TEMPLATES : SAMPLE_TEMPLATES;
      const tmpl = pool[Math.floor(Math.random() * pool.length)];
      const now = new Date();
      const sub = Math.floor(Math.random() * 254) + 1;
      const srcIp = isThreat ? (tmpl as typeof THREAT_TEMPLATES[number]).uri.match(/[\d.]+/)?.[0] || `203.0.113.${Math.floor(Math.random() * 254) + 1}` : `192.168.${sub}.${Math.floor(Math.random() * 200) + 10}`;
      const dstIp = `10.0.${sub}.${Math.floor(Math.random() * 100) + 5}`;
      const srcPort = Math.floor(Math.random() * 40000) + 1024;
      const dstPort = tmpl.type === 'HTTP' || tmpl.type === 'TLS' || tmpl.type === 'C2' || tmpl.type === 'EXFIL' ? 443 : tmpl.type === 'DNS' ? 53 : tmpl.type === 'DB' ? 5432 : tmpl.type === 'SSH' ? 22 : 5060;
      const severity = isThreat ? (tmpl as typeof THREAT_TEMPLATES[number]).severity : undefined;
      const cefSeverity = severity === 'critical' ? 10 : severity === 'high' ? 8 : 3;
      setEvents(prev => [{
        id: Math.random().toString(36).slice(2),
        timestamp: now.toLocaleTimeString(),
        type: tmpl.type,
        jsonDoc: { event_type: `${tmpl.type}_EVENT`, application: tmpl.app, src_ip: srcIp, src_port: srcPort, dst_ip: dstIp, dst_port: dstPort, uri_query: tmpl.uri, http_method: tmpl.method, response_code: tmpl.status, latency_ms: tmpl.latency, bytes_sent: tmpl.bytes },
        cefStr: `CEF:0|Gigamon|AMI|6.4|${tmpl.type}|${tmpl.app}|${cefSeverity}|src=${srcIp} dst=${dstIp} request=${tmpl.uri} outcome=${tmpl.status}`,
        ipfixStr: `IPFIX|${srcIp}:${srcPort}→${dstIp}:${dstPort}|${tmpl.app}|${tmpl.bytes}B`,
        isThreat,
        severity,
        threatLabel: isThreat ? (tmpl as typeof THREAT_TEMPLATES[number]).threatLabel : undefined
      }, ...prev.slice(0, 8)]);
    }, 350);
    return () => clearInterval(interval);
  }, [isRunning]);

  return (
    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '6px', padding: '6px 8px', marginTop: '8px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ color: '#ff9800', fontWeight: 700, fontSize: '11px' }}>📄 Event Documents</span>
        <div style={{ display: 'flex', gap: '2px', background: '#0d1117', padding: '2px', borderRadius: '4px', border: '1px solid #30363d' }}>
          {(['JSON', 'CEF', 'IPFIX'] as MetadataFormat[]).map(fmt => (
            <button
              key={fmt}
              onClick={() => handleFormatChange(fmt)}
              style={{
                padding: '1px 5px', fontSize: '9px', borderRadius: '3px', border: 'none', cursor: 'pointer', fontWeight: 700,
                background: activeFormat === fmt ? '#ff9800' : 'transparent',
                color: activeFormat === fmt ? '#000' : '#888',
              }}
            >
              {fmt}
            </button>
          ))}
        </div>
      </div>

      {/* Bandwidth savings — single compact line */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px', padding: '3px 6px', marginBottom: '4px', fontSize: '10px' }}>
        <span style={{ color: '#34d399', fontWeight: 600 }}>⚡ 95% bandwidth saved</span>
        <span style={{ color: '#9ca3af', fontFamily: 'monospace', fontSize: '9px' }}>~1.4k evt/s</span>
      </div>

      {/* Collapsible event log */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ background: '#090d12', border: '1px solid #21262d', borderRadius: '4px', padding: '4px 5px', cursor: 'pointer', fontSize: '9px', fontFamily: 'monospace' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#6b7280', marginBottom: expanded ? '3px' : '0' }}>
          <span>{expanded ? '▾' : '▸'} Live stream ({events.length} records)</span>
          <span style={{ fontSize: '8px' }}>{isRunning ? '● LIVE' : '○ IDLE'}</span>
        </div>
        {expanded && (
          <div
            onMouseEnter={() => setIsHoveringLog(true)}
            onMouseLeave={() => setIsHoveringLog(false)}
            style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '100px', overflowY: 'auto' }}
          >
            {events.length === 0 ? (
              <div style={{ color: '#6b7280', fontStyle: 'italic', textAlign: 'center', padding: '4px 0', fontSize: '9px' }}>
                {isRunning ? 'Waiting for events…' : 'Press ▶ to start'}
              </div>
            ) : events.map(evt => (
              <div
                key={evt.id}
                style={{
                  display: 'flex', gap: '4px', lineHeight: '1.3', fontSize: '9px',
                  background: evt.isThreat ? 'rgba(239, 83, 80, 0.12)' : 'transparent',
                  borderLeft: evt.isThreat ? '2px solid #ef5350' : '2px solid transparent',
                  padding: evt.isThreat ? '1px 2px' : 0,
                  borderRadius: '2px',
                }}
              >
                <span style={{ color: evt.isThreat ? '#ef5350' : '#ff9800', flexShrink: 0, fontWeight: evt.isThreat ? 700 : 400 }}>{evt.timestamp}</span>
                <span className={evt.isThreat ? '' : fmtColor} style={{ wordBreak: 'break-all', color: evt.isThreat ? '#ff8a80' : undefined, fontWeight: evt.isThreat ? 700 : 400 }}>{formatOneLiner(evt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enlarged read-out — shown on hover so the tiny scrolling log becomes legible */}
      {expanded && isHoveringLog && events.length > 0 && (
        <div
          onMouseEnter={() => setIsHoveringLog(true)}
          onMouseLeave={() => setIsHoveringLog(false)}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(720px, 90vw)',
            maxHeight: '70vh',
            background: '#0d1117',
            border: '1px solid #ff9800',
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            padding: '14px 16px',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ color: '#ff9800', fontWeight: 700, fontSize: '15px' }}>📄 Event Documents — {activeFormat}</span>
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>{isRunning ? '● LIVE' : '○ IDLE'}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', fontFamily: 'monospace' }}>
            {events.map(evt => (
              <div
                key={evt.id}
                style={{
                  display: 'flex', gap: '10px', lineHeight: '1.5', fontSize: '14px',
                  background: evt.isThreat ? 'rgba(239, 83, 80, 0.14)' : 'transparent',
                  borderLeft: evt.isThreat ? '3px solid #ef5350' : '3px solid transparent',
                  padding: evt.isThreat ? '4px 8px' : '0 8px',
                  borderRadius: '4px',
                }}
              >
                <span style={{ color: evt.isThreat ? '#ef5350' : '#ff9800', flexShrink: 0, fontWeight: evt.isThreat ? 700 : 400 }}>{evt.timestamp}</span>
                <span className={evt.isThreat ? '' : fmtColor} style={{ wordBreak: 'break-all', color: evt.isThreat ? '#ff8a80' : undefined, fontWeight: evt.isThreat ? 700 : 400 }}>{formatOneLiner(evt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
