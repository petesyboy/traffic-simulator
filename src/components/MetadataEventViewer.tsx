import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
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
  jsonDoc: Record<string, unknown>;
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

// Base pace between events, and the longer pause held after a threat event
// fires so it stays on screen long enough to actually spot before the next
// record lands — then the feed ramps back up to its normal pace.
const BASE_INTERVAL_MS = 900;
const THREAT_PAUSE_MS = 3200;

/**
 * FLIP-animates rows as new records push older ones down, instead of them
 * jumping straight to their new position. When the feed pauses (a threat
 * event holding at the top), nothing moves — which is what actually makes
 * the pause read as "stop and look at this line" rather than more jitter.
 */
function useFlipRows(events: EventRecord[]) {
  const rowsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());

  useLayoutEffect(() => {
    // Clear any transform left over from an animation that never got to finish (e.g. the
    // tab was backgrounded mid-transition) so positions below are measured from each row's
    // true, untransformed layout position rather than a stale offset.
    rowsRef.current.forEach((el) => {
      el.style.transition = 'none';
      el.style.transform = '';
    });

    const nextRects = new Map<string, DOMRect>();
    rowsRef.current.forEach((el, id) => nextRects.set(id, el.getBoundingClientRect()));

    rowsRef.current.forEach((el, id) => {
      const prevRect = prevRectsRef.current.get(id);
      const nextRect = nextRects.get(id);
      if (!prevRect || !nextRect) return;
      const deltaY = prevRect.top - nextRect.top;
      if (Math.abs(deltaY) > 0.5) {
        el.style.transform = `translateY(${deltaY}px)`;
      }
    });

    // Force a reflow so the "invert" transforms above are committed before animating away from them.
    void rowsRef.current.values().next().value?.offsetHeight;

    requestAnimationFrame(() => {
      rowsRef.current.forEach((el) => {
        el.style.transition = 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)';
        el.style.transform = '';
      });
    });

    prevRectsRef.current = nextRects;
  }, [events]);

  return (id: string) => (el: HTMLDivElement | null) => {
    if (el) rowsRef.current.set(id, el);
    else rowsRef.current.delete(id);
  };
}

export const MetadataEventViewer: React.FC<MetadataEventViewerProps> = ({ selectedNode }) => {
  const isRunning = useStore(state => state.isRunning);
  const updateNodeData = useStore(state => state.updateNodeData);

  const format = (selectedNode.data?.metadataFormat as MetadataFormat) || 'JSON';
  const [activeFormat, setActiveFormat] = useState<MetadataFormat>(format);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [isHoveringLog, setIsHoveringLog] = useState(false);
  const setCompactRowRef = useFlipRows(events);
  const setEnlargedRowRef = useFlipRows(events);

  // Anchor rect of the small compact log box, captured on hover, so the
  // enlarged read-out can be placed right next to it (instead of dead
  // centre) and connector lines can be drawn between the two.
  const logBoxRef = useRef<HTMLDivElement>(null);
  const enlargedPanelRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [enlargedRect, setEnlargedRect] = useState<DOMRect | null>(null);

  const captureAnchorRect = () => {
    if (logBoxRef.current) setAnchorRect(logBoxRef.current.getBoundingClientRect());
  };

  useLayoutEffect(() => {
    if (expanded && isHoveringLog && enlargedPanelRef.current) {
      setEnlargedRect(enlargedPanelRef.current.getBoundingClientRect());
    } else {
      setEnlargedRect(null);
    }
  }, [expanded, isHoveringLog, events]);

  // Prefer placing the enlarged panel just to the left of the anchor (the
  // config panel lives on the right edge of the screen); fall back to
  // stacking it above/below the anchor if there isn't enough horizontal room.
  const GAP = 22;
  const PANEL_WIDTH = 480;
  const MIN_USABLE_WIDTH = 320;
  let placement: { left: number; top: number; width: number; maxHeight: number; side: 'left' | 'stack' } | null = null;
  if (anchorRect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceLeft = anchorRect.left - GAP - 16;
    if (spaceLeft >= MIN_USABLE_WIDTH) {
      const width = Math.min(PANEL_WIDTH, spaceLeft);
      const maxHeight = Math.min(vh * 0.7, vh - 32);
      const top = Math.min(Math.max(16, anchorRect.top - 40), Math.max(16, vh - maxHeight - 16));
      placement = { left: anchorRect.left - GAP - width, top, width, maxHeight, side: 'left' };
    } else {
      const width = Math.min(560, vw - 32);
      const maxHeight = Math.min(vh * 0.55, vh - anchorRect.bottom - GAP - 16);
      const left = Math.min(Math.max(16, anchorRect.left + anchorRect.width / 2 - width / 2), vw - width - 16);
      const top = maxHeight > 200 ? anchorRect.bottom + GAP : Math.max(16, anchorRect.top - Math.min(vh * 0.55, vh - 32) - GAP);
      placement = { left, top, width, maxHeight: Math.max(maxHeight, 200), side: 'stack' };
    }
  }

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
    let timeoutId: ReturnType<typeof setTimeout>;

    const tick = () => {
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

      // Hold on a threat event longer before generating the next record,
      // then ease back to the normal pace — rather than a flat interval
      // that can bury a red row before it's been noticed.
      timeoutId = setTimeout(tick, isThreat ? THREAT_PAUSE_MS : BASE_INTERVAL_MS);
    };

    timeoutId = setTimeout(tick, BASE_INTERVAL_MS);
    return () => clearTimeout(timeoutId);
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
            ref={logBoxRef}
            onMouseEnter={() => { captureAnchorRect(); setIsHoveringLog(true); }}
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
                ref={setCompactRowRef(evt.id)}
                style={{
                  display: 'flex', gap: '4px', lineHeight: '1.3', fontSize: '9px',
                  background: evt.isThreat ? 'rgba(239, 83, 80, 0.12)' : 'transparent',
                  borderLeft: evt.isThreat ? '2px solid #ef5350' : '2px solid transparent',
                  padding: evt.isThreat ? '1px 2px' : 0,
                  borderRadius: '2px',
                  animation: 'fadeSlideIn 320ms ease-out',
                }}
              >
                <span style={{ color: evt.isThreat ? '#ef5350' : '#ff9800', flexShrink: 0, fontWeight: evt.isThreat ? 700 : 400 }}>{evt.timestamp}</span>
                <span className={evt.isThreat ? '' : fmtColor} style={{ wordBreak: 'break-all', color: evt.isThreat ? '#ff8a80' : undefined, fontWeight: evt.isThreat ? 700 : 400 }}>{formatOneLiner(evt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connector lines linking the compact log box to its enlarged magnification */}
      {expanded && isHoveringLog && events.length > 0 && anchorRect && enlargedRect && (
        <svg
          style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 1999 }}
        >
          {(() => {
            // Pick the pair of facing corners between the two boxes based on
            // their actual relative position, so the lines look right whichever
            // side the enlarged panel ends up placed on.
            const dx = (anchorRect.left + anchorRect.width / 2) - (enlargedRect.left + enlargedRect.width / 2);
            const dy = (anchorRect.top + anchorRect.height / 2) - (enlargedRect.top + enlargedRect.height / 2);
            let p1, p2, a1, a2;
            if (Math.abs(dx) >= Math.abs(dy)) {
              if (dx > 0) {
                p1 = { x: enlargedRect.right, y: enlargedRect.top };
                p2 = { x: enlargedRect.right, y: enlargedRect.bottom };
                a1 = { x: anchorRect.left, y: anchorRect.top };
                a2 = { x: anchorRect.left, y: anchorRect.bottom };
              } else {
                p1 = { x: enlargedRect.left, y: enlargedRect.top };
                p2 = { x: enlargedRect.left, y: enlargedRect.bottom };
                a1 = { x: anchorRect.right, y: anchorRect.top };
                a2 = { x: anchorRect.right, y: anchorRect.bottom };
              }
            } else if (dy > 0) {
              p1 = { x: enlargedRect.left, y: enlargedRect.bottom };
              p2 = { x: enlargedRect.right, y: enlargedRect.bottom };
              a1 = { x: anchorRect.left, y: anchorRect.top };
              a2 = { x: anchorRect.right, y: anchorRect.top };
            } else {
              p1 = { x: enlargedRect.left, y: enlargedRect.top };
              p2 = { x: enlargedRect.right, y: enlargedRect.top };
              a1 = { x: anchorRect.left, y: anchorRect.bottom };
              a2 = { x: anchorRect.right, y: anchorRect.bottom };
            }
            return (
              <>
                <polygon
                  points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${a2.x},${a2.y} ${a1.x},${a1.y}`}
                  fill="rgba(255,152,0,0.06)"
                />
                <line x1={p1.x} y1={p1.y} x2={a1.x} y2={a1.y} stroke="#ff9800" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7} />
                <line x1={p2.x} y1={p2.y} x2={a2.x} y2={a2.y} stroke="#ff9800" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7} />
              </>
            );
          })()}
        </svg>
      )}

      {/* Enlarged read-out — shown on hover so the tiny scrolling log becomes legible, anchored near the compact panel */}
      {expanded && isHoveringLog && events.length > 0 && placement && (
        <div
          ref={enlargedPanelRef}
          onMouseEnter={() => setIsHoveringLog(true)}
          onMouseLeave={() => setIsHoveringLog(false)}
          style={{
            position: 'fixed',
            top: `${placement.top}px`,
            left: `${placement.left}px`,
            width: `${placement.width}px`,
            maxHeight: `${placement.maxHeight}px`,
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
                ref={setEnlargedRowRef(evt.id)}
                style={{
                  display: 'flex', gap: '10px', lineHeight: '1.5', fontSize: '14px',
                  background: evt.isThreat ? 'rgba(239, 83, 80, 0.14)' : 'transparent',
                  borderLeft: evt.isThreat ? '3px solid #ef5350' : '3px solid transparent',
                  padding: evt.isThreat ? '4px 8px' : '0 8px',
                  borderRadius: '4px',
                  animation: 'fadeSlideIn 320ms ease-out',
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
