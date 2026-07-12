import React from 'react';
import { useStore } from '../../store/store';

interface GroupingBannerProps {
  selectedInputCount: number;
  selectedGroupCount: number;
}

export const GroupingBanner: React.FC<GroupingBannerProps> = ({ selectedInputCount, selectedGroupCount }) => {
  const groupSelectedNodes = useStore(state => state.groupSelectedNodes);
  const ungroupGroup = useStore(state => state.ungroupGroup);
  const nodes = useStore(state => state.nodes);

  const handleUngroup = () => {
    nodes.filter(n => n.selected && n.type === 'groupNode').forEach(gn => ungroupGroup(gn.id));
  };

  return (
    <div style={{
      position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 100,
      background: 'rgba(22, 22, 22, 0.95)', border: '1px solid var(--border-color)', borderRadius: '20px',
      padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }}>
      {selectedInputCount >= 2 && (
        <>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#ffffff' }}>{selectedInputCount} Traffic Nodes Selected</span>
          <button onClick={groupSelectedNodes} style={{
            background: 'linear-gradient(135deg, #00b0ff 0%, #00e5ff 100%)', color: '#121212',
            border: 'none', padding: '6px 12px', fontSize: '11px', fontWeight: 'bold', borderRadius: '12px',
            cursor: 'pointer', boxShadow: '0 0 8px rgba(0, 229, 255, 0.4)',
          }} onMouseDown={(e) => e.stopPropagation()}>📦 Group Ports Together</button>
        </>
      )}
      {selectedInputCount >= 2 && selectedGroupCount >= 1 && <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)' }} />}
      {selectedGroupCount >= 1 && (
        <>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#ffffff' }}>{selectedGroupCount} Port Group{selectedGroupCount > 1 ? 's' : ''} Selected</span>
          <button onClick={handleUngroup} style={{
            background: 'linear-gradient(135deg, #ff1744 0%, #ff5252 100%)', color: '#ffffff',
            border: 'none', padding: '6px 12px', fontSize: '11px', fontWeight: 'bold', borderRadius: '12px',
            cursor: 'pointer', boxShadow: '0 0 8px rgba(255, 23, 68, 0.4)',
          }} onMouseDown={(e) => e.stopPropagation()}>🔓 Ungroup Ports</button>
        </>
      )}
    </div>
  );
};
