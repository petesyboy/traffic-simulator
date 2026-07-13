/**
 * DuplicateModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal for duplicating the solution topology to a new site.
 */

import React, { useState } from 'react';

export interface DuplicateModalProps {
  defaultName: string;
  selectedCount: number;
  totalCount: number;
  onConfirm: (siteName: string) => void;
  onCancel: () => void;
}

const DuplicateModal: React.FC<DuplicateModalProps> = ({
  defaultName,
  selectedCount,
  totalCount,
  onConfirm,
  onCancel,
}) => {
  const [name, setName] = useState(defaultName);

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <h3 style={{ margin: 0, fontSize: '14px', color: '#ff9800', fontWeight: 'bold' }}>
          👥 Duplicate Solution
        </h3>
        <p className="text-sm text-muted" style={{ margin: 0, lineHeight: '1.4' }}>
          {selectedCount > 0
            ? `This will duplicate the ${selectedCount} selected node${selectedCount > 1 ? 's' : ''} (and associated edges and traffic flows) to a new site.`
            : `This will duplicate all ${totalCount} node${totalCount > 1 ? 's' : ''} on the canvas to a new site.`}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className="text-muted" style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
            New Site Name
          </label>
          <input
            type="text"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) {
                onConfirm(name.trim());
              }
            }}
          />
        </div>
        <div className="flex-row" style={{ gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => { if (name.trim()) onConfirm(name.trim()); }}
            disabled={!name.trim()}
            style={{ background: '#ff9800', borderColor: '#e65100' }}
          >
            Duplicate
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateModal;
