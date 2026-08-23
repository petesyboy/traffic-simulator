/**
 * App.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Root application component.  Responsibilities:
 *  • Restores saved canvas state from localStorage on first mount.
 *  • Registers global keyboard shortcuts.
 *  • Composes the main layout (Header → Sidebar + Canvas + ConfigPanel).
 *
 * CHANGES (refactor/code-quality-improvements)
 * ─────────────────────────────────────────────
 * 1. KEYBOARD SHORTCUTS
 *    Added via a single `keydown` listener in a useEffect.  Shortcuts:
 *      Ctrl/Cmd + S  → Save layout to localStorage
 *      Space         → Toggle simulation (run / pause)
 *
 *    Note: Delete/Backspace for node deletion is already handled natively by
 *    ReactFlow (via `deleteKeyCode` prop in CanvasArea).
 *
 * 2. MULTI-SLOT SAVE
 *    The header's "Save Layout" button previously always wrote to a single
 *    localStorage key.  Now a SaveSlotModal lets users choose a named slot
 *    (up to 5 slots, plus the default auto-save).  Slots are listed in the
 *    modal with a load button next to each.
 *
 *    Storage keys: 'fm-simulator-slot-<name>'
 *    Backward compatible: the old 'fm-simulator-default-file' key is still
 *    auto-loaded on startup if present.
 */

import { useEffect, useState, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import CanvasArea from './components/CanvasArea';
import ConfigPanel from './components/ConfigPanel';
import RackElevationView from './components/RackElevationView';
import SimulationEngine from './components/SimulationEngine';
import TrafficGenerator from './components/TrafficGenerator';
import { useStore } from './store/store';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TradeShowDemo } from './components/TradeShowDemo';
import { MissionDemo } from './components/MissionDemo';
import { SaveSlotModal } from './components/header/SaveSlotModal';
import './App.css';


function App() {
  const restoreState     = useStore((state) => state.restoreState);
  const toggleSimulation = useStore((state) => state.toggleSimulation);
  const setCurrentScenarioName = useStore((s) => s.setCurrentScenarioName);
  const undo = useStore((state) => state.undo);
  const redo = useStore((state) => state.redo);

  // State for export, moved up from SaveSlotModal
  const nodes               = useStore((s) => s.nodes);
  const edges               = useStore((s) => s.edges);
  const trafficStreams      = useStore((s) => s.trafficStreams);
  const advancedMode        = useStore((s) => s.advancedMode);
  const projectLicenseMode  = useStore((s) => s.projectLicenseMode);
  const defaultTermDuration = useStore((s) => s.defaultTermDuration);
  const projectRegion       = useStore((s) => s.projectRegion);
  const disableDcWarnings   = useStore((s) => s.disableDcWarnings);
  const panelTextScale      = useStore((s) => s.panelTextScale);
  const showGrid            = useStore((s) => s.showGrid);
  const snapToGrid          = useStore((s) => s.snapToGrid);
  const currentScenarioName = useStore((s) => s.currentScenarioName);
  const activeView          = useStore((s) => s.activeView);

  const [modalMode, setModalMode] = useState<'save' | 'load' | null>(null);
  const [saveToast, setSaveToast] = useState('');

  const handleExportStateToFile = useCallback(async () => {
    // Matches the header's own "Untitled Project" fallback (Header.tsx) so the
    // suggested filename always tracks whatever project name is shown on screen.
    // Characters invalid in Windows/macOS filenames are stripped since the name
    // comes from a free-text rename field with no character restrictions.
    const name = (currentScenarioName || 'Untitled Project').replace(/[<>:"/\\|?*]+/g, '_').trim() || 'Untitled Project';
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
        snapToGrid
      }
    };
    const json = JSON.stringify(flow, null, 2);
    const filename = `${name}.json`;

    // Chromium browsers support showSaveFilePicker, which brings up the native
    // "Save As" dialog so the user can pick a location/filename instead of it
    // silently landing in the default downloads folder. Firefox/Safari don't
    // implement it, and this app is mainly distributed as a standalone HTML
    // file opened directly via file:// - where the picker API can exist on
    // `window` but throw when actually invoked (no real origin to attach the
    // permission to) - so any failure other than the user cancelling falls
    // through to the anchor-download approach below rather than failing silently.
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as unknown as {
          showSaveFilePicker: (options: {
            suggestedName: string;
            types: { description: string; accept: Record<string, string[]> }[];
          }) => Promise<FileSystemFileHandle>;
        }).showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'JSON Topology File', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        setSaveToast(`Saved topology to "${handle.name}"`);
        setTimeout(() => setSaveToast(''), 5000);
        return;
      } catch (err) {
        // AbortError means the user cancelled the picker - respect that instead
        // of falling back to a download they didn't ask for.
        if (err instanceof Error && err.name === 'AbortError') return;
        console.warn('showSaveFilePicker unavailable, falling back to anchor download:', err);
      }
    }

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', url);
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);

    setSaveToast(`Saved topology to "${filename}"`);
    setTimeout(() => setSaveToast(''), 5000);
  }, [
    nodes, edges, trafficStreams, advancedMode, projectLicenseMode, defaultTermDuration,
    projectRegion, disableDcWarnings, panelTextScale, showGrid, snapToGrid,
    currentScenarioName
  ]);

  const handleImportStateFromFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
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
          setSaveToast(`Loaded "${scenarioName}"`);
          setTimeout(() => setSaveToast(''), 5000);
        } else {
          alert("Invalid topology file structure.");
        }
      } catch (err) {
        alert("Failed to parse the topology file. Make sure it's a valid JSON scenario file.");
        console.error(err);
      }
    };
    reader.readAsText(file);
    // Reset the input value to allow loading the same file again
    if(event.target) event.target.value = '';
  }, [restoreState, setCurrentScenarioName]);


  // ── Auto-restore on first mount ──────────────────────────────────────────

  useEffect(() => {
    // Check autosave, last slot, or legacy default save
    const savedState = localStorage.getItem('fm-simulator-autosave') || localStorage.getItem('fm-simulator-default-file');
    if (savedState) {
      try {
        const { nodes: n, edges: e, trafficStreams: t, settings: s_obj } = JSON.parse(savedState);
        if (n && e) {
          restoreState(n, e, t || [], s_obj);
          const lastSlot = localStorage.getItem('fm-simulator-last-slot');
          if (lastSlot) setCurrentScenarioName(lastSlot);
        }
      } catch (error) {
        console.error('Failed to parse the saved canvas state:', error);
      }
    }
  }, [restoreState, setCurrentScenarioName]);

  // ── Auto-save working state on changes (debounced) ───────────────────────

  useEffect(() => {
    const timer = setTimeout(() => {
      if (nodes.length > 0) {
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
        try {
          localStorage.setItem('fm-simulator-autosave', JSON.stringify(flow));
        } catch {
          // Ignore quota errors in restricted environments
        }
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [
    nodes,
    edges,
    trafficStreams,
    advancedMode,
    projectLicenseMode,
    defaultTermDuration,
    projectRegion,
    disableDcWarnings,
    panelTextScale,
    showGrid,
    snapToGrid,
  ]);

  // ── Global keyboard shortcuts ─────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore shortcuts when the user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl && e.key === 's') {
        // Ctrl/Cmd+S → open the save slot modal (same as clicking "💾 Save Layout")
        e.preventDefault();
        setModalMode('save');
      }

      if (isCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
        // Ctrl/Cmd+Z → undo
        e.preventDefault();
        undo();
      }

      if (isCtrl && ((e.shiftKey && e.key.toLowerCase() === 'z') || e.key.toLowerCase() === 'y')) {
        // Ctrl/Cmd+Shift+Z, or Ctrl+Y → redo
        e.preventDefault();
        redo();
      }

      if (e.key === ' ' && !isCtrl) {
        // Space → toggle simulation run/pause
        e.preventDefault();
        toggleSimulation();
      }
    },
    [toggleSimulation, undo, redo]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="app-container">
      {/* Global toast for keyboard-triggered saves. z-index sits above the Save/Load
          modal's blurred overlay (z-index 10000) - handleSave() there leaves the modal
          open after saving to a slot, so this toast must render on top of it, not
          behind, or it inherits the modal's backdrop blur and becomes illegible. */}
      {saveToast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 10001, background: 'rgba(37,179,75,0.92)', color: '#fff', padding: '10px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
          ✓ {saveToast}
        </div>
      )}

      {/* Multi-slot save/load modal */}
      {modalMode && (
        <SaveSlotModal
          mode={modalMode}
          onClose={() => setModalMode(null)}
          onSaved={(name: string) => {
            setSaveToast(`Saved to "${name}"`);
            setTimeout(() => setSaveToast(''), 5000);
          }}
          onLoaded={() => {
            setSaveToast('Layout loaded');
            setTimeout(() => setSaveToast(''), 5000);
          }}
        />
      )}

      <Header
        onSaveClick={() => setModalMode('save')}
        onLoadClick={() => setModalMode('load')}
        onSaveFileClick={handleExportStateToFile}
        onLoadFileChange={handleImportStateFromFile}
      />

      <div className="main-content">
        <ReactFlowProvider>
          <TradeShowDemo />
          <MissionDemo />
          <Sidebar />
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {activeView === 'rack' ? (
              <RackElevationView />
            ) : (
              <ErrorBoundary name="Canvas Area">
                <CanvasArea />
              </ErrorBoundary>
            )}
            <TrafficGenerator />
          </div>
          <ErrorBoundary name="Configuration Panel">
            <ConfigPanel />
          </ErrorBoundary>
          <SimulationEngine />
        </ReactFlowProvider>
      </div>
    </div>
  );
}

export default App;