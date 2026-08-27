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
import { validateConfiguration, detectMixedSiteAssignment } from '../utils/bomEngine';
import { captureTopologyDiagramPng } from '../utils/report/captureTopologyDiagram';
import { getStandardExportFilename } from '../utils/exportNaming';
import { saveWithFilePickerOrPrompt } from '../utils/fileSaveHelper';
import gigamonLogo from '../assets/gigamon-logo.png';

import {
  ConfirmModal,
  DuplicateModal,
  ProjectSettingsModal,
  BomModal,
  AboutModal,
  SkuUpdateModal,
  ReportModal,
  MixedSiteConfirmModal,
  PlayIcon,
  PauseIcon,
  CopyIcon,
  ClipboardIcon,
  GridIcon,
  ServerRackIcon,
  PresentationIcon,
  StopIcon,
  CameraIcon,
  ReportIcon,
  SaveIcon,
  FolderOpenIcon,
  GearIcon,
  RefreshIcon,
  TrashIcon,
  UndoIcon,
  RedoIcon,
  PriceListIcon,
  SunIcon,
  MoonIcon,
  ChevronDownIcon,
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
  const isRunning = useStore((state) => state.isRunning);
  const simulationSpeed = useStore((state) => state.simulationSpeed);
  const toggleSimulation = useStore((state) => state.toggleSimulation);
  const setSimulationSpeed = useStore((state) => state.setSimulationSpeed);
  const clearCanvas = useStore((state) => state.clearCanvas);
  const loadDemo = useStore((state) => state.loadDemo);
  const advancedMode = useStore((state) => state.advancedMode);
  const setAdvancedMode = useStore((state) => state.setAdvancedMode);
  const setAdvancedModeUnlocked = useStore((state) => state.setAdvancedModeUnlocked);
  const nodes = useStore((state) => state.nodes);
  const edges = useStore((state) => state.edges);
  const activeView = useStore((state) => state.activeView);
  const setActiveView = useStore((state) => state.setActiveView);
  const panelTextScale = useStore((state) => state.panelTextScale || 1.0);
  const setPanelTextScale = useStore((state) => state.setPanelTextScale);
  const currentScenarioName = useStore((state) => state.currentScenarioName);
  const setCurrentScenarioName = useStore((state) => state.setCurrentScenarioName);
  const projectRegion = useStore((state) => state.projectRegion);
  const duplicateSolution = useStore((state) => state.duplicateSolution);
  const isTradeShowDemoActive = useStore((state) => state.isTradeShowDemoActive);
  const setTradeShowDemoActive = useStore((state) => state.setTradeShowDemoActive);
  const isMissionDemoActive = useStore((state) => state.isMissionDemoActive);
  const setMissionDemoActive = useStore((state) => state.setMissionDemoActive);
  const canUndo = useStore((state) => state.historyPast.length > 0);
  const canRedo = useStore((state) => state.historyFuture.length > 0);
  const undo = useStore((state) => state.undo);
  const redo = useStore((state) => state.redo);
  const theme = useStore((state) => state.theme);
  const toggleTheme = useStore((state) => state.toggleTheme);
  const bumpSkuCatalogueVersion = useStore((state) => state.bumpSkuCatalogueVersion);

  // Local UI state for modals & dropdowns
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showBom, setShowBom] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showDuplicatePrompt, setShowDuplicatePrompt] = useState(false);
  const [showSkuUpdate, setShowSkuUpdate] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showMixedSiteConfirm, setShowMixedSiteConfirm] = useState(false);
  const [pendingSiteAction, setPendingSiteAction] = useState<'bom' | 'report'>('bom');
  const [logoClicks, setLogoClicks] = useState<number[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [showDemoMenu, setShowDemoMenu] = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const demoMenuRef = React.useRef<HTMLDivElement>(null);
  const projectMenuRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (demoMenuRef.current && !demoMenuRef.current.contains(e.target as Node)) {
        setShowDemoMenu(false);
      }
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) {
        setShowProjectMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleOpenBom = () => {
    const siteCheck = detectMixedSiteAssignment(nodes);
    if (siteCheck.hasMixedSites) {
      setPendingSiteAction('bom');
      setShowMixedSiteConfirm(true);
    } else {
      setShowBom(true);
    }
  };

  const handleOpenReport = () => {
    const siteCheck = detectMixedSiteAssignment(nodes);
    if (siteCheck.hasMixedSites) {
      setPendingSiteAction('report');
      setShowMixedSiteConfirm(true);
    } else {
      setShowReport(true);
    }
  };

  const handleLogoClick = () => {
    const now = Date.now();
    const recentClicks = [...logoClicks, now].filter((t) => now - t < 2000);
    setLogoClicks(recentClicks);
    if (recentClicks.length >= 4) {
      const nextMode = !advancedMode;
      setAdvancedMode(nextMode);
      setAdvancedModeUnlocked(nextMode);
      setLogoClicks([]);
    }
  };

  const handleClearRequest = () => setShowClearConfirm(true);
  const handleClearConfirm = () => {
    clearCanvas();
    setShowClearConfirm(false);
  };
  const handleClearCancel = () => setShowClearConfirm(false);

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
    captureTopologyDiagramPng()
      .then(async (dataUrl) => {
        const filename = getStandardExportFilename('diagram-png', currentScenarioName);
        await saveWithFilePickerOrPrompt(dataUrl, filename, {
          description: 'PNG Topology Diagram',
          mimeType: 'image/png',
          extension: '.png',
        });
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

      {showMixedSiteConfirm && (() => {
        const siteCheck = detectMixedSiteAssignment(nodes);
        return (
          <MixedSiteConfirmModal
            targetType={pendingSiteAction}
            taggedSites={siteCheck.taggedSites}
            taggedNodes={siteCheck.taggedNodes}
            untaggedNodes={siteCheck.untaggedNodes}
            onConfirm={() => {
              setShowMixedSiteConfirm(false);
              if (pendingSiteAction === 'bom') {
                setShowBom(true);
              } else {
                setShowReport(true);
              }
            }}
            onCancel={() => setShowMixedSiteConfirm(false)}
          />
        );
      })()}

      {showBom && <BomModal onClose={() => setShowBom(false)} />}
      {showSettings && <ProjectSettingsModal onClose={() => setShowSettings(false)} />}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
      {showSkuUpdate && <SkuUpdateModal onClose={() => setShowSkuUpdate(false)} onChanged={bumpSkuCatalogueVersion} />}
      {showReport && <ReportModal onClose={() => setShowReport(false)} />}
      {showDuplicatePrompt && (
        <DuplicateModal
          defaultName="Site B"
          selectedCount={nodes.filter((n) => n.selected).length}
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
              style={{ height: '18px', display: 'block', objectFit: 'contain', cursor: 'pointer', flexShrink: 0 }}
              onClick={handleLogoClick}
              title="Gigamon Traffic Simulator"
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
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
                      background: 'var(--bg-input)',
                      border: '1px solid var(--color-blue)',
                      borderRadius: '3px',
                      color: 'var(--text-primary)',
                      font: 'inherit',
                      padding: '0 4px',
                      width: '150px',
                    }}
                  />
                ) : (
                  <span
                    onDoubleClick={handleNameDoubleClick}
                    title="Double-click to rename project"
                    style={{ cursor: 'text' }}
                  >
                    {currentScenarioName || 'Untitled Project'}
                  </span>
                )}
                <img
                  className="brand-region-flag"
                  src={
                    projectRegion === 'EU'
                      ? 'https://flagcdn.com/eu.svg'
                      : projectRegion === 'UK'
                        ? 'https://flagcdn.com/gb.svg'
                        : 'https://flagcdn.com/us.svg'
                  }
                  alt={projectRegion}
                  title={`Deployment Region: ${projectRegion}`}
                  onClick={() => setShowSettings(true)}
                />
              </span>
              <span className="brand-subtitle">
                <span className="brand-subtitle-full">FLOW MAPPING DESIGNER </span>
                <button
                  className="brand-build-link"
                  onClick={() => setShowAbout(true)}
                  title={`Build ${pkg.version} — click for release notes`}
                  style={{ background: 'none', border: 'none', padding: 0, font: 'inherit' }}
                >
                  v{pkg.version}
                </button>
              </span>
            </div>

            <div className="tab monitoring-session active" style={{ color: advancedMode ? '#ff9800' : '#fff', flexShrink: 0 }}>
              {advancedMode ? 'Expert Designer' : 'Standard View'}
            </div>
          </div>

          <div className="header-controls">
            {/* ── Group 1: Simulation ── */}
            <div className="control-group" style={{ flexShrink: 0 }}>
              <button
                onClick={toggleSimulation}
                className={`sim-btn ${isRunning ? 'running' : ''}`}
                style={{ minWidth: isRunning ? '75px' : '110px' }}
              >
                {isRunning ? <PauseIcon /> : <PlayIcon />}
                <span>{isRunning ? 'Pause' : 'Run'}</span>
                <span className="header-btn-text-optional">{isRunning ? '' : ' Simulation'}</span>
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
              <button className="header-btn icon-only" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
                <UndoIcon />
              </button>
              <button className="header-btn icon-only" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
                <RedoIcon />
              </button>

              {advancedMode && nodes.length > 0 && (
                <button
                  className="header-btn header-btn--cyan"
                  onClick={() => setShowDuplicatePrompt(true)}
                  title="Duplicate the entire topology to a new site"
                >
                  <CopyIcon /> <span className="header-btn-text-optional">Duplicate</span>
                </button>
              )}

              {(advancedMode || nodes.some((n) => n.type === 'hardwareNode')) && !isMissionDemoActive &&
                (() => {
                  const validationErrors = validateConfiguration(nodes, edges);
                  const hasErrors = validationErrors.length > 0;
                  return (
                    <button
                      className={`header-btn ${hasErrors ? 'header-btn--red' : 'header-btn--orange'}`}
                      onClick={handleOpenBom}
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
                  {activeView === 'rack' ? (
                    <>
                      <GridIcon /> <span className="header-btn-text-optional">Canvas View</span>
                    </>
                  ) : (
                    <>
                      <ServerRackIcon /> <span className="header-btn-text-optional">Rack View</span>
                    </>
                  )}
                </button>
              )}

              {/* Demo Modes: Active state stop button OR compact dropdown */}
              {isTradeShowDemoActive ? (
                <button
                  className="header-btn header-btn--solid-red"
                  onClick={() => setTradeShowDemoActive(false)}
                  title="Stop Automated Demo"
                >
                  <StopIcon /> Stop Demo
                </button>
              ) : isMissionDemoActive ? (
                <button
                  className="header-btn header-btn--solid-red"
                  onClick={() => setMissionDemoActive(false)}
                  title="Stop Mission Demo"
                >
                  <StopIcon /> Stop Mission
                </button>
              ) : (
                <div className="header-dropdown-wrapper" ref={demoMenuRef}>
                  <button
                    className="header-btn header-btn--green"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDemoMenu((prev) => !prev);
                      setShowProjectMenu(false);
                    }}
                    title="Demonstration modes"
                  >
                    <PresentationIcon /> <span>Demo</span> <ChevronDownIcon />
                  </button>
                  {showDemoMenu && (
                    <div className="header-dropdown-menu">
                      <button
                        className="header-dropdown-item"
                        onClick={() => {
                          setTradeShowDemoActive(true);
                          setShowDemoMenu(false);
                        }}
                      >
                        <PresentationIcon size={14} />
                        <span>Automated Trade Show Demo</span>
                      </button>
                      <button
                        className="header-dropdown-item"
                        onClick={() => {
                          setMissionDemoActive(true);
                          setShowDemoMenu(false);
                        }}
                      >
                        <PresentationIcon size={14} />
                        <span>Mission (Before / After) Demo</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {advancedMode && (
                <button className="header-btn" onClick={handleExportScreenshot} title="Export canvas to PNG">
                  <CameraIcon /> <span className="header-btn-text-optional">Screenshot</span>
                </button>
              )}

              {advancedMode && (
                <button
                  className="header-btn"
                  onClick={handleOpenReport}
                  title="Generate a customer-facing PDF solution report"
                >
                  <ReportIcon /> <span className="header-btn-text-optional">Report</span>
                </button>
              )}

              <div className="control-divider">
                <span style={{ fontSize: '9px', color: '#666', fontWeight: 700 }}>SIZE</span>
                <select
                  value={panelTextScale}
                  onChange={(e) => setPanelTextScale(Number(e.target.value))}
                  className="sim-speed-select"
                  style={{ width: '52px', height: '24px', padding: '0 2px' }}
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

            {/* ── Group 3: File / Project Storage Operations ── */}
            <div className="control-group">
              <div className="header-dropdown-wrapper" ref={projectMenuRef}>
                <button
                  className="header-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowProjectMenu((prev) => !prev);
                    setShowDemoMenu(false);
                  }}
                  title="Project file save and load options"
                >
                  <SaveIcon /> <span>Project</span> <ChevronDownIcon />
                </button>
                {showProjectMenu && (
                  <div className="header-dropdown-menu right-aligned">
                    <button
                      className="header-dropdown-item"
                      onClick={() => {
                        onSaveFileClick();
                        setShowProjectMenu(false);
                      }}
                    >
                      <SaveIcon size={14} />
                      <span>Export Project File (.json)</span>
                    </button>
                    <button
                      className="header-dropdown-item"
                      onClick={() => {
                        handleImportClick();
                        setShowProjectMenu(false);
                      }}
                    >
                      <FolderOpenIcon size={14} />
                      <span>Import Project File (.json)</span>
                    </button>
                    <div className="header-dropdown-divider" />
                    <button
                      className="header-dropdown-item"
                      onClick={() => {
                        onSaveClick();
                        setShowProjectMenu(false);
                      }}
                    >
                      <SaveIcon size={14} />
                      <span>Save to Browser Slot...</span>
                    </button>
                    <button
                      className="header-dropdown-item"
                      onClick={() => {
                        onLoadClick();
                        setShowProjectMenu(false);
                      }}
                    >
                      <FolderOpenIcon size={14} />
                      <span>Load from Browser Slot...</span>
                    </button>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json,text/plain,.txt"
                onChange={onLoadFileChange}
                style={{
                  position: 'fixed',
                  top: '-9999px',
                  left: '-9999px',
                  opacity: 0,
                  width: '1px',
                  height: '1px',
                  pointerEvents: 'none',
                }}
              />
            </div>

            {/* ── Group 4: System / Danger ── */}
            <div className="control-group" style={{ flexShrink: 0 }}>
              {advancedMode && (
                <button
                  className="header-btn icon-only"
                  onClick={() => setShowSkuUpdate(true)}
                  title="Update SKU price list from a spreadsheet"
                >
                  <PriceListIcon />
                </button>
              )}
              <button
                className="header-btn icon-only"
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to Light Theme (White Canvas for Documents)' : 'Switch to Dark Theme'}
                style={{ color: theme === 'light' ? '#ff9800' : '#00e5ff' }}
              >
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </button>
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
