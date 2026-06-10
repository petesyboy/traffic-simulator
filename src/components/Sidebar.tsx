import React, { useState } from 'react';

// Reusable SVG Icon Component mapping to all Gigamon UI entries
export const AppIcon: React.FC<{ type: string; size?: number; rate?: number }> = ({ type, size = 20, rate }) => {
  const t = type.toLowerCase().replace(/\s+/g, '-');
  
  switch (t) {
    case 'metadata':
    case 'application-metadata':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <path d="M14.5 6.5l4 4L10 19H6v-4l8.5-8.5z" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="9.5" cy="14.5" r="1" fill="white"/>
        </svg>
      );
    case 'visualization':
    case 'application-visualization':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <path d="M4 12s3.5-5.5 8-5.5 8 5.5 8 5.5-3.5 5.5-8 5.5-8-5.5-8-5.5z" stroke="white" stroke-width="1.5" fill="none"/>
          <circle cx="12" cy="12" r="2.5" stroke="white" stroke-width="1.5"/>
        </svg>
      );
    case '5g-cloud':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <path d="M6.5 13.5a2.5 2.5 0 011.2-4.8 3.5 3.5 0 016.6 1 2.5 2.5 0 011.2 3.8H6.5z" stroke="white" stroke-width="1.2" fill="none"/>
          <text x="12" y="15.5" fill="white" fontSize="5.5" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">5G</text>
        </svg>
      );
    case 'dedup':
    case 'deduplication':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <text x="12" y="12" fill="white" fontSize={rate !== undefined ? "12" : "13"} fontFamily="Inter, sans-serif" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
            {rate !== undefined ? `${Math.round(rate)}%` : '%'}
          </text>
        </svg>
      );
    case 'gvhttp2':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <rect x="4.5" y="7.5" width="15" height="9" rx="1" stroke="white" stroke-width="1.2" fill="none"/>
          <text x="12" y="13.5" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">GV HTTP2</text>
        </svg>
      );
    case 'headerstripping':
    case 'header-stripping':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <circle cx="12" cy="12" r="4.5" stroke="white" stroke-width="1.5" strokeDasharray="2 2" fill="none"/>
          <path d="M12 4.5v3M12 16.5v3M4.5 12h3M16.5 12h3" stroke="white" stroke-width="1.5" strokeLinecap="round"/>
        </svg>
      );
    case 'load-balancing':
    case 'giga-stream':
    case 'gigastream-lb':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <path d="M6 7.5h12M6 12h12M6 16.5h12" stroke="white" stroke-width="1.5" strokeLinecap="round"/>
          <path d="M14 5.5l2 2-2 2M14 10l2 2-2 2M14 14.5l2 2-2 2" stroke="white" stroke-width="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'masking':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <circle cx="12" cy="12" r="5" stroke="white" stroke-width="1.5" fill="none"/>
          <path d="M12 7a5 5 0 010 10V7z" fill="white"/>
        </svg>
      );
    case 'amx':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <path d="M12 6.5v10M9 9.5l3-3 3 3" stroke="white" stroke-width="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8 17.5h8" stroke="white" stroke-width="1.8" strokeLinecap="round"/>
        </svg>
      );
    case 'pcapng':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <path d="M7 6.5h6l4 4V18H7V6.5z" stroke="white" stroke-width="1.2" fill="none"/>
          <path d="M13 6.5V10h3.5" stroke="white" stroke-width="1.2"/>
          <rect x="9" y="12" width="6" height="4.5" rx="0.5" stroke="white" stroke-width="1" fill="none"/>
          <circle cx="12" cy="14.2" r="0.7" fill="white"/>
        </svg>
      );
    case '5g-sbi':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <text x="8" y="14" fill="white" fontSize="5.5" fontFamily="sans-serif" fontWeight="bold">5G</text>
          <path d="M15.5 11.5c.5-.5 1-.5 1.5 0M15.5 13.5c.5.5 1 .5 1.5 0" stroke="white" stroke-width="1" strokeLinecap="round"/>
          <circle cx="16" cy="12.5" r="0.8" fill="white"/>
        </svg>
      );
    case 'sbipoe':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <rect x="6" y="6" width="3.5" height="3.5" rx="0.5" stroke="white" stroke-width="1.2" fill="none"/>
          <rect x="14.5" y="6" width="3.5" height="3.5" rx="0.5" stroke="white" stroke-width="1.2" fill="none"/>
          <rect x="10.25" y="14.5" width="3.5" height="3.5" rx="0.5" stroke="white" stroke-width="1.2" fill="none"/>
          <path d="M7.75 9.5v2.5h8.5V9.5M12 12v2.5" stroke="white" stroke-width="1.2" strokeLinecap="round"/>
        </svg>
      );
    case 'slicing':
    case 'packet-slicing':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <circle cx="12" cy="12" r="5" stroke="white" stroke-width="1.5" strokeDasharray="1.5 1.5" fill="none"/>
          <path d="M12 5.5v13" stroke="white" stroke-width="1.5"/>
        </svg>
      );
    case 'ssl-decrypt':
    case 'ssl-decryption':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <rect x="7.5" y="11.5" width="9" height="6" rx="1.2" stroke="white" stroke-width="1.2" fill="none"/>
          <path d="M9.5 11.5v-2.5a2.5 2.5 0 015 0v2.5" stroke="white" stroke-width="1.2" fill="none"/>
          <circle cx="12" cy="14.5" r="0.8" fill="white"/>
        </svg>
      );
    default:
      // Generic Blue Square
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <rect x="7" y="7" width="10" height="10" rx="1.5" stroke="white" stroke-width="1.5" fill="none"/>
        </svg>
      );
  }
};

// Shared SVG Map Icon (Blue Circle)
export const MapIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="11" fill="#007cff" />
    <path d="M7 9h10M7 12h10M7 15h10" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="9" cy="9" r="1.2" fill="white"/>
    <circle cx="15" cy="12" r="1.2" fill="white"/>
    <circle cx="11" cy="15" r="1.2" fill="white"/>
  </svg>
);

// Shared SVG Green Circle Icon (Tunnel / Tool / Raw Endpoint)
export const GreenCircleIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="11" fill="#163c20" stroke="#25b34b" stroke-width="1.5" />
    <path d="M12 6c-3 0-5.5 2.5-5.5 5.5V17h11v-5.5C17.5 8.5 15 6 12 6z" stroke="white" stroke-width="1.5" fill="none"/>
    <path d="M9 13.5h6" stroke="white" stroke-width="1.2" />
  </svg>
);

// Shared SVG GigaSMART Icon (Blue Diamond / Gear)
export const SmartIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <rect x="12" y="3" width="12" height="12" rx="2" transform="rotate(45 12 3)" fill="#0091ea" stroke="#00b0ff" stroke-width="1.2" />
    <circle cx="12" cy="12" r="3.5" fill="white"/>
    <circle cx="12" cy="12" r="1.5" fill="#0091ea"/>
  </svg>
);

export const SpanIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="11" fill="#1e88e5" stroke="#1565c0" strokeWidth="1.5" />
    <path d="M8 12h8M12 8l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="5.5" y="10" fill="white" fontSize="5.5" fontFamily="sans-serif" fontWeight="bold">S</text>
  </svg>
);

export const TapIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="11" fill="#43a047" stroke="#2e7d32" strokeWidth="1.5" />
    <path d="M7 12h4m2 0h4M12 7v10" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="12" cy="12" r="2.5" fill="none" stroke="white" strokeWidth="1.2"/>
  </svg>
);

export const ErspanIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="11" fill="#ab47bc" stroke="#7b1fa2" strokeWidth="1.5" />
    <path d="M6 10h5l3 5h4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="6" y="17" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="bold">ER</text>
  </svg>
);

export const PacketToolIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <rect width="24" height="24" rx="4" fill="#2e7d32" stroke="#1b5e20" strokeWidth="1"/>
    <path d="M12 5l6 2.5v5.5c0 4-6 6-6 6s-6-2-6-6V7.5L12 5z" stroke="white" strokeWidth="1.5" fill="none"/>
    <path d="M9 10.5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const MetadataToolIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <rect width="24" height="24" rx="4" fill="#e65100" stroke="#b71c1c" strokeWidth="1"/>
    <path d="M7 17h10M7 13h10M7 9h6" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="15" cy="9" r="1.5" fill="white"/>
  </svg>
);

const Sidebar: React.FC = () => {
  const [openSections, setOpenSections] = useState({
    demo: true, // Demonstration section expanded by default
    new: true,
    library: false,
    apps: true, // Expanded by default to showcase the new draggable applications
    tunnels: false,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const onDragStart = (
    event: React.DragEvent, 
    nodeType: string, 
    label: string, 
    initialData?: Record<string, unknown>
  ) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ type: nodeType, label, initialData }));
    event.dataTransfer.effectAllowed = 'move';
  };

  // 14 applications list
  const appsList = [
    { label: 'Application Metadata', type: 'gigaSmartNode', initial: { actionType: 'Application Metadata', configType: 'Application Metadata' } },
    { label: 'Application Visualization', type: 'gigaSmartNode', initial: { actionType: 'Application Visualization', configType: 'Application Visualization' } },
    { label: '5G-Cloud', type: 'gigaSmartNode', initial: { actionType: '5G-Cloud', configType: '5G-Cloud' } },
    { label: 'Dedup', type: 'gigaSmartNode', initial: { actionType: 'Deduplication', configType: 'Deduplication' } },
    { label: 'GVHTTP2', type: 'gigaSmartNode', initial: { actionType: 'GVHTTP2', configType: 'GVHTTP2' } },
    { label: 'HeaderStripping', type: 'gigaSmartNode', initial: { actionType: 'Header Stripping', configType: 'Header Stripping' } },
    { label: 'Load Balancing', type: 'gigaStreamNode', initial: { algorithm: 'Round Robin' } },
    { label: 'Masking', type: 'gigaSmartNode', initial: { actionType: 'Masking', configType: 'Masking' } },
    { label: 'AMX', type: 'gigaSmartNode', initial: { actionType: 'AMX', configType: 'AMX' } },
    { label: 'Pcapng', type: 'gigaSmartNode', initial: { actionType: 'Pcapng', configType: 'Pcapng' } },
    { label: '5G-SBI', type: 'gigaSmartNode', initial: { actionType: '5G-SBI', configType: '5G-SBI' } },
    { label: 'Sbipoe', type: 'gigaSmartNode', initial: { actionType: 'Sbipoe', configType: 'Sbipoe' } },
    { label: 'Slicing', type: 'gigaSmartNode', initial: { actionType: 'Packet Slicing', configType: 'Packet Slicing' } },
    { label: 'SSL Decrypt', type: 'gigaSmartNode', initial: { actionType: 'SSL Decrypt', configType: 'SSL Decrypt' } },
  ];

  return (
    <>
      {/* 1. Leftmost Session Sidebar */}
      <aside className="sidebar-sessions">
        <button className="new-session-btn">
          New Monitoring Session
        </button>

        <div className="sidebar-section-title">Monitoring Sessions</div>
        
        <div className="session-item active">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', color: '#9e9e9e' }}>☁️</span>
            <div>
              <div className="session-name">Test</div>
              <div className="session-status">Not Deployed | Healthy</div>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. Inner Elements Tree Sidebar */}
      <aside className="sidebar-elements">
        <div className="elements-header">
          <span>TRAFFIC ELEMENTS</span>
          <span style={{ cursor: 'pointer', color: '#666' }}>|<br/>|</span>
        </div>

        {/* Collapsible Section: Demonstration */}
        <div className="tree-section">
          <div className="tree-header" onClick={() => toggleSection('demo')}>
            <span className={`chevron ${openSections.demo ? 'open' : ''}`}>▼</span>
            <span>Demonstration</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#888' }}>⚡</span>
          </div>

          {openSections.demo && (
            <div className="tree-content" style={{ maxHeight: '380px', overflowY: 'auto' }}>
              <div className="demo-group-label" style={{ padding: '6px 12px 2px 12px', fontSize: '9px', color: '#888', fontWeight: 'bold', letterSpacing: '0.5px' }}>SOURCES</div>
              
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, 'inputNode', 'SPAN Port 1/1/x1', { configType: 'SPAN' })}>
                <SpanIcon size={18} />
                <span>SPAN Port</span>
              </div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, 'inputNode', 'TAP Device 1/1/x2', { configType: 'TAP' })}>
                <TapIcon size={18} />
                <span>TAP Device</span>
              </div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, 'inputNode', 'ERSPAN Tunnel 10', { configType: 'ERSPAN' })}>
                <ErspanIcon size={18} />
                <span>ERSPAN Source</span>
              </div>

              <div className="demo-group-label" style={{ padding: '8px 12px 2px 12px', fontSize: '9px', color: '#888', fontWeight: 'bold', letterSpacing: '0.5px' }}>PACKET CONSUMING TOOLS</div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, 'toolNode', 'ExtraHop Tool', { configType: 'Packet Tool', toolName: 'ExtraHop', expectedType: 'packet' })}>
                <PacketToolIcon size={18} />
                <span>ExtraHop</span>
              </div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, 'toolNode', 'Vectra Tool', { configType: 'Packet Tool', toolName: 'Vectra', expectedType: 'packet' })}>
                <PacketToolIcon size={18} />
                <span>Vectra</span>
              </div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, 'toolNode', 'Corelight Tool', { configType: 'Packet Tool', toolName: 'Corelight', expectedType: 'packet' })}>
                <PacketToolIcon size={18} />
                <span>Corelight</span>
              </div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, 'toolNode', 'Endace Capture Appliance', { configType: 'Packet Tool', toolName: 'Endace Packet Capture Appliance', expectedType: 'packet' })}>
                <PacketToolIcon size={18} />
                <span>Endace Capture</span>
              </div>

              <div className="demo-group-label" style={{ padding: '8px 12px 2px 12px', fontSize: '9px', color: '#888', fontWeight: 'bold', letterSpacing: '0.5px' }}>METADATA CONSUMING TOOLS</div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, 'toolNode', 'Splunk Collector', { configType: 'Metadata Tool', toolName: 'Splunk', expectedType: 'metadata', expectedFormat: 'CEF' })}>
                <MetadataToolIcon size={18} />
                <span>Splunk</span>
              </div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, 'toolNode', 'Elastic Search', { configType: 'Metadata Tool', toolName: 'Elastic', expectedType: 'metadata', expectedFormat: 'JSON' })}>
                <MetadataToolIcon size={18} />
                <span>Elastic</span>
              </div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, 'toolNode', 'Dynatrace APM', { configType: 'Metadata Tool', toolName: 'Dynatrace', expectedType: 'metadata', expectedFormat: 'JSON' })}>
                <MetadataToolIcon size={18} />
                <span>Dynatrace</span>
              </div>
              <div className="tree-draggable" draggable onDragStart={(e) => onDragStart(e, 'toolNode', 'Microsoft Sentinel SIEM', { configType: 'Metadata Tool', toolName: 'Microsoft Sentinel', expectedType: 'metadata', expectedFormat: 'CEF' })}>
                <MetadataToolIcon size={18} />
                <span>Sentinel</span>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Section: New */}
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
                onDragStart={(e) => onDragStart(e, 'mapNode', 'Traffic Map')}
              >
                <MapIcon size={18} />
                <span>New Map</span>
                <span className="info-badge">i</span>
              </div>

              <div 
                className="tree-draggable" 
                draggable 
                onDragStart={(e) => onDragStart(e, 'filterNode', 'VLAN Filter')}
              >
                <GreenCircleIcon size={18} />
                <span>New Tunnel</span>
              </div>

              <div 
                className="tree-draggable" 
                draggable 
                onDragStart={(e) => onDragStart(e, 'toolNode', 'Vectra')}
              >
                <GreenCircleIcon size={18} />
                <span>New Raw Endpoint</span>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Section: Map Library */}
        <div className="tree-section">
          <div className="tree-header" onClick={() => toggleSection('library')}>
            <span className={`chevron ${openSections.library ? 'open' : ''}`}>▶</span>
            <span>Map Library</span>
          </div>
          {openSections.library && (
            <div className="tree-content placeholder-text">No library items available.</div>
          )}
        </div>

        {/* Collapsible Section: Applications (Contains 14 Draggable applications) */}
        <div className="tree-section">
          <div className="tree-header" onClick={() => toggleSection('apps')}>
            <span className={`chevron ${openSections.apps ? 'open' : ''}`}>▼</span>
            <span>Applications</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#888' }}>🔍</span>
          </div>
          {openSections.apps && (
            <div className="tree-content" style={{ maxHeight: '350px', overflowY: 'auto' }}>
              {appsList.map((app) => (
                <div
                  key={app.label}
                  className="tree-draggable"
                  draggable
                  onDragStart={(e) => onDragStart(e, app.type, app.label, app.initial)}
                >
                  {/* Render handle icon bar */}
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

        {/* Collapsible Section: Tunnels */}
        <div className="tree-section">
          <div className="tree-header" onClick={() => toggleSection('tunnels')}>
            <span className={`chevron ${openSections.tunnels ? 'open' : ''}`}>▶</span>
            <span>Tunnels</span>
          </div>
          {openSections.tunnels && (
            <div className="tree-content placeholder-text">No tunnels configured.</div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;