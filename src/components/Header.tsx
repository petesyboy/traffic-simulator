/**
 * Header.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The top application bar.  Contains the simulation run/pause control, speed
 * selector, save/reset/clear actions, and toolbar buttons.
 *
 * Sub-components (modals / panels) are in `./header/`.
 */

import React, { useState } from 'react';
import { useStore } from '../store/store';
import pkg from '../../package.json';
import { toPng } from 'html-to-image';
import { validateConfiguration } from '../utils/bomEngine';
import gigamonLogo from '../assets/gigamon-logo.png';

import {
  ConfirmModal, DuplicateModal, ProjectSettingsModal, BomModal,
  PlayIcon, PauseIcon, CopyIcon, ClipboardIcon, GridIcon, ServerRackIcon,
  PresentationIcon, StopIcon, CameraIcon, SaveIcon, FolderOpenIcon,
  GearIcon, RefreshIcon, TrashIcon,
} from './header/index';

// ─── Header component ─────────────────────────────────────────────────────────

interface HeaderProps {
  /** Called when the user clicks "Save Layout" — opens the save slot modal in App.tsx. */
  onSaveClick: () => void;
  /** Called when the user clicks "Load Layout" — opens the load slot modal in App.tsx. */
  onLoadClick: () => void;
  /** Called when the user clicks "Save to File" — directly triggers a file download. */
  onSaveFileClick: () => void;
  /** Called when the user selects a file to load. */
  onLoadFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const Header: React.FC<HeaderProps> = ({ onSaveClick, onLoadClick, onSaveFileClick, onLoadFileChange }) => {
  // Subscribe to exactly the state slices we need
  const isRunning      = useStore((state) => state.isRunning);
  const simulationSpeed = useStore((state) => state.simulationSpeed);
  const toggleSimulation  = useStore((state) => state.toggleSimulation);
  const setSimulationSpeed = useStore((state) => state.setSimulationSpeed);
  const clearCanvas    = useStore((state) => state.clearCanvas);
  const loadDemo       = useStore((state) => state.loadDemo);
  const advancedMode   = useStore((state) => state.advancedMode);
  const setAdvancedMode = useStore((state) => state.setAdvancedMode);
  const setAdvancedModeUnlocked = useStore((state) => state.setAdvancedModeUnlocked);
  const nodes          = useStore((state) => state.nodes);
  const edges          = useStore((state) => state.edges);
  const activeView     = useStore((state) => state.activeView);
  const setActiveView  = useStore((state) => state.setActiveView);
  const panelTextScale = useStore((state) => state.panelTextScale || 1.0);
  const setPanelTextScale = useStore((state) => state.setPanelTextScale);
  const currentScenarioName = useStore((state) => state.currentScenarioName);
  const setCurrentScenarioName = useStore((state) => state.setCurrentScenarioName);
  const projectRegion = useStore((state) => state.projectRegion);
  const duplicateSolution = useStore((state) => state.duplicateSolution);
  const isTradeShowDemoActive = useStore((state) => state.isTradeShowDemoActive);
  const setTradeShowDemoActive = useStore((state) => state.setTradeShowDemoActive);

  // Local UI state for modals
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showBom, setShowBom] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDuplicatePrompt, setShowDuplicatePrompt] = useState(false);
  const [logoClicks, setLogoClicks] = useState<number[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const handleLogoClick = () => {
    const now = Date.now();
    const recentClicks = [...logoClicks, now].filter(t => now - t < 2000);
    setLogoClicks(recentClicks);
    if (recentClicks.length >= 4) {
      const nextMode = !advancedMode;
      setAdvancedMode(nextMode);
      setAdvancedModeUnlocked(nextMode);
      setLogoClicks([]);
    }
  };

  const handleClearRequest = () => setShowClearConfirm(true);
  const handleClearConfirm  = () => { clearCanvas(); setShowClearConfirm(false); };
  const handleClearCancel   = () => setShowClearConfirm(false);

  const handleNameDoubleClick = () => {
    setNameDraft(currentScenarioName || '');
    setIsEditingName(true);
  };
  const commitNameEdit = () => {
    const trimmed = nameDraft.trim();
    setCurrentScenarioName(trimmed || null);
    setIsEditingName(false);
  };
  const cancelNameEdit = () => setIsEditingName(false);

  const handleExportScreenshot = () => {
    const element = document.querySelector('.react-flow') as HTMLElement;
    if (!element) return;
    
    toPng(element, {
      backgroundColor: '#121212',
      cacheBust: true,
      filter: (node) => {
        if (
          node.classList?.contains('react-flow__controls') || 
          node.classList?.contains('react-flow__panel') ||
          node.classList?.contains('config-panel-toggle')
        ) {
          return false;
        }
        return true;
      }
    })
      .then((dataUrl) => {
        const a = document.createElement('a');
        const filename = currentScenarioName 
          ? `${currentScenarioName} - export.png`
          : 'Flow Mapping Example - export.png';
        a.setAttribute('download', filename);
        a.setAttribute('href', dataUrl);
        a.click();
      })
      .catch((err) => {
        console.error('oops, something went wrong!', err);
      });
  };

  return (
    <>
      {showClearConfirm && (
        <ConfirmModal
          message="Are you sure you want to clear the canvas? All nodes, edges, and traffic streams will be removed."
          onConfirm={handleClearConfirm}
          onCancel={handleClearCancel}
        />
      )}

      {showBom && <BomModal onClose={() => setShowBom(false)} />}
      {showSettings && <ProjectSettingsModal onClose={() => setShowSettings(false)} />}
      {showDuplicatePrompt && (
        <DuplicateModal
          defaultName="Site B"
          selectedCount={nodes.filter(n => n.selected).length}
          totalCount={nodes.length}
          onConfirm={(siteName: string) => {
            duplicateSolution(siteName);
            setShowDuplicatePrompt(false);
          }}
          onCancel={() => setShowDuplicatePrompt(false)}
        />
      )}

      <div className="header-wrapper">
        {/* ── Top Brand Bar ── */}
        <header className="header-brand">
          <div className="brand-identity">
            <img
              src={gigamonLogo}
              alt="Gigamon"
              style={{ height: '18px', display: 'block', objectFit: 'contain', cursor: 'pointer' }}
              onClick={handleLogoClick}
              title="Gigamon Traffic Simulator"
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span className="brand-project-name">
                {isEditingName ? (
                  <input
                    type="text"
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={commitNameEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitNameEdit();
                      if (e.key === 'Escape') cancelNameEdit();
                    }}
                    placeholder="Untitled Project"
                    style={{
                      background: '#121212',
                      border: '1px solid var(--color-blue)',
                      borderRadius: '3px',
                      color: '#fff',
                      font: 'inherit',
                      padding: '0 4px',
                      width: '180px',
                    }}
                  />
                ) : (
                  <span onDoubleClick={handleNameDoubleClick} title="Double-click to rename project" style={{ cursor: 'text' }}>
                    {currentScenarioName || 'Untitled Project'}
                  </span>
                )}
                <img
                  className="brand-region-flag"
                  src={projectRegion === 'EU' ? 'https://flagcdn.com/eu.svg' : projectRegion === 'UK' ? 'https://flagcdn.com/gb.svg' : 'https://flagcdn.com/us.svg'}
                  alt={projectRegion}
                  title={`Deployment Region: ${projectRegion}`}
                  onClick={() => setShowSettings(true)}
                />
              </span>
              <span className="brand-subtitle">
                FLOW MAPPING DESIGNER
                <a
                  className="brand-build-link"
                  href="https://github.com/petesyboy/traffic-simulator/releases"
                  target="_blank"
                  rel="noreferrer"
                  title={`Build ${pkg.version}`}
                >
                  v{pkg.version}
                </a>
              </span>
            </div>

            <div className="tab monitoring-session active" style={{ color: advancedMode ? '#ff9800' : '#fff' }}>
              {advancedMode ? 'Expert Designer' : 'Standard View'}
            </div>
          </div>

          <div className="header-controls">
            {/* ── Group 1: Simulation ── */}
            <div className="control-group">
              <button
                onClick={toggleSimulation}
                className={`sim-btn ${isRunning ? 'running' : ''}`}
                style={{ minWidth: isRunning ? '80px' : '130px' }}
              >
                {isRunning ? <PauseIcon /> : <PlayIcon />}
                {isRunning ? 'Pause' : 'Run Simulation'}
              </button>

              {isRunning && (
                <select
                  value={simulationSpeed}
                  onChange={(e) => setSimulationSpeed(Number(e.target.value))}
                  className="sim-speed-select"
                >
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={5}>5x</option>
                  <option value={10}>10x</option>
                </select>
              )}
            </div>

            {/* ── Group 2: Project / View ── */}
            <div className="control-group">
              {nodes.length > 0 && (
                <button
                  className="header-btn header-btn--cyan"
                  onClick={() => setShowDuplicatePrompt(true)}
                  title="Duplicate the entire topology to a new site"
                >
                  <CopyIcon /> Duplicate
                </button>
              )}

              {(advancedMode || nodes.some(n => n.type === 'hardwareNode')) && (() => {
                const validationErrors = validateConfiguration(nodes, edges);
                const hasErrors = validationErrors.length > 0;
                return (
                  <button
                    className={`header-btn ${hasErrors ? 'header-btn--red' : 'header-btn--orange'}`}
                    onClick={() => setShowBom(true)}
                    title={hasErrors ? 'Configuration errors detected' : 'View Bill of Materials'}
                  >
                    <ClipboardIcon /> BOM{hasErrors ? ' (!)' : ''}
                  </button>
                );
              })()}

              {advancedMode && (
                <button
                  className={`header-btn ${activeView === 'rack' ? 'header-btn--active-view' : ''}`}
                  onClick={() => setActiveView(activeView === 'canvas' ? 'rack' : 'canvas')}
                  title="Toggle Rack Elevation View"
                >
                  {activeView === 'rack' ? <><GridIcon /> Canvas View</> : <><ServerRackIcon /> Rack View</>}
                </button>
              )}

              <button
                className={`header-btn ${isTradeShowDemoActive ? 'header-btn--solid-red' : 'header-btn--green'}`}
                onClick={() => setTradeShowDemoActive(!isTradeShowDemoActive)}
                title="Toggle Automated Trade Show Demonstration Mode"
              >
                {isTradeShowDemoActive ? <><StopIcon /> Stop Demo</> : <><PresentationIcon /> Auto Demo</>}
              </button>

              <button className="header-btn" onClick={handleExportScreenshot} title="Export canvas to PNG">
                <CameraIcon /> Screenshot
              </button>

              <div className="control-divider">
                <span style={{ fontSize: '9px', color: '#666', fontWeight: 700 }}>SIZE</span>
                <select
                  value={panelTextScale}
                  onChange={(e) => setPanelTextScale(Number(e.target.value))}
                  className="sim-speed-select"
                  style={{ width: '55px', height: '24px', padding: '0 4px' }}
                >
                  <option value={0.75}>75%</option>
                  <option value={0.85}>85%</option>
                  <option value={1.0}>100%</option>
                  <option value={1.15}>115%</option>
                  <option value={1.3}>130%</option>
                  <option value={1.5}>150%</option>
                </select>
              </div>
            </div>

            {/* ── Group 3: File Operations ── */}
            <div className="control-group">
              <button className="header-btn" onClick={onSaveFileClick} title="Save project to a .json file">
                <SaveIcon /> Save
              </button>
              <label className="header-btn" style={{ cursor: 'pointer', margin: 0 }} title="Load project from a .json file">
                <FolderOpenIcon /> Load
                <input type="file" accept=".json" onChange={onLoadFileChange} style={{ display: 'none' }} />
              </label>

              <div className="control-divider">
                <button className="header-btn" onClick={onSaveClick} title="Save to browser local storage"><SaveIcon /> Browser Save</button>
                <button className="header-btn" onClick={onLoadClick} title="Load from browser local storage"><FolderOpenIcon /> Browser Load</button>
              </div>
            </div>

            {/* ── Group 4: System / Danger ── */}
            <div className="control-group">
              <button className="header-btn icon-only" onClick={() => setShowSettings(true)} title="Project Settings">
                <GearIcon />
              </button>
              <button className="header-btn icon-only" onClick={loadDemo} title="Reset to default demo layout">
                <RefreshIcon />
              </button>
              <button onClick={handleClearRequest} className="header-btn danger icon-only" title="Clear canvas">
                <TrashIcon />
              </button>
            </div>
          </div>
        </header>
      </div>
    </>
  );
};


export default Header;