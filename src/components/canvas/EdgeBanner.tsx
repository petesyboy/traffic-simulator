import React from 'react';
import { useStore } from '../../store/store';

interface EdgeBannerProps {
  selectedEdges: any[];
  onDelete: () => void;
  topOffset: boolean;
}

export const EdgeBanner: React.FC<EdgeBannerProps> = ({ selectedEdges, onDelete, topOffset }) => {
  const nodes = useStore(state => state.nodes);

  return (
    <div style={{
      position: 'absolute', top: topOffset ? '72px' : '20px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 100, background: 'rgba(22, 22, 22, 0.95)', border: '1px solid var(--border-color)',
      borderRadius: '20px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', transition: 'top 0.2s ease-in-out',
    }}>
      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '12px' }}>🔗</span>
        {selectedEdges.length === 1 ? (
          <>Selected Link: <span style={{ color: 'var(--color-orange)' }}>
            {(() => {
              const e = selectedEdges[0];
              const src = nodes.find(n => n.id === e.source)?.data?.label || 'Source';
              const dst = nodes.find(n => n.id === e.target)?.data?.label || 'Target';
              return `${src} ➔ ${dst}`;
            })()}
          </span></>
        ) : `${selectedEdges.length} Links Selected`}
      </span>
      <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)' }} />
      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Press <kbd style={{ background: '#2a2a2a', border: '1px solid #444', padding: '2px 5px', borderRadius: '4px', color: '#fff', fontSize: '10px', fontFamily: 'monospace' }}>Delete</kbd> or <kbd style={{ background: '#2a2a2a', border: '1px solid #444', padding: '2px 5px', borderRadius: '4px', color: '#fff', fontSize: '10px', fontFamily: 'monospace' }}>Backspace</kbd> to delete</span>
      <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)' }} />
      <button onClick={onDelete} style={{
        background: 'linear-gradient(135deg, #ff1744 0%, #ff5252 100%)', color: '#ffffff',
        border: 'none', padding: '6px 12px', fontSize: '11px', fontWeight: 'bold', borderRadius: '12px',
        cursor: 'pointer', boxShadow: '0 0 8px rgba(255, 23, 68, 0.4)',
      }} onMouseDown={(e) => e.stopPropagation()}>🗑️ Remove Link{selectedEdges.length > 1 ? 's' : ''}</button>
    </div>
  );
};
