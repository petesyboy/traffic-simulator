/**
 * ProjectSettingsModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Project-level settings modal: licence mode, region, term duration, grid, etc.
 */

import React, { useState } from 'react';
import { useStore } from '../../store/store';
import { TOOL_INGEST_PROFILES } from '../../constants/toolIngestLimits';
import {
  pickWorkingDirectory,
  isFileSystemAccessSupported,
  testDirectoryAccess,
  getDirectoryHandle,
} from '../../utils/projectDirectoryStorage';

const DEFAULT_TOOL_OPTIONS = Object.keys(TOOL_INGEST_PROFILES).filter((name) => name !== 'GigaSMART Appliance');

export interface ProjectSettingsModalProps {
  onClose: () => void;
  onOpenFeedback?: () => void;
}

const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ onClose, onOpenFeedback }) => {
  const projectId = useStore((s) => s.projectId);
  const workingDirectoryName = useStore((s) => s.workingDirectoryName);
  const setWorkingDirectory = useStore((s) => s.setWorkingDirectory);
  const clearWorkingDirectory = useStore((s) => s.clearWorkingDirectory);
  const projectLicenseMode = useStore((s) => s.projectLicenseMode);
  const setProjectLicenseMode = useStore((s) => s.setProjectLicenseMode);
  const defaultTermDuration = useStore((s) => s.defaultTermDuration);
  const setDefaultTermDuration = useStore((s) => s.setDefaultTermDuration);
  const colourVisionMode = useStore((s) => s.colourVisionMode);
  const setColourVisionMode = useStore((s) => s.setColourVisionMode);
  const projectRegion = useStore((s) => s.projectRegion);
  const setProjectRegion = useStore((s) => s.setProjectRegion);
  const disableDcWarnings = useStore((s) => s.disableDcWarnings);
  const setDisableDcWarnings = useStore((s) => s.setDisableDcWarnings);
  const showGrid = useStore((s) => s.showGrid);
  const setShowGrid = useStore((s) => s.setShowGrid);
  const snapToGrid = useStore((s) => s.snapToGrid);
  const setSnapToGrid = useStore((s) => s.setSnapToGrid);
  const trayAllocationPreference = useStore((s) => s.trayAllocationPreference);
  const setTrayAllocationPreference = useStore((s) => s.setTrayAllocationPreference);
  const defaultPacketTool = useStore((s) => s.defaultPacketTool);
  const setDefaultPacketTool = useStore((s) => s.setDefaultPacketTool);

  const [dirStatusMsg, setDirStatusMsg] = useState<string | null>(null);
  const [isDirBusy, setIsDirBusy] = useState(false);

  const isFsSupported = isFileSystemAccessSupported();

  const handlePickDirectory = async () => {
    setIsDirBusy(true);
    setDirStatusMsg(null);
    try {
      const handle = await pickWorkingDirectory();
      if (handle) {
        await setWorkingDirectory(handle.name, handle);
        setDirStatusMsg(`✓ Connected to folder "${handle.name}"`);
      }
    } catch (err) {
      console.warn('Directory pick failed:', err);
      setDirStatusMsg('Could not open folder picker.');
    } finally {
      setIsDirBusy(false);
    }
  };

  const handleVerifyDirectory = async () => {
    setIsDirBusy(true);
    setDirStatusMsg(null);
    try {
      const handle = await getDirectoryHandle(projectId);
      if (!handle) {
        setDirStatusMsg('No directory handle found in storage. Please reconnect.');
        return;
      }
      const test = await testDirectoryAccess(handle);
      if (test.accessible) {
        setDirStatusMsg(`✓ Directory "${handle.name}" is verified and ready for direct saves.`);
      } else {
        setDirStatusMsg(`⚠️ Access issue: ${test.error || 'Permission required or folder moved'}`);
      }
    } catch (err) {
      setDirStatusMsg('Failed to test directory access.');
    } finally {
      setIsDirBusy(false);
    }
  };

  const handleDisconnectDirectory = async () => {
    await clearWorkingDirectory();
    setDirStatusMsg('Working directory disconnected.');
  };

  const handleTermBlur = () => {
    let parsed = parseInt(defaultTermDuration, 10);
    if (isNaN(parsed) || parsed < 1) parsed = 1;
    if (parsed > 120) parsed = 120;
    setDefaultTermDuration(parsed.toString());
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <h3 style={{ margin: 0, fontSize: '14px', color: '#ff9800', fontWeight: 'bold' }}>
          ⚙️ Project Settings
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Working Directory */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="text-muted" style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
                📁 Project Working Directory
              </label>
              {workingDirectoryName && (
                <span style={{ fontSize: '10px', color: '#4ade80', fontWeight: 600 }}>Active</span>
              )}
            </div>

            {workingDirectoryName ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(56, 189, 248, 0.1)',
                    border: '1px solid #0284c7',
                    borderRadius: '4px',
                    padding: '6px 8px',
                    overflow: 'hidden',
                  }}
                >
                  <span style={{ fontSize: '14px' }}>📁</span>
                  <span
                    style={{
                      fontSize: '12px',
                      color: '#fff',
                      fontWeight: 600,
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {workingDirectoryName}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handlePickDirectory}
                    disabled={isDirBusy}
                    style={{ fontSize: '11px', padding: '3px 8px', height: 'auto', color: '#38bdf8' }}
                  >
                    Change Folder...
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handleVerifyDirectory}
                    disabled={isDirBusy}
                    style={{ fontSize: '11px', padding: '3px 8px', height: 'auto', color: '#a5b4fc' }}
                  >
                    Verify Access
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handleDisconnectDirectory}
                    disabled={isDirBusy}
                    style={{ fontSize: '11px', padding: '3px 8px', height: 'auto', color: '#f87171' }}
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ) : isFsSupported ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handlePickDirectory}
                  disabled={isDirBusy}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    fontSize: '11px',
                    background: '#1e293b',
                    border: '1px dashed #475569',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                  }}
                >
                  📁 {isDirBusy ? 'Opening Chooser...' : 'Select Working Directory...'}
                </button>
              </div>
            ) : (
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Directory picker requires a Chromium-based browser (Chrome, Edge).
              </span>
            )}

            <span className="text-muted" style={{ fontSize: '10px', lineHeight: 1.4 }}>
              All project files (.gvp), screenshots (.png), BOM (.csv), quotes, and reports (.pdf) are saved directly into this directory. Supports local disks (C:\, D:\), mapped network drives, OneDrive, and Google Drive.
            </span>

            {dirStatusMsg && (
              <span style={{ fontSize: '11px', color: dirStatusMsg.startsWith('✓') ? '#4ade80' : '#f87171' }}>
                {dirStatusMsg}
              </span>
            )}
          </div>
          {/* Licence Mode */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="text-muted" style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
              Default Licence Mode
            </label>
            <select
              className="form-select"
              value={projectLicenseMode}
              onChange={(e) => setProjectLicenseMode(e.target.value as 'HTL' | 'Perpetual')}
            >
              <option value="HTL">Hybrid Term Licensing (HTL)</option>
              <option value="Perpetual">Perpetual</option>
            </select>
          </div>

          {/* Region */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="text-muted" style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
              Hardware Deployment Region
            </label>
            <select
              className="form-select"
              value={projectRegion}
              onChange={(e) => setProjectRegion(e.target.value as 'US' | 'EU' | 'UK' | 'AU')}
            >
              <option value="US">North America (US)</option>
              <option value="EU">Europe (EU)</option>
              <option value="UK">United Kingdom (UK)</option>
              <option value="AU">Australia &amp; New Zealand (AU / ANZ)</option>
            </select>
          </div>

          {/* TAP Tray Allocation Preference */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="text-muted" style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
              TAP Chassis Tray Allocation
            </label>
            <select
              className="form-select"
              value={trayAllocationPreference}
              onChange={(e) => setTrayAllocationPreference(e.target.value as 'auto' | 'TAP-M200T' | 'TAP-M100T')}
            >
              <option value="auto">Auto (Bin-Pack: M100T ≤3 bays, M200T 4–6)</option>
              <option value="TAP-M200T">Force TAP-M200T (1RU 6-Slot Full-Width)</option>
              <option value="TAP-M100T">Force TAP-M100T (0.5RU 3-Slot Half-Width)</option>
            </select>
          </div>

          {/* Default Packet Tool */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="text-muted" style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
              Default Packet Tool
            </label>
            <select
              className="form-select"
              value={defaultPacketTool}
              onChange={(e) => setDefaultPacketTool(e.target.value)}
            >
              {DEFAULT_TOOL_OPTIONS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <span className="text-muted" style={{ fontSize: '10px', lineHeight: 1.4 }}>
              The tool pre-wired into a fresh canvas, "Load Demo", and the guided Trade Show Demo. Set this to
              whichever NDR/NPM tool your business sells instead of the ExtraHop default. Saved for you rather
              than with the project.
            </span>
          </div>

          {/* Term Duration */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="text-muted" style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
              Default Term Duration (Months)
            </label>
            <input
              type="number"
              className="form-input"
              min="1"
              max="120"
              value={defaultTermDuration}
              onChange={(e) => setDefaultTermDuration(e.target.value)}
              onBlur={handleTermBlur}
            />
          </div>

          {/* Colour vision - stored per person, not in the project file, so it
              follows you into someone else's topology. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="text-muted" style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
              Colour Vision
            </label>
            <select
              className="form-input"
              value={colourVisionMode}
              onChange={(e) => setColourVisionMode(e.target.value as 'off' | 'red-green')}
            >
              <option value="off">Standard palette</option>
              <option value="red-green">Red-green friendly (protanopia / deuteranopia)</option>
            </select>
            <span className="text-muted" style={{ fontSize: '10px', lineHeight: 1.4 }}>
              Moves status greens to blue so they read against the reds they are paired with.
              Applies to the canvas and every panel; PDF exports still use the standard palette.
              Saved for you rather than with the project.
            </span>
          </div>

          {/* Checkboxes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <input
              type="checkbox"
              checked={disableDcWarnings}
              onChange={(e) => setDisableDcWarnings(e.target.checked)}
              id="modalDisableDcWarnings"
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="modalDisableDcWarnings" className="text-sm" style={{ cursor: 'pointer' }}>
              Disable DC Power Warnings
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
              id="modalShowGrid"
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="modalShowGrid" className="text-sm" style={{ cursor: 'pointer' }}>
              Show Background Grid
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <input
              type="checkbox"
              checked={snapToGrid}
              onChange={(e) => setSnapToGrid(e.target.checked)}
              id="modalSnapToGrid"
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="modalSnapToGrid" className="text-sm" style={{ cursor: 'pointer' }}>
              Snap Nodes to Grid
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          {onOpenFeedback ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                onClose();
                onOpenFeedback();
              }}
              style={{
                color: '#38bdf8',
                fontSize: '11px',
                padding: '4px 8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
              title="Send feedback or report an issue"
            >
              <span>💬</span> Send Feedback or Report an Issue...
            </button>
          ) : (
            <div />
          )}
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectSettingsModal;
