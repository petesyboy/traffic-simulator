/**
 * ProjectSetupModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Project Initialisation and Setup Modal.
 * Prompts the user for a project name and offers to designate a working directory upfront.
 *
 * Explains that project files (.gvp), screenshots (.png), BOM (.csv), quotes,
 * and reports (.pdf) will all be stored in this directory.
 * Supports local disks, mapped drives, OneDrive, and Google Drive.
 */

import React, { useState } from 'react';
import {
  pickWorkingDirectory,
  isFileSystemAccessSupported,
} from '../../utils/projectDirectoryStorage';
import { useStore } from '../../store/store';

export interface ProjectSetupModalProps {
  initialName?: string;
  onConfirm: (config: {
    projectName: string;
    directoryHandle?: FileSystemDirectoryHandle | null;
  }) => void;
  onCancel: () => void;
}

export const ProjectSetupModal: React.FC<ProjectSetupModalProps> = ({
  initialName = 'Untitled Project',
  onConfirm,
  onCancel,
}) => {
  const projectRegion = useStore((s) => s.projectRegion);
  const setProjectRegion = useStore((s) => s.setProjectRegion);
  const projectLicenseMode = useStore((s) => s.projectLicenseMode);
  const setProjectLicenseMode = useStore((s) => s.setProjectLicenseMode);

  const [name, setName] = useState(initialName);
  const [selectedHandle, setSelectedHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isSupported = isFileSystemAccessSupported();

  const handlePickDirectory = async () => {
    setIsPicking(true);
    setErrorMsg(null);
    try {
      const handle = await pickWorkingDirectory();
      if (handle) {
        setSelectedHandle(handle);
      }
    } catch (err: unknown) {
      console.warn('Failed to pick directory:', err);
      setErrorMsg('Could not open folder picker. Please try again.');
    } finally {
      setIsPicking(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    onConfirm({
      projectName: trimmed,
      directoryHandle: selectedHandle,
    });
  };

  const isInvalid = !name.trim();

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div
        className="modal-card"
        style={{
          width: '460px',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          background: '#1e293b',
          border: '1px solid #38bdf8',
          boxShadow: '0 16px 40px rgba(0,0,0,0.75)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>✨</span>
          <h3 style={{ margin: 0, fontSize: '15px', color: '#38bdf8', fontWeight: 'bold' }}>
            Set Up New Project
          </h3>
        </div>

        <p className="text-sm" style={{ margin: 0, color: '#cbd5e1', lineHeight: '1.45' }}>
          Specify your project details and optionally choose a working directory for all project exports and saves.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Project Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
              Project / Customer Name <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder="Untitled Project"
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
          </div>

          {/* Working Directory Box */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase' }}>
                Project Working Directory (Optional)
              </span>
              {selectedHandle && (
                <button
                  type="button"
                  onClick={() => setSelectedHandle(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '11px',
                    padding: '2px 6px',
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: '1.45' }}>
              We'll save your project files (<code style={{ color: '#38bdf8' }}>.gvp</code>), screenshots (<code style={{ color: '#38bdf8' }}>.png</code>), Bill of Materials (<code style={{ color: '#38bdf8' }}>.csv</code>), quotes, and architecture reports (<code style={{ color: '#38bdf8' }}>.pdf</code>) directly into this directory.
            </p>

            {selectedHandle ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid #0284c7',
                  borderRadius: '4px',
                  padding: '8px 10px',
                  marginTop: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <span style={{ fontSize: '16px' }}>📁</span>
                  <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {selectedHandle.name}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handlePickDirectory}
                  disabled={isPicking}
                  style={{ padding: '4px 8px', fontSize: '11px', height: 'auto', color: '#38bdf8' }}
                >
                  Change
                </button>
              </div>
            ) : isSupported ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handlePickDirectory}
                disabled={isPicking}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  background: '#1e293b',
                  border: '1px dashed #475569',
                  color: '#cbd5e1',
                  fontSize: '12px',
                  cursor: 'pointer',
                  marginTop: '4px',
                }}
              >
                📁 {isPicking ? 'Opening Chooser...' : 'Choose Working Directory...'}
              </button>
            ) : (
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Directory selection is supported in Chromium-based browsers (Chrome, Edge).
              </span>
            )}

            <span style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
              Supports local physical drives (C:\, D:\), mapped network shares, Microsoft OneDrive, Google Drive, or any authenticated folder.
            </span>

            {errorMsg && (
              <span style={{ color: '#f87171', fontSize: '11px' }}>
                {errorMsg}
              </span>
            )}
          </div>

          {/* Region & License defaults */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                Deployment Region
              </label>
              <select
                className="form-select"
                value={projectRegion}
                onChange={(e) => setProjectRegion(e.target.value as 'US' | 'EU' | 'UK' | 'AU')}
                style={{ padding: '6px 8px', fontSize: '12px', background: '#0f172a', border: '1px solid #475569', color: '#fff', borderRadius: '4px' }}
              >
                <option value="US">North America (US)</option>
                <option value="EU">Europe (EU)</option>
                <option value="UK">United Kingdom (UK)</option>
                <option value="AU">Australia &amp; NZ (AU)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                Licence Mode
              </label>
              <select
                className="form-select"
                value={projectLicenseMode}
                onChange={(e) => setProjectLicenseMode(e.target.value as 'HTL' | 'Perpetual')}
                style={{ padding: '6px 8px', fontSize: '12px', background: '#0f172a', border: '1px solid #475569', color: '#fff', borderRadius: '4px' }}
              >
                <option value="HTL">Hybrid Term (HTL)</option>
                <option value="Perpetual">Perpetual</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex-row" style={{ gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: '6px' }}>
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
                fontWeight: 600,
              }}
            >
              Start Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectSetupModal;
