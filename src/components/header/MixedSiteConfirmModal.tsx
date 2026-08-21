/**
 * MixedSiteConfirmModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Confirmation modal displayed when the user attempts to generate a Bill of
 * Materials or Solution Report while only a subset of equipment is tagged
 * with physical site locations.
 *
 * Prevents unintentional BOM discrepancies where equipment intended for a
 * second physical datacentre/location is left unassigned.
 */

import React from 'react';
import { type SiteTaggedNodeInfo, type SiteUntaggedNodeInfo } from '../../utils/bom/siteValidation';

export interface MixedSiteConfirmModalProps {
  targetType: 'bom' | 'report';
  taggedSites: string[];
  taggedNodes: SiteTaggedNodeInfo[];
  untaggedNodes: SiteUntaggedNodeInfo[];
  onConfirm: () => void;
  onCancel: () => void;
}

const MixedSiteConfirmModal: React.FC<MixedSiteConfirmModalProps> = ({
  targetType,
  taggedSites,
  taggedNodes,
  untaggedNodes,
  onConfirm,
  onCancel,
}) => {
  const targetName = targetType === 'bom' ? 'Bill of Materials' : 'Solution Report';

  // Group tagged nodes by site for clear display
  const nodesBySite: Record<string, SiteTaggedNodeInfo[]> = {};
  taggedNodes.forEach((node) => {
    if (!nodesBySite[node.site]) {
      nodesBySite[node.site] = [];
    }
    nodesBySite[node.site].push(node);
  });

  return (
    <div className="modal-overlay" style={{ background: 'rgba(0, 0, 0, 0.82)' }}>
      <div
        className="modal-card"
        style={{
          width: '520px',
          maxWidth: '92vw',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.85)',
          border: '1px solid rgba(255, 152, 0, 0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>📍</span>
          <h3 style={{ margin: 0, fontSize: '15px', color: '#ff9800', fontWeight: 'bold' }}>
            Confirm Physical Site Assignments
          </h3>
        </div>

        <p className="text-sm" style={{ margin: 0, color: '#e0e0e0', lineHeight: 1.45 }}>
          Some equipment in this design has been assigned to physical deployment sites, whilst other equipment has no
          site label assigned.
        </p>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '6px',
            border: '1px solid #333',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '12px',
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          <div>
            <span style={{ color: '#00e5ff', fontWeight: 600 }}>Assigned Sites ({taggedSites.length}):</span>
            <ul style={{ margin: '4px 0 0 16px', padding: 0, color: '#ccc' }}>
              {taggedSites.map((site) => {
                const siteItems = nodesBySite[site] || [];
                const itemNames = siteItems.map((n) => n.label).join(', ');
                return (
                  <li key={site} style={{ marginBottom: '2px' }}>
                    <strong style={{ color: '#fff' }}>{site}</strong> ({siteItems.length} item
                    {siteItems.length !== 1 ? 's' : ''}): <span style={{ color: '#aaa' }}>{itemNames}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: '6px' }}>
            <span style={{ color: '#ffb74d', fontWeight: 600 }}>
              Unassigned Equipment ({untaggedNodes.length} item{untaggedNodes.length !== 1 ? 's' : ''}):
            </span>
            <div style={{ margin: '4px 0 0 0', color: '#bbb', lineHeight: 1.4 }}>
              {untaggedNodes.map((n) => n.label).join(', ')}
            </div>
          </div>
        </div>

        <p className="text-xs text-muted" style={{ margin: 0, lineHeight: 1.4 }}>
          Untagged equipment will be grouped under <strong>Global / Unassigned</strong> in the {targetName}. If your
          topology represents multiple physical locations or datacentres, please confirm whether this is intentional or
          if you would like to tag all equipment before proceeding.
        </p>

        <div
          className="flex-row"
          style={{ gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: '6px', paddingTop: '8px' }}
        >
          <button className="btn btn-ghost" onClick={onCancel} title="Return to canvas to tag equipment">
            Review & Tag Equipment
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            style={{ background: '#ff9800', borderColor: '#e65100', color: '#000', fontWeight: 600 }}
            title={`Proceed with generating ${targetName}`}
          >
            Proceed to {targetName}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MixedSiteConfirmModal;
