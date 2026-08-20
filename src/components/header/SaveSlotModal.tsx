import React, { useState } from 'react';
import { useStore } from '../../store/store';
import { PRESET_SCENARIOS } from '../../constants/presets';
import pkg from '../../../package.json';

const SLOT_PREFIX = 'fm-simulator-slot-';

/** Returns all saved slot names currently in localStorage. */
const getSavedSlots = (): string[] =>
  Object.keys(localStorage)
    .filter((k) => k.startsWith(SLOT_PREFIX))
    .map((k) => k.slice(SLOT_PREFIX.length))
    .sort();

export interface SaveSlotModalProps {
  mode: 'save' | 'load';
  onClose: () => void;
  onSaved: (name: string) => void;
  onLoaded: () => void;
}

/**
 * Modal for managing save slots, pre-baked scenarios, and sharing JSON topologies.
 */
export const SaveSlotModal: React.FC<SaveSlotModalProps> = ({ mode, onClose, onSaved, onLoaded }) => {
  const [activeTab, setActiveTab] = useState<'slots' | 'presets'>('slots');
  const currentScenarioName = useStore((s) => s.currentScenarioName);
  const [slotName, setSlotName] = useState(currentScenarioName || '');
  const [slots, setSlots] = useState<string[]>(getSavedSlots);
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const trafficStreams = useStore((s) => s.trafficStreams);
  const restoreState = useStore((s) => s.restoreState);
  const setCurrentScenarioName = useStore((s) => s.setCurrentScenarioName);

  // Settings
  const advancedMode = useStore((s) => s.advancedMode);
  const projectLicenseMode = useStore((s) => s.projectLicenseMode);
  const defaultTermDuration = useStore((s) => s.defaultTermDuration);
  const projectRegion = useStore((s) => s.projectRegion);
  const disableDcWarnings = useStore((s) => s.disableDcWarnings);
  const panelTextScale = useStore((s) => s.panelTextScale);
  const showGrid = useStore((s) => s.showGrid);
  const snapToGrid = useStore((s) => s.snapToGrid);

  const handleSave = () => {
    const name = slotName.trim() || 'default';
    const flow = {
      nodes,
      edges,
      trafficStreams,
      settings: {
        advancedMode,
        projectLicenseMode,
        defaultTermDuration,
        projectRegion,
        disableDcWarnings,
        panelTextScale,
        showGrid,
        snapToGrid,
      },
    };
    localStorage.setItem(`${SLOT_PREFIX}${name}`, JSON.stringify(flow));
    setSlots(getSavedSlots());
    setCurrentScenarioName(name);
    onSaved(name);
  };

  const handleExportFile = () => {
    const name = slotName.trim() || 'my-topology';
    const flow = {
      nodes,
      edges,
      trafficStreams,
      settings: {
        advancedMode,
        projectLicenseMode,
        defaultTermDuration,
        projectRegion,
        disableDcWarnings,
        panelTextScale,
        showGrid,
        snapToGrid,
      },
    };
    const blob = new Blob([JSON.stringify(flow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', url);
    downloadAnchor.setAttribute('download', `${name}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
    setCurrentScenarioName(name);
    onSaved(name);
    onClose();
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = e.target?.result as string;
        const { nodes: n, edges: e_list, trafficStreams: t, settings: s_obj } = JSON.parse(raw);
        if (n && e_list) {
          restoreState(n, e_list, t || [], s_obj);
          const scenarioName = file.name.replace(/\.json$/i, '');
          setCurrentScenarioName(scenarioName);
          onLoaded();
          onClose();
        } else {
          alert('Invalid topology file structure.');
        }
      } catch (err) {
        alert("Failed to parse the topology file. Make sure it's a valid JSON scenario file.");
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const handleLoad = (name: string) => {
    try {
      const raw = localStorage.getItem(`${SLOT_PREFIX}${name}`);
      if (!raw) return;
      const { nodes: n, edges: e, trafficStreams: t, settings: s_obj } = JSON.parse(raw);
      if (n && e) {
        restoreState(n, e, t, s_obj);
        setCurrentScenarioName(name);
        onLoaded();
      }
    } catch (err) {
      console.error('Failed to load slot:', err);
    }
    onClose();
  };

  const handleLoadPreset = (preset: (typeof PRESET_SCENARIOS)[number]) => {
    restoreState(preset.nodes, preset.edges, preset.trafficStreams);
    setCurrentScenarioName(preset.name);
    onLoaded();
    onClose();
  };

  const handleDelete = (name: string) => {
    localStorage.removeItem(`${SLOT_PREFIX}${name}`);
    setSlots(getSavedSlots());
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '10px',
          padding: '24px',
          width: '420px',
          boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
        }}
      >
        <h3
          style={{
            margin: '0 0 16px 0',
            fontSize: '15px',
            color: '#fff',
            fontWeight: 700,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{mode === 'save' ? '💾 Save / Export Layout' : '📂 Load / Import Layout'}</span>
          <span style={{ fontSize: '11px', color: '#888', fontWeight: 'normal' }}>v{pkg.version}</span>
        </h3>

        {/* Tab Selection (only relevant for loading) */}
        {mode === 'load' && (
          <div style={{ display: 'flex', borderBottom: '1px solid #2d2d2d', marginBottom: '16px', gap: '4px' }}>
            <button
              onClick={() => setActiveTab('slots')}
              style={{
                flex: 1,
                padding: '8px',
                background: activeTab === 'slots' ? '#222' : 'transparent',
                border: 'none',
                borderBottom: activeTab === 'slots' ? '2px solid var(--color-blue)' : '2px solid transparent',
                color: activeTab === 'slots' ? '#fff' : '#888',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                borderRadius: '4px 4px 0 0',
              }}
            >
              📂 Saved Layouts &amp; Files
            </button>
            <button
              onClick={() => setActiveTab('presets')}
              style={{
                flex: 1,
                padding: '8px',
                background: activeTab === 'presets' ? '#222' : 'transparent',
                border: 'none',
                borderBottom: activeTab === 'presets' ? '2px solid var(--color-blue)' : '2px solid transparent',
                color: activeTab === 'presets' ? '#fff' : '#888',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                borderRadius: '4px 4px 0 0',
              }}
            >
              ✨ Demo Presets
            </button>
          </div>
        )}

        {/* --- SAVE MODE PANEL --- */}
        {mode === 'save' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Local Save Layout Row */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>
                Save to Browser Storage (This PC)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Layout name (e.g. my-topology)"
                  value={slotName}
                  onChange={(e) => setSlotName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    background: '#121212',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <button
                  onClick={handleSave}
                  style={{
                    padding: '7px 14px',
                    background: slots.includes(slotName.trim()) ? 'rgba(239,83,80,0.2)' : 'var(--color-blue)',
                    border: slots.includes(slotName.trim()) ? '1px solid rgba(239,83,80,0.5)' : 'none',
                    borderRadius: '4px',
                    color: slots.includes(slotName.trim()) ? '#ef5350' : '#fff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {slots.includes(slotName.trim()) ? 'Overwrite' : 'Save'}
                </button>
              </div>
            </div>

            {/* List of existing layouts for quick overwrite */}
            <div style={{ marginTop: '4px' }}>
              <span style={{ fontSize: '11px', color: '#888' }}>Existing Saved Layouts:</span>
              {slots.length === 0 ? (
                <p style={{ fontSize: '11px', color: '#555', textAlign: 'center', margin: '8px 0' }}>
                  No layouts saved yet.
                </p>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    paddingRight: '4px',
                    marginTop: '6px',
                  }}
                >
                  {slots.map((name) => (
                    <div
                      key={name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 10px',
                        background: '#111',
                        borderRadius: '5px',
                        border: '1px solid #222',
                        cursor: 'pointer',
                      }}
                      onClick={() => setSlotName(name)}
                    >
                      <span
                        style={{
                          flex: 1,
                          fontSize: '12px',
                          color: '#ccc',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSlotName(name);
                          setTimeout(handleSave, 0);
                        }}
                        style={{
                          padding: '3px 10px',
                          background: 'rgba(239,83,80,0.15)',
                          border: '1px solid rgba(239,83,80,0.3)',
                          borderRadius: '3px',
                          color: '#ef5350',
                          fontSize: '11px',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        Overwrite
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ height: '1px', background: '#2d2d2d', marginTop: '8px' }} />

            {/* Email / Share Topology File Row */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>
                Export Shareable Scenario File (Email to others)
              </label>
              <button
                onClick={handleExportFile}
                style={{
                  width: '100%',
                  padding: '9px',
                  background: 'rgba(76,175,80,0.15)',
                  border: '1px solid rgba(76,175,80,0.4)',
                  borderRadius: '4px',
                  color: '#81c784',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
                title="Download JSON scenario file"
              >
                ✉️ Export Topology JSON File
              </button>
              <span
                style={{
                  display: 'block',
                  fontSize: '10px',
                  color: '#666',
                  marginTop: '6px',
                  textAlign: 'center',
                }}
              >
                Downloads a file that you can attach to an email so others can import it.
              </span>
            </div>
          </div>
        )}

        {/* --- LOAD MODE TAB: SLOTS & FILES --- */}
        {mode === 'load' && activeTab === 'slots' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* File Uploader for Email Imports */}
            <div
              style={{
                padding: '12px',
                background: 'rgba(0,229,255,0.03)',
                border: '1px dashed rgba(0,229,255,0.2)',
                borderRadius: '6px',
                textAlign: 'center',
              }}
            >
              <label
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span style={{ fontSize: '20px' }}>✉️</span>
                <span style={{ fontSize: '11px', color: '#00e5ff', fontWeight: 'bold' }}>
                  Import Shareable JSON File
                </span>
                <span style={{ fontSize: '9px', color: '#666' }}>Upload a scenario file someone emailed to you</span>
                <input type="file" accept=".json" onChange={handleImportFile} style={{ display: 'none' }} />
              </label>
            </div>

            <div style={{ height: '1px', background: '#2d2d2d', margin: '4px 0' }} />

            {/* List of browser saved layouts */}
            <span style={{ fontSize: '11px', color: '#888' }}>Saved Layouts on this PC:</span>
            {slots.length === 0 ? (
              <p style={{ fontSize: '11px', color: '#555', textAlign: 'center', margin: '8px 0' }}>
                No layouts saved on this PC yet.
              </p>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  paddingRight: '4px',
                }}
              >
                {slots.map((name) => (
                  <div
                    key={name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 10px',
                      background: '#111',
                      borderRadius: '5px',
                      border: '1px solid #222',
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        fontSize: '12px',
                        color: '#ccc',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {name}
                    </span>
                    <button
                      onClick={() => handleLoad(name)}
                      style={{
                        padding: '3px 10px',
                        background: 'rgba(0,124,255,0.15)',
                        border: '1px solid rgba(0,124,255,0.3)',
                        borderRadius: '3px',
                        color: '#00e5ff',
                        fontSize: '11px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Load
                    </button>
                    <button
                      onClick={() => handleDelete(name)}
                      style={{
                        padding: '3px 8px',
                        background: 'rgba(239,83,80,0.1)',
                        border: '1px solid rgba(239,83,80,0.2)',
                        borderRadius: '3px',
                        color: '#ef5350',
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- LOAD MODE TAB: DEMO PRESETS --- */}
        {mode === 'load' && activeTab === 'presets' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: '280px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            {PRESET_SCENARIOS.map((preset) => (
              <div
                key={preset.name}
                onClick={() => handleLoadPreset(preset)}
                style={{
                  padding: '10px 12px',
                  background: '#141414',
                  border: '1px solid #2d2d2d',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                }}
                className="preset-item"
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-blue)';
                  e.currentTarget.style.background = 'rgba(0, 124, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#2d2d2d';
                  e.currentTarget.style.background = '#141414';
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>
                  {preset.name}
                </div>
                <div style={{ fontSize: '10px', color: '#888', lineHeight: '1.3' }}>{preset.description}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 16px',
              background: '#2a2a2a',
              border: '1px solid #444',
              color: '#aaa',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
