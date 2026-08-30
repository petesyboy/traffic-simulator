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

import React, { useState, useRef, useCallback } from 'react';
import { useStore, type TrafficStream } from '../store/store';
import type { TappedLinkAllocation } from '../store/types';
import { getOpticSpeedMbps } from '../utils/hardwareUtils';
import { isAutoTrayModel } from '../utils/trayModels';
import {
  generateStreamsForTopology,
  getTopologyIngressSummary,
  type TrafficProfileBias,
} from '../utils/trafficStreamUtils';

// Sub-1Gbps presets are only offered in Advanced Mode - they exist to model
// ingest-limited sensors (e.g. ForeScout, capped at 1Gbps) that need a feed
// throttled below a full 1Gbps link, which Standard mode users don't need
// to see.
const STANDARD_BANDWIDTH_PRESETS = [1000, 10000, 25000, 40000, 100000];
const ADVANCED_BANDWIDTH_PRESETS = [100, 250, 500, ...STANDARD_BANDWIDTH_PRESETS];

const formatBandwidthOption = (mbps: number): string =>
  mbps >= 1000 ? `${(mbps / 1000).toFixed(1).replace('.0', '')} Gbps` : `${mbps} Mbps`;

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  name: 360,
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
  const addTrafficStream      = useStore((state) => state.addTrafficStream);
  const setTrafficStreams     = useStore((state) => state.setTrafficStreams);
  const clearTrafficStreams   = useStore((state) => state.clearTrafficStreams);
  const updateTrafficStream   = useStore((state) => state.updateTrafficStream);
  const deleteTrafficStream   = useStore((state) => state.deleteTrafficStream);
  const trafficProfileBias    = useStore((state) => state.trafficProfileBias || 'mixed');
  const setTrafficProfileBias = useStore((state) => state.setTrafficProfileBias);
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
      utilizationMin: 0.42,
      utilizationMax: 0.58,
    });

    if (generated.length > 0) {
      setTrafficStreams(generated);
      const biasLabel = trafficProfileBias === 'telco'
        ? 'Telco & Mobile Core'
        : (trafficProfileBias === 'enterprise' ? 'Enterprise' : 'Mixed');
      setAutoGenNotice(`✨ Auto-generated ${generated.length} flow${generated.length !== 1 ? 's' : ''} across all monitored links (~50% utilisation, ${biasLabel} profile).`);
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

    const newStream: TrafficStream = {
      id: `t-${Date.now()}`,
      name: `Traffic Stream ${trafficStreams.length + 1} (${defaultBandwidth >= 1000 ? defaultBandwidth/1000 + ' Gbps' : defaultBandwidth + ' Mbps'})`,
      sourceNodeId: sourceNode.id,
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
                {trafficStreams.map((stream) => (
                  <tr key={stream.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
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
                        onChange={(e) => handleFieldChange(stream.id, 'sourceNodeId', e.target.value)}
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
                        {inputPorts.map((port) => (
                          <option key={port.id} value={port.id}>
                            {port.data.label as string}
                          </option>
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
                      ) : deliveredStreams.some(id => id === stream.id || id.startsWith(`${stream.id}-`)) ? (
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
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrafficGenerator;
