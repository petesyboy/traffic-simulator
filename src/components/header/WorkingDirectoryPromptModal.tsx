/**
 * WorkingDirectoryPromptModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal prompt asking the user to choose a working directory for their project.
 * Explains that project saves, screenshots, BOMs, quotes, and reports will be saved there.
 *
 * Supports local physical drives, mapped network shares, OneDrive, and Google Drive.
 */

import React, { useState } from 'react';
import {
  pickWorkingDirectory,
  isFileSystemAccessSupported,
} from '../../utils/projectDirectoryStorage';
import { useStore } from '../../store/store';

export interface WorkingDirectoryPromptModalProps {
  title?: string;
  actionName?: string;
  onDirectorySelected: (handle: FileSystemDirectoryHandle) => void;
  onContinueWithoutDirectory: () => void;
  onCancel: () => void;
}

export const WorkingDirectoryPromptModal: React.FC<WorkingDirectoryPromptModalProps> = ({
  title = '📁 Set Project Working Directory',
  actionName = 'export or save',
  onDirectorySelected,
  onContinueWithoutDirectory,
  onCancel,
}) => {
  const currentScenarioName = useStore((s) => s.currentScenarioName);
  const setWorkingDirectory = useStore((s) => s.setWorkingDirectory);
  const setWorkingDirectoryPromptDismissed = useStore((s) => s.setWorkingDirectoryPromptDismissed);

  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);

  const isSupported = isFileSystemAccessSupported();

  const handlePickDirectory = async () => {
    setIsPicking(true);
    setErrorMsg(null);
    try {
      const handle = await pickWorkingDirectory();
      if (handle) {
        await setWorkingDirectory(handle.name, handle);
        if (dontAskAgain) {
          setWorkingDirectoryPromptDismissed(true);
        }
        onDirectorySelected(handle);
      }
    } catch (err: unknown) {
      console.warn('Directory selection error:', err);
      setErrorMsg('Could not open or access the selected folder. Please try again.');
    } finally {
      setIsPicking(false);
    }
  };

  const handleSkip = () => {
    if (dontAskAgain) {
      setWorkingDirectoryPromptDismissed(true);
    }
    onContinueWithoutDirectory();
  };

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
          <span style={{ fontSize: '20px' }}>📁</span>
          <h3 style={{ margin: 0, fontSize: '15px', color: '#38bdf8', fontWeight: 'bold' }}>
            {title}
          </h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p className="text-sm" style={{ margin: 0, color: '#e2e8f0', lineHeight: '1.5' }}>
            Would you like to designate a <strong>working directory</strong> for{' '}
            <span style={{ color: '#38bdf8' }}>{currentScenarioName || 'this project'}</span> before you {actionName}?
          </p>

          <div
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '12px',
              fontSize: '12px',
              color: '#94a3b8',
              lineHeight: '1.55',
            }}
          >
            <p style={{ margin: '0 0 8px 0', color: '#cbd5e1' }}>
              <strong>What goes into this working directory:</strong>
            </p>
            <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>Complete project design files (<code style={{ color: '#38bdf8' }}>.gvp</code>)</li>
              <li>High-resolution topology screenshots (<code style={{ color: '#38bdf8' }}>.png</code>)</li>
              <li>Bill of Materials &amp; Deployment schedules (<code style={{ color: '#38bdf8' }}>.csv</code>)</li>
              <li>Customer-facing Architecture Reports &amp; Quotes (<code style={{ color: '#38bdf8' }}>.pdf</code>)</li>
            </ul>

            <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #1e293b', fontSize: '11px', color: '#64748b' }}>
              💡 <strong>Universal storage support:</strong> Choose any local physical drive (C:\, D:\), mapped network shares, Microsoft OneDrive, Google Drive, or synchronised folders you are authenticated to.
            </div>
          </div>

          {!isSupported && (
            <div style={{ background: '#451a03', border: '1px solid #b45309', borderRadius: '4px', padding: '8px 10px', color: '#fde68a', fontSize: '12px' }}>
              Notice: Direct directory write access is available in Chromium browsers (Chrome, Edge). In this browser, files will be saved using standard download prompts.
            </div>
          )}

          {errorMsg && (
            <div style={{ color: '#f87171', fontSize: '12px' }}>
              {errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <input
              type="checkbox"
              id="dontAskAgainDir"
              checked={dontAskAgain}
              onChange={(e) => setDontAskAgain(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="dontAskAgainDir" className="text-sm" style={{ cursor: 'pointer', color: '#94a3b8', fontSize: '12px' }}>
              Do not ask again for this project
            </label>
          </div>
        </div>

        <div className="flex-row" style={{ gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel} style={{ fontSize: '13px' }}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleSkip}
            style={{ fontSize: '13px', background: '#334155', color: '#cbd5e1' }}
          >
            Save File Only
          </button>
          {isSupported && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handlePickDirectory}
              disabled={isPicking}
              style={{
                fontSize: '13px',
                background: '#0284c7',
                borderColor: '#0369a1',
                color: '#fff',
                fontWeight: 600,
              }}
            >
              {isPicking ? 'Opening Chooser...' : '📁 Select Working Directory...'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkingDirectoryPromptModal;
