/**
 * ProjectSettingsModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Project-level settings modal: licence mode, region, term duration, grid, etc.
 */

import React from 'react';
import { useStore } from '../../store/store';

export interface ProjectSettingsModalProps {
  onClose: () => void;
}

const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ onClose }) => {
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

  const handleTermBlur = () => {
    let parsed = parseInt(defaultTermDuration, 10);
    if (isNaN(parsed) || parsed < 1) parsed = 1;
    if (parsed > 120) parsed = 120;
    setDefaultTermDuration(parsed.toString());
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <h3 style={{ margin: 0, fontSize: '14px', color: '#ff9800', fontWeight: 'bold' }}>
          ⚙️ Project Settings
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectSettingsModal;
