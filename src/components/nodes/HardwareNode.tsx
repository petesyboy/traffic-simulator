/**
 * HardwareNode.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * GigaVUE hardware chassis / TAP appliance node renderer (~370 lines).
 *
 * Type casts use the proper typed interfaces from types.ts instead of `any`.
 */

import React, { useMemo, useState } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { useStore } from '../../store/store';
import type { MapCondition, HardwareNodeData, GigaSmartNodeData, CustomNode } from '../../store/types';
import { formatBandwidth } from '../../utils/format';
import {
  MapIcon, GreenCircleIcon, TapIcon, AppIcon,
} from '../Icons';
import { resolveNodeSkus } from '../../utils/skuResolver';
import { getNodeValueProposition } from '../../constants/nodeValues';
import { generateSingleNodeBom } from '../../utils/bomEngine';
import { useGlowClass, getTapDetails, getConditionsSummary } from './nodeStyles';
import { resolveHardwareIcon } from '../../assets/hardwareIcons';
import { ChassisSummaryModal } from './ChassisSummaryModal';
import { ChassisFaceplate } from './ChassisFaceplate';
import { ChassisFrontPanel } from './ChassisFrontPanel';
import { getChassisPorts, getPortOccupancy } from '../../utils/ports';
import { getModuleSlotPositions } from '../../utils/hardwareUtils';

const HardwareNodeComponent: React.FC<NodeProps> = ({ id, data, selected }) => {
  const updateNodeData = useStore((state) => state.updateNodeData);
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);
  const model = (data.model as string) || 'Hardware';
  const projectLicenseMode = useStore((state) => state.projectLicenseMode);
  const globalTermDuration = useStore((state) => state.defaultTermDuration || '12');
  const globalRegion = useStore((state) => state.projectRegion || 'US');
  const nodes = useStore((state) => state.nodes);
  const edges = useStore((state) => state.edges);
  const exportDiagramMode = useStore((state) => state.exportDiagramMode);
  const advancedMode = useStore((state) => state.advancedMode);
  const resolved = resolveNodeSkus(data, projectLicenseMode);
  const [showSummary, setShowSummary] = useState(false);

  let displaySku = resolved.hwSku;
  if (resolved.swSku) displaySku += ` + ${resolved.swSku}`;
  if (resolved.advSku) displaySku += ` + ${resolved.advSku}`;

  const hwData = data as HardwareNodeData;
  const image = resolveHardwareIcon(hwData.image);

  // Ports are derived rather than stored, so recompute only when the inputs
  // that shape them actually change - not on every metrics tick.
  const chassisPorts = useMemo(
    () => (advancedMode ? getChassisPorts(model, hwData) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hwData is a fresh object each render; these are the fields getChassisPorts reads
    [advancedMode, model, hwData.installedBoards, hwData.portCapacity, hwData.optics],
  );
  const portOccupancy = useMemo(
    () => (chassisPorts.length > 0
      ? getPortOccupancy({ id, type: 'hardwareNode', position: { x: 0, y: 0 }, data } as CustomNode, nodes, edges, chassisPorts)
      : new Map()),
    [chassisPorts, id, data, nodes, edges],
  );

  // Photographic front panel, drawn only for chassis whose bays have been calibrated
  // (see `module_slot_positions` in the hardware catalogue). It shows which bays are
  // populated; the ChassisFaceplate below it carries live per-port state.
  const slotPositions = useMemo(
    () => (advancedMode ? getModuleSlotPositions(model, data.sku as string) : []),
    [advancedMode, model, data.sku],
  );
  const showFrontPanel = Boolean(image) && slotPositions.some(p => p.box);

  // Chassis photos are extremely wide (an HC1 is 10.6:1), so cap width as well as
  // height - a height-only constraint let the icon alone stretch an HC1 node to
  // ~470px, near double an HC3's, purely from its aspect ratio.
  // When the front-panel strip is already showing the same chassis photo (with
  // its installed modules), showing it again as the small header icon is pure
  // duplication - fall back to a generic icon there instead.
  const useHeaderPhoto = Boolean(image) && !showFrontPanel;
  let rawIcon = useHeaderPhoto ? (
    <img src={image} alt={model} style={{ maxHeight: '32px', maxWidth: '120px', display: 'block' }} />
  ) : <GreenCircleIcon size={20} />;

  if (!useHeaderPhoto) {
    if (model.includes('TAP')) rawIcon = <TapIcon size={20} />;
    else if (model.includes('HC')) rawIcon = <MapIcon size={20} />;
  }

  const iconComponent = (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {rawIcon}
      {resolved.advSku && (
        <div style={{
          position: 'absolute',
          top: '-5px',
          right: '-5px',
          background: '#ffd54f',
          color: '#000',
          borderRadius: '50%',
          width: '11px',
          height: '11px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '8px',
          fontWeight: 'bold',
          boxShadow: '0 0 3px rgba(0,0,0,0.8)',
          lineHeight: '1',
          pointerEvents: 'none'
        }} title="Advanced Features Licensed">★</div>
      )}
    </div>
  );
  
  const isTap = model.includes('TAP');
  const isChassis = (model.includes('HC') || model.includes('TA')) && !isTap;
  const tapInfo = isTap ? getTapDetails(resolved.hwSku, model) : null;
  const conditions = (data.conditions as MapCondition[]) || [];

  const nodeObj = { id, type: 'hardwareNode', position: { x: 0, y: 0 }, data } as CustomNode;
  const nodeBom = generateSingleNodeBom(nodeObj, projectLicenseMode, globalTermDuration, globalRegion, edges, nodes);
  
  let tooltipText = `${model} Configuration BOM:\n`;
  if (nodeBom.length > 0) {
    tooltipText += nodeBom.map(row => `• ${row.qty}x ${row.sku} (${row.description})${row.term ? ` [${row.term} mo]` : ''}`).join('\n');
  } else {
    tooltipText += 'No components configured.';
  }

  const glowClass = useGlowClass(id);

  // Typed access to GigaSMART apps
  const gigaSmartApps: GigaSmartNodeData[] = (hwData.gigaSmartApps || []);

  return (
    <>
      <NodeResizer minWidth={170} minHeight={75} isVisible={selected} />
      <div 
        className={`custom-node hardware-node ${selected ? 'selected-node' : ''} ${glowClass} ${data.hasGigaSmartError ? 'has-error' : ''}`} 
        style={{ borderLeft: '4px solid #ff9800', ...(data.hasGigaSmartError ? { borderColor: '#f44336', boxShadow: '0 0 10px rgba(244,67,54,0.5)' } : {}) }}
        title={tooltipText}
      >
        {Boolean(data.site) && (
          <div style={{ position: 'absolute', top: '-8px', left: '8px', background: '#3b82f6', color: '#fff', fontSize: '9px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', zIndex: 10, border: '1px solid #60a5fa' }}>
            Site: {data.site as string}
          </div>
        )}
        <Handle type="target" position={Position.Left} id="in" />
        <div className="node-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {iconComponent}
            <span className="node-title">{data.label as string}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {isChassis && (
              <button
                className="node-info-icon"
                style={{ cursor: 'pointer', border: 'none' }}
                title="View hardware summary"
                onClick={(e) => { e.stopPropagation(); setShowSummary(true); }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                📋
              </button>
            )}
            <div className="node-value-tooltip-container">
              <span className="node-info-icon">ⓘ</span>
              <div className="node-value-tooltip">{getNodeValueProposition('hardwareNode')}</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between', marginTop: '2px' }}>
          <div className="node-type-label" style={{ display: 'block', color: '#ff9800', fontWeight: 'bold', margin: 0 }}>{model}</div>
          {advancedMode && resolved.advSku && (
            <span style={{
              fontSize: '8px',
              background: 'rgba(255, 213, 79, 0.15)',
              color: '#ffd54f',
              border: '1px solid rgba(255, 213, 79, 0.3)',
              borderRadius: '3px',
              padding: '1px 4px',
              fontWeight: 'bold',
              marginRight: '6px'
            }}>
              ★ ADV LICENSED
            </span>
          )}
        </div>
        {advancedMode && (
          <>
            <div className="node-meta" style={{ fontSize: '9px', opacity: 0.8, marginTop: '2px' }}>
              <span>SKU: {displaySku}</span>
            </div>
            {showFrontPanel && (
              <div style={{ marginTop: '6px', maxWidth: '220px', border: '1px solid #2a2a2a', borderRadius: '3px', overflow: 'hidden' }}>
                <ChassisFrontPanel
                  chassisImage={image!}
                  model={model}
                  slotPositions={slotPositions}
                  installedBoards={hwData.installedBoards || {}}
                />
              </div>
            )}
            <ChassisFaceplate ports={chassisPorts} occupancy={portOccupancy} />
            {isTap && tapInfo && (
              <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                {tapInfo.splitRatio && (
                <span style={{
                  fontSize: '8px',
                  background: 'rgba(0, 229, 255, 0.15)',
                  color: '#00e5ff',
                  border: '1px solid rgba(0, 229, 255, 0.3)',
                  borderRadius: '3px',
                  padding: '1px 4px',
                  fontWeight: 'bold'
                }}>
                  ⚖️ {tapInfo.splitRatio}
                </span>
                )}
                {tapInfo.media && (
                  <span style={{
                    fontSize: '8px',
                    background: tapInfo.media.includes('SMF') ? 'rgba(255, 235, 59, 0.15)' : 'rgba(0, 230, 118, 0.15)',
                    color: tapInfo.media.includes('SMF') ? '#ffd54f' : '#00e676',
                    border: tapInfo.media.includes('SMF') ? '1px solid rgba(255, 235, 59, 0.3)' : '1px solid rgba(0, 230, 118, 0.3)',
                    borderRadius: '3px',
                    padding: '1px 4px',
                    fontWeight: 'bold'
                  }}>
                    {tapInfo.media}
                  </span>
                )}
                {tapInfo.wavelength && (
                  <span style={{
                    fontSize: '8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#ccc',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '3px',
                    padding: '1px 4px'
                  }}>
                    λ {tapInfo.wavelength}
                  </span>
                )}
                {tapInfo.isULT && (
                  <span style={{
                    fontSize: '8px',
                    background: 'rgba(244, 67, 54, 0.15)',
                    color: '#ff8a80',
                    border: '1px solid rgba(244, 67, 54, 0.3)',
                    borderRadius: '3px',
                    padding: '1px 4px',
                    fontWeight: 'bold'
                  }}>
                    🔒 ULT
                  </span>
                )}
              </div>
            )}
          </>
        )}

        {!isTap && conditions.length > 0 && (
          <div style={{
            marginTop: '6px',
            padding: '4px 6px',
            fontSize: '8.5px',
            background: 'rgba(255, 152, 0, 0.08)',
            border: '1px solid rgba(255, 152, 0, 0.2)',
            borderRadius: '3px',
            color: '#ffe0b2',
            wordBreak: 'break-all'
          }}>
            <div style={{ fontWeight: 'bold', color: '#ff9800', marginBottom: '2px' }}>
              🎯 Map ({conditions.length} rule{conditions.length > 1 ? 's' : ''}):
            </div>
            <div>
              {getConditionsSummary(conditions)}
            </div>
          </div>
        )}
        
        {/* Render GigaSMART validation errors */}
        {Boolean(data.hasGigaSmartError) && Boolean(data.gigaSmartErrorMsg) && (
          <div style={{
            marginTop: '8px', 
            padding: '4px',
            background: 'rgba(244,67,54,0.1)',
            border: '1px solid #f44336',
            borderRadius: '4px',
            color: '#f44336',
            fontSize: '9px',
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            ⚠️ {String(data.gigaSmartErrorMsg)}
          </div>
        )}
        
        {/* Render internal GigaSMART apps in Advanced Mode */}
        {advancedMode && gigaSmartApps.length > 0 && (
          <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,152,0,0.3)', paddingTop: '6px' }}>
            <div style={{ fontSize: '9px', color: '#ff9800', marginBottom: '4px', fontWeight: 'bold' }}>GigaSMART Apps:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {gigaSmartApps.map((app: GigaSmartNodeData, idx: number) => (
                <div key={(app.id as string) || idx} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px', padding: '2px 4px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AppIcon type={app.actionType as string} size={14} rate={app.dedupRate as number} />
                    <span style={{ fontSize: '9px', color: '#ccc' }}>
                      {(app.label as string) || (app.actionType as string)}
                      {app.actionType === 'Packet Slicing' && ` (${(app.sliceSize as number) ?? 128}B)`}
                    </span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const newApps = gigaSmartApps.filter((a: GigaSmartNodeData) => a.id !== app.id);
                      updateNodeData(id, { gigaSmartApps: newApps as GigaSmartNodeData[] });
                    }}
                    style={{
                      background: 'none', border: 'none', color: '#888', cursor: 'pointer',
                      fontSize: '10px', padding: '0 2px', lineHeight: 1
                    }}
                    title="Remove app"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {isRunning && (
          <div className="node-metrics" style={{ marginTop: '8px', justifyContent: isTap ? 'flex-end' : 'space-between' }}>
            {!isTap && <span>In: {formatBandwidth(metrics?.rxMbps)}</span>}
            <span>Out: {formatBandwidth(metrics?.txMbps)}</span>
          </div>
        )}

        <Handle type="source" position={Position.Right} id="out" />
      </div>

      {showSummary && (
        <ChassisSummaryModal
          model={model}
          sku={(data.sku as string) || ''}
          displaySku={resolved.hwSku}
          label={(data.label as string) || model}
          hwData={hwData}
          onClose={() => setShowSummary(false)}
        />
      )}

      {exportDiagramMode && (
        <div style={{
          background: 'rgba(20, 20, 20, 0.95)',
          border: '1px solid #ff9800',
          borderRadius: '4px',
          padding: '6px 8px',
          width: '180px',
          boxSizing: 'border-box',
          color: '#fff',
          fontSize: '9px',
          fontFamily: 'monospace',
          boxShadow: '0 2px 8px rgba(0,0,0,0.8)',
          pointerEvents: 'none',
          whiteSpace: 'pre-wrap',
          marginTop: '6px'
        }}>
          {(() => {
            if (isTap) {
              const allocations = (hwData.tappedLinkAllocations as { qty: number, optic: string }[]) || [
                { qty: hwData.tappedLinksCount ?? 1, optic: (hwData.tappedLinkOptic as string) || (tapInfo?.media?.includes('SMF') ? 'SFP-533' : 'SFP-532') }
              ];
              const descLines = allocations.map(a => `Tapping ${a.qty} network link(s) using ${a.optic} to mirror traffic.`);
              return descLines.join('\n');
            } else {
              // Find incoming TAP links (deduplicated by source node to prevent double-counting)
              const incomingSrcIds = Array.from(new Set(edges.filter(e => e.target === id).map(e => e.source)));
              const tapConns = incomingSrcIds.map(srcId => {
                const src = nodes.find(n => n.id === srcId);
                if (src && String(src.data?.model || '').toUpperCase().includes('TAP')) {
                  const srcHw = src.data as HardwareNodeData;
                  const allocations = (srcHw.tappedLinkAllocations as { qty: number, optic: string, toolOptic?: string }[]) || [
                    { qty: srcHw.tappedLinksCount ?? 1, optic: (srcHw.tappedLinkOptic as string) || 'SFP-532' }
                  ];
                  return allocations.map(a => ({
                    label: srcHw.label || 'TAP',
                    linksCount: a.qty,
                    optic: a.toolOptic || a.optic
                  }));
                }
                return null;
              }).filter(Boolean).flat() as { label: string, linksCount: number, optic: string }[];

              let desc = '';
              if (tapConns.length > 0) {
                const grouped = tapConns.reduce((acc, curr) => {
                  if (!acc[curr.optic]) acc[curr.optic] = { links: 0, labels: new Set<string>() };
                  acc[curr.optic].links += curr.linksCount;
                  acc[curr.optic].labels.add(curr.label);
                  return acc;
                }, {} as Record<string, { links: number, labels: Set<string> }>);

                desc += Object.entries(grouped).map(([optic, data]) => {
                  const ports = data.links * 2;
                  const labels = Array.from(data.labels).join(', ');
                  return `Terminating ${ports} TAP ports (from ${data.links} tapped links) from ${labels} using ${optic}.`;
                }).join('\n') + '\n\n';
              }

              const opticsDesc = nodeBom.filter(r => r.type === 'Optic' || r.type === 'TAP' || r.type === 'Module')
                .map(r => `${r.qty}x ${r.sku}`)
                .join(', ');
              
              const has4x10 = nodeBom.some(r => r.sku.includes('PNL-M341'));
              const has4x25 = nodeBom.some(r => r.sku.includes('PNL-M343'));
              let breakoutNote = '';
              if (has4x10 || has4x25) {
                breakoutNote += '\nNote: ';
                if (has4x10) breakoutNote += 'Each 4x10G breakout panel (PNL-M341) requires a 40G QSFP+ optic to supply the 10G ports. ';
                if (has4x25) breakoutNote += 'Each 4x25G breakout panel (PNL-M343) requires a 100G QSFP28 optic to supply the 25G ports. ';
              }
              
              desc += `Configured: ${opticsDesc || 'No modules or optics configured.'}${breakoutNote}\n\n`;
              desc += `Aggregating, filtering, and distributing network traffic to destination tools.`;
              
              if (conditions && conditions.length > 0) {
                desc += `\n\nTraffic Map (Filtering Rules):\n` + conditions.map((c, i) => {
                  const logicPrefix = i > 0 ? `${c.logic} ` : '';
                  let fieldLabel = c.field.toUpperCase();
                  if (c.field === 'portdst') fieldLabel = 'DST PORT';
                  if (c.field === 'portsrc') fieldLabel = 'SRC PORT';
                  if (c.field === 'ipdst') fieldLabel = 'DST IP';
                  if (c.field === 'ipsrc') fieldLabel = 'SRC IP';
                  if (c.field === 'ipver') fieldLabel = 'IP VER';
                  if (c.field === 'vlan') fieldLabel = 'VLAN';
                  if (c.field === 'protocol') fieldLabel = 'PROTO';
                  
                  const actionLabel = c.action === 'drop' ? 'DROP' : 'PASS';
                  return `• ${logicPrefix}${fieldLabel} = ${c.value} -> ${actionLabel}`;
                }).join('\n');
              }
              
              if (gigaSmartApps.length > 0) {
                const gsApps = gigaSmartApps.map((app: GigaSmartNodeData) => (app.label as string) || (app.actionType as string)).join(', ');
                desc += `\n\nActive GigaSMART Functions: ${gsApps}`;
              }
              
              return desc;
            }
          })()}
        </div>
      )}
    </>
  );
};

export const HardwareNode = React.memo(HardwareNodeComponent);
