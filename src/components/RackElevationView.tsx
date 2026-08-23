import React, { useState } from 'react';
import { useStore } from '../store/store';
import type { CustomNode, HardwareNodeData } from '../store/types';
import hardwareCatalogue from '../constants/hardwareCatalogue.json';
import { resolveHardwareIcon } from '../assets/hardwareIcons';
import { getModuleSlotPositions, getTrayBayCount, isTapModule } from '../utils/hardwareUtils';
import { getChassisPorts, getPortOpticMap } from '../utils/ports';
import { ChassisFrontPanel } from './nodes/ChassisFrontPanel';
import { ChassisSummaryModal } from './nodes/ChassisSummaryModal';

export interface RackElevationViewProps {
  nodes?: CustomNode[];
  updateNodeData?: (nodeId: string, data: Record<string, unknown>) => void;
}

const RackElevationView: React.FC<RackElevationViewProps> = (props) => {
  const storeNodes = useStore((state) => state.nodes);
  const storeUpdateNodeData = useStore((state) => state.updateNodeData);
  const nodes = props.nodes ?? storeNodes;
  const updateNodeData = props.updateNodeData ?? storeUpdateNodeData;

  const [selectedSite, setSelectedSite] = useState<string>('');
  const [zoom, setZoom] = useState<number>(1);
  const [hideLabels, setHideLabels] = useState<boolean>(false);
  const [inspectingNode, setInspectingNode] = useState<CustomNode | null>(null);

  const handleZoomIn = () => setZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))));
  const handleZoomReset = () => setZoom(1);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        setZoom((z) => Math.min(2.5, Number((z + 0.1).toFixed(2))));
      } else {
        setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))));
      }
    }
  };

  // Filter hardware nodes that represent rack-mountable chassis
  const allHardwareNodes = nodes.filter(n => n.type === 'hardwareNode' || n.data?.configType === 'TAP Device');

  // Extract unique sites from all hardware/TAP nodes
  const uniqueSites = Array.from(
    new Set(
      allHardwareNodes
        .map(n => (n.data?.site as string || '').trim())
        .filter(s => s !== '')
    )
  );

  const hasUnassigned = allHardwareNodes.some(n => !n.data?.site);
  if (hasUnassigned || uniqueSites.length === 0) {
    uniqueSites.unshift('Global / Unassigned');
  }

  const activeSite = uniqueSites.includes(selectedSite)
    ? selectedSite
    : (uniqueSites[0] || 'Global / Unassigned');

  // Filter hardware nodes that represent rack-mountable chassis for the active site
  const rackableNodes = allHardwareNodes.filter(n => {
    const nodeSite = (n.data?.site as string || '').trim();
    if (activeSite === 'Global / Unassigned') {
      return !nodeSite;
    }
    return nodeSite === activeSite;
  });

  const rackId = activeSite === 'Global / Unassigned' ? 'rack_global' : `rack_${activeSite}`;

  // Rack height (RU) for a device - prefers the catalogue's own `ru` field (this is
  // what makes a TAP-M100T correctly take 0.5U and a TAP-M200T 1U instead of both
  // falling into the old blanket "any TAP = 1U" guess) and falls back to the old
  // model-name heuristics for entries that don't carry one.
  const getDeviceRU = (model: string, sku?: string): number => {
    if (!model) return 1;
    const catalogueEntry = [...hardwareCatalogue.taps, ...hardwareCatalogue.ta_series, ...hardwareCatalogue.hc_series]
      .find((c: { model: string; sku: string; ru?: number }) => (sku && c.sku === sku) || c.model === model) as
      { ru?: number } | undefined;
    if (catalogueEntry?.ru !== undefined) return catalogueEntry.ru;
    if (model.includes('HC3')) return 3;
    if (model.includes('HC1')) return 1;
    if (model.includes('HCT')) return 1;
    if (model.includes('TA25E') || model.includes('TA200') || model.includes('TA400')) return 1;
    if (model.includes('TAP')) return 1; // Assuming M-series fits in 1U trays
    return 1;
  };

  const rackedNodes = rackableNodes.filter(n => n.data?.rackId === rackId && typeof n.data?.rackU === 'number');

  // A tap-module nested in a tray's bay is "resolved" (hidden from Unracked Hardware)
  // only while its parent tray is itself actually racked here - computed live rather
  // than stored, so un-racking a tray automatically surfaces its nested modules back
  // into Unracked Hardware, and re-racking the same tray silently restores them.
  const isNestedInRackedTray = (n: (typeof rackableNodes)[number]) => {
    const trayId = n.data?.trayId as string | undefined;
    if (!trayId) return false;
    const tray = rackableNodes.find(t => t.id === trayId);
    return Boolean(tray && tray.data?.rackId === rackId && typeof tray.data?.rackU === 'number');
  };

  const unrackedNodes = rackableNodes.filter(n =>
    n.data?.rackId !== rackId && !isNestedInRackedTray(n)
  );

  // Calculate stats
  const totalWeight = rackedNodes.reduce((acc, n) => {
    // Rough estimates: HC3 = 50lbs, HC1 = 20lbs, TAs = 15lbs
    const model = String(n.data?.model || '');
    if (model.includes('HC3')) return acc + 50;
    if (model.includes('HC1')) return acc + 20;
    return acc + 15;
  }, 0);

  const totalBtu = rackedNodes.reduce((acc, n) => {
    const model = String(n.data?.model || '');
    if (model.includes('HC3')) return acc + 6824;
    if (model.includes('HC1-Plus')) return acc + 2216;
    if (model.includes('HC1')) return acc + 1227;
    if (model.includes('HCT')) return acc + 975;
    if (model.includes('TA')) return acc + 1500;
    return acc + 100;
  }, 0);

  // Create an array of 42 Units, reversed so 42 is at the top
  const rackUnits = Array.from({ length: 42 }, (_, i) => 42 - i);

  const handleDrop = (e: React.DragEvent, uPosition: number) => {
    e.preventDefault();
    const nodeId = e.dataTransfer.getData('nodeId');
    if (nodeId) {
      updateNodeData(nodeId, { rackId, rackU: uPosition, trayId: undefined, traySlot: undefined });
    }
  };

  const handleBayDrop = (e: React.DragEvent, trayNodeId: string, bay: number) => {
    e.preventDefault();
    const nodeId = e.dataTransfer.getData('nodeId');
    if (!nodeId) return;
    const dragged = nodes.find(n => n.id === nodeId);
    const model = String(dragged?.data?.model || '');
    const sku = dragged?.data?.sku as string | undefined;
    if (!isTapModule(model, sku)) {
      alert(`Only tap modules (TAP-M251T, TAP-M253T, etc.) or breakout panels (PNL-M341T, PNL-M343T) can be fitted into a tray bay - "${model}" isn't one.`);
      return;
    }
    updateNodeData(nodeId, { trayId: trayNodeId, traySlot: bay, rackId: undefined, rackU: undefined });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragStart = (e: React.DragEvent, nodeId: string) => {
    e.dataTransfer.setData('nodeId', nodeId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e1e', color: '#fff', padding: '16px', boxSizing: 'border-box', overflow: 'hidden' }}>
      
      {/* HEADER: SITE SELECTOR + ZOOM CONTROLS */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '16px', background: '#252526', padding: '10px 16px', borderRadius: '8px', border: '1px solid #333', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#ff9800' }}>📍 Select Site:</span>
          <select
            value={activeSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            style={{
              padding: '6px 12px',
              background: '#121212',
              border: '1px solid #444',
              borderRadius: '4px',
              color: '#e0e0e0',
              fontSize: '12px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {uniqueSites.map(site => (
              <option key={site} value={site}>{site}</option>
            ))}
          </select>
          <span style={{ fontSize: '11px', color: '#aaa' }}>
            Site: <strong style={{ color: '#00e5ff' }}>{activeSite}</strong>
          </span>
        </div>

        {/* ZOOM CONTROLS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#181818', padding: '4px 10px', borderRadius: '6px', border: '1px solid #3a3a3a' }}>
          <span style={{ fontSize: '12px', color: '#aaa', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
            🔍 Zoom:
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            title="Zoom Out (Step -25%)"
            style={{ padding: '2px 8px', fontSize: '13px', minWidth: '26px', color: zoom <= 0.5 ? '#555' : '#fff' }}
          >
            −
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleZoomReset}
            title="Reset Zoom to 100%"
            style={{
              padding: '2px 8px',
              fontSize: '12px',
              fontWeight: zoom === 1 ? 'bold' : 'normal',
              color: zoom === 1 ? '#00e5ff' : '#ccc',
              minWidth: '50px',
              textAlign: 'center',
            }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleZoomIn}
            disabled={zoom >= 2.5}
            title="Zoom In (Step +25%)"
            style={{ padding: '2px 8px', fontSize: '13px', minWidth: '26px', color: zoom >= 2.5 ? '#555' : '#fff' }}
          >
            +
          </button>
          <div style={{ width: '1px', height: '14px', background: '#444', margin: '0 4px' }} />
          {[0.75, 1, 1.5, 2].map((preset) => (
            <button
              key={preset}
              className="btn btn-ghost btn-sm"
              onClick={() => setZoom(preset)}
              style={{
                padding: '2px 6px',
                fontSize: '11px',
                color: zoom === preset ? '#00e5ff' : '#888',
                fontWeight: zoom === preset ? 'bold' : 'normal',
                background: zoom === preset ? 'rgba(0,229,255,0.12)' : 'transparent',
                borderRadius: '3px',
              }}
            >
              {Math.round(preset * 100)}%
            </button>
          ))}
          <span style={{ fontSize: '10px', color: '#666', marginLeft: '4px' }}>
            (Ctrl + Scroll)
          </span>
          <div style={{ width: '1px', height: '14px', background: '#444', margin: '0 4px' }} />
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              color: hideLabels ? '#00e5ff' : '#aaa',
              cursor: 'pointer',
              userSelect: 'none',
              marginLeft: '4px',
              fontWeight: hideLabels ? 'bold' : 'normal',
            }}
            title="Toggle to hide equipment labels across all chassis and TAP trays in the rack"
          >
            <input
              type="checkbox"
              checked={hideLabels}
              onChange={(e) => setHideLabels(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: '#00e5ff' }}
            />
            <span>Hide Labels</span>
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: '20px', overflow: 'hidden' }}>
        {/* ── UNRACKED ASSETS PANEL ── */}
        <div style={{ width: '280px', flexShrink: 0, background: '#252526', border: '1px solid #333', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '16px', borderBottom: '1px solid #444', paddingBottom: '8px' }}>Unracked Hardware</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1 }}>
            {unrackedNodes.length === 0 ? (
              <div style={{ color: '#666', fontSize: '13px', fontStyle: 'italic' }}>All site hardware is racked.</div>
            ) : (
              unrackedNodes.map(node => (
                <div 
                  key={node.id} 
                  draggable 
                  onDragStart={(e) => handleDragStart(e, node.id)}
                  style={{ background: '#333', padding: '10px 12px', borderRadius: '4px', cursor: 'grab', border: '1px solid #444' }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '2px' }}>{node.data?.label || node.data?.model}</div>
                  <div style={{ fontSize: '11px', color: '#aaa' }}>
                    {isTapModule(String(node.data?.model || ''), node.data?.sku as string | undefined)
                      ? 'Tap/breakout module - drop into a tray bay'
                      : `${getDeviceRU(String(node.data?.model || ''), node.data?.sku as string | undefined)} RU`}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* METRICS DASHBOARD */}
          <div style={{ marginTop: '16px', background: '#111', padding: '14px', borderRadius: '8px', border: '1px solid #333' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#ffb74d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeSite} Metrics
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
              <span style={{ color: '#888' }}>Weight</span>
              <span style={{ fontWeight: 'bold' }}>{totalWeight} lbs</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: '#888' }}>Heat Dissipation</span>
              <span style={{ fontWeight: 'bold' }}>{totalBtu.toLocaleString()} BTU/hr</span>
            </div>
          </div>
        </div>

        {/* ── 42U RACK VISUALIZATION VIEWPORT ── */}
        <div
          onWheel={handleWheel}
          style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            padding: '20px',
            background: '#161616',
            borderRadius: '8px',
            border: '1px solid #2d2d2d',
          }}
        >
          <div
            style={{
              width: `${420 * zoom}px`,
              minHeight: `${1060 * zoom}px`,
              display: 'flex',
              justifyContent: 'center',
              flexShrink: 0,
              paddingBottom: '20px',
            }}
          >
            <div
              style={{
                width: '420px',
                transform: `scale(${zoom})`,
                transformOrigin: 'top center',
                transition: 'transform 0.1s ease-out',
                background: '#111',
                border: '10px solid #2d2d2d',
                borderTop: '20px solid #2d2d2d',
                borderBottom: '20px solid #2d2d2d',
                borderRadius: '4px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
              }}
            >
            {rackUnits.map(u => {
              const occupyingNode = rackedNodes.find(n => n.data?.rackU === u);

              const isCovered = rackedNodes.some(n => {
                const startU = Number(n.data?.rackU);
                const ru = getDeviceRU(String(n.data?.model || ''), n.data?.sku as string | undefined);
                return u >= startU && u < startU + ru;
              });

              if (isCovered && !occupyingNode) {
                return null;
              }

              if (occupyingNode) {
                const model = String(occupyingNode.data?.model || '');
                const sku = occupyingNode.data?.sku as string | undefined;
                const ru = getDeviceRU(model, sku);
                const rowHeight = ru * 24;
                const bays = getTrayBayCount(model, sku);

                if (bays > 0) {
                  const nested = rackableNodes.filter(n => n.data?.trayId === occupyingNode.id);
                  const resolvedTrayImage = resolveHardwareIcon(occupyingNode.data?.image as string | undefined);
                  return (
                    <div
                      key={u}
                      style={{
                        height: `${rowHeight}px`,
                        display: 'flex',
                        borderBottom: '1px solid #0056b3',
                        borderTop: '1px solid #4da6ff',
                        position: 'relative',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                      }}
                    >
                      {resolvedTrayImage && (
                        <img
                          src={resolvedTrayImage}
                          alt={model}
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }}
                        />
                      )}
                      <div style={{ position: 'absolute', left: '-25px', color: '#666', fontSize: '10px' }}>{u}</div>
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, occupyingNode.id)}
                        title={`${model} - drag to reposition`}
                        style={{
                          width: '14px', flexShrink: 0, cursor: 'grab', position: 'relative', zIndex: 1,
                          background: resolvedTrayImage ? 'transparent' : '#444',
                        }}
                      />
                      {Array.from({ length: bays }, (_, i) => i + 1).map(bay => {
                        const bayNode = nested.find(n => n.data?.traySlot === bay);
                        if (bayNode) {
                          const resolvedBayImage = resolveHardwareIcon(
                            (bayNode.data?.image as string | undefined) || (bayNode.data?.model as string | undefined)
                          );
                          return (
                            <div
                              key={bay}
                              onClick={() => updateNodeData(bayNode.id, { trayId: undefined, traySlot: undefined })}
                              title={`Bay ${bay}: ${bayNode.data?.model} - ${bayNode.data?.label} (click to remove)`}
                              style={{
                                flex: 1, color: '#fff', cursor: 'pointer', position: 'relative', zIndex: 1,
                                background: resolvedBayImage ? '#0a0a0a' : (resolvedTrayImage ? 'rgba(0,124,255,0.55)' : '#007cff'),
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '8px', fontWeight: 'bold', overflow: 'hidden', whiteSpace: 'nowrap',
                                borderRight: '1px solid #0d1117', boxSizing: 'border-box',
                              }}
                            >
                              {resolvedBayImage && (
                                <img
                                  src={resolvedBayImage}
                                  alt={String(bayNode.data?.model || '')}
                                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }}
                                />
                              )}
                              {rowHeight >= 18 && !hideLabels && (
                                <span style={{
                                  position: 'relative', zIndex: 2,
                                  background: resolvedBayImage ? 'rgba(0,0,0,0.65)' : 'transparent',
                                  padding: '1px 3px', borderRadius: '2px',
                                  textShadow: '0 0 3px #000',
                                }}>
                                  {bayNode.data?.model}
                                </span>
                              )}
                            </div>
                          );
                        }
                        return (
                          <div
                            key={bay}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleBayDrop(e, occupyingNode.id, bay)}
                            title={`Bay ${bay} - drop a tap module or breakout panel here`}
                            style={{
                              flex: 1, border: '1px dashed #555', boxSizing: 'border-box', position: 'relative', zIndex: 1,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '7px', color: resolvedTrayImage ? '#fff' : '#666',
                              textShadow: resolvedTrayImage ? '0 0 3px #000' : undefined,
                            }}
                          >
                            {rowHeight >= 18 && !hideLabels ? bay : ''}
                          </div>
                        );
                      })}
                      <button
                        onClick={() => updateNodeData(occupyingNode.id, { rackId: undefined, rackU: undefined })}
                        style={{
                          width: '14px', flexShrink: 0, background: 'transparent', border: 'none', color: '#fff',
                          cursor: 'pointer', fontSize: '9px', padding: 0, position: 'relative', zIndex: 1, textShadow: '0 0 3px #000',
                        }}
                        title="Remove tray from rack"
                      >
                        ✕
                      </button>
                    </div>
                  );
                }

                const resolvedImage = resolveHardwareIcon(occupyingNode.data?.image as string | undefined);
                const slotPositions = getModuleSlotPositions(model, sku);
                const hwData = (occupyingNode.data || {}) as HardwareNodeData;
                const chassisPorts = getChassisPorts(model, hwData);
                const portOpticMap = getPortOpticMap(chassisPorts, hwData.optics);
                const hasFrontPanel = Boolean(resolvedImage) && (slotPositions.some(p => p.box) || chassisPorts.some(p => p.box));

                return (
                  <div
                    key={u}
                    draggable
                    onDragStart={(e) => handleDragStart(e, occupyingNode.id)}
                    style={{
                      height: `${rowHeight}px`,
                      background: resolvedImage ? '#111' : '#007cff',
                      color: '#fff',
                      borderBottom: '1px solid #0056b3',
                      borderTop: '1px solid #4da6ff',
                      display: 'flex',
                      alignItems: 'center',
                      position: 'relative',
                      cursor: 'grab',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ position: 'absolute', left: '-25px', color: '#666', fontSize: '10px' }}>{u}</div>
                    {resolvedImage ? (
                      hasFrontPanel ? (
                        <div style={{ width: '100%', height: '100%' }}>
                          <ChassisFrontPanel
                            chassisImage={resolvedImage}
                            model={model}
                            slotPositions={slotPositions}
                            installedBoards={hwData.installedBoards || {}}
                            ports={chassisPorts}
                            portOpticMap={portOpticMap}
                          />
                        </div>
                      ) : (
                        <img src={resolvedImage} alt={model} style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }} />
                      )
                    ) : (
                      !hideLabels ? (
                        <div style={{ padding: '0 10px', fontWeight: 'bold', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {model} - {occupyingNode.data?.label}
                        </div>
                      ) : null
                    )}
                    {!hideLabels && resolvedImage && (
                      <div style={{
                        position: 'absolute', left: 0, right: 0, bottom: 0, padding: '1px 6px',
                        background: 'rgba(0,0,0,0.6)', fontSize: '9px', fontWeight: 'bold',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {model} - {occupyingNode.data?.label}
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectingNode(occupyingNode as CustomNode);
                      }}
                      style={{
                        position: 'absolute',
                        top: '2px',
                        right: '22px',
                        background: 'rgba(0,0,0,0.7)',
                        border: '1px solid #555',
                        borderRadius: '3px',
                        color: '#00e5ff',
                        cursor: 'pointer',
                        fontSize: '9px',
                        padding: '1px 4px',
                        lineHeight: 1,
                        zIndex: 2,
                        textShadow: '0 0 2px #000',
                      }}
                      title="Inspect chassis details and front panel"
                    >
                      🔍
                    </button>
                    <button
                      onClick={() => updateNodeData(occupyingNode.id, { rackId: undefined, rackU: undefined })}
                      style={{ position: 'absolute', top: '1px', right: '4px', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '14px', textShadow: '0 0 3px #000', zIndex: 2 }}
                      title="Remove from Rack"
                    >
                      ✕
                    </button>
                  </div>
                );
              }

              return (
                <div 
                  key={u}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, u)}
                  style={{ 
                    height: '24px', 
                    borderBottom: '1px dashed #333', 
                    display: 'flex', 
                    alignItems: 'center', 
                    position: 'relative',
                    background: 'transparent',
                    transition: 'background 0.2s',
                    boxSizing: 'border-box'
                  }}
                >
                  <div style={{ position: 'absolute', left: '-25px', color: '#666', fontSize: '10px' }}>{u}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
      {inspectingNode && (
        <ChassisSummaryModal
          model={String(inspectingNode.data?.model || '')}
          sku={String(inspectingNode.data?.sku || '')}
          displaySku={String(inspectingNode.data?.sku || inspectingNode.data?.model || '')}
          label={String(inspectingNode.data?.label || inspectingNode.data?.model || '')}
          hwData={(inspectingNode.data || {}) as HardwareNodeData}
          onClose={() => setInspectingNode(null)}
        />
      )}
    </div>
  );
};

export default RackElevationView;
