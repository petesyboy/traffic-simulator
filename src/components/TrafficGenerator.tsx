/**
 * TrafficGenerator.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Bottom drawer that shows live traffic streams and lets users add/edit/delete them.
 *
 * CHANGES (refactor/code-quality-improvements)
 * ─────────────────────────────────────────────
 * • `alert()` replaced with an inline empty-state message — there's already
 *   a guard that prevents adding a stream when no input port exists; the error
 *   is now shown as a styled inline notice rather than a blocking browser dialog.
 * • Resizable tray: a drag handle at the top lets users resize the drawer by
 *   dragging.  The height is stored in local state (default 220px) and is
 *   clamped between 80px (minimal) and 500px (tall).
 * • CSS classes used instead of some repeated inline style objects.
 */

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useStore, type TrafficStream } from '../store/store';
import type { CustomNode, TappedLinkAllocation } from '../store/types';
import { getOpticSpeedMbps } from '../utils/hardwareUtils';
import { isAutoTrayModel } from '../utils/trayModels';
import { resolveNodeSite } from '../utils/report/describeTopology';
import {
  generateStreamsForTopology,
  getTopologyIngressSummary,
  type TrafficProfileBias,
  type TrafficUtilisationLevel,
} from '../utils/trafficStreamUtils';

// Sub-1Gbps presets are only offered in Advanced Mode - they exist to model
// ingest-limited sensors (e.g. ForeScout, capped at 1Gbps) that need a feed
// throttled below a full 1Gbps link, which Standard mode users don't need
// to see.
const STANDARD_BANDWIDTH_PRESETS = [1000, 10000, 25000, 40000, 100000];
const ADVANCED_BANDWIDTH_PRESETS = [100, 250, 500, ...STANDARD_BANDWIDTH_PRESETS];

const formatBandwidthOption = (mbps: number): string =>
  mbps >= 1000 ? `${(mbps / 1000).toFixed(1).replace('.0', '')} Gbps` : `${mbps} Mbps`;

const getSiteBadgeStyle = (siteName: string) => {
  if (!siteName || siteName === 'Unassigned') {
    return {
      bg: 'rgba(255, 255, 255, 0.04)',
      border: 'rgba(255, 255, 255, 0.12)',
      text: 'var(--text-muted)',
    };
  }
  let hash = 0;
  for (let i = 0; i < siteName.length; i++) {
    hash = (hash << 5) - hash + siteName.charCodeAt(i);
    hash |= 0;
  }
  const palettes = [
    { bg: 'rgba(0, 229, 255, 0.12)', border: 'rgba(0, 229, 255, 0.35)', text: '#00e5ff' },
    { bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.35)', text: '#c084fc' },
    { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.35)', text: '#34d399' },
    { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.35)', text: '#fbbf24' },
    { bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.35)', text: '#fb7185' },
    { bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.35)', text: '#38bdf8' },
  ];
  return palettes[Math.abs(hash) % palettes.length];
};

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  dataCentre: 110,
  name: 340,
  ingress: 180,
  vlan: 60,
  proto: 70,
  ipSrc: 115,
  ipDst: 115,
  portDst: 65,
  rate: 100,
  status: 80,
  encrypted: 65,
  active: 55,
  action: 65,
};

const MIN_COLUMN_WIDTHS: Record<string, number> = {
  dataCentre: 75,
  name: 140,
  ingress: 100,
  vlan: 45,
  proto: 50,
  ipSrc: 80,
  ipDst: 80,
  portDst: 50,
  rate: 70,
  status: 60,
  encrypted: 50,
  active: 45,
  action: 55,
};

const TrafficGenerator: React.FC = () => {
  const trafficStreams        = useStore((state) => state.trafficStreams);
  const nodes                 = useStore((state) => state.nodes);
  const edges                 = useStore((state) => state.edges);
  const addTrafficStream      = useStore((state) => state.addTrafficStream);
  const setTrafficStreams     = useStore((state) => state.setTrafficStreams);
  const clearTrafficStreams   = useStore((state) => state.clearTrafficStreams);
  const updateTrafficStream   = useStore((state) => state.updateTrafficStream);
  const deleteTrafficStream   = useStore((state) => state.deleteTrafficStream);
  const trafficProfileBias       = useStore((state) => state.trafficProfileBias || 'mixed');
  const setTrafficProfileBias    = useStore((state) => state.setTrafficProfileBias);
  const trafficUtilisationLevel  = useStore((state) => state.trafficUtilisationLevel || 'medium');
  const setTrafficUtilisationLevel = useStore((state) => state.setTrafficUtilisationLevel);
  const deliveredStreams      = useStore((state) => state.deliveredStreams);
  const isRunning             = useStore((state) => state.isRunning);
  const toggleSimulation      = useStore((state) => state.toggleSimulation);

  // Resizable tray: tracks the current drawer height in pixels.
  const [drawerHeight, setDrawerHeight] = useState(220);
  const dragStartY   = useRef<number>(0);
  const dragStartH   = useRef<number>(220);

  // Minimum and maximum heights for the tray
  const MIN_HEIGHT = 80;
  const MAX_HEIGHT = 500;

  // Resizable columns
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('fm_simulator_traffic_col_widths');
      if (saved) {
        return { ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(saved) };
      }
    } catch {
      // fallback
    }
    return DEFAULT_COLUMN_WIDTHS;
  });

  const [activeResizingCol, setActiveResizingCol] = useState<string | null>(null);

  const onColumnResizeStart = useCallback((e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidths[colKey] || DEFAULT_COLUMN_WIDTHS[colKey] || 100;
    const minW = MIN_COLUMN_WIDTHS[colKey] || 40;
    setActiveResizingCol(colKey);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(minW, startW + delta);
      setColWidths((prev) => ({ ...prev, [colKey]: newWidth }));
    };

    const onMouseUp = () => {
      setActiveResizingCol(null);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      setColWidths((current) => {
        try {
          localStorage.setItem('fm_simulator_traffic_col_widths', JSON.stringify(current));
        } catch {
          // ignore
        }
        return current;
      });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [colWidths]);

  const resetColumnWidths = useCallback(() => {
    setColWidths(DEFAULT_COLUMN_WIDTHS);
    try {
      localStorage.removeItem('fm_simulator_traffic_col_widths');
    } catch {
      // ignore
    }
  }, []);

  /**
   * Drag-to-resize implementation.
   * The handle is at the TOP of the drawer, so dragging upward (negative delta)
   * increases height, and dragging downward decreases it.
   */
  const onDragHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartH.current = drawerHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      // Moving up (smaller clientY) increases drawer height
      const delta  = dragStartY.current - moveEvent.clientY;
      const newH   = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragStartH.current + delta));
      setDrawerHeight(newH);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [drawerHeight]);

  const inputPorts = nodes.filter((node) =>
    node.type === 'inputNode' ||
    (node.type === 'hardwareNode' && typeof node.data.model === 'string' && node.data.model.includes('TAP') && !isAutoTrayModel(node.data.model))
  );
  const ingressSummary = getTopologyIngressSummary(nodes);

  const getPortSite = useCallback((port: CustomNode): string => {
    const direct = ((port.data?.site as string) || '').trim();
    if (direct) return direct;
    return resolveNodeSite(port, nodes, edges) || '';
  }, [nodes, edges]);

  const getStreamSite = useCallback((stream: TrafficStream): string => {
    if (stream.site && stream.site.trim()) return stream.site.trim();
    const sourceNode = nodes.find((n) => n.id === stream.sourceNodeId);
    if (sourceNode) {
      const site = getPortSite(sourceNode);
      if (site) return site;
    }
    const match = stream.name.match(/^\[(.*?)\]/);
    if (match && match[1]) return match[1].trim();
    return '';
  }, [nodes, getPortSite]);

  const groupedInputPorts = useMemo(() => {
    const map = new Map<string, CustomNode[]>();
    inputPorts.forEach((port) => {
      const site = getPortSite(port);
      if (!map.has(site)) {
        map.set(site, []);
      }
      map.get(site)!.push(port);
    });
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b);
    });
  }, [inputPorts, getPortSite]);

  // Data Centre filtering & grouping state
  const [selectedDcFilter, setSelectedDcFilter] = useState<string>('all');
  const [groupByDc, setGroupByDc] = useState<boolean>(true);
  const [collapsedDcs, setCollapsedDcs] = useState<Record<string, boolean>>({});

  const toggleDcCollapsed = useCallback((site: string) => {
    setCollapsedDcs((prev) => ({ ...prev, [site]: !prev[site] }));
  }, []);

  const toggleAllInDc = useCallback((site: string, makeActive: boolean) => {
    const targetStreams = trafficStreams.filter((s) => (getStreamSite(s) || 'Unassigned') === site);
    targetStreams.forEach((s) => {
      updateTrafficStream(s.id, { active: makeActive });
    });
  }, [trafficStreams, getStreamSite, updateTrafficStream]);

  const siteStreamStats = useMemo(() => {
    const stats = new Map<string, { count: number; bandwidth: number }>();
    trafficStreams.forEach((s) => {
      const site = getStreamSite(s) || 'Unassigned';
      const current = stats.get(site) || { count: 0, bandwidth: 0 };
      stats.set(site, {
        count: current.count + 1,
        bandwidth: current.bandwidth + (s.active ? s.bandwidth : 0),
      });
    });
    return stats;
  }, [trafficStreams, getStreamSite]);

  const availableSites = useMemo(() => {
    return Array.from(siteStreamStats.keys()).sort((a, b) => {
      if (a === 'Unassigned') return 1;
      if (b === 'Unassigned') return -1;
      return a.localeCompare(b);
    });
  }, [siteStreamStats]);

  const filteredStreams = useMemo(() => {
    if (selectedDcFilter === 'all') return trafficStreams;
    return trafficStreams.filter((s) => {
      const site = getStreamSite(s) || 'Unassigned';
      return site === selectedDcFilter;
    });
  }, [trafficStreams, selectedDcFilter, getStreamSite]);

  const groupedStreams = useMemo(() => {
    const groups = new Map<string, TrafficStream[]>();
    filteredStreams.forEach((stream) => {
      const site = getStreamSite(stream) || 'Unassigned';
      if (!groups.has(site)) {
        groups.set(site, []);
      }
      groups.get(site)!.push(stream);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === 'Unassigned') return 1;
      if (b === 'Unassigned') return -1;
      return a.localeCompare(b);
    });
  }, [filteredStreams, getStreamSite]);

  const [noPortError, setNoPortError] = useState(false);
  const [streamLimitError, setStreamLimitError] = useState(false);
  const [autoGenNotice, setAutoGenNotice] = useState<string | null>(null);

  const handleAutoGenerate = () => {
    if (inputPorts.length === 0 && ingressSummary.totalMonitoredLinks === 0) {
      setNoPortError(true);
      setTimeout(() => setNoPortError(false), 3000);
      return;
    }
    setNoPortError(false);

    const generated = generateStreamsForTopology(nodes, {
      profileBias: trafficProfileBias,
      utilisationLevel: trafficUtilisationLevel,
      edges,
    });

    if (generated.length > 0) {
      setTrafficStreams(generated);
      const biasLabel = trafficProfileBias === 'telco'
        ? 'Telco & Mobile Core'
        : (trafficProfileBias === 'enterprise' ? 'Enterprise' : 'Mixed');
      const utilLabel = trafficUtilisationLevel === 'low' ? '10% Low' :
        (trafficUtilisationLevel === 'medium' ? '50% Medium' :
        (trafficUtilisationLevel === 'high' ? '80% High' :
        (trafficUtilisationLevel === 'max' ? '95% Max' :
        (trafficUtilisationLevel === 'full' ? '100% Line Rate' : `${trafficUtilisationLevel}%`))));

      setAutoGenNotice(`✨ Auto-generated ${generated.length} flow${generated.length !== 1 ? 's' : ''} across all monitored links (${utilLabel} utilisation, ${biasLabel} profile).`);
      setTimeout(() => setAutoGenNotice(null), 5000);
    }
  };

  const handleClearAll = () => {
    if (trafficStreams.length === 0) return;
    clearTrafficStreams();
    setAutoGenNotice('Cleared all traffic streams.');
    setTimeout(() => setAutoGenNotice(null), 3000);
  };

  const handleAddStream = () => {
    if (inputPorts.length === 0) {
      // Show an inline error notice instead of alert()
      setNoPortError(true);
      setTimeout(() => setNoPortError(false), 3000);
      return;
    }
    setNoPortError(false);

    if (trafficStreams.length >= 500) {
      setStreamLimitError(true);
      setTimeout(() => setStreamLimitError(false), 4000);
      return;
    }
    setStreamLimitError(false);
    
    const sourceNode = inputPorts[0];
    let defaultBandwidth = 10000;
    
    if (sourceNode.type === 'hardwareNode' && typeof sourceNode.data.model === 'string' && sourceNode.data.model.includes('TAP')) {
      const allocations = sourceNode.data.tappedLinkAllocations as TappedLinkAllocation[];
      let totalLinkBandwidth = 0;

      if (allocations && allocations.length > 0) {
        allocations.forEach(a => {
          const opticName = a.toolOptic || a.optic || '';
          const speedMbps = getOpticSpeedMbps(opticName) || 1000;
          totalLinkBandwidth += speedMbps * (a.qty || 1);
        });
      } else if (sourceNode.data.tappedLinkOptic) {
        const opticName = sourceNode.data.tappedLinkOptic as string;
        const speedMbps = getOpticSpeedMbps(opticName) || 1000;
        const numLinks = (sourceNode.data.tappedLinksCount as number) ?? 1;
        totalLinkBandwidth = numLinks * speedMbps;
      }

      if (totalLinkBandwidth > 0) {
        defaultBandwidth = Math.floor(totalLinkBandwidth * 0.5);
      }
    }

    const sourceSite = getPortSite(sourceNode);
    const sitePrefix = sourceSite ? `[${sourceSite}] ` : '';

    const newStream: TrafficStream = {
      id: `t-${Date.now()}`,
      name: `${sitePrefix}Traffic Stream ${trafficStreams.length + 1} (${defaultBandwidth >= 1000 ? defaultBandwidth/1000 + ' Gbps' : defaultBandwidth + ' Mbps'})`,
      sourceNodeId: sourceNode.id,
      site: sourceSite || undefined,
      vlan: String(100 + trafficStreams.length * 100),
      ipSrc: `192.168.1.${50 + trafficStreams.length}`,
      ipDst: '10.0.0.100',
      portSrc: String(50231 + trafficStreams.length),
      portDst: '443',
      protocol: 'tcp',
      bandwidth: defaultBandwidth,
      active: true,
    };

    addTrafficStream(newStream);
  };

  const handleFieldChange = (id: string, field: keyof TrafficStream, value: string | number | boolean) => {
    updateTrafficStream(id, { [field]: value });
  };

  const handleSourceNodeChange = (streamId: string, newSourceNodeId: string) => {
    const newPort = nodes.find((n) => n.id === newSourceNodeId);
    const newSite = newPort ? getPortSite(newPort) : undefined;
    updateTrafficStream(streamId, {
      sourceNodeId: newSourceNodeId,
      site: newSite || undefined,
    });
  };

  const panelTextScale = useStore((state) => state.panelTextScale || 1.0);
  const advancedMode = useStore((state) => state.advancedMode);
  const currentScenarioName = useStore((state) => state.currentScenarioName);

  // Traffic simulation panel is always minimized by default (both in Standard and Advanced mode)
  // to keep the canvas clear whenever any scenario or layout is loaded.
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [prevAdvancedMode, setPrevAdvancedMode] = useState(advancedMode);
  if (advancedMode !== prevAdvancedMode) {
    setPrevAdvancedMode(advancedMode);
    setIsCollapsed(true);
  }

  // When a new scenario is loaded or restored, collapse the drawer
  const [prevScenarioName, setPrevScenarioName] = useState(currentScenarioName);
  if (currentScenarioName !== prevScenarioName) {
    setPrevScenarioName(currentScenarioName);
    setIsCollapsed(true);
  }

  // Mission Demo starts with the canvas already in Standard mode, so the
  // advancedMode-change check above never fires - without this, a drawer
  // the user had manually expanded beforehand would stay expanded and crowd
  // the canvas for the whole demo instead of starting minimized.
  const trafficGenCollapseTrigger = useStore((state) => state.trafficGenCollapseTrigger);
  const [prevCollapseTrigger, setPrevCollapseTrigger] = useState(trafficGenCollapseTrigger);
  if (trafficGenCollapseTrigger !== prevCollapseTrigger) {
    setPrevCollapseTrigger(trafficGenCollapseTrigger);
    setIsCollapsed(true);
  }

  const totalBandwidthMbps = trafficStreams.filter(s => s.active).reduce((sum, s) => sum + s.bandwidth, 0);
  const totalBandwidthLabel = totalBandwidthMbps >= 1000
    ? `${(totalBandwidthMbps / 1000).toFixed(1).replace('.0', '')} Gbps`
    : `${totalBandwidthMbps} Mbps`;

  const totalTableWidth = Object.values(colWidths).reduce((sum, w) => sum + w, 0);

  const ResizableHeader: React.FC<{
    colKey: string;
    label: string;
    textAlign?: 'left' | 'center' | 'right';
  }> = ({ colKey, label, textAlign = 'left' }) => {
    const width = colWidths[colKey] || DEFAULT_COLUMN_WIDTHS[colKey] || 100;
    const isResizing = activeResizingCol === colKey;
    return (
      <th
        style={{
          padding: '6px 8px',
          width: `${width}px`,
          minWidth: `${width}px`,
          maxWidth: `${width}px`,
          position: 'relative',
          userSelect: 'none',
          textAlign,
          boxSizing: 'border-box',
        }}
      >
        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <div
          className={`col-resizer ${isResizing ? 'active' : ''}`}
          onMouseDown={(e) => onColumnResizeStart(e, colKey)}
          title="Drag to resize column (double-click to reset)"
          onDoubleClick={resetColumnWidths}
        >
          <div className="col-resizer-line" />
        </div>
      </th>
    );
  };

  const renderStreamRow = (stream: TrafficStream) => {
    const site = getStreamSite(stream);
    const palette = getSiteBadgeStyle(site);

    return (
      <tr key={stream.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
        <td style={{ padding: '4px 6px', width: `${colWidths.dataCentre}px`, minWidth: `${colWidths.dataCentre}px`, maxWidth: `${colWidths.dataCentre}px`, boxSizing: 'border-box' }}>
          {site ? (
            <span
              title={`Data Centre: ${site}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: palette.bg,
                border: `1px solid ${palette.border}`,
                color: palette.text,
                borderRadius: '3px',
                fontSize: '10px',
                fontWeight: 'bold',
                padding: '2px 6px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
                boxSizing: 'border-box',
              }}
            >
              🏢 {site}
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', paddingLeft: '4px' }}>—</span>
          )}
        </td>
        <td style={{ padding: '4px 6px', width: `${colWidths.name}px`, minWidth: `${colWidths.name}px`, maxWidth: `${colWidths.name}px`, boxSizing: 'border-box' }}>
          <input
            type="text"
            value={stream.name}
            onChange={(e) => handleFieldChange(stream.id, 'name', e.target.value)}
            title={stream.name}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '12px',
              width: '100%',
              boxSizing: 'border-box',
              borderBottom: '1px solid transparent',
              textOverflow: 'ellipsis',
            }}
            onFocus={(e) => e.target.style.borderBottom = '1px solid var(--text-muted)'}
            onBlur={(e) => e.target.style.borderBottom = '1px solid transparent'}
          />
        </td>
        <td style={{ padding: '4px 6px', width: `${colWidths.ingress}px`, minWidth: `${colWidths.ingress}px`, maxWidth: `${colWidths.ingress}px`, boxSizing: 'border-box' }}>
          <select
            value={stream.sourceNodeId}
            onChange={(e) => handleSourceNodeChange(stream.id, e.target.value)}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: '11px',
              padding: '2px 4px',
              borderRadius: '4px',
              width: '100%',
              boxSizing: 'border-box',
              textOverflow: 'ellipsis',
            }}
          >
            {groupedInputPorts.map(([grpSite, ports]) => (
              <optgroup key={grpSite || 'unassigned'} label={grpSite ? `Data Centre: ${grpSite}` : 'Unassigned Data Centre'}>
                {ports.map((port) => (
                  <option key={port.id} value={port.id}>
                    {port.data.label as string}{grpSite ? ` [${grpSite}]` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </td>
        <td style={{ padding: '4px 6px', width: `${colWidths.vlan}px`, minWidth: `${colWidths.vlan}px`, maxWidth: `${colWidths.vlan}px`, boxSizing: 'border-box' }}>
          <input
            type="text"
            value={stream.vlan}
            onChange={(e) => handleFieldChange(stream.id, 'vlan', e.target.value)}
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '11px', padding: '2px 4px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}
          />
        </td>
        <td style={{ padding: '4px 6px', width: `${colWidths.proto}px`, minWidth: `${colWidths.proto}px`, maxWidth: `${colWidths.proto}px`, boxSizing: 'border-box' }}>
          <select
            value={stream.protocol}
            onChange={(e) => handleFieldChange(stream.id, 'protocol', e.target.value)}
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '11px', padding: '2px 4px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}
          >
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
            <option value="icmp">ICMP</option>
          </select>
        </td>
        <td style={{ padding: '4px 6px', width: `${colWidths.ipSrc}px`, minWidth: `${colWidths.ipSrc}px`, maxWidth: `${colWidths.ipSrc}px`, boxSizing: 'border-box' }}>
          <input
            type="text"
            value={stream.ipSrc}
            onChange={(e) => handleFieldChange(stream.id, 'ipSrc', e.target.value)}
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '11px', padding: '2px 4px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}
          />
        </td>
        <td style={{ padding: '4px 6px', width: `${colWidths.ipDst}px`, minWidth: `${colWidths.ipDst}px`, maxWidth: `${colWidths.ipDst}px`, boxSizing: 'border-box' }}>
          <input
            type="text"
            value={stream.ipDst}
            onChange={(e) => handleFieldChange(stream.id, 'ipDst', e.target.value)}
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '11px', padding: '2px 4px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}
          />
        </td>
        <td style={{ padding: '4px 6px', width: `${colWidths.portDst}px`, minWidth: `${colWidths.portDst}px`, maxWidth: `${colWidths.portDst}px`, boxSizing: 'border-box' }}>
          <input
            type="text"
            value={stream.portDst}
            onChange={(e) => handleFieldChange(stream.id, 'portDst', e.target.value)}
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '11px', padding: '2px 4px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}
          />
        </td>
        <td style={{ padding: '4px 6px', width: `${colWidths.rate}px`, minWidth: `${colWidths.rate}px`, maxWidth: `${colWidths.rate}px`, boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <select
               value={stream.bandwidth}
               onChange={(e) => handleFieldChange(stream.id, 'bandwidth', Number(e.target.value))}
               style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '11px', padding: '2px 4px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}
            >
               {(() => {
                 const presets = advancedMode ? ADVANCED_BANDWIDTH_PRESETS : STANDARD_BANDWIDTH_PRESETS;
                 return (
                   <>
                     {!presets.includes(stream.bandwidth) && (
                       <option value={stream.bandwidth}>{formatBandwidthOption(stream.bandwidth)}</option>
                     )}
                     {presets.map((mbps) => (
                       <option key={mbps} value={mbps}>{formatBandwidthOption(mbps)}</option>
                     ))}
                   </>
                 );
               })()}
            </select>
            {/* Live drifted rate (shown while simulation is running) */}
            {isRunning && stream.active && (
              <span style={{ fontSize: '10px', color: '#4caf50', fontWeight: 'bold', display: 'block', paddingLeft: '2px' }}>
                ~{((stream.bandwidth * (stream.drift || 1.0)) / 1000).toFixed(2)} Gbps
              </span>
            )}
          </div>
        </td>
        <td style={{ padding: '4px 6px', width: `${colWidths.status}px`, minWidth: `${colWidths.status}px`, maxWidth: `${colWidths.status}px`, boxSizing: 'border-box' }}>
          {/* Status badge: Idle / Inactive / ✓ Passed / ❌ Filtered */}
          {!isRunning ? (
            <span style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', fontSize: '10px', color: '#888', display: 'inline-block' }}>
              Idle
            </span>
          ) : !stream.active ? (
            <span style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '3px', fontSize: '10px', color: '#666', display: 'inline-block' }}>
              Inactive
            </span>
          ) : deliveredStreams.some((id) => id === stream.id || id.startsWith(`${stream.id}-`)) ? (
            <span style={{ padding: '2px 6px', background: 'rgba(76, 175, 80, 0.12)', border: '1px solid rgba(76, 175, 80, 0.25)', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold', color: '#4caf50', display: 'inline-block', whiteSpace: 'nowrap' }}>
              ✓ Passed
            </span>
          ) : (
            <span style={{ padding: '2px 6px', background: 'rgba(239, 83, 80, 0.12)', border: '1px solid rgba(239, 83, 80, 0.25)', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold', color: '#ef5350', display: 'inline-block', whiteSpace: 'nowrap' }}>
              ❌ Filtered
            </span>
          )}
        </td>
        <td style={{ padding: '4px 6px', width: `${colWidths.encrypted}px`, minWidth: `${colWidths.encrypted}px`, maxWidth: `${colWidths.encrypted}px`, textAlign: 'center', boxSizing: 'border-box' }}>
          <input
            type="checkbox"
            checked={stream.isEncrypted || false}
            onChange={(e) => handleFieldChange(stream.id, 'isEncrypted', e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
        </td>
        <td style={{ padding: '4px 6px', width: `${colWidths.active}px`, minWidth: `${colWidths.active}px`, maxWidth: `${colWidths.active}px`, textAlign: 'center', boxSizing: 'border-box' }}>
          <input
            type="checkbox"
            checked={stream.active}
            onChange={(e) => handleFieldChange(stream.id, 'active', e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
        </td>
        <td style={{ padding: '4px 6px', width: `${colWidths.action}px`, minWidth: `${colWidths.action}px`, maxWidth: `${colWidths.action}px`, textAlign: 'center', boxSizing: 'border-box' }}>
          <button className="danger" style={{ padding: '2px 6px', fontSize: '10px' }} onClick={() => deleteTrafficStream(stream.id)}>
            Delete
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div style={{ position: 'relative', flexShrink: 0, zoom: panelTextScale }}>
      {/* ── Drag handle ──────────────────────────────────────────────────────── */}
      {/*
        A thin stripe at the top of the drawer.  When the user clicks and
        drags it upward/downward, the drawer height changes.
        The cursor: 'ns-resize' signal makes the intent obvious.
      */}
      {!isCollapsed && (
        <div
          onMouseDown={onDragHandleMouseDown}
          style={{
            height: '6px',
            background: 'rgba(255,255,255,0.04)',
            borderTop: '1px solid var(--border-color)',
            cursor: 'ns-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Visual grip indicator — three dots */}
          <div style={{ width: '32px', height: '2px', borderRadius: '1px', background: 'rgba(255,255,255,0.15)' }} />
        </div>
      )}

      {/* ── Drawer body ──────────────────────────────────────────────────────── */}
      <div
        className="bottom-drawer"
        style={{
          maxHeight: isCollapsed ? '48px' : `${drawerHeight}px`,
          height: isCollapsed ? '48px' : `${drawerHeight}px`,
          padding: isCollapsed ? '10px 16px' : undefined,
          overflow: 'hidden',
          transition: 'height 0.2s ease, max-height 0.2s ease',
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isCollapsed ? 0 : '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? 'Expand traffic generator' : 'Minimize traffic generator'}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '18px',
                lineHeight: 1,
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              {isCollapsed ? '▸' : '▾'}
            </button>
            <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📊 Live Traffic Generator &amp; Injector
            </h3>
            {!isCollapsed && trafficStreams.length > 0 && (
              <span style={{ fontSize: '11px', background: 'rgba(0, 229, 255, 0.12)', border: '1px solid rgba(0, 229, 255, 0.3)', color: '#00e5ff', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                {trafficStreams.length} stream{trafficStreams.length !== 1 ? 's' : ''} · {totalBandwidthLabel}
              </span>
            )}
            {!isCollapsed && selectedDcFilter !== 'all' && (
              <span style={{ fontSize: '11px', background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.35)', color: '#c084fc', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                Filtering: {filteredStreams.length} in {selectedDcFilter}
              </span>
            )}
            {!isCollapsed && ingressSummary.totalMonitoredLinks > 0 && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                ({ingressSummary.totalMonitoredLinks} tapped link{ingressSummary.totalMonitoredLinks !== 1 ? 's' : ''} detected)
              </span>
            )}
          </div>
          {!isCollapsed && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Inline notices */}
            {autoGenNotice && (
              <span style={{ fontSize: '11px', color: '#00e5ff', background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.3)', borderRadius: '4px', padding: '4px 8px' }}>
                {autoGenNotice}
              </span>
            )}
            {noPortError && (
              <span style={{ fontSize: '11px', color: '#ff9100', background: 'rgba(255,145,0,0.1)', border: '1px solid rgba(255,145,0,0.3)', borderRadius: '4px', padding: '4px 8px' }}>
                ⚠️ Add a Network Input port or TAP module first
              </span>
            )}
            {streamLimitError && (
              <span style={{ fontSize: '11px', color: '#ef5350', background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.3)', borderRadius: '4px', padding: '4px 8px' }}>
                ⚠️ Maximum limit of 500 active traffic streams reached
              </span>
            )}

            {/* Data Centre Filter dropdown */}
            {availableSites.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <select
                  value={selectedDcFilter}
                  onChange={(e) => setSelectedDcFilter(e.target.value)}
                  title="Filter traffic streams by Data Centre"
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: selectedDcFilter !== 'all' ? '1px solid rgba(0, 229, 255, 0.5)' : '1px solid var(--border-color)',
                    color: selectedDcFilter !== 'all' ? '#00e5ff' : 'var(--text-primary)',
                    fontSize: '11px',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <option value="all">🏢 All Data Centres ({trafficStreams.length})</option>
                  {availableSites.map((site) => {
                    const stats = siteStreamStats.get(site) || { count: 0, bandwidth: 0 };
                    const bw = stats.bandwidth >= 1000 ? `${(stats.bandwidth / 1000).toFixed(1).replace('.0', '')} Gbps` : `${stats.bandwidth} Mbps`;
                    return (
                      <option key={site} value={site}>
                        🏢 {site} ({stats.count} stream{stats.count !== 1 ? 's' : ''} · {bw})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Group by Data Centre toggle */}
            {availableSites.length > 0 && (
              <button
                onClick={() => setGroupByDc(!groupByDc)}
                title={groupByDc ? 'Disable Data Centre grouping (show flat list)' : 'Group traffic streams by Data Centre'}
                style={{
                  background: groupByDc ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  border: groupByDc ? '1px solid rgba(0, 229, 255, 0.4)' : '1px solid var(--border-color)',
                  color: groupByDc ? '#00e5ff' : 'var(--text-secondary)',
                  fontSize: '11px',
                  padding: '5px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                📁 Group by DC {groupByDc ? '✓' : ''}
              </button>
            )}

            {/* Profile bias dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <select
                value={trafficProfileBias}
                onChange={(e) => setTrafficProfileBias(e.target.value as TrafficProfileBias)}
                title="Select traffic synthesis profile bias (Telco/Mobile Core, Enterprise, or Mixed)"
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                  padding: '5px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                <option value="mixed">🔀 Mixed (Telco &amp; Enterprise)</option>
                <option value="telco">📱 Telco &amp; Mobile (GTP/5G/SIP)</option>
                <option value="enterprise">🏢 Enterprise &amp; Cloud</option>
              </select>
            </div>

            {/* Utilisation level dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <select
                value={trafficUtilisationLevel}
                onChange={(e) => setTrafficUtilisationLevel(e.target.value as TrafficUtilisationLevel)}
                title="Select target link utilisation intensity for generated traffic streams"
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                  padding: '5px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                <option value="low">📉 Low (~10% · 1G on 10G)</option>
                <option value="25">📉 25% Utilisation (2.5G on 10G)</option>
                <option value="medium">📊 Medium (~50% · 5G on 10G)</option>
                <option value="75">📈 75% Utilisation (7.5G on 10G)</option>
                <option value="high">📈 High (~80% · 8G on 10G)</option>
                <option value="max">🔥 Maximum (~95% · 9.5G on 10G)</option>
                <option value="full">⚡ Line Rate (100% · 10G on 10G)</option>
              </select>
            </div>

            {/* Auto-generate button */}
            <button
              onClick={handleAutoGenerate}
              title="Automatically create traffic generator flows for all tapped links and ingress ports (~50% link utilisation)"
              style={{
                background: 'rgba(0, 229, 255, 0.15)',
                border: '1px solid rgba(0, 229, 255, 0.4)',
                color: '#00e5ff',
                padding: '6px 12px',
                fontSize: '12px',
                borderRadius: '4px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              ⚡ Auto-Generate Flows
            </button>

            {/* Reset column widths button */}
            <button
              onClick={resetColumnWidths}
              title="Reset table column widths to default layout"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                padding: '6px 8px',
                fontSize: '11px',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              ⟲ Reset Columns
            </button>

            {/* Clear All button */}
            {trafficStreams.length > 0 && (
              <button
                onClick={handleClearAll}
                title="Clear all traffic streams"
                style={{
                  background: 'rgba(239, 83, 80, 0.12)',
                  border: '1px solid rgba(239, 83, 80, 0.3)',
                  color: '#ef5350',
                  padding: '6px 10px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Clear All
              </button>
            )}

            <button
              className={`sim-btn ${isRunning ? 'running' : ''}`}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                backgroundColor: isRunning ? 'rgba(239, 83, 80, 0.2)' : 'rgba(37, 179, 75, 0.2)',
                border: isRunning ? '1px solid rgba(239, 83, 80, 0.4)' : '1px solid rgba(37, 179, 75, 0.4)',
                color: isRunning ? '#ef5350' : 'var(--color-green)',
                borderRadius: '4px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onClick={toggleSimulation}
            >
              {isRunning ? '⏸ Pause Simulation' : '▶ Run Simulation'}
            </button>
            <button className="primary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={handleAddStream}>
              + Inject Traffic Stream
            </button>
          </div>
          )}
        </div>

        {/* Stream table or empty state */}
        {!isCollapsed && (trafficStreams.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <span>
              No traffic streams currently injected. Click &quot;⚡ Auto-Generate Flows&quot; to populate all {ingressSummary.totalMonitoredLinks > 0 ? `${ingressSummary.totalMonitoredLinks} monitored links` : 'tapped links'} (~50% utilisation), or &quot;+ Inject Traffic Stream&quot; for single streams.
            </span>
            {ingressSummary.totalMonitoredLinks > 0 && (
              <button
                onClick={handleAutoGenerate}
                style={{
                  background: 'rgba(0, 229, 255, 0.15)',
                  border: '1px solid rgba(0, 229, 255, 0.4)',
                  color: '#00e5ff',
                  padding: '6px 16px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                ⚡ Auto-Generate {ingressSummary.totalMonitoredLinks} Flow{ingressSummary.totalMonitoredLinks !== 1 ? 's' : ''} for All Links
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: `${drawerHeight - 60}px` }}>
            <table style={{ width: '100%', minWidth: `${totalTableWidth}px`, tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left', color: 'var(--text-secondary)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                  <ResizableHeader colKey="dataCentre" label="Data Centre" />
                  <ResizableHeader colKey="name" label="Name" />
                  <ResizableHeader colKey="ingress" label="Ingress Port" />
                  <ResizableHeader colKey="vlan" label="VLAN" />
                  <ResizableHeader colKey="proto" label="Proto" />
                  <ResizableHeader colKey="ipSrc" label="Source IP" />
                  <ResizableHeader colKey="ipDst" label="Dest IP" />
                  <ResizableHeader colKey="portDst" label="Dst Port" />
                  <ResizableHeader colKey="rate" label="Rate" />
                  <ResizableHeader colKey="status" label="Status" />
                  <ResizableHeader colKey="encrypted" label="Encrypted" textAlign="center" />
                  <ResizableHeader colKey="active" label="Active" textAlign="center" />
                  <ResizableHeader colKey="action" label="Action" textAlign="center" />
                </tr>
              </thead>
              <tbody>
                {filteredStreams.length === 0 ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                      No traffic streams found for Data Centre &quot;{selectedDcFilter}&quot;.
                      <button
                        onClick={() => setSelectedDcFilter('all')}
                        style={{
                          marginLeft: '12px',
                          background: 'rgba(0, 229, 255, 0.15)',
                          border: '1px solid rgba(0, 229, 255, 0.4)',
                          color: '#00e5ff',
                          padding: '3px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                      >
                        Show All Data Centres
                      </button>
                    </td>
                  </tr>
                ) : groupByDc && availableSites.length > 0 ? (
                  groupedStreams.map(([site, siteStreams]) => {
                    const isDcCollapsed = collapsedDcs[site] || false;
                    const palette = getSiteBadgeStyle(site === 'Unassigned' ? '' : site);
                    const activeCount = siteStreams.filter((s) => s.active).length;
                    const activeBandwidth = siteStreams.filter((s) => s.active).reduce((sum, s) => sum + s.bandwidth, 0);
                    const activeBwLabel = activeBandwidth >= 1000
                      ? `${(activeBandwidth / 1000).toFixed(1).replace('.0', '')} Gbps`
                      : `${activeBandwidth} Mbps`;

                    return (
                      <React.Fragment key={`dc-grp-${site}`}>
                        <tr style={{ background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                          <td colSpan={13} style={{ padding: '6px 8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => toggleDcCollapsed(site)}
                              >
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '12px', display: 'inline-block' }}>
                                  {isDcCollapsed ? '▸' : '▾'}
                                </span>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  background: palette.bg,
                                  border: `1px solid ${palette.border}`,
                                  color: palette.text,
                                }}>
                                  🏢 Data Centre: {site}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                  {siteStreams.length} stream{siteStreams.length !== 1 ? 's' : ''} ({activeCount} active · {activeBwLabel})
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const allActive = siteStreams.every((s) => s.active);
                                    toggleAllInDc(site, !allActive);
                                  }}
                                  title={`Toggle active state for all streams in ${site}`}
                                  style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-secondary)',
                                    fontSize: '10px',
                                    padding: '2px 8px',
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {siteStreams.every((s) => s.active) ? 'Disable All' : 'Enable All'}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {!isDcCollapsed && siteStreams.map((stream) => renderStreamRow(stream))}
                      </React.Fragment>
                    );
                  })
                ) : (
                  filteredStreams.map((stream) => renderStreamRow(stream))
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrafficGenerator;
