/**
 * ProjectNamePromptModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal prompt to ensure a project is given a descriptive name rather than
 * remaining as "Untitled Project" before generating quotes, reports, or deliverables.
 */

import React, { useState } from 'react';

export interface ProjectNamePromptModalProps {
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  defaultName?: string;
  onConfirm: (projectName: string) => void;
  onCancel: () => void;
}

export function isUntitledProject(name?: string | null): boolean {
  if (!name) return true;
  const trimmed = name.trim().toLowerCase();
  return trimmed === '' || trimmed === 'untitled project';
}

const ProjectNamePromptModal: React.FC<ProjectNamePromptModalProps> = ({
  title = '🏷️ Project Name Required',
  subtitle = 'Please enter a name for your project before proceeding with generation or export:',
  confirmLabel = 'Save & Continue',
  defaultName = '',
  onConfirm,
  onCancel,
}) => {
  const [name, setName] = useState(defaultName);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (trimmed && trimmed.toLowerCase() !== 'untitled project') {
      onConfirm(trimmed);
    }
  };

  const isInvalid = !name.trim() || name.trim().toLowerCase() === 'untitled project';

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div
        className="modal-card"
        style={{
          width: '380px',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          background: '#1e293b',
          border: '1px solid #38bdf8',
          boxShadow: '0 12px 36px rgba(0,0,0,0.7)',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '15px', color: '#38bdf8', fontWeight: 'bold' }}>
          {title}
        </h3>
        <p className="text-sm" style={{ margin: 0, color: '#cbd5e1', lineHeight: '1.45' }}>
          {subtitle}
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
            Project / Customer Name
          </label>
          <input
            type="text"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Enterprise Core Visibility"
            autoFocus
            style={{
              padding: '8px 10px',
              borderRadius: '4px',
              background: '#0f172a',
              border: '1px solid #475569',
              color: '#fff',
              fontSize: '13px',
            }}
          />
          {name.trim().toLowerCase() === 'untitled project' && (
            <span style={{ fontSize: '11px', color: '#f87171' }}>
              Please specify a unique project or customer name.
            </span>
          )}
          <div className="flex-row" style={{ gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isInvalid}
              style={{
                background: isInvalid ? '#475569' : '#0284c7',
                borderColor: isInvalid ? '#334155' : '#0369a1',
                color: '#fff',
                cursor: isInvalid ? 'not-allowed' : 'pointer',
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectNamePromptModal;
