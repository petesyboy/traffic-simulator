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

import React, { useState } from 'react';
import { useStore } from '../store/store';
import {
  AppIcon, MapIcon, GreenCircleIcon,
  SpanIcon, TapIcon, ErspanIcon, EastWestIcon, VmwareIcon,
  PacketToolIcon, MetadataToolIcon, S3StorageIcon, WiresharkIcon,
} from './Icons';
import { NODE_TYPES, ACTION_TYPES, CONFIG_TYPES } from '../constants/nodeTypes';
import hardwareCatalogue from '../constants/hardwareCatalogue.json';

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
  { label: 'Application Visualization', type: NODE_TYPES.GIGASMART, initial: { actionType: ACTION_TYPES.APP_VIS,    configType: ACTION_TYPES.APP_VIS } },
  { label: '5G-Cloud',           type: NODE_TYPES.GIGASMART, initial: { actionType: ACTION_TYPES.CLOUD_5G,          configType: ACTION_TYPES.CLOUD_5G } },
  { label: 'Deduplication',      type: NODE_TYPES.GIGASMART, initial: { actionType: ACTION_TYPES.DEDUPLICATION,     configType: ACTION_TYPES.DEDUPLICATION } },
  { label: 'GVHTTP2',            type: NODE_TYPES.GIGASMART, initial: { actionType: ACTION_TYPES.GVHTTP2,           configType: ACTION_TYPES.GVHTTP2 } },
  { label: 'HeaderStripping',    type: NODE_TYPES.GIGASMART, initial: { actionType: ACTION_TYPES.HEADER_STRIP,      configType: ACTION_TYPES.HEADER_STRIP } },
  { label: 'Load Balancing',     type: NODE_TYPES.GIGASTREAM, initial: { algorithm: 'Round Robin' } },
  { label: 'Masking',            type: NODE_TYPES.GIGASMART, initial: { actionType: ACTION_TYPES.MASKING,           configType: ACTION_TYPES.MASKING } },
  { label: 'AMX',                type: NODE_TYPES.GIGASMART, initial: { actionType: ACTION_TYPES.AMX,               configType: ACTION_TYPES.AMX } },
  { label: 'AMI',                type: NODE_TYPES.GIGASMART, initial: { actionType: ACTION_TYPES.AMI,               configType: ACTION_TYPES.AMI } },
  { label: 'Pcapng',             type: NODE_TYPES.GIGASMART, initial: { actionType: ACTION_TYPES.PCAPNG,            configType: ACTION_TYPES.PCAPNG } },
  { label: '5G-SBI',             type: NODE_TYPES.GIGASMART, initial: { actionType: ACTION_TYPES.SBI_5G,            configType: ACTION_TYPES.SBI_5G } },
  { label: 'Sbipoe',             type: NODE_TYPES.GIGASMART, initial: { actionType: ACTION_TYPES.SBIPOE,            configType: ACTION_TYPES.SBIPOE } },
  { label: 'Slicing',            type: NODE_TYPES.GIGASMART, initial: { actionType: ACTION_TYPES.PACKET_SLICING,    configType: ACTION_TYPES.PACKET_SLICING } },
  { label: 'SSL Decrypt',        type: NODE_TYPES.GIGASMART, initial: { actionType: ACTION_TYPES.SSL_DECRYPT,       configType: ACTION_TYPES.SSL_DECRYPT } },
] as const;

// ─── Sidebar component ────────────────────────────────────────────────────────

const Sidebar: React.FC = () => {
  const { advancedMode, setAdvancedMode } = useStore();
  const [openSections, setOpenSections] = useState({
    demo: true,  // "Demonstration" section — expanded by default
    new: true,   // "New elements" section
    apps: true,  // "Applications" section — shows all 15 GigaSMART apps
    advanced: true, // "Hardware" section for advanced mode
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  /**
   * Attach drag data to the event so CanvasArea.onDrop can read it.
   * The payload is JSON-stringified and stored under the
   * 'application/reactflow' MIME type to avoid conflicts with other
   * drag-and-drop interactions on the page.
   */
  const onDragStart = (
    event: React.DragEvent,
    nodeType: string,
    label: string,
    initialData?: Record<string, unknown>
  ) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ type: nodeType, label, initialData }));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <>
      {/* Inner Elements Tree Sidebar */}
      <aside className="sidebar-elements">
        <div className="elements-header">
          <span>TRAFFIC ELEMENTS</span>
          <span style={{ cursor: 'pointer', color: '#666' }}>|<br/>|</span>
        </div>

        <div style={{ padding: '10px 15px', borderBottom: '1px solid #333' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
            <input
              type="checkbox"
              checked={advancedMode}
              onChange={(e) => setAdvancedMode(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            Advanced Mode (SE)
          </label>
        </div>

        {/* ── Collapsible Section: Demonstration ── */}
        <div className="tree-section">
          <div className="tree-header" onClick={() => toggleSection('demo')}>
            <span className={`chevron ${openSections.demo ? 'open' : ''}`}>▼</span>
            <span>Demonstration</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#888' }}>⚡</span>
          </div>

          {openSections.demo && (
            <div className="tree-content" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <div className="demo-group-label" style={{ padding: '6px 12px 2px 12px', fontSize: '9px', color: '#888', fontWeight: 'bold', letterSpacing: '0.5px' }}>SOURCES</div>

              {/* Input port types — dragging these creates an inputNode */}
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, NODE_TYPES.INPUT, 'SPAN Port 1/1/x1', { configType: CONFIG_TYPES.SPAN, linkSpeed: 10000 })}>
                <SpanIcon size={18} />
                <span>SPAN Port</span>
              </div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, NODE_TYPES.INPUT, 'TAP Device 1/1/x2', { configType: CONFIG_TYPES.TAP, linkSpeed: 10000 })}>
                <TapIcon size={18} />
                <span>TAP Device</span>
              </div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, NODE_TYPES.INPUT, 'ERSPAN Tunnel 10', { configType: CONFIG_TYPES.ERSPAN, linkSpeed: 10000 })}>
                <ErspanIcon size={18} />
                <span>ERSPAN Source</span>
              </div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, NODE_TYPES.INPUT, 'East/West Traffic 1', { configType: CONFIG_TYPES.EAST_WEST, linkSpeed: 10000 })}>
                <EastWestIcon size={18} />
                <span>East/West Traffic</span>
              </div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, NODE_TYPES.INPUT, 'VMWare Estate 1', { configType: CONFIG_TYPES.VMWARE, linkSpeed: 40000 })}>
                <VmwareIcon size={18} />
                <span>VMWare Estate</span>
              </div>

              <div className="demo-group-label" style={{ padding: '8px 12px 2px 12px', fontSize: '9px', color: '#888', fontWeight: 'bold', letterSpacing: '0.5px' }}>PACKET CONSUMING TOOLS</div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, NODE_TYPES.TOOL, 'ExtraHop Tool', { configType: CONFIG_TYPES.PACKET_TOOL, toolName: 'ExtraHop', expectedType: 'packet' })}>
                <PacketToolIcon size={18} />
                <span>ExtraHop</span>
              </div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, NODE_TYPES.TOOL, 'Vectra Tool', { configType: CONFIG_TYPES.PACKET_TOOL, toolName: 'Vectra', expectedType: 'packet' })}>
                <PacketToolIcon size={18} />
                <span>Vectra</span>
              </div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, NODE_TYPES.TOOL, 'Corelight Tool', { configType: CONFIG_TYPES.PACKET_TOOL, toolName: 'Corelight', expectedType: 'packet' })}>
                <PacketToolIcon size={18} />
                <span>Corelight</span>
              </div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, NODE_TYPES.TOOL, 'Endace Capture Appliance', { configType: CONFIG_TYPES.PACKET_TOOL, toolName: 'Endace Packet Capture Appliance', expectedType: 'packet' })}>
                <PacketToolIcon size={18} />
                <span>Endace Capture</span>
              </div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, NODE_TYPES.TOOL, 'Wireshark Tool', { configType: CONFIG_TYPES.PACKET_TOOL, toolName: 'Wireshark', expectedType: 'packet' })}>
                <WiresharkIcon size={18} />
                <span>Wireshark</span>
              </div>

              <div className="demo-group-label" style={{ padding: '8px 12px 2px 12px', fontSize: '9px', color: '#888', fontWeight: 'bold', letterSpacing: '0.5px' }}>METADATA CONSUMING TOOLS</div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, NODE_TYPES.TOOL, 'Splunk Collector', { configType: CONFIG_TYPES.METADATA_TOOL, toolName: 'Splunk', expectedType: 'metadata', expectedFormat: 'CEF' })}>
                <MetadataToolIcon size={18} />
                <span>Splunk</span>
              </div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, NODE_TYPES.TOOL, 'Elastic Search', { configType: CONFIG_TYPES.METADATA_TOOL, toolName: 'Elastic', expectedType: 'metadata', expectedFormat: 'JSON' })}>
                <MetadataToolIcon size={18} />
                <span>Elastic</span>
              </div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, NODE_TYPES.TOOL, 'Dynatrace APM', { configType: CONFIG_TYPES.METADATA_TOOL, toolName: 'Dynatrace', expectedType: 'metadata', expectedFormat: 'JSON' })}>
                <MetadataToolIcon size={18} />
                <span>Dynatrace</span>
              </div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, NODE_TYPES.TOOL, 'Microsoft Sentinel SIEM', { configType: CONFIG_TYPES.METADATA_TOOL, toolName: 'Microsoft Sentinel', expectedType: 'metadata', expectedFormat: 'CEF' })}>
                <MetadataToolIcon size={18} />
                <span>Sentinel</span>
              </div>

              <div className="demo-group-label" style={{ padding: '8px 12px 2px 12px', fontSize: '9px', color: '#888', fontWeight: 'bold', letterSpacing: '0.5px' }}>STORAGE TOOLS</div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, NODE_TYPES.TOOL, 'S3 / Object Storage', { configType: CONFIG_TYPES.STORAGE_TOOL, toolName: 'S3 Object Storage', expectedType: 'any' })}>
                <S3StorageIcon size={18} />
                <span>S3 / Object Storage</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Collapsible Section: New (core building blocks) ── */}
        <div className="tree-section">
          <div className="tree-header" onClick={() => toggleSection('new')}>
            <span className={`chevron ${openSections.new ? 'open' : ''}`}>▼</span>
            <span>New</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#888' }}>🔍</span>
          </div>

          {openSections.new && (
            <div className="tree-content">
              <div
                className="tree-draggable"
                draggable
                onDragStart={(e) => onDragStart(e, NODE_TYPES.MAP, 'Traffic Map')}
              >
                <MapIcon size={18} />
                <span>New Map</span>
                <span className="info-badge">i</span>
              </div>

              <div
                className="tree-draggable"
                draggable
                onDragStart={(e) => onDragStart(e, NODE_TYPES.FILTER, 'VLAN Filter')}
              >
                <GreenCircleIcon size={18} />
                <span>New Tunnel</span>
              </div>

              <div
                className="tree-draggable"
                draggable
                onDragStart={(e) => onDragStart(e, NODE_TYPES.TOOL, 'Vectra')}
              >
                <GreenCircleIcon size={18} />
                <span>New Raw Endpoint</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Collapsible Section: Applications (15 GigaSMART applications) ── */}
        <div className="tree-section">
          <div className="tree-header" onClick={() => toggleSection('apps')}>
            <span className={`chevron ${openSections.apps ? 'open' : ''}`}>▼</span>
            <span>Applications</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#888' }}>🔍</span>
          </div>
          {openSections.apps && (
            <div className="tree-content" style={{ maxHeight: '550px', overflowY: 'auto' }}>
              {appsList.map((app) => (
                <div
                  key={app.label}
                  className="tree-draggable"
                  draggable
                  onDragStart={(e) => onDragStart(e, app.type, app.label, app.initial)}
                >
                  {/* Drag handle indicator (three stacked bars) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginRight: '4px', opacity: 0.3 }}>
                    <div style={{ width: '4px', height: '2px', backgroundColor: '#fff' }}></div>
                    <div style={{ width: '4px', height: '2px', backgroundColor: '#fff' }}></div>
                    <div style={{ width: '4px', height: '2px', backgroundColor: '#fff' }}></div>
                  </div>
                  <AppIcon type={app.label} size={18} />
                  <span style={{ fontSize: '11px', fontWeight: 500 }}>{app.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Collapsible Section: Hardware (Advanced Mode) ── */}
        {advancedMode && (
          <div className="tree-section">
            <div className="tree-header" onClick={() => toggleSection('advanced')}>
              <span className={`chevron ${openSections.advanced ? 'open' : ''}`}>▼</span>
              <span>Physical Hardware (SE)</span>
              <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#888' }}>⚙️</span>
            </div>
            {openSections.advanced && (
              <div className="tree-content" style={{ maxHeight: '550px', overflowY: 'auto' }}>
                <div className="demo-group-label" style={{ padding: '6px 12px 2px 12px', fontSize: '9px', color: '#888', fontWeight: 'bold', letterSpacing: '0.5px' }}>TAPS</div>
                {hardwareCatalogue.taps.filter(item => !['TAP-M100T', 'TAP-M200T', 'TAP-M202ULT'].includes(item.sku)).map((item) => (
                  <div key={item.sku} className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, NODE_TYPES.HARDWARE, item.model, { configType: 'Hardware', model: item.model, sku: item.sku })}>
                    <TapIcon size={18} />
                    <span>{item.model} {item.ru ? `(${item.ru < 1 ? '1/2' : item.ru} RU)` : ''}</span>
                  </div>
                ))}
                
                <div className="demo-group-label" style={{ padding: '8px 12px 2px 12px', fontSize: '9px', color: '#888', fontWeight: 'bold', letterSpacing: '0.5px' }}>TA SERIES</div>
                {hardwareCatalogue.ta_series.map((item) => (
                  <div key={item.sku} className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, NODE_TYPES.HARDWARE, item.model, { configType: 'Hardware', model: item.model, sku: item.sku })}>
                    <GreenCircleIcon size={18} />
                    <span>{item.model}</span>
                  </div>
                ))}
                
                <div className="demo-group-label" style={{ padding: '8px 12px 2px 12px', fontSize: '9px', color: '#888', fontWeight: 'bold', letterSpacing: '0.5px' }}>HC SERIES</div>
                {hardwareCatalogue.hc_series.map((item) => (
                  <div key={item.sku} className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, NODE_TYPES.HARDWARE, item.model, { configType: 'Hardware', model: item.model, sku: item.sku })}>
                    <MapIcon size={18} />
                    <span>{item.model}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </aside>
    </>
  );
};

export default Sidebar;