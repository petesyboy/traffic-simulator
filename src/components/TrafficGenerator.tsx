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

const TrafficGenerator: React.FC = () => {
  const trafficStreams    = useStore((state) => state.trafficStreams);
  const nodes            = useStore((state) => state.nodes);
  const addTrafficStream  = useStore((state) => state.addTrafficStream);
  const updateTrafficStream = useStore((state) => state.updateTrafficStream);
  const deleteTrafficStream = useStore((state) => state.deleteTrafficStream);
  const deliveredStreams  = useStore((state) => state.deliveredStreams);
  const isRunning        = useStore((state) => state.isRunning);
  const toggleSimulation = useStore((state) => state.toggleSimulation);
  const edges            = useStore((state) => state.edges);

  // Resizable tray: tracks the current drawer height in pixels.
  const [drawerHeight, setDrawerHeight] = useState(220);
  const dragStartY   = useRef<number>(0);
  const dragStartH   = useRef<number>(220);

  // Minimum and maximum heights for the tray
  const MIN_HEIGHT = 80;
  const MAX_HEIGHT = 500;

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
    (node.type === 'hardwareNode' && typeof node.data.model === 'string' && node.data.model.includes('TAP'))
  );
  const [noPortError, setNoPortError] = useState(false);
  const [streamLimitError, setStreamLimitError] = useState(false);

  const handleAddStream = () => {
    if (inputPorts.length === 0) {
      // Show an inline error notice instead of alert()
      setNoPortError(true);
      setTimeout(() => setNoPortError(false), 3000);
      return;
    }
    setNoPortError(false);

    const totalTappedLinks = nodes.reduce((sum, n) => {
      if (n.type === 'hardwareNode' && String(n.data?.model || '').includes('TAP')) {
        return sum + ((n.data?.tappedLinksCount as number) ?? 1);
      }
      return sum;
    }, 0);

    if (trafficStreams.length >= totalTappedLinks) {
      setStreamLimitError(true);
      setTimeout(() => setStreamLimitError(false), 4000);
      return;
    }
    setStreamLimitError(false);
    
    const sourceNode = inputPorts[0];
    let defaultBandwidth = 10000;
    
    if (sourceNode.type === 'hardwareNode' && typeof sourceNode.data.model === 'string' && sourceNode.data.model.includes('TAP')) {
      const outgoingEdges = edges.filter(e => e.source === sourceNode.id);
      if (outgoingEdges.length > 0) {
        const targetNode = nodes.find(n => n.id === outgoingEdges[0].target);
        if (targetNode && targetNode.data.optics) {
          const optics = targetNode.data.optics as any[];
          let maxSpeedValue = 0;
          optics.forEach(opt => {
            const match = opt.optic.match(/(1|10|25|40|100|400)G/i);
            if (match) {
              const val = parseInt(match[1]);
              if (val > maxSpeedValue) maxSpeedValue = val;
            }
          });
          if (maxSpeedValue > 0) {
            const numLinks = (sourceNode.data.tappedLinksCount as number) ?? 1;
            defaultBandwidth = numLinks * maxSpeedValue * 1000;
          }
        }
      }
    }

    const newStream: TrafficStream = {
      id: `t-${Date.now()}`,
      name: `Traffic Stream ${trafficStreams.length + 1} (${defaultBandwidth >= 1000 ? defaultBandwidth/1000 + ' Gbps' : defaultBandwidth + ' Mbps'})`,
      sourceNodeId: sourceNode.id,
      vlan: '100',
      ipSrc: '192.168.1.50',
      ipDst: '10.0.0.100',
      portSrc: '50231',
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

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {/* ── Drag handle ──────────────────────────────────────────────────────── */}
      {/*
        A thin stripe at the top of the drawer.  When the user clicks and
        drags it upward/downward, the drawer height changes.
        The cursor: 'ns-resize' signal makes the intent obvious.
      */}
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

      {/* ── Drawer body ──────────────────────────────────────────────────────── */}
      <div
        className="bottom-drawer"
        style={{ maxHeight: `${drawerHeight}px`, height: `${drawerHeight}px`, overflow: 'hidden' }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📊 Live Traffic Generator &amp; Injector
          </h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Inline error notice (replaces alert()) */}
            {noPortError && (
              <span style={{ fontSize: '11px', color: '#ff9100', background: 'rgba(255,145,0,0.1)', border: '1px solid rgba(255,145,0,0.3)', borderRadius: '4px', padding: '4px 8px' }}>
                ⚠️ Add a Network Input port first
              </span>
            )}
            {streamLimitError && (() => {
              const totalTappedLinks = nodes.reduce((sum, n) => {
                if (n.type === 'hardwareNode' && String(n.data?.model || '').includes('TAP')) {
                  return sum + ((n.data?.tappedLinksCount as number) ?? 1);
                }
                return sum;
              }, 0);
              return (
                <span style={{ fontSize: '11px', color: '#ef5350', background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.3)', borderRadius: '4px', padding: '4px 8px' }}>
                  ⚠️ Cannot exceed total tapped links in solution ({totalTappedLinks})
                </span>
              );
            })()}
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
        </div>

        {/* Stream table or empty state */}
        {trafficStreams.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '15px 0', fontSize: '13px' }}>
            No traffic streams currently injected. Click &quot;+ Inject Traffic Stream&quot; to simulate network load.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: `${drawerHeight - 60}px` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left', color: 'var(--text-secondary)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                  <th style={{ padding: '6px 4px', width: '180px' }}>Name</th>
                  <th style={{ padding: '6px 4px' }}>Ingress Port</th>
                  <th style={{ padding: '6px 4px', width: '70px' }}>VLAN</th>
                  <th style={{ padding: '6px 4px', width: '70px' }}>Proto</th>
                  <th style={{ padding: '6px 4px' }}>Source IP</th>
                  <th style={{ padding: '6px 4px' }}>Dest IP</th>
                  <th style={{ padding: '6px 4px', width: '70px' }}>Dst Port</th>
                  <th style={{ padding: '6px 4px', width: '100px' }}>Rate</th>
                  <th style={{ padding: '6px 4px', width: '90px' }}>Status</th>
                  <th style={{ padding: '6px 4px', width: '60px', textAlign: 'center' }}>Active</th>
                  <th style={{ padding: '6px 4px', width: '60px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {trafficStreams.map((stream) => (
                  <tr key={stream.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '4px 2px' }}>
                      <input
                        type="text"
                        value={stream.name}
                        onChange={(e) => handleFieldChange(stream.id, 'name', e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '12px', width: '175px', borderBottom: '1px solid transparent' }}
                        onFocus={(e) => e.target.style.borderBottom = '1px solid var(--text-muted)'}
                        onBlur={(e) => e.target.style.borderBottom = '1px solid transparent'}
                      />
                    </td>
                    <td style={{ padding: '4px 2px' }}>
                      <select
                        value={stream.sourceNodeId}
                        onChange={(e) => handleFieldChange(stream.id, 'sourceNodeId', e.target.value)}
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '11px', padding: '2px 4px', borderRadius: '4px', width: '120px' }}
                      >
                        {inputPorts.map((port) => (
                          <option key={port.id} value={port.id}>
                            {port.data.label as string}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '4px 2px' }}>
                      <input
                        type="text"
                        value={stream.vlan}
                        onChange={(e) => handleFieldChange(stream.id, 'vlan', e.target.value)}
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '11px', padding: '2px 4px', borderRadius: '4px', width: '50px' }}
                      />
                    </td>
                    <td style={{ padding: '4px 2px' }}>
                      <select
                        value={stream.protocol}
                        onChange={(e) => handleFieldChange(stream.id, 'protocol', e.target.value)}
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '11px', padding: '2px 4px', borderRadius: '4px', width: '60px' }}
                      >
                        <option value="tcp">TCP</option>
                        <option value="udp">UDP</option>
                        <option value="icmp">ICMP</option>
                      </select>
                    </td>
                    <td style={{ padding: '4px 2px' }}>
                      <input
                        type="text"
                        value={stream.ipSrc}
                        onChange={(e) => handleFieldChange(stream.id, 'ipSrc', e.target.value)}
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '11px', padding: '2px 4px', borderRadius: '4px', width: '100px' }}
                      />
                    </td>
                    <td style={{ padding: '4px 2px' }}>
                      <input
                        type="text"
                        value={stream.ipDst}
                        onChange={(e) => handleFieldChange(stream.id, 'ipDst', e.target.value)}
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '11px', padding: '2px 4px', borderRadius: '4px', width: '100px' }}
                      />
                    </td>
                    <td style={{ padding: '4px 2px' }}>
                      <input
                        type="text"
                        value={stream.portDst}
                        onChange={(e) => handleFieldChange(stream.id, 'portDst', e.target.value)}
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '11px', padding: '2px 4px', borderRadius: '4px', width: '50px' }}
                      />
                    </td>
                    <td style={{ padding: '4px 2px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <select
                          value={stream.bandwidth}
                          onChange={(e) => handleFieldChange(stream.id, 'bandwidth', Number(e.target.value))}
                          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '11px', padding: '2px 4px', borderRadius: '4px', width: '90px' }}
                        >
                          {![1000, 10000, 25000, 40000, 100000].includes(stream.bandwidth) && (
                            <option value={stream.bandwidth}>
                              {stream.bandwidth >= 1000 ? `${(stream.bandwidth / 1000).toFixed(1).replace('.0', '')} Gbps` : `${stream.bandwidth} Mbps`}
                            </option>
                          )}
                          <option value={1000}>1 Gbps</option>
                          <option value={10000}>10 Gbps</option>
                          <option value={25000}>25 Gbps</option>
                          <option value={40000}>40 Gbps</option>
                          <option value={100000}>100 Gbps</option>
                        </select>
                        {/* Live drifted rate (shown while simulation is running) */}
                        {isRunning && stream.active && (
                          <span style={{ fontSize: '10px', color: '#4caf50', fontWeight: 'bold', display: 'block', paddingLeft: '2px' }}>
                            ~{((stream.bandwidth * (stream.drift || 1.0)) / 1000).toFixed(2)} Gbps
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '4px 2px' }}>
                      {/* Status badge: Idle / Inactive / ✓ Passed / ❌ Filtered */}
                      {!isRunning ? (
                        <span style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', fontSize: '10px', color: '#888', display: 'inline-block' }}>
                          Idle
                        </span>
                      ) : !stream.active ? (
                        <span style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '3px', fontSize: '10px', color: '#666', display: 'inline-block' }}>
                          Inactive
                        </span>
                      ) : deliveredStreams.includes(stream.id) ? (
                        <span style={{ padding: '2px 6px', background: 'rgba(76, 175, 80, 0.12)', border: '1px solid rgba(76, 175, 80, 0.25)', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold', color: '#4caf50', display: 'inline-block', whiteSpace: 'nowrap' }}>
                          ✓ Passed
                        </span>
                      ) : (
                        <span style={{ padding: '2px 6px', background: 'rgba(239, 83, 80, 0.12)', border: '1px solid rgba(239, 83, 80, 0.25)', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold', color: '#ef5350', display: 'inline-block', whiteSpace: 'nowrap' }}>
                          ❌ Filtered
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '4px 2px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={stream.active}
                        onChange={(e) => handleFieldChange(stream.id, 'active', e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '4px 2px' }}>
                      <button className="danger" style={{ padding: '2px 6px', fontSize: '10px' }} onClick={() => deleteTrafficStream(stream.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrafficGenerator;
