/**
 * ChassisSummaryModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Read-only "at a glance" summary for an HC- or TA-series chassis node: base
 * unit specs, add-in boards/license tier, and current optics cage capacity.
 * Rendered via a portal since it's triggered from inside a ReactFlow node
 * (which sits under a pan/zoom CSS transform that would otherwise break
 * `position: fixed`).
 */

import React from 'react';
import { createPortal } from 'react-dom';
import type { HardwareNodeData } from '../../store/types';
import hardwareCatalogue from '../../constants/hardwareCatalogue.json';
import { getCageCapacityBreakdown, getBoardDescription, getMaxChassisCapacityBySpeed, getGigaSmartEngineCount } from '../../utils/hardwareUtils';

interface PortSpec {
  type: string;
  count: number;
  speeds: string[];
}

interface ChassisSummaryModalProps {
  model: string;
  sku: string;
  displaySku: string;
  label: string;
  hwData: HardwareNodeData;
  onClose: () => void;
}

export const ChassisSummaryModal: React.FC<ChassisSummaryModalProps> = ({ model, sku, displaySku, label, hwData, onClose }) => {
  const isHc = model.includes('HC');
  const catalogueSeries = isHc ? hardwareCatalogue.hc_series : hardwareCatalogue.ta_series;
  const details = catalogueSeries.find(c => c.sku === sku || c.model === model);
  const detailsAny = details as unknown as { power?: string; fans?: number; airflow?: string; ports?: PortSpec[]; base_ports?: PortSpec[]; module_slots?: number };
  const builtInPorts: PortSpec[] = detailsAny?.ports || detailsAny?.base_ports || [];
  const slotCount = detailsAny?.module_slots || 0;

  const capacity = getCageCapacityBreakdown(model, hwData);
  const installedBoards = hwData.installedBoards || {};
  const capVal = (hwData.portCapacity as string) || 'Full';
  const maxCapacityBySpeed = isHc ? getMaxChassisCapacityBySpeed(model) : [];
  const gigaSmartEngines = isHc ? getGigaSmartEngineCount(model, hwData) : 0;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ width: '440px', maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="flex-between" style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', color: '#ff9800', fontWeight: 'bold' }}>
            📋 {label} Summary
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '12px' }}>
          <section>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#00e5ff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Base Unit
            </h4>
            <div style={{ background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div><span style={{ color: '#888' }}>Model:</span> {model}</div>
              <div><span style={{ color: '#888' }}>SKU:</span> {displaySku}</div>
              {details && (
                <>
                  <div><span style={{ color: '#888' }}>Power / Fans / Airflow:</span> {detailsAny.power} · {detailsAny.fans} fans · {detailsAny.airflow}</div>
                  {builtInPorts.length > 0 && (
                    <div>
                      <span style={{ color: '#888' }}>Built-in ports:</span>{' '}
                      {builtInPorts.map(p => `${p.count}x ${p.type} (${p.speeds.join('/')})`).join(', ')}
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          <section>
            {isHc ? (
              <>
                <div className="flex-between" style={{ marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '11px', color: '#00e5ff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Add-in Boards ({slotCount} slot{slotCount !== 1 ? 's' : ''})
                  </h4>
                  <span style={{ fontSize: '11px', color: '#888' }}>
                    GigaSMART Engines: <strong style={{ color: '#fff' }}>{gigaSmartEngines}</strong>
                  </span>
                </div>
                {slotCount === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No module slots on this chassis.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {Array.from({ length: slotCount }, (_, i) => i + 1).map(slotIdx => {
                      const boardName = installedBoards[slotIdx];
                      return (
                        <div key={slotIdx} style={{ background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '8px 10px', display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#888' }}>Slot {slotIdx}:</span>
                          <span style={{ textAlign: 'right' }}>
                            {boardName ? getBoardDescription(boardName, model) : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Empty</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#00e5ff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Software License
                </h4>
                {capacity.isLicensed ? (
                  <div style={{ background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div><span style={{ color: '#888' }}>Current Tier:</span> {capVal}</div>
                    <div><span style={{ color: '#888' }}>Licensed capacity:</span> {capacity.licensedSfpCages} SFP / {capacity.licensedQsfpCages} QSFP</div>
                    <div><span style={{ color: '#888' }}>Physical maximum:</span> {capacity.totalExpandedSfpPorts} SFP / {capacity.totalQsfpCages} QSFP</div>
                    {capacity.licensedQsfp400gCages > 0 && (
                      <div><span style={{ color: '#888' }}>400G-enabled ports:</span> {capacity.licensedQsfp400gCages}</div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Fixed-capacity chassis — no software license tiers apply.</div>
                )}
              </>
            )}
          </section>

          <section>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#00e5ff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Optics Cages Available
            </h4>
            <div style={{ background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#888' }}>QSFP Cages (40G/100G/400G):</span>
                <strong style={{ color: capacity.remainingQsfpCages === 0 ? '#ef5350' : '#4caf50', fontFamily: 'monospace' }}>
                  {capacity.usedQsfpOptics + capacity.usedBreakouts} / {capacity.isLicensed ? `${capacity.licensedQsfpCages} (${capacity.totalQsfpCages} phys)` : capacity.totalQsfpCages} used ({capacity.isLicensed ? `${capacity.remainingLicensedQsfpCages} lic, ` : ''}{capacity.remainingQsfpCages} free)
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#888' }}>SFP Cages (1G/10G/25G):</span>
                <strong style={{ color: capacity.remainingSfpCages === 0 ? '#ef5350' : '#4caf50', fontFamily: 'monospace' }}>
                  {capacity.usedSfpOptics} / {capacity.isLicensed ? `${capacity.licensedSfpCages} (${capacity.totalExpandedSfpPorts} phys)` : capacity.totalExpandedSfpPorts} used ({capacity.isLicensed ? `${capacity.remainingLicensedSfpCages} lic, ` : ''}{capacity.remainingSfpCages} free)
                </strong>
              </div>
              {capacity.hasBuiltInCopper && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>Built-in 1G RJ45 Ports:</span>
                  <strong style={{ color: (4 - capacity.usedBuiltInCopper) === 0 ? '#ef5350' : '#4caf50', fontFamily: 'monospace' }}>
                    {capacity.usedBuiltInCopper} / 4 used ({4 - capacity.usedBuiltInCopper} free)
                  </strong>
                </div>
              )}
            </div>
          </section>

          {maxCapacityBySpeed.length > 0 && (
            <section>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#00e5ff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Maximum Possible Capacity
              </h4>
              <div style={{ background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {maxCapacityBySpeed.map(({ speed, maxPorts, config }) => (
                  <div key={speed} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ color: '#888' }}>{speed} ports:</span>
                    <strong style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                      {maxPorts} <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>({config})</span>
                    </strong>
                  </div>
                ))}
              </div>
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '6px', fontSize: '11px' }}>
                Best-case if every slot were filled with the single densest module for that speed — not necessarily the current configuration above.
              </div>
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
