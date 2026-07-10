import React, { useState } from 'react';
import { useStore } from '../store/store';

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

  // Simple hardcoded rack heights (RU) for known devices based on design spec
  const getDeviceRU = (model: string): number => {
    if (!model) return 1;
    if (model.includes('HC3')) return 3;
    if (model.includes('HC1')) return 1;
    if (model.includes('HCT')) return 1;
    if (model.includes('TA25E') || model.includes('TA200') || model.includes('TA400')) return 1;
    if (model.includes('TAP')) return 1; // Assuming M-series fits in 1U trays
    return 1;
  };

  const rackedNodes = rackableNodes.filter(n => n.data?.rackId === rackId && typeof n.data?.rackU === 'number');
  const unrackedNodes = rackableNodes.filter(n => n.data?.rackId !== rackId);

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
      updateNodeData(nodeId, { rackId, rackU: uPosition });
    }
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
                  <div style={{ fontSize: '12px', color: '#aaa' }}>{getDeviceRU(String(node.data?.model || ''))} RU</div>
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
                const ru = getDeviceRU(String(n.data?.model || ''));
                return u >= startU && u < startU + ru;
              });

              if (isCovered && !occupyingNode) {
                return null;
              }

              if (occupyingNode) {
                const ru = getDeviceRU(String(occupyingNode.data?.model || ''));
                return (
                  <div 
                    key={u}
                    draggable
                    onDragStart={(e) => handleDragStart(e, occupyingNode.id)}
                    style={{ 
                      height: `${ru * 24}px`, 
                      background: '#007cff', 
                      color: '#fff',
                      borderBottom: '1px solid #0056b3',
                      borderTop: '1px solid #4da6ff',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 10px',
                      position: 'relative',
                      cursor: 'grab',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{ position: 'absolute', left: '-25px', color: '#666', fontSize: '10px' }}>{u}</div>
                    <div style={{ fontWeight: 'bold', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {occupyingNode.data?.model} - {occupyingNode.data?.label}
                    </div>
                    <button 
                      onClick={() => updateNodeData(occupyingNode.id, { rackId: undefined, rackU: undefined })}
                      style={{ position: 'absolute', right: '10px', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '14px' }}
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
