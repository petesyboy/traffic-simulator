import React from 'react';
import { useStore } from '../store/store';

const Header: React.FC = () => {
  const nodes = useStore((state) => state.nodes);
  const edges = useStore((state) => state.edges);

  const handleSave = () => {
    const flow = { nodes, edges };
    localStorage.setItem('fm-simulator-default-file', JSON.stringify(flow));
    alert('Canvas state saved successfully!');
  };

  return (
    <header className="header">
      <h1>Gigamon Traffic Flow</h1>
      <div>
        <button className="primary" onClick={handleSave}>Save</button>
      </div>
    </header>
  );
};

export default Header;