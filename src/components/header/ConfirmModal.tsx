/**
 * ConfirmModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Generic inline confirmation modal — replaces `window.confirm()`.
 * Rendered inline so it respects the app's dark theme.
 */

import React from 'react';

export interface ConfirmModalProps {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  message,
  confirmLabel = 'Clear Canvas',
  onConfirm,
  onCancel,
}) => (
  <div className="modal-overlay">
    <div className="modal-card" style={{ width: '320px' }}>
      <p className="text-sm" style={{ margin: '0 0 20px 0', lineHeight: '1.5' }}>
        {message}
      </p>
      <div className="flex-row" style={{ gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

export default ConfirmModal;
