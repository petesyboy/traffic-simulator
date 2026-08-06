import React, { useState } from 'react';
import { useStore } from '../store/store';
import type { HardwareNodeData } from '../store/types';
import hardwareCatalogue from '../constants/hardwareCatalogue.json';
import { resolveHardwareIcon } from '../assets/hardwareIcons';
import { getModuleSlotPositions, getTrayBayCount, isTapModule } from '../utils/hardwareUtils';
import { ChassisFrontPanel } from './nodes/ChassisFrontPanel';

const RackElevationView: React.FC = () => {
  const nodes = useStore((state) => state.nodes);
  const updateNodeData = useStore((state) => state.updateNodeData);

  const [selectedSite, setSelectedSite] = useState<string>('');

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
      alert(`Only tap modules (TAP-M251T, TAP-M253T, etc.) can be fitted into a tray bay - "${model}" isn't one.`);
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e1e', color: '#fff', padding: '20px', boxSizing: 'border-box', overflow: 'hidden' }}>
      
      {/* SITE SELECTOR HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', background: '#252526', padding: '12px 16px', borderRadius: '8px', border: '1px solid #333' }}>
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
            cursor: 'pointer'
          }}
        >
          {uniqueSites.map(site => (
            <option key={site} value={site}>{site}</option>
          ))}
        </select>
        <span style={{ fontSize: '11px', color: '#aaa', marginLeft: 'auto' }}>
          Showing hardware for site: <strong style={{ color: '#00e5ff' }}>{activeSite}</strong>
        </span>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: '20px', overflowY: 'auto' }}>
        {/* ── UNRACKED ASSETS PANEL ── */}
        <div style={{ width: '300px', background: '#252526', border: '1px solid #333', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', borderBottom: '1px solid #444', paddingBottom: '8px' }}>Unracked Hardware</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1 }}>
            {unrackedNodes.length === 0 ? (
              <div style={{ color: '#666', fontSize: '13px', fontStyle: 'italic' }}>All site hardware is racked.</div>
            ) : (
              unrackedNodes.map(node => (
                <div 
                  key={node.id} 
                  draggable 
                  onDragStart={(e) => handleDragStart(e, node.id)}
                  style={{ background: '#333', padding: '12px', borderRadius: '4px', cursor: 'grab', border: '1px solid #444' }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>{node.data?.label || node.data?.model}</div>
                  <div style={{ fontSize: '12px', color: '#aaa' }}>
                    {isTapModule(String(node.data?.model || ''), node.data?.sku as string | undefined)
                      ? 'Tap module - drop into a tray bay'
                      : `${getDeviceRU(String(node.data?.model || ''), node.data?.sku as string | undefined)} RU`}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* METRICS DASHBOARD */}
          <div style={{ marginTop: '20px', background: '#111', padding: '16px', borderRadius: '8px', border: '1px solid #333' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#ffb74d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeSite} Metrics
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
              <span style={{ color: '#888' }}>Weight</span>
              <span style={{ fontWeight: 'bold' }}>{totalWeight} lbs</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#888' }}>Heat Dissipation</span>
              <span style={{ fontWeight: 'bold' }}>{totalBtu.toLocaleString()} BTU/hr</span>
            </div>
          </div>
        </div>

        {/* ── 42U RACK VISUALIZATION ── */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '400px', background: '#111', border: '10px solid #2d2d2d', borderTop: '20px solid #2d2d2d', borderBottom: '20px solid #2d2d2d', borderRadius: '4px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
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
                          return (
                            <div
                              key={bay}
                              onClick={() => updateNodeData(bayNode.id, { trayId: undefined, traySlot: undefined })}
                              title={`Bay ${bay}: ${bayNode.data?.model} - ${bayNode.data?.label} (click to remove)`}
                              style={{
                                flex: 1, color: '#fff', cursor: 'pointer', position: 'relative', zIndex: 1,
                                background: resolvedTrayImage ? 'rgba(0,124,255,0.55)' : '#007cff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '8px', fontWeight: 'bold', overflow: 'hidden', whiteSpace: 'nowrap',
                                borderRight: '1px solid #0d1117', boxSizing: 'border-box',
                              }}
                            >
                              {rowHeight >= 18 ? bayNode.data?.model : ''}
                            </div>
                          );
                        }
                        return (
                          <div
                            key={bay}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleBayDrop(e, occupyingNode.id, bay)}
                            title={`Bay ${bay} - drop a tap module here`}
                            style={{
                              flex: 1, border: '1px dashed #555', boxSizing: 'border-box', position: 'relative', zIndex: 1,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '7px', color: resolvedTrayImage ? '#fff' : '#666',
                              textShadow: resolvedTrayImage ? '0 0 3px #000' : undefined,
                            }}
                          >
                            {rowHeight >= 18 ? bay : ''}
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
                const hasFrontPanel = Boolean(resolvedImage) && slotPositions.some(p => p.box);

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
                            installedBoards={(occupyingNode.data as HardwareNodeData).installedBoards || {}}
                          />
                        </div>
                      ) : (
                        <img src={resolvedImage} alt={model} style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }} />
                      )
                    ) : (
                      <div style={{ padding: '0 10px', fontWeight: 'bold', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {model} - {occupyingNode.data?.label}
                      </div>
                    )}
                    {resolvedImage && (
                      <div style={{
                        position: 'absolute', left: 0, right: 0, bottom: 0, padding: '1px 6px',
                        background: 'rgba(0,0,0,0.6)', fontSize: '9px', fontWeight: 'bold',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {model} - {occupyingNode.data?.label}
                      </div>
                    )}
                    <button
                      onClick={() => updateNodeData(occupyingNode.id, { rackId: undefined, rackU: undefined })}
                      style={{ position: 'absolute', top: '1px', right: '4px', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '14px', textShadow: '0 0 3px #000' }}
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
  );
};

export default RackElevationView;
