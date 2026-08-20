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
  AppIcon,
  MapIcon,
  GreenCircleIcon,
  SpanIcon,
  TapIcon,
  ErspanIcon,
  EastWestIcon,
  VmwareIcon,
  PacketToolIcon,
  MetadataToolIcon,
  S3StorageIcon,
  WiresharkIcon,
} from './Icons';
import { NODE_TYPES, ACTION_TYPES, CONFIG_TYPES } from '../constants/nodeTypes';
import { DEFAULT_TOOL_INGEST_LIMITS_MBPS, GENERIC_PACKET_TOOL_INGEST_LIMIT_MBPS } from '../constants/toolIngestLimits';
import hardwareCatalogue from '../constants/hardwareCatalogue.json';
import { getSkus } from '../utils/bom/skuUtils';
import CatalogueSection from './sidebar/CatalogueSection';
import type { HardwareCatalogueItem } from './sidebar/CatalogueSection';

// Re-export icons so existing imports of these from 'Sidebar' continue to work.
// Once all callers are updated to import from Icons.tsx directly these re-exports
// can be removed.
export {
  AppIcon,
  MapIcon,
  GreenCircleIcon,
  SpanIcon,
  TapIcon,
  ErspanIcon,
  EastWestIcon,
  VmwareIcon,
  PacketToolIcon,
  MetadataToolIcon,
  S3StorageIcon,
};

// ─── Application palette data ─────────────────────────────────────────────────

/**
 * Each entry in this list becomes a draggable item in the "Applications"
 * section of the sidebar.  The `type` determines which React Flow node
 * component is instantiated; `initial` provides default `data` values.
 */
const appsList = [
  {
    label: 'Application Metadata',
    type: NODE_TYPES.GIGASMART,
    initial: { actionType: ACTION_TYPES.APP_METADATA, configType: ACTION_TYPES.APP_METADATA },
  },
  {
    label: 'Deduplication',
    type: NODE_TYPES.GIGASMART,
    initial: { actionType: ACTION_TYPES.DEDUPLICATION, configType: ACTION_TYPES.DEDUPLICATION },
  },
  { label: 'Load Balancing', type: NODE_TYPES.GIGASTREAM, initial: { algorithm: 'Round Robin' } },
  {
    label: 'Masking',
    type: NODE_TYPES.GIGASMART,
    initial: { actionType: ACTION_TYPES.MASKING, configType: ACTION_TYPES.MASKING },
  },
  {
    label: 'Slicing',
    type: NODE_TYPES.GIGASMART,
    initial: { actionType: ACTION_TYPES.PACKET_SLICING, configType: ACTION_TYPES.PACKET_SLICING },
  },
  {
    label: 'SSL Decrypt',
    type: NODE_TYPES.GIGASMART,
    initial: { actionType: ACTION_TYPES.SSL_DECRYPT, configType: ACTION_TYPES.SSL_DECRYPT },
  },
  {
    label: 'Header Stripping',
    type: NODE_TYPES.GIGASMART,
    initial: { actionType: ACTION_TYPES.HEADER_STRIP, configType: ACTION_TYPES.HEADER_STRIP, headerStripProtocol: 'VXLAN' },
  },
  {
    label: 'IP FlowVUE',
    type: NODE_TYPES.GIGASMART,
    initial: { actionType: ACTION_TYPES.IP_FLOWVUE, configType: ACTION_TYPES.IP_FLOWVUE },
  },
  {
    label: 'GTP Flow Filtering',
    type: NODE_TYPES.GIGASMART,
    initial: { actionType: ACTION_TYPES.GTP_FLOW_FILTERING, configType: ACTION_TYPES.GTP_FLOW_FILTERING },
  },
  {
    label: 'GTP Whitelisting',
    type: NODE_TYPES.GIGASMART,
    initial: { actionType: ACTION_TYPES.GTP_WHITELISTING, configType: ACTION_TYPES.GTP_WHITELISTING },
  },
  {
    label: 'GTP Flow Sampling',
    type: NODE_TYPES.GIGASMART,
    initial: { actionType: ACTION_TYPES.GTP_FLOW_SAMPLING, configType: ACTION_TYPES.GTP_FLOW_SAMPLING, gtpSamplePercent: 10 },
  },
] as const;

// ─── Sidebar component ────────────────────────────────────────────────────────

const Sidebar: React.FC = () => {
  const {
    advancedMode,
    setDraggedNodeType,
    sidebarMessage,
    setSidebarMessage,
    customTools,
    addCustomTool,
    deleteCustomTool,
    panelTextScale,
  } = useStore();
  // useStore() above (no selector) already re-renders this component on any store
  // change, including skuCatalogueVersion - so reading getSkus() fresh here picks up
  // an uploaded price list immediately, no extra memoisation needed.
  const skus = getSkus();
  const [openSections, setOpenSections] = useState({
    demo: true, // "Demonstration" section — expanded by default
    apps: true, // "Applications" section — shows all 15 GigaSMART apps
    advanced: true, // "Hardware" section for advanced mode
    hwTaps: false,
    hwTa: false,
    hwHc: true,
    hwGsa: false,
  });

  const [width, setWidth] = useState(260); // increased default width to fit grid
  const [isResizing, setIsResizing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddTool, setShowAddTool] = useState(false);
  const [newToolName, setNewToolName] = useState('');
  const [newToolFormat, setNewToolFormat] = useState<'packets' | 'AMI' | 'objects'>('packets');
  const [newToolIngestLimit, setNewToolIngestLimit] = useState(String(GENERIC_PACKET_TOOL_INGEST_LIMIT_MBPS));

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Per-group collapse state for the "Demonstration" section's sub-groups
  // (Sources, Traffic Routing, Packet Consumers, etc). Absence of a key means
  // "expanded" so the groups all start open without needing every label
  // pre-populated here. Packet Consumers in particular has 15+ entries, so
  // being able to collapse it (individually or via "Collapse All") keeps the
  // palette scannable.
  const DEMO_GROUP_LABELS = ['Sources', 'Traffic Routing', 'Packet Consumers', 'Metadata Consumers', 'Objects'];
  const [openDemoGroups, setOpenDemoGroups] = useState<Record<string, boolean>>({});
  const isDemoGroupOpen = (label: string) => openDemoGroups[label] !== false;
  const toggleDemoGroup = (label: string) => {
    setOpenDemoGroups((prev) => ({ ...prev, [label]: !isDemoGroupOpen(label) }));
  };
  const allDemoGroupsCollapsed = DEMO_GROUP_LABELS.every((label) => openDemoGroups[label] === false);
  const toggleAllDemoGroups = () => {
    const nextState: Record<string, boolean> = {};
    DEMO_GROUP_LABELS.forEach((label) => {
      nextState[label] = allDemoGroupsCollapsed;
    });
    setOpenDemoGroups(nextState);
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
    initialData?: Record<string, unknown>,
  ) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ type: nodeType, label, initialData }));
    event.dataTransfer.effectAllowed = 'move';
    setDraggedNodeType(nodeType);
  };

  return (
    <>
      {/* Inner Elements Tree Sidebar */}
      <aside
        className="sidebar-elements"
        style={{
          width: `${width}px`,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          zoom: panelTextScale,
        }}
      >
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
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* ── Collapsible Section: Demonstration ──
              Ordered via CSS `order` (not JSX position) so Advanced Mode can
              place the Physical Hardware section first without duplicating
              this section's markup for each mode. */}
          <div className="tree-section" style={{ order: 2 }}>
            <div className="tree-header" onClick={() => toggleSection('demo')}>
              <span className={`chevron ${openSections.demo ? 'open' : ''}`}>▶</span>
              <span>Demonstration</span>
              <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#888' }}>⚡</span>
            </div>

            {openSections.demo && (
              <div className="tree-content">
                <button
                  onClick={toggleAllDemoGroups}
                  style={{
                    alignSelf: 'flex-end',
                    background: 'transparent',
                    border: '1px solid #444',
                    borderRadius: '3px',
                    color: '#999',
                    fontSize: '9px',
                    padding: '3px 6px',
                    cursor: 'pointer',
                    marginBottom: '2px',
                  }}
                >
                  {allDemoGroupsCollapsed ? '▾ Expand All' : '▸ Collapse All'}
                </button>
                {(() => {
                  const packetCustom = (customTools || [])
                    .filter((t) => t.inputFormat === 'packets')
                    .map((t) => ({
                      label: t.label,
                      desc: `${t.label} (Custom Tool)`,
                      type: NODE_TYPES.TOOL,
                      icon: PacketToolIcon,
                      isCustom: true,
                      id: t.id,
                      initial: {
                        configType: CONFIG_TYPES.PACKET_TOOL,
                        toolName: t.label,
                        expectedType: 'packet',
                        ingestLimitMbps: t.ingestLimitMbps ?? GENERIC_PACKET_TOOL_INGEST_LIMIT_MBPS,
                      },
                    }));

                  const metadataCustom = (customTools || [])
                    .filter((t) => t.inputFormat === 'AMI')
                    .map((t) => ({
                      label: t.label,
                      desc: `${t.label} (Custom Tool)`,
                      type: NODE_TYPES.TOOL,
                      icon: MetadataToolIcon,
                      isCustom: true,
                      id: t.id,
                      initial: {
                        configType: CONFIG_TYPES.METADATA_TOOL,
                        toolName: t.label,
                        expectedType: 'metadata',
                        expectedFormat: 'Any',
                      },
                    }));

                  const objectsCustom = (customTools || [])
                    .filter((t) => t.inputFormat === 'objects')
                    .map((t) => ({
                      label: t.label,
                      desc: `${t.label} (Custom Tool)`,
                      type: NODE_TYPES.TOOL,
                      icon: S3StorageIcon,
                      isCustom: true,
                      id: t.id,
                      initial: { configType: CONFIG_TYPES.STORAGE_TOOL, toolName: t.label, expectedType: 'objects' },
                    }));

                  const demoGroups = [
                    {
                      label: 'Sources',
                      items: [
                        {
                          label: 'SPAN Port',
                          desc: 'SPAN Port 1/1/x1',
                          type: NODE_TYPES.INPUT,
                          icon: SpanIcon,
                          initial: { configType: CONFIG_TYPES.SPAN, linkSpeed: 10000 },
                        },
                        {
                          label: 'TAP Device',
                          desc: 'TAP Device 1/1/x2',
                          type: NODE_TYPES.INPUT,
                          icon: TapIcon,
                          initial: { configType: CONFIG_TYPES.TAP, linkSpeed: 10000 },
                        },
                        {
                          label: 'ERSPAN Source',
                          desc: 'ERSPAN Tunnel 10',
                          type: NODE_TYPES.INPUT,
                          icon: ErspanIcon,
                          initial: { configType: CONFIG_TYPES.ERSPAN, linkSpeed: 10000 },
                        },
                        {
                          label: 'East/West Traffic',
                          desc: 'East/West Traffic 1',
                          type: NODE_TYPES.INPUT,
                          icon: EastWestIcon,
                          initial: { configType: CONFIG_TYPES.EAST_WEST, linkSpeed: 10000 },
                        },
                        {
                          label: 'VMWare Estate',
                          desc: 'VMWare Estate 1',
                          type: NODE_TYPES.INPUT,
                          icon: VmwareIcon,
                          initial: { configType: CONFIG_TYPES.VMWARE, linkSpeed: 40000 },
                        },
                      ],
                    },
                    {
                      label: 'Traffic Routing',
                      items: [
                        { label: 'Traffic Map', desc: 'Traffic Map', type: NODE_TYPES.MAP, icon: MapIcon },
                        {
                          label: 'Traffic Tunnel',
                          desc: 'VLAN Filter',
                          type: NODE_TYPES.FILTER,
                          icon: GreenCircleIcon,
                        },
                      ],
                    },
                    {
                      label: 'Packet Consumers',
                      items: [
                        {
                          label: 'ExtraHop',
                          desc: 'ExtraHop Tool',
                          type: NODE_TYPES.TOOL,
                          icon: PacketToolIcon,
                          initial: {
                            configType: CONFIG_TYPES.PACKET_TOOL,
                            toolName: 'ExtraHop',
                            expectedType: 'packet',
                            ingestLimitMbps: DEFAULT_TOOL_INGEST_LIMITS_MBPS['ExtraHop'],
                          },
                        },
                        {
                          label: 'Vectra',
                          desc: 'Vectra Tool',
                          type: NODE_TYPES.TOOL,
                          icon: PacketToolIcon,
                          initial: {
                            configType: CONFIG_TYPES.PACKET_TOOL,
                            toolName: 'Vectra',
                            expectedType: 'packet',
                            ingestLimitMbps: DEFAULT_TOOL_INGEST_LIMITS_MBPS['Vectra'],
                          },
                        },
                        {
                          label: 'Darktrace',
                          desc: 'Darktrace Tool',
                          type: NODE_TYPES.TOOL,
                          icon: PacketToolIcon,
                          initial: {
                            configType: CONFIG_TYPES.PACKET_TOOL,
                            toolName: 'Darktrace',
                            expectedType: 'packet',
                            ingestLimitMbps: DEFAULT_TOOL_INGEST_LIMITS_MBPS['Darktrace'],
                          },
                        },
                        {
                          label: 'Corelight',
                          desc: 'Corelight Tool',
                          type: NODE_TYPES.TOOL,
                          icon: PacketToolIcon,
                          initial: {
                            configType: CONFIG_TYPES.PACKET_TOOL,
                            toolName: 'Corelight',
                            expectedType: 'packet',
                            ingestLimitMbps: DEFAULT_TOOL_INGEST_LIMITS_MBPS['Corelight'],
                          },
                        },
                        {
                          label: 'Endace Capture',
                          desc: 'Endace Capture Appliance',
                          type: NODE_TYPES.TOOL,
                          icon: PacketToolIcon,
                          initial: {
                            configType: CONFIG_TYPES.PACKET_TOOL,
                            toolName: 'Endace Packet Capture Appliance',
                            expectedType: 'packet',
                            ingestLimitMbps: DEFAULT_TOOL_INGEST_LIMITS_MBPS['Endace Packet Capture Appliance'],
                          },
                        },
                        {
                          label: 'Wireshark',
                          desc: 'Wireshark Tool',
                          type: NODE_TYPES.TOOL,
                          icon: WiresharkIcon,
                          initial: {
                            configType: CONFIG_TYPES.PACKET_TOOL,
                            toolName: 'Wireshark',
                            expectedType: 'packet',
                            ingestLimitMbps: DEFAULT_TOOL_INGEST_LIMITS_MBPS['Wireshark'],
                          },
                        },
                        {
                          label: 'ForeScout',
                          desc: 'ForeScout Tool',
                          type: NODE_TYPES.TOOL,
                          icon: PacketToolIcon,
                          initial: {
                            configType: CONFIG_TYPES.PACKET_TOOL,
                            toolName: 'ForeScout',
                            expectedType: 'packet',
                            ingestLimitMbps: DEFAULT_TOOL_INGEST_LIMITS_MBPS['ForeScout'],
                          },
                        },
                        {
                          label: 'Nozomi',
                          desc: 'Nozomi Tool',
                          type: NODE_TYPES.TOOL,
                          icon: PacketToolIcon,
                          initial: {
                            configType: CONFIG_TYPES.PACKET_TOOL,
                            toolName: 'Nozomi',
                            expectedType: 'packet',
                            ingestLimitMbps: DEFAULT_TOOL_INGEST_LIMITS_MBPS['Nozomi'],
                          },
                        },
                        {
                          label: 'Trellix',
                          desc: 'Trellix Network Security (IPS/NDR)',
                          type: NODE_TYPES.TOOL,
                          icon: PacketToolIcon,
                          initial: {
                            configType: CONFIG_TYPES.PACKET_TOOL,
                            toolName: 'Trellix',
                            expectedType: 'packet',
                            ingestLimitMbps: DEFAULT_TOOL_INGEST_LIMITS_MBPS['Trellix'],
                          },
                        },
                        {
                          label: 'Cisco',
                          desc: 'Cisco Secure Network Analytics',
                          type: NODE_TYPES.TOOL,
                          icon: PacketToolIcon,
                          initial: {
                            configType: CONFIG_TYPES.PACKET_TOOL,
                            toolName: 'Cisco Secure Network Analytics',
                            expectedType: 'packet',
                            ingestLimitMbps: DEFAULT_TOOL_INGEST_LIMITS_MBPS['Cisco Secure Network Analytics'],
                          },
                        },
                        {
                          label: 'Arista NDR',
                          desc: 'Arista NDR (Awake)',
                          type: NODE_TYPES.TOOL,
                          icon: PacketToolIcon,
                          initial: {
                            configType: CONFIG_TYPES.PACKET_TOOL,
                            toolName: 'Arista NDR',
                            expectedType: 'packet',
                            ingestLimitMbps: DEFAULT_TOOL_INGEST_LIMITS_MBPS['Arista NDR'],
                          },
                        },
                        {
                          label: 'FortiNDR',
                          desc: 'Fortinet FortiNDR',
                          type: NODE_TYPES.TOOL,
                          icon: PacketToolIcon,
                          initial: {
                            configType: CONFIG_TYPES.PACKET_TOOL,
                            toolName: 'FortiNDR',
                            expectedType: 'packet',
                            ingestLimitMbps: DEFAULT_TOOL_INGEST_LIMITS_MBPS['FortiNDR'],
                          },
                        },
                        {
                          label: 'NetWitness',
                          desc: 'NetWitness NDR',
                          type: NODE_TYPES.TOOL,
                          icon: PacketToolIcon,
                          initial: {
                            configType: CONFIG_TYPES.PACKET_TOOL,
                            toolName: 'NetWitness',
                            expectedType: 'packet',
                            ingestLimitMbps: DEFAULT_TOOL_INGEST_LIMITS_MBPS['NetWitness'],
                          },
                        },
                        {
                          label: 'Trend Micro',
                          desc: 'Trend Micro Deep Discovery Inspector',
                          type: NODE_TYPES.TOOL,
                          icon: PacketToolIcon,
                          initial: {
                            configType: CONFIG_TYPES.PACKET_TOOL,
                            toolName: 'Trend Micro',
                            expectedType: 'packet',
                            ingestLimitMbps: DEFAULT_TOOL_INGEST_LIMITS_MBPS['Trend Micro'],
                          },
                        },
                        ...packetCustom,
                      ],
                    },
                    {
                      label: 'Metadata Consumers',
                      items: [
                        {
                          label: 'Splunk',
                          desc: 'Splunk Collector',
                          type: NODE_TYPES.TOOL,
                          icon: MetadataToolIcon,
                          initial: {
                            configType: CONFIG_TYPES.METADATA_TOOL,
                            toolName: 'Splunk',
                            expectedType: 'metadata',
                            expectedFormat: 'CEF',
                          },
                        },
                        {
                          label: 'Elastic',
                          desc: 'Elastic Search',
                          type: NODE_TYPES.TOOL,
                          icon: MetadataToolIcon,
                          initial: {
                            configType: CONFIG_TYPES.METADATA_TOOL,
                            toolName: 'Elastic',
                            expectedType: 'metadata',
                            expectedFormat: 'JSON',
                          },
                        },
                        {
                          label: 'Dynatrace',
                          desc: 'Dynatrace APM',
                          type: NODE_TYPES.TOOL,
                          icon: MetadataToolIcon,
                          initial: {
                            configType: CONFIG_TYPES.METADATA_TOOL,
                            toolName: 'Dynatrace',
                            expectedType: 'metadata',
                            expectedFormat: 'JSON',
                          },
                        },
                        {
                          label: 'Sentinel',
                          desc: 'Microsoft Sentinel SIEM',
                          type: NODE_TYPES.TOOL,
                          icon: MetadataToolIcon,
                          initial: {
                            configType: CONFIG_TYPES.METADATA_TOOL,
                            toolName: 'Microsoft Sentinel',
                            expectedType: 'metadata',
                            expectedFormat: 'CEF',
                          },
                        },
                        ...metadataCustom,
                      ],
                    },
                    {
                      label: 'Objects',
                      items: [
                        {
                          label: 'S3 / Object Storage',
                          desc: 'S3 Object Storage',
                          type: NODE_TYPES.TOOL,
                          icon: S3StorageIcon,
                          initial: {
                            configType: CONFIG_TYPES.STORAGE_TOOL,
                            toolName: 'S3 Object Storage',
                            expectedType: 'objects',
                          },
                        },
                        ...objectsCustom,
                      ],
                    },
                  ];

                  return demoGroups.map((group, gIdx) => {
                    const filteredItems = group.items.filter((item) => item.label.toLowerCase().includes(searchQuery));
                    if (filteredItems.length === 0) return null;

                    // A search query force-opens every matching group, regardless of its
                    // collapsed state, so search results are never hidden.
                    const isGroupOpen = searchQuery ? true : isDemoGroupOpen(group.label);

                    return (
                      <React.Fragment key={gIdx}>
                        <div
                          className="demo-group-label"
                          onClick={() => toggleDemoGroup(group.label)}
                          style={{
                            padding: '8px 12px 2px 12px',
                            fontSize: '10px',
                            color: '#999',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            userSelect: 'none',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '8px',
                              display: 'inline-block',
                              transform: isGroupOpen ? 'rotate(90deg)' : 'none',
                              transition: 'transform 0.15s ease',
                            }}
                          >
                            ▶
                          </span>
                          <span>{group.label}</span>
                          <span style={{ marginLeft: 'auto', color: '#666', fontWeight: 400 }}>
                            {filteredItems.length}
                          </span>
                        </div>
                        {isGroupOpen &&
                          filteredItems.map((item, iIdx) => (
                            <div
                              key={iIdx}
                              className="tree-draggable"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingRight: '8px',
                              }}
                              draggable
                              onDragStart={(e) =>
                                onDragStart(
                                  e,
                                  item.type,
                                  item.desc,
                                  (item as { initial?: Record<string, unknown> }).initial,
                                )
                              }
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <item.icon size={18} />
                                <span>{item.label}</span>
                              </div>
                              {(item as { isCustom?: boolean }).isCustom && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteCustomTool((item as { id: string }).id);
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#ff5555',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    padding: '2px 4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                  title="Delete custom tool"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                      </React.Fragment>
                    );
                  });
                })()}

                {/* Add Custom Tool Section */}
                <div style={{ padding: '12px 12px 6px 12px', borderTop: '1px solid #2d2d2d', marginTop: '10px' }}>
                  {!showAddTool ? (
                    <button
                      onClick={() => setShowAddTool(true)}
                      style={{
                        width: '100%',
                        padding: '6px',
                        background: '#2b2b2b',
                        border: '1px dashed #555',
                        borderRadius: '4px',
                        color: '#ddd',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      ➕ Add Custom Tool
                    </button>
                  ) : (
                    <div
                      style={{
                        background: '#1c1c1c',
                        border: '1px solid #333',
                        borderRadius: '4px',
                        padding: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#ff9800' }}>Create Custom Tool</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '9px', color: '#888' }}>Tool Name</label>
                        <input
                          type="text"
                          placeholder="e.g. My Custom Tool"
                          value={newToolName}
                          onChange={(e) => setNewToolName(e.target.value)}
                          style={{
                            padding: '4px 6px',
                            background: '#121212',
                            border: '1px solid #444',
                            borderRadius: '3px',
                            color: '#fff',
                            fontSize: '11px',
                            outline: 'none',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '9px', color: '#888' }}>Input Data Format</label>
                        <select
                          value={newToolFormat}
                          onChange={(e) => setNewToolFormat(e.target.value as 'packets' | 'AMI' | 'objects')}
                          style={{
                            padding: '4px 6px',
                            background: '#121212',
                            border: '1px solid #444',
                            borderRadius: '3px',
                            color: '#fff',
                            fontSize: '11px',
                            outline: 'none',
                          }}
                        >
                          <option value="packets">Packets (Packet Consuming)</option>
                          <option value="AMI">AMI / Metadata (Metadata Consuming)</option>
                          <option value="objects">Objects (Object Consuming)</option>
                        </select>
                      </div>
                      {newToolFormat === 'packets' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '9px', color: '#888' }}>Ingest Rate Limit (Mbps)</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder={String(GENERIC_PACKET_TOOL_INGEST_LIMIT_MBPS)}
                            value={newToolIngestLimit}
                            onChange={(e) => setNewToolIngestLimit(e.target.value)}
                            style={{
                              padding: '4px 6px',
                              background: '#121212',
                              border: '1px solid #444',
                              borderRadius: '3px',
                              color: '#fff',
                              fontSize: '11px',
                              outline: 'none',
                            }}
                          />
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        <button
                          onClick={() => {
                            if (!newToolName.trim()) return;
                            const parsedLimit = parseInt(newToolIngestLimit, 10);
                            addCustomTool({
                              label: newToolName.trim(),
                              inputFormat: newToolFormat,
                              ...(newToolFormat === 'packets'
                                ? {
                                    ingestLimitMbps:
                                      !isNaN(parsedLimit) && parsedLimit > 0
                                        ? parsedLimit
                                        : GENERIC_PACKET_TOOL_INGEST_LIMIT_MBPS,
                                  }
                                : {}),
                            });
                            setNewToolName('');
                            setNewToolIngestLimit(String(GENERIC_PACKET_TOOL_INGEST_LIMIT_MBPS));
                            setShowAddTool(false);
                          }}
                          style={{
                            flex: 1,
                            padding: '5px',
                            background: '#ff9800',
                            border: 'none',
                            borderRadius: '3px',
                            color: '#000',
                            fontWeight: 'bold',
                            fontSize: '10px',
                            cursor: 'pointer',
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setNewToolName('');
                            setShowAddTool(false);
                          }}
                          style={{
                            flex: 1,
                            padding: '5px',
                            background: '#444',
                            border: 'none',
                            borderRadius: '3px',
                            color: '#ccc',
                            fontSize: '10px',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Collapsible Section: Applications (15 GigaSMART applications) ── */}
          <div className="tree-section" style={{ order: 3 }}>
            <div className="tree-header" onClick={() => toggleSection('apps')}>
              <span className={`chevron ${openSections.apps ? 'open' : ''}`}>▶</span>
              <span>Applications</span>
              <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#888' }}>🔍</span>
            </div>
            {openSections.apps && (
              <div className="tree-content" style={{ maxHeight: '550px', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', padding: '4px' }}>
                  {appsList
                    .filter((app) => app.label.toLowerCase().includes(searchQuery))
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
                          borderRadius: '6px',
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

          {/* ── Collapsible Section: Hardware (Advanced Mode) ──
            Placed first (order: 1) in Advanced Mode, since physical hardware
            configuration is the primary concern there. */}
          {advancedMode && (
            <div className="tree-section" style={{ order: 1 }}>
              <div className="tree-header" onClick={() => toggleSection('advanced')}>
                <span className={`chevron ${openSections.advanced ? 'open' : ''}`}>▶</span>
                <span>Physical Hardware (SE)</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#888' }}>⚙️</span>
              </div>
              {openSections.advanced && (
                <div className="tree-content" style={{ maxHeight: '550px', overflowY: 'auto' }}>
                  {/* TAPS Sub-accordion - trays (TAP-M100T/M200T/M202ULT) are
                    excluded here: they're auto-generated (see syncTapTrays)
                    to match however many tap modules actually need one, and
                    only ever placed via Rack View, never dragged manually. */}
                  <CatalogueSection
                    title="TAPs"
                    items={hardwareCatalogue.taps as HardwareCatalogueItem[]}
                    filterFn={(item) => !['TAP-M100T', 'TAP-M200T', 'TAP-M202ULT'].includes(item.sku as string)}
                    isOpen={openSections.hwTaps}
                    onToggle={() => toggleSection('hwTaps')}
                    searchQuery={searchQuery}
                    onDragStart={onDragStart}
                    nodeType={NODE_TYPES.HARDWARE}
                    fallbackIcon={TapIcon}
                    skus={skus}
                    buildInitialData={(item) => ({
                      configType: 'Hardware',
                      model: item.model,
                      sku: item.sku,
                      image: item.image,
                      tappedLinksCount: 0,
                      tappedLinkAllocations: [],
                    })}
                  />

                  {/* TA Series Sub-accordion */}
                  <CatalogueSection
                    title="TA Series"
                    items={hardwareCatalogue.ta_series as HardwareCatalogueItem[]}
                    isOpen={openSections.hwTa}
                    onToggle={() => toggleSection('hwTa')}
                    searchQuery={searchQuery}
                    onDragStart={onDragStart}
                    nodeType={NODE_TYPES.HARDWARE}
                    fallbackIcon={GreenCircleIcon}
                    skus={skus}
                  />

                  {/* HC Series Sub-accordion */}
                  <CatalogueSection
                    title="HC Series"
                    items={hardwareCatalogue.hc_series as HardwareCatalogueItem[]}
                    isOpen={openSections.hwHc}
                    onToggle={() => toggleSection('hwHc')}
                    searchQuery={searchQuery}
                    onDragStart={onDragStart}
                    nodeType={NODE_TYPES.HARDWARE}
                    fallbackIcon={MapIcon}
                    skus={skus}
                  />

                  {/* Appliances Sub-accordion — external Gigamon appliances (not
                    chassis hardware) that still belong alongside TAPs/TA/HC
                    since they're Gigamon-branded gear, not general-purpose tools. */}
                  <CatalogueSection
                    title="Appliances"
                    items={[{ model: 'GigaSMART Appliance', sku: 'GSA', image: 'GigaVUE-GSA.png' }]}
                    isOpen={openSections.hwGsa}
                    onToggle={() => toggleSection('hwGsa')}
                    searchQuery={searchQuery}
                    onDragStart={onDragStart}
                    nodeType={NODE_TYPES.TOOL}
                    fallbackIcon={PacketToolIcon}
                    skus={skus}
                    renderLabel={() => <>GigaSMART Appliance (GSA)</>}
                    buildInitialData={() => ({
                      configType: CONFIG_TYPES.PACKET_TOOL,
                      toolName: 'GigaSMART Appliance',
                      expectedType: 'packet',
                      ingestLimitMbps: DEFAULT_TOOL_INGEST_LIMITS_MBPS['GigaSMART Appliance'],
                      gigaSmartApps: [
                        {
                          id: 'ami-1',
                          actionType: ACTION_TYPES.AMI,
                          label: 'Application Metadata Intelligence',
                          metadataFormat: 'CEF',
                          metadataRate: 1.5,
                        },
                      ],
                    })}
                  />
                </div>
              )}
            </div>
          )}

          {/* Sidebar message panel */}
          {sidebarMessage && (
            <div
              style={{
                padding: '10px 12px',
                background: 'rgba(76, 175, 80, 0.08)',
                borderTop: '1px solid rgba(76, 175, 80, 0.25)',
                borderLeft: '4px solid #4caf50',
                fontSize: '11px',
                color: '#c8e6c9',
                position: 'relative',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontWeight: 'bold',
                  color: '#4caf50',
                  marginBottom: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>📢 Inventory Auto-configured</span>
                <button
                  onClick={() => setSidebarMessage(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#aaa',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: 0,
                  }}
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
