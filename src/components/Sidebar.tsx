/**
 * Sidebar.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The left-hand element palette.  Users drag nodes from here onto the canvas.
 *
 * CHANGES (refactor/code-quality-improvements)
 * ─────────────────────────────────────────────
 * • All SVG icon components have been moved to Icons.tsx and are now imported.
 *   Previously they were defined and exported from this file, which coupled
 *   CustomNodes.tsx to Sidebar.tsx as a side effect.
 * • The `appsList` data array is now typed using ACTION_TYPES constants instead
 *   of bare magic strings.
 */

import React, { useState, useEffect } from 'react';
import { useStore } from '../store/store';
import {
  AppIcon, MapIcon, GreenCircleIcon,
  SpanIcon, TapIcon, ErspanIcon, EastWestIcon, VmwareIcon,
  PacketToolIcon, MetadataToolIcon, S3StorageIcon, WiresharkIcon,
} from './Icons';
import { NODE_TYPES, ACTION_TYPES, CONFIG_TYPES } from '../constants/nodeTypes';
import hardwareCatalogue from '../constants/hardwareCatalogue.json';
import skusData from '../constants/skus.json';

const skus: Record<string, string> = skusData as Record<string, string>;

// Re-export icons so existing imports of these from 'Sidebar' continue to work.
// Once all callers are updated to import from Icons.tsx directly these re-exports
// can be removed.
export {
  AppIcon, MapIcon, GreenCircleIcon,
  SpanIcon, TapIcon, ErspanIcon, EastWestIcon, VmwareIcon,
  PacketToolIcon, MetadataToolIcon, S3StorageIcon,
};

// ─── Application palette data ─────────────────────────────────────────────────

/**
 * Each entry in this list becomes a draggable item in the "Applications"
 * section of the sidebar.  The `type` determines which React Flow node
 * component is instantiated; `initial` provides default `data` values.
 */
const appsList = [
  { label: 'Application Metadata', type: NODE_TYPES.GIGASMART, initial: { actionType: ACTION_TYPES.APP_METADATA,   configType: ACTION_TYPES.APP_METADATA } },
  { label: 'Deduplication',      type: NODE_TYPES.GIGASMART, initial: { actionType: ACTION_TYPES.DEDUPLICATION,     configType: ACTION_TYPES.DEDUPLICATION } },
  { label: 'Load Balancing',     type: NODE_TYPES.GIGASTREAM, initial: { algorithm: 'Round Robin' } },
  { label: 'Masking',            type: NODE_TYPES.GIGASMART, initial: { actionType: ACTION_TYPES.MASKING,           configType: ACTION_TYPES.MASKING } },
  { label: 'Slicing',            type: NODE_TYPES.GIGASMART, initial: { actionType: ACTION_TYPES.PACKET_SLICING,    configType: ACTION_TYPES.PACKET_SLICING } },
  { label: 'SSL Decrypt',        type: NODE_TYPES.GIGASMART, initial: { actionType: ACTION_TYPES.SSL_DECRYPT,       configType: ACTION_TYPES.SSL_DECRYPT } },
] as const;

// ─── Sidebar component ────────────────────────────────────────────────────────

const Sidebar: React.FC = () => {
  const { advancedMode, setDraggedNodeType, sidebarMessage, setSidebarMessage } = useStore();
  const [openSections, setOpenSections] = useState({
    demo: true,  // "Demonstration" section — expanded by default
    apps: true,  // "Applications" section — shows all 15 GigaSMART apps
    advanced: true, // "Hardware" section for advanced mode
    hwTaps: false,
    hwTa: false,
    hwHc: true,
  });

  const [width, setWidth] = useState(260); // increased default width to fit grid
  const [isResizing, setIsResizing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Constrain sidebar width between 200px and 450px
      const newWidth = Math.max(200, Math.min(450, e.clientX));
      setWidth(newWidth);
      
      const aside = document.querySelector('.sidebar-elements');
      if (aside) {
        (aside as HTMLElement).style.width = `${newWidth}px`;
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    const handleDragEnd = () => {
      setDraggedNodeType(null);
    };
    window.addEventListener('dragend', handleDragEnd);
    return () => {
      window.removeEventListener('dragend', handleDragEnd);
    };
  }, [setDraggedNodeType]);

  /**
   * Attach drag data to the event so CanvasArea.onDrop can read it.
   */
  const onDragStart = (
    event: React.DragEvent,
    nodeType: string,
    label: string,
    initialData?: Record<string, unknown>
  ) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ type: nodeType, label, initialData }));
    event.dataTransfer.effectAllowed = 'move';
    setDraggedNodeType(nodeType);
  };

  return (
    <>
      {/* Inner Elements Tree Sidebar */}
      <aside className="sidebar-elements" style={{ width: `${width}px`, position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="elements-header" style={{ flexShrink: 0 }}>
          <span>TRAFFIC ELEMENTS</span>
          <span style={{ color: '#555', fontSize: '10px' }}>◄ ►</span>
        </div>



        <div style={{ padding: '10px 12px', borderBottom: '1px solid #333', flexShrink: 0 }}>
          <input
            type="text"
            placeholder="Search elements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.toLowerCase())}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #444',
              background: '#1a1a1a',
              color: '#fff',
              fontSize: '11px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* ── Collapsible Section: Demonstration ── */}
        <div className="tree-section">
          <div className="tree-header" onClick={() => toggleSection('demo')}>
            <span className={`chevron ${openSections.demo ? 'open' : ''}`}>▶</span>
            <span>Demonstration</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#888' }}>⚡</span>
          </div>

          {openSections.demo && (
            <div className="tree-content">
              {(() => {
                const demoGroups = [
                  {
                    label: 'Sources',
                    items: [
                      { label: 'SPAN Port', desc: 'SPAN Port 1/1/x1', type: NODE_TYPES.INPUT, icon: SpanIcon, initial: { configType: CONFIG_TYPES.SPAN, linkSpeed: 10000 } },
                      { label: 'TAP Device', desc: 'TAP Device 1/1/x2', type: NODE_TYPES.INPUT, icon: TapIcon, initial: { configType: CONFIG_TYPES.TAP, linkSpeed: 10000 } },
                      { label: 'ERSPAN Source', desc: 'ERSPAN Tunnel 10', type: NODE_TYPES.INPUT, icon: ErspanIcon, initial: { configType: CONFIG_TYPES.ERSPAN, linkSpeed: 10000 } },
                      { label: 'East/West Traffic', desc: 'East/West Traffic 1', type: NODE_TYPES.INPUT, icon: EastWestIcon, initial: { configType: CONFIG_TYPES.EAST_WEST, linkSpeed: 10000 } },
                      { label: 'VMWare Estate', desc: 'VMWare Estate 1', type: NODE_TYPES.INPUT, icon: VmwareIcon, initial: { configType: CONFIG_TYPES.VMWARE, linkSpeed: 40000 } },
                    ]
                  },
                  {
                    label: 'Traffic Routing',
                    items: [
                      { label: 'Traffic Map', desc: 'Traffic Map', type: NODE_TYPES.MAP, icon: MapIcon },
                      { label: 'Traffic Tunnel', desc: 'VLAN Filter', type: NODE_TYPES.FILTER, icon: GreenCircleIcon },
                    ]
                  },
                  {
                    label: 'Packet Consumers',
                    items: [
                      { label: 'ExtraHop', desc: 'ExtraHop Tool', type: NODE_TYPES.TOOL, icon: PacketToolIcon, initial: { configType: CONFIG_TYPES.PACKET_TOOL, toolName: 'ExtraHop', expectedType: 'packet' } },
                      { label: 'Vectra', desc: 'Vectra Tool', type: NODE_TYPES.TOOL, icon: PacketToolIcon, initial: { configType: CONFIG_TYPES.PACKET_TOOL, toolName: 'Vectra', expectedType: 'packet' } },
                      { label: 'Corelight', desc: 'Corelight Tool', type: NODE_TYPES.TOOL, icon: PacketToolIcon, initial: { configType: CONFIG_TYPES.PACKET_TOOL, toolName: 'Corelight', expectedType: 'packet' } },
                      { label: 'Endace Capture', desc: 'Endace Capture Appliance', type: NODE_TYPES.TOOL, icon: PacketToolIcon, initial: { configType: CONFIG_TYPES.PACKET_TOOL, toolName: 'Endace Packet Capture Appliance', expectedType: 'packet' } },
                      { label: 'Wireshark', desc: 'Wireshark Tool', type: NODE_TYPES.TOOL, icon: WiresharkIcon, initial: { configType: CONFIG_TYPES.PACKET_TOOL, toolName: 'Wireshark', expectedType: 'packet' } },
                      { label: 'ForeScout', desc: 'ForeScout Tool', type: NODE_TYPES.TOOL, icon: PacketToolIcon, initial: { configType: CONFIG_TYPES.PACKET_TOOL, toolName: 'ForeScout', expectedType: 'packet' } },
                      { label: 'Nozomi', desc: 'Nozomi Tool', type: NODE_TYPES.TOOL, icon: PacketToolIcon, initial: { configType: CONFIG_TYPES.PACKET_TOOL, toolName: 'Nozomi', expectedType: 'packet' } },
                    ]
                  },
                  {
                    label: 'Metadata Consumers',
                    items: [
                      { label: 'Splunk', desc: 'Splunk Collector', type: NODE_TYPES.TOOL, icon: MetadataToolIcon, initial: { configType: CONFIG_TYPES.METADATA_TOOL, toolName: 'Splunk', expectedType: 'metadata', expectedFormat: 'CEF' } },
                      { label: 'Elastic', desc: 'Elastic Search', type: NODE_TYPES.TOOL, icon: MetadataToolIcon, initial: { configType: CONFIG_TYPES.METADATA_TOOL, toolName: 'Elastic', expectedType: 'metadata', expectedFormat: 'JSON' } },
                      { label: 'Dynatrace', desc: 'Dynatrace APM', type: NODE_TYPES.TOOL, icon: MetadataToolIcon, initial: { configType: CONFIG_TYPES.METADATA_TOOL, toolName: 'Dynatrace', expectedType: 'metadata', expectedFormat: 'JSON' } },
                      { label: 'Sentinel', desc: 'Microsoft Sentinel SIEM', type: NODE_TYPES.TOOL, icon: MetadataToolIcon, initial: { configType: CONFIG_TYPES.METADATA_TOOL, toolName: 'Microsoft Sentinel', expectedType: 'metadata', expectedFormat: 'CEF' } },
                    ]
                  },
                  {
                    label: 'Storage Tools',
                    items: [
                      { label: 'S3 / Object Storage', desc: 'S3 / Object Storage', type: NODE_TYPES.TOOL, icon: S3StorageIcon, initial: { configType: CONFIG_TYPES.STORAGE_TOOL, toolName: 'S3 Object Storage', expectedType: 'any' } },
                    ]
                  }
                ];

                return demoGroups.map((group, gIdx) => {
                  const filteredItems = group.items.filter(item => item.label.toLowerCase().includes(searchQuery));
                  if (filteredItems.length === 0) return null;
                  
                  return (
                    <React.Fragment key={gIdx}>
                      <div className="demo-group-label" style={{ padding: '8px 12px 2px 12px', fontSize: '10px', color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{group.label}</div>
                      {filteredItems.map((item, iIdx) => (
                        <div key={iIdx} className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, item.type, item.desc, (item as any).initial)}>
                          <item.icon size={18} />
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </React.Fragment>
                  );
                });
              })()}
            </div>
          )}
        </div>

        {/* ── Collapsible Section: Applications (15 GigaSMART applications) ── */}
        <div className="tree-section">
          <div className="tree-header" onClick={() => toggleSection('apps')}>
            <span className={`chevron ${openSections.apps ? 'open' : ''}`}>▶</span>
            <span>Applications</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#888' }}>🔍</span>
          </div>
          {openSections.apps && (
            <div className="tree-content" style={{ maxHeight: '550px', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', padding: '4px' }}>
                {appsList
                  .filter(app => app.label.toLowerCase().includes(searchQuery))
                  .map((app) => (
                  <div
                    key={app.label}
                    className="tree-draggable"
                    draggable
                    onDragStart={(e) => onDragStart(e, app.type, app.label, app.initial)}
                    style={{ 
                      margin: 0, 
                      padding: '6px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      textAlign: 'center',
                      gap: '4px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: '6px'
                    }}
                  >
                    <AppIcon type={app.label} size={20} />
                    <span style={{ fontSize: '9px', fontWeight: 500, lineHeight: '1.1' }}>{app.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Collapsible Section: Hardware (Advanced Mode) ── */}
        {advancedMode && (
          <div className="tree-section">
            <div className="tree-header" onClick={() => toggleSection('advanced')}>
              <span className={`chevron ${openSections.advanced ? 'open' : ''}`}>▶</span>
              <span>Physical Hardware (SE)</span>
              <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#888' }}>⚙️</span>
            </div>
            {openSections.advanced && (
              <div className="tree-content" style={{ maxHeight: '550px', overflowY: 'auto' }}>
                {/* TAPS Sub-accordion */}
                <div 
                  className="demo-group-label" 
                  onClick={() => toggleSection('hwTaps')}
                  style={{ padding: '8px 12px 6px 12px', fontSize: '10px', color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <span className={`chevron ${openSections.hwTaps ? 'open' : ''}`} style={{ marginRight: '6px' }}>▶</span>
                  TAPs
                </div>
                {openSections.hwTaps && hardwareCatalogue.taps
                  .filter(item => !['TAP-M100T', 'TAP-M200T', 'TAP-M202ULT'].includes(item.sku) && item.model.toLowerCase().includes(searchQuery))
                  .map((item) => (
                  <div key={item.sku} className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, NODE_TYPES.HARDWARE, item.model, { configType: 'Hardware', model: item.model, sku: item.sku, image: (item as any).image })} title={skus[item.sku] || ''}>
                    <TapIcon size={18} />
                    <span>{item.model} {item.ru ? `(${item.ru < 1 ? '1/2' : item.ru} RU)` : ''}</span>
                  </div>
                ))}
                
                {/* TA Series Sub-accordion */}
                <div 
                  className="demo-group-label" 
                  onClick={() => toggleSection('hwTa')}
                  style={{ padding: '8px 12px 6px 12px', fontSize: '10px', color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <span className={`chevron ${openSections.hwTa ? 'open' : ''}`} style={{ marginRight: '6px' }}>▶</span>
                  TA Series
                </div>
                {openSections.hwTa && hardwareCatalogue.ta_series
                  .filter(item => item.model.toLowerCase().includes(searchQuery))
                  .map((item) => (
                  <div key={item.sku} className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, NODE_TYPES.HARDWARE, item.model, { configType: 'Hardware', model: item.model, sku: item.sku, image: (item as any).image })} title={skus[item.sku] || ''}>
                    {(item as any).image ? <img src={(item as any).image} style={{height:'16px', objectFit:'contain'}} alt={item.model} /> : <GreenCircleIcon size={18} />}
                    <span>{item.model}</span>
                  </div>
                ))}
                
                {/* HC Series Sub-accordion */}
                <div 
                  className="demo-group-label" 
                  onClick={() => toggleSection('hwHc')}
                  style={{ padding: '8px 12px 6px 12px', fontSize: '10px', color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <span className={`chevron ${openSections.hwHc ? 'open' : ''}`} style={{ marginRight: '6px' }}>▶</span>
                  HC Series
                </div>
                {openSections.hwHc && hardwareCatalogue.hc_series
                  .filter(item => item.model.toLowerCase().includes(searchQuery))
                  .map((item) => (
                  <div key={item.sku} className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, NODE_TYPES.HARDWARE, item.model, { configType: 'Hardware', model: item.model, sku: item.sku, image: (item as any).image })} title={skus[item.sku] || ''}>
                    {(item as any).image ? <img src={(item as any).image} style={{height:'16px', objectFit:'contain'}} alt={item.model} /> : <MapIcon size={18} />}
                    <span>{item.model}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sidebar message panel */}
        {sidebarMessage && (
          <div style={{ 
            padding: '10px 12px', 
            background: 'rgba(76, 175, 80, 0.08)', 
            borderTop: '1px solid rgba(76, 175, 80, 0.25)', 
            borderLeft: '4px solid #4caf50',
            fontSize: '11px', 
            color: '#c8e6c9', 
            position: 'relative',
            flexShrink: 0
          }}>
            <div style={{ fontWeight: 'bold', color: '#4caf50', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📢 Inventory Auto-configured</span>
              <button 
                onClick={() => setSidebarMessage(null)} 
                style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '12px', padding: 0 }}
              >
                ✕
              </button>
            </div>
            {sidebarMessage}
          </div>
        )}

        {/* Resizing Handle */}
        </div>
        <div 
          onMouseDown={handleMouseDown}
          className={`sidebar-resize-handle ${isResizing ? 'resizing' : ''}`}
          title="Drag to resize elements sidebar"
        />
      </aside>
    </>
  );
};

export default Sidebar;