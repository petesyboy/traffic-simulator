import React, { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import CanvasArea from './components/CanvasArea';
import ConfigPanel from './components/ConfigPanel';
import { useStore } from './store/store';
import './App.css';

function App() {
  const restoreState = useStore((state) => state.restoreState);

  useEffect(() => {
    const savedState = localStorage.getItem('fm-simulator-default-file');
    if (savedState) {
      try {
        const { nodes, edges } = JSON.parse(savedState);
        if (nodes && edges) {
          restoreState(nodes, edges);
        }
      } catch (error) {
        console.error('Failed to parse the saved canvas state:', error);
      }
    }
  }, [restoreState]);

  return (
    <div className="app-container">
      <Header />
      <div className="main-content">
        <ReactFlowProvider>
          <Sidebar />
          <CanvasArea />
          <ConfigPanel />
        </ReactFlowProvider>
      </div>
    </div>
  );
}

export default App;