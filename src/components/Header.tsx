import React from 'react';
import { useStore } from '../store/store';

const Header: React.FC = () => {
  const nodes = useStore((state) => state.nodes);
  const isRunning = useStore((state) => state.isRunning);
  const toggleSimulation = useStore((state) => state.toggleSimulation);
  const simulationSpeed = useStore((state) => state.simulationSpeed);
  const setSimulationSpeed = useStore((state) => state.setSimulationSpeed);
  const trafficStreams = useStore((state) => state.trafficStreams);
  const clearCanvas = useStore((state) => state.clearCanvas);
  const loadDemo = useStore((state) => state.loadDemo);

  const handleSave = () => {
    const flow = {
      nodes,
      edges: useStore.getState().edges,
      trafficStreams: useStore.getState().trafficStreams
    };
    localStorage.setItem('fm-simulator-default-file', JSON.stringify(flow));
    alert('Canvas state saved successfully!');
  };

  const activeStreamsCount = trafficStreams.filter(s => s.active).length;

  return (
    <div className="header-wrapper">
      {/* Topmost Brand Header Bar */}
      <header className="header-brand">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span className="brand-logo">Third Party Orchestration</span>
          <div className="tab monitoring-session active">Monitoring Session</div>
        </div>

        <div className="header-controls">
          {/* Simulation Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRight: '1px solid var(--border-color)', paddingRight: '12px', marginRight: '12px' }}>
            <button
              onClick={toggleSimulation}
              className={`sim-btn ${isRunning ? 'running' : ''}`}
            >
              {isRunning ? '⏸ Pause' : '▶ Run Simulation'}
            </button>

            {isRunning && (
              <select
                value={simulationSpeed}
                onChange={(e) => setSimulationSpeed(Number(e.target.value))}
                className="sim-speed-select"
              >
                <option value={1}>1x Speed</option>
                <option value={2}>2x Speed</option>
                <option value={5}>5x Speed</option>
                <option value={10}>10x Speed</option>
              </select>
            )}
          </div>

          <button className="header-btn primary" onClick={handleSave}>
            💾 Save Layout
          </button>
          <button className="header-btn secondary" onClick={loadDemo}>
            🔄 Reset Demo
          </button>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to clear the canvas?')) {
                clearCanvas();
              }
            }}
            className="header-btn danger"
          >
            🗑️ Clear
          </button>
        </div>
      </header>

      {/* Sub-Header Row with Breadcrumbs and Stage Buttons */}
      <div className="header-sub">
        <div className="session-title-area">
          <span className="session-icon">☁️</span>
          <span className="session-name-label">Test</span>
        </div>

        <div className="header-stats-indicator">
          <span>Active Ingress Port Loads: <b>{activeStreamsCount} / {trafficStreams.length}</b></span>
        </div>

      </div>
    </div>
  );
};

export default Header;