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

import { ConfirmModal, DuplicateModal, ProjectSettingsModal, BomModal } from './header/index';

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img 
                src="./gigamon-logo.png" 
                alt="Gigamon" 
                style={{ height: '18px', display: 'block', objectFit: 'contain', cursor: 'pointer' }} 
                onClick={handleLogoClick}
                title="Gigamon Traffic Simulator"
              />
              
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                <span className="brand-logo" style={{ color: '#fff', textShadow: 'none', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{currentScenarioName || 'Untitled Project'}</span>
                  <img 
                    src={projectRegion === 'EU' ? 'https://flagcdn.com/eu.svg' : projectRegion === 'UK' ? 'https://flagcdn.com/gb.svg' : 'https://flagcdn.com/us.svg'} 
                    alt={projectRegion}
                    title={`Deployment Region: ${projectRegion}`}
                    onClick={() => setShowSettings(true)}
                    style={{ height: '10px', width: 'auto', borderRadius: '1px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                  />
                </span>
                <span style={{ fontSize: '9px', color: '#666', fontWeight: 500, letterSpacing: '0.02em' }}>
                  FLOW MAPPING DESIGNER
                  <a 
                    href={`https://github.com/petesyboy/traffic-simulator/releases/tag/v${pkg.version}`}
                    target="_blank"
                    rel="noreferrer"
                    title={`Build ${pkg.version}`}
                    style={{ marginLeft: '8px', color: '#444', textDecoration: 'none', cursor: 'pointer' }}
                  >
                    v{pkg.version}
                  </a>
                </span>
              </div>
            </div>
            <div className="tab monitoring-session active" style={{ height: '40px', display: 'flex', alignItems: 'center', borderBottom: '2px solid #007cff', color: advancedMode ? '#ff9800' : '#fff' }}>
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
                {isRunning ? '⏸ Pause' : '▶ Run Simulation'}
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
                  className="header-btn" 
                  onClick={() => setShowDuplicatePrompt(true)}
                  title="Duplicate the entire topology to a new site"
                  style={{
                    background: 'rgba(0, 124, 255, 0.1)',
                    color: '#00e5ff',
                    borderColor: 'rgba(0, 124, 255, 0.3)'
                  }}
                >
                  👥 Duplicate
                </button>
              )}

              {(advancedMode || nodes.some(n => n.type === 'hardwareNode')) && (() => {
                const validationErrors = validateConfiguration(nodes, edges);
                const hasErrors = validationErrors.length > 0;
                return (
                  <button 
                    className="header-btn" 
                    style={{ 
                      background: hasErrors ? 'rgba(239, 83, 80, 0.1)' : 'rgba(255, 152, 0, 0.1)', 
                      color: hasErrors ? '#ef5350' : '#ffb74d', 
                      borderColor: hasErrors ? 'rgba(239, 83, 80, 0.3)' : 'rgba(255, 152, 0, 0.3)' 
                    }} 
                    onClick={() => setShowBom(true)}
                    title={hasErrors ? 'Configuration errors detected' : 'View Bill of Materials'}
                  >
                    📋 BOM{hasErrors ? ' (⚠️)' : ''}
                  </button>
                );
              })()}

              {advancedMode && (
                <button 
                  className="header-btn" 
                  onClick={() => setActiveView(activeView === 'canvas' ? 'rack' : 'canvas')} 
                  title="Toggle Rack Elevation View"
                  style={{ background: activeView === 'rack' ? '#007cff' : 'transparent', color: activeView === 'rack' ? '#fff' : '#ccc' }}
                >
                  {activeView === 'rack' ? '🎯 Canvas View' : '🗄️ Rack View'}
                </button>
              )}

              <button
                className="header-btn"
                onClick={() => setTradeShowDemoActive(!isTradeShowDemoActive)}
                title="Toggle Automated Trade Show Demonstration Mode"
                style={{
                  background: isTradeShowDemoActive ? '#ef5350' : 'rgba(34, 197, 94, 0.12)',
                  color: isTradeShowDemoActive ? '#fff' : '#22c55e',
                  borderColor: isTradeShowDemoActive ? '#ef5350' : 'rgba(34, 197, 94, 0.35)',
                  fontWeight: 'bold',
                  boxShadow: isTradeShowDemoActive ? '0 0 8px rgba(239, 83, 80, 0.4)' : 'none',
                }}
              >
                {isTradeShowDemoActive ? '⏹ Stop Demo' : '📺 Auto Demo'}
              </button>

              <button className="header-btn" onClick={handleExportScreenshot} title="Export canvas to PNG">
                📸 Screenshot
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '8px' }}>
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
                💾 Save
              </button>
              <label className="header-btn" style={{ cursor: 'pointer', margin: 0 }} title="Load project from a .json file">
                📂 Load
                <input type="file" accept=".json" onChange={onLoadFileChange} style={{ display: 'none' }} />
              </label>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '4px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '6px' }}>
                <button className="header-btn" onClick={onSaveClick} style={{ padding: '5px 8px' }} title="Save to browser local storage">Browser Save</button>
                <button className="header-btn" onClick={onLoadClick} style={{ padding: '5px 8px' }} title="Load from browser local storage">Browser Load</button>
              </div>
            </div>

            {/* ── Group 4: System / Danger ── */}
            <div className="control-group">
              <button className="header-btn icon-only" onClick={() => setShowSettings(true)} title="Project Settings">
                ⚙️
              </button>
              <button className="header-btn icon-only" onClick={loadDemo} title="Reset to default demo layout">
                🔄
              </button>
              <button onClick={handleClearRequest} className="header-btn danger icon-only" title="Clear canvas">
                🗑️
              </button>
            </div>
          </div>
        </header>
      </div>
    </>
  );
};


export default Header;