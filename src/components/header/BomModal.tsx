/**
 * BomModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Bill of Materials and Physical Rack & Deployment Report modal.
 * Contains: BOM table, config validation errors, export CSV, and physical specs.
 */

import React, { useState } from 'react';
import { useStore } from '../../store/store';
import { generateBom, validateConfiguration, getSkus } from '../../utils/bomEngine';
import { buildProjectWideOpticBom } from '../../utils/bom/opticPacks';
import { consolidateSimpleDeviceRows, CONSOLIDATED_DEVICES_NODE_ID } from '../../utils/bom/consolidateSimpleDevices';
import { buildPhysicalItems, parseAndConvertDimensions, type PhysicalItem } from '../../utils/bom/physicalItems';
import type { HardwareNodeData } from '../../store/types';

export interface BomModalProps {
  onClose: () => void;
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────
const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;

// ─── Component ────────────────────────────────────────────────────────────────
const BomModal: React.FC<BomModalProps> = ({ onClose }) => {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const globalLicenseMode = useStore((s) => s.projectLicenseMode);
  const globalTermDuration = useStore((s) => s.defaultTermDuration);
  const globalRegion = useStore((s) => s.projectRegion);
  const currentScenarioName = useStore((s) => s.currentScenarioName);
  const peakNodeRxMbps = useStore((s) => s.peakNodeRxMbps);

  const [activeTab, setActiveTab] = useState<'bom' | 'physical'>('bom');
  const [bomViewMode, setBomViewMode] = useState<'site' | 'master'>('site');
  const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>('metric');

  // Nodes that only ever contribute a single BOM row (standalone TAP modules,
  // breakout panels, ...) are merged into one shared line per SKU per site -
  // a chassis with multiple line items (modules/optics/licenses) keeps its
  // own per-node breakdown, since that detail is still useful there.
  const items = consolidateSimpleDeviceRows(
    generateBom(nodes, edges, globalLicenseMode, globalTermDuration, globalRegion, true, peakNodeRxMbps),
  );
  const validationErrors = validateConfiguration(nodes, edges);

  const physicalItems = buildPhysicalItems(nodes, items);

  // Aggregate totals
  let totalRU = 0;
  let totalPower = 0;
  let totalHeat = 0;
  let totalWeight = 0;
  physicalItems.forEach((item) => {
    totalRU += item.ruNum;
    totalWeight += item.weightNum;
    totalPower += item.powerNum;
    totalHeat += item.heatNum;
  });

  const physicalSiteGroups = physicalItems.reduce(
    (acc, item) => {
      if (!acc[item.site]) acc[item.site] = [];
      acc[item.site].push(item);
      return acc;
    },
    {} as Record<string, PhysicalItem[]>,
  );

  // ── Export handlers ──
  const handleExportBomCsv = () => {
    const headers = 'Site,Type,SKU,Description,Term(Months),Qty';
    const csv = [headers]
      .concat(
        items.map(
          (i) =>
            `${escapeCsv(i.site || 'Global / Unassigned')},${escapeCsv(i.type)},${escapeCsv(i.sku)},${escapeCsv(i.description)},${i.term || ''},${i.qty}`,
        ),
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanName = currentScenarioName ? currentScenarioName.toLowerCase().replace(/[^a-z0-9_-]/g, '_') : 'bom';
    a.download = `${cleanName}.csv`;
    a.click();
  };

  const handleExportPhysicalCsv = () => {
    const csv = [
      'Node/Chassis,Qty,Rack Space,Dimensions (Imperial),Dimensions (Metric),Weight (Imperial),Weight (Metric),Power,Heat,Airflow',
    ]
      .concat(
        physicalItems.map((p) => {
          const { inches, cm } = parseAndConvertDimensions(p.dimensions);
          const lbs = `${p.weightNum.toFixed(1)} lbs`;
          const kg = `${(p.weightNum * 0.45359237).toFixed(2)} kg`;
          return `${escapeCsv(p.name)},${p.qty},${escapeCsv(p.ru)},${escapeCsv(inches)},${escapeCsv(cm)},${escapeCsv(lbs)},${escapeCsv(kg)},${escapeCsv(p.power)},${escapeCsv(p.heat)},${escapeCsv(p.airflow)}`;
        }),
      )
      .concat([
        `Total,${physicalItems.reduce((acc, p) => acc + p.qty, 0)},${totalRU} RU,-,-,${totalWeight.toFixed(1)} lbs,${(totalWeight * 0.45359237).toFixed(1)} kg,${totalPower} W,${totalHeat} BTU/hr,-`,
      ])
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanName = currentScenarioName
      ? currentScenarioName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')
      : 'physical_deployment';
    a.download = `${cleanName}_deployment_report.csv`;
    a.click();
  };

  // ── Render ──
  return (
    <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div
        className="modal-card"
        style={{
          width: '920px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 48px rgba(0,0,0,0.8)',
        }}
      >
        {/* Modal Header & Tabs */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #333',
            marginBottom: '16px',
            paddingBottom: '8px',
          }}
        >
          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('bom');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: activeTab === 'bom' ? '#ffb74d' : '#888',
                borderBottom: activeTab === 'bom' ? '2px solid #ffb74d' : 'none',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              📋 Bill of Materials
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('physical');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: activeTab === 'physical' ? '#ffb74d' : '#888',
                borderBottom: activeTab === 'physical' ? '2px solid #ffb74d' : 'none',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              ⚡ Physical Rack & Deployment Report
            </button>
          </div>
          <span className="text-sm text-muted">{currentScenarioName || 'Layout'} specs</span>
        </div>

        {/* Validation warnings */}
        {validationErrors.length > 0 && activeTab === 'bom' && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px 16px',
              background: 'rgba(239, 83, 80, 0.08)',
              border: '1px solid rgba(239, 83, 80, 0.3)',
              borderRadius: '6px',
              color: '#ef5350',
            }}
          >
            <h4
              style={{
                margin: '0 0 6px 0',
                fontSize: '13px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              ⚠️ Configuration Attention Required (Not 100% Valid Configuration)
            </h4>
            <p className="text-sm text-muted" style={{ margin: '0 0 10px 0', lineHeight: '1.4' }}>
              The current canvas configuration has unresolved errors. This bill of materials may be incomplete or
              invalid:
            </p>
            <ul
              style={{
                margin: 0,
                paddingLeft: '20px',
                fontSize: '11px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {validationErrors.map((err, i) => (
                <li key={i} style={{ color: '#ffb74d' }}>
                  {err.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* View mode toggle */}
            <div
              style={{
                display: 'flex',
                gap: '10px',
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setBomViewMode('site');
                  }}
                  style={{
                    background: bomViewMode === 'site' ? '#ff9800' : '#333',
                    color: bomViewMode === 'site' ? '#fff' : '#aaa',
                    border: 'none',
                    padding: '6px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  By Site Breakdown
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setBomViewMode('master');
                  }}
                  style={{
                    background: bomViewMode === 'master' ? '#ff9800' : '#333',
                    color: bomViewMode === 'master' ? '#fff' : '#aaa',
                    border: 'none',
                    padding: '6px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  Master Report (Aggregated)
                </button>
              </div>

              {activeTab === 'physical' && (
                <div
                  style={{
                    display: 'flex',
                    gap: '4px',
                    background: '#222',
                    padding: '2px',
                    borderRadius: '6px',
                    border: '1px solid #444',
                    marginLeft: '10px',
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setUnitSystem('metric');
                    }}
                    style={{
                      background: unitSystem === 'metric' ? '#00e5ff' : 'transparent',
                      color: unitSystem === 'metric' ? '#000' : '#aaa',
                      border: 'none',
                      padding: '4px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      transition: 'all 0.2s',
                    }}
                  >
                    Metric
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setUnitSystem('imperial');
                    }}
                    style={{
                      background: unitSystem === 'imperial' ? '#00e5ff' : 'transparent',
                      color: unitSystem === 'imperial' ? '#000' : '#aaa',
                      border: 'none',
                      padding: '4px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      transition: 'all 0.2s',
                    }}
                  >
                    Imperial
                  </button>
                </div>
              )}
            </div>

            {activeTab === 'bom'
              ? renderBomTab(items, nodes, bomViewMode, getSkus())
              : renderPhysicalTab(
                  physicalItems,
                  physicalSiteGroups,
                  bomViewMode,
                  totalRU,
                  totalWeight,
                  totalPower,
                  totalHeat,
                  unitSystem,
                )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', gap: '8px' }}>
          {activeTab === 'bom' ? (
            <button
              className="btn btn-primary"
              onClick={handleExportBomCsv}
              style={{ background: 'rgba(0,229,255,0.2)', border: '1px solid rgba(0,229,255,0.5)', color: '#00e5ff' }}
            >
              Export CSV
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleExportPhysicalCsv}
              style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.5)', color: '#22c55e' }}
            >
              Export Deployment CSV
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── BOM tab renderer ─────────────────────────────────────────────────────────
function renderBomTab(
  items: ReturnType<typeof generateBom>,
  nodes: ReturnType<typeof useStore.getState>['nodes'],
  bomViewMode: 'site' | 'master',
  skus: Record<string, string>,
) {
  if (items.length === 0) {
    return (
      <div className="text-sm text-muted" style={{ textAlign: 'center', padding: '20px' }}>
        No hardware nodes tracked in the current layout.
      </div>
    );
  }

  // The actual whole-project order: every row combined by SKU across every
  // node and site, then rolled up into multipacks where that applies - not
  // just summing whatever pack/singles split each node happened to land on
  // independently, which would under-count cross-node pack opportunities.
  const masterBomItems = buildProjectWideOpticBom(items, skus);

  // Group items by site, then by nodeId
  const siteGroups: Record<string, Record<string, typeof items>> = {};
  items.forEach((item) => {
    const siteKey = item.site || 'Global / Unassigned';
    const nodeKey = item.nodeId || 'global';
    if (!siteGroups[siteKey]) siteGroups[siteKey] = {};
    if (!siteGroups[siteKey][nodeKey]) siteGroups[siteKey][nodeKey] = [];
    siteGroups[siteKey][nodeKey].push(item);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {bomViewMode === 'master' ? (
        <div style={{ border: '1px solid #444', borderRadius: '8px', overflow: 'hidden' }}>
          <div
            style={{
              background: '#333',
              padding: '10px 16px',
              borderBottom: '2px solid #555',
              fontWeight: 'bold',
              fontSize: '14px',
              color: '#fff',
            }}
          >
            Master BOM (All Sites)
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #444', background: '#1a1a1a' }}>
                <th style={{ padding: '8px', color: '#888' }}>Type</th>
                <th style={{ padding: '8px', color: '#888' }}>SKU</th>
                <th style={{ padding: '8px', color: '#888' }}>Description</th>
                <th style={{ padding: '8px', color: '#888', textAlign: 'right' }}>Term (Mo)</th>
                <th style={{ padding: '8px', color: '#888', textAlign: 'right' }}>Qty</th>
              </tr>
            </thead>
            <tbody>
              {masterBomItems.map((item, i) => (
                <tr key={i} style={{ borderBottom: i === masterBomItems.length - 1 ? 'none' : '1px solid #333' }}>
                  <td style={{ padding: '8px', color: '#ccc' }}>{item.type}</td>
                  <td style={{ padding: '8px', color: '#00e5ff', fontFamily: 'monospace', fontWeight: 'bold' }}>
                    {item.sku}
                  </td>
                  <td style={{ padding: '8px', color: '#aaa' }}>
                    {item.description}
                    {item.note && (
                      <div style={{ color: '#66bb6a', fontSize: '10px', marginTop: '4px' }} title={item.note}>
                        💡 {item.note}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '8px', color: '#fff', textAlign: 'right' }}>{item.term || '-'}</td>
                  <td style={{ padding: '8px', color: '#fff', textAlign: 'right', fontWeight: 'bold' }}>{item.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        Object.entries(siteGroups).map(([siteKey, nodeGroups]) => (
          <div key={siteKey} style={{ border: '1px solid #444', borderRadius: '8px', overflow: 'hidden' }}>
            <div
              style={{
                background: '#333',
                padding: '10px 16px',
                borderBottom: '2px solid #555',
                fontWeight: 'bold',
                fontSize: '14px',
                color: '#fff',
              }}
            >
              Site: {siteKey}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #444', background: '#1a1a1a' }}>
                  <th style={{ padding: '8px', color: '#888' }}>Type</th>
                  <th style={{ padding: '8px', color: '#888' }}>SKU</th>
                  <th style={{ padding: '8px', color: '#888' }}>Description</th>
                  <th style={{ padding: '8px', color: '#888', textAlign: 'right' }}>Term (Mo)</th>
                  <th style={{ padding: '8px', color: '#888', textAlign: 'right' }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(nodeGroups).map(([nodeId, groupItems]) => {
                  const nodeInfo = nodes.find((n) => n.id === nodeId);
                  const nodeLabel = nodeInfo
                    ? `${nodeInfo.data?.label || ''} (${(nodeInfo.data as HardwareNodeData)?.model || ''})`
                    : nodeId === 'global'
                      ? 'Global Accessories & Dependencies'
                      : nodeId === CONSOLIDATED_DEVICES_NODE_ID
                        ? 'Standalone Devices'
                        : 'System Components';

                  return (
                    <React.Fragment key={nodeId}>
                      <tr style={{ borderBottom: '1px solid #333', background: '#222' }}>
                        <td
                          colSpan={5}
                          style={{
                            padding: '6px 8px',
                            color: '#ffb74d',
                            fontWeight: 'bold',
                            fontSize: '10px',
                            textTransform: 'uppercase',
                          }}
                        >
                          {nodeLabel}
                        </td>
                      </tr>
                      {groupItems.map((item, i) => (
                        <tr
                          key={`${nodeId}-${i}`}
                          style={{ borderBottom: i === groupItems.length - 1 ? '2px solid #444' : '1px solid #333' }}
                        >
                          <td style={{ padding: '8px', color: '#ccc' }}>{item.type}</td>
                          <td style={{ padding: '8px', color: '#00e5ff', fontFamily: 'monospace', fontWeight: 'bold' }}>
                            {item.sku}
                          </td>
                          <td
                            style={{
                              padding: '8px',
                              color: '#aaa',
                              maxWidth: '300px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={item.description}
                          >
                            {item.description}
                          </td>
                          <td style={{ padding: '8px', color: '#fff', textAlign: 'right' }}>{item.term || '-'}</td>
                          <td style={{ padding: '8px', color: '#fff', textAlign: 'right' }}>{item.qty}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}

function renderPhysicalTab(
  physicalItems: PhysicalItem[],
  physicalSiteGroups: Record<string, PhysicalItem[]>,
  bomViewMode: 'site' | 'master',
  totalRU: number,
  totalWeight: number,
  totalPower: number,
  totalHeat: number,
  unitSystem: 'metric' | 'imperial',
) {
  if (physicalItems.length === 0) {
    return (
      <div className="text-sm text-muted" style={{ textAlign: 'center', padding: '20px' }}>
        No physical hardware nodes found on the canvas.
      </div>
    );
  }

  const physicalHeaders = (
    <tr style={{ borderBottom: '1px solid #444' }}>
      <th style={{ padding: '8px', color: '#888' }}>Hardware Node / Chassis</th>
      <th style={{ padding: '8px', color: '#888', textAlign: 'center' }}>Qty</th>
      <th style={{ padding: '8px', color: '#888', textAlign: 'center' }}>Rack Space</th>
      <th style={{ padding: '8px', color: '#888' }}>Dimensions (H x W x D)</th>
      <th style={{ padding: '8px', color: '#888' }}>Weight</th>
      <th style={{ padding: '8px', color: '#888', textAlign: 'right' }}>Max Power</th>
      <th style={{ padding: '8px', color: '#888', textAlign: 'right' }}>Heat Output</th>
      <th style={{ padding: '8px', color: '#888', textAlign: 'center' }}>Airflow</th>
    </tr>
  );

  const renderRow = (item: PhysicalItem, i: number) => {
    const { inches, cm } = parseAndConvertDimensions(item.dimensions);
    const lbs = `${item.weightNum.toFixed(1)} lbs`;
    const kg = `${(item.weightNum * 0.45359237).toFixed(2)} kg`;

    const dimPrimary = unitSystem === 'metric' ? cm : inches;
    const dimSecondary = unitSystem === 'metric' ? inches : cm;
    const weightPrimary = unitSystem === 'metric' ? kg : lbs;
    const weightSecondary = unitSystem === 'metric' ? lbs : kg;

    return (
      <tr key={i} style={{ borderBottom: '1px solid #333' }}>
        <td style={{ padding: '8px', color: '#ffb74d', fontWeight: 'bold' }}>{item.name}</td>
        <td style={{ padding: '8px', color: '#fff', textAlign: 'center' }}>{item.qty}</td>
        <td style={{ padding: '8px', color: '#00e5ff', textAlign: 'center', fontWeight: 'bold' }}>{item.ru}</td>
        <td style={{ padding: '8px', color: '#aaa', fontFamily: 'monospace' }}>
          <div>{dimPrimary}</div>
          <div style={{ color: '#666', fontSize: '9.5px', marginTop: '2px' }}>({dimSecondary})</div>
        </td>
        <td style={{ padding: '8px', color: '#aaa' }}>
          <div>{weightPrimary}</div>
          <div style={{ color: '#666', fontSize: '9.5px', marginTop: '2px' }}>({weightSecondary})</div>
        </td>
        <td style={{ padding: '8px', color: '#fff', textAlign: 'right', fontWeight: 'bold' }}>{item.power}</td>
        <td style={{ padding: '8px', color: '#fff', textAlign: 'right' }}>{item.heat}</td>
        <td style={{ padding: '8px', color: '#ccc', textAlign: 'center' }}>{item.airflow}</td>
      </tr>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {bomViewMode === 'master' ? (
        <div style={{ border: '1px solid #444', borderRadius: '8px', overflow: 'hidden' }}>
          <div
            style={{
              background: '#333',
              padding: '10px 16px',
              borderBottom: '2px solid #555',
              fontWeight: 'bold',
              fontSize: '14px',
              color: '#fff',
            }}
          >
            Master Physical Report (All Sites)
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
            <thead>{physicalHeaders}</thead>
            <tbody>{physicalItems.map(renderRow)}</tbody>
          </table>
        </div>
      ) : (
        Object.entries(physicalSiteGroups).map(([siteKey, siteItems]) => (
          <div key={siteKey} style={{ border: '1px solid #444', borderRadius: '8px', overflow: 'hidden' }}>
            <div
              style={{
                background: '#333',
                padding: '10px 16px',
                borderBottom: '2px solid #555',
                fontWeight: 'bold',
                fontSize: '14px',
                color: '#fff',
              }}
            >
              Site: {siteKey}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>{physicalHeaders}</thead>
              <tbody>{siteItems.map(renderRow)}</tbody>
            </table>
          </div>
        ))
      )}

      {/* Physical Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginTop: '4px' }}>
        <div
          style={{
            background: '#222',
            border: '1px solid #333',
            borderRadius: '6px',
            padding: '12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>
            Total Space Required
          </div>
          <div style={{ fontSize: '20px', color: '#00e5ff', fontWeight: 'bold' }}>{totalRU.toFixed(1)} RU</div>
        </div>
        <div
          style={{
            background: '#222',
            border: '1px solid #333',
            borderRadius: '6px',
            padding: '12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>
            Total Est. Weight
          </div>
          <div
            style={{
              fontSize: '16px',
              color: '#a855f7',
              fontWeight: 'bold',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            {unitSystem === 'metric' ? (
              <>
                <span>{(totalWeight * 0.45359237).toFixed(1)} kg</span>
                <span style={{ fontSize: '11px', opacity: 0.6 }}>({totalWeight.toFixed(1)} lbs)</span>
              </>
            ) : (
              <>
                <span>{totalWeight.toFixed(1)} lbs</span>
                <span style={{ fontSize: '11px', opacity: 0.6 }}>({(totalWeight * 0.45359237).toFixed(1)} kg)</span>
              </>
            )}
          </div>
        </div>
        <div
          style={{
            background: '#222',
            border: '1px solid #333',
            borderRadius: '6px',
            padding: '12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>
            Total Max Power
          </div>
          <div style={{ fontSize: '20px', color: '#22c55e', fontWeight: 'bold' }}>{totalPower} W</div>
        </div>
        <div
          style={{
            background: '#222',
            border: '1px solid #333',
            borderRadius: '6px',
            padding: '12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>
            Total Heat Dissipation
          </div>
          <div style={{ fontSize: '20px', color: '#ef4444', fontWeight: 'bold' }}>{totalHeat.toFixed(1)} BTU/hr</div>
        </div>
      </div>
    </div>
  );
}

export default BomModal;
