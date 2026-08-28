import React from 'react';
import { useStore } from '../../store/store';

interface GroupingBannerProps {
  selectedInputCount: number;
  selectedGroupCount: number;
  selectedTapCount?: number;
  selectedToolCount?: number;
  selectedClusterCount?: number;
}

export const GroupingBanner: React.FC<GroupingBannerProps> = ({
  selectedInputCount,
  selectedGroupCount,
  selectedTapCount = 0,
  selectedToolCount = 0,
  selectedClusterCount = 0,
}) => {
  const groupSelectedNodes = useStore(state => state.groupSelectedNodes);
  const ungroupGroup = useStore(state => state.ungroupGroup);
  const createCluster = useStore(state => state.createCluster);
  const dissolveCluster = useStore(state => state.dissolveCluster);
  const toggleClusterCollapse = useStore(state => state.toggleClusterCollapse);
  const nodes = useStore(state => state.nodes);

  const handleUngroup = () => {
    nodes.filter(n => n.selected && n.type === 'groupNode').forEach(gn => ungroupGroup(gn.id));
  };

  const handleDissolveClusters = () => {
    nodes.filter(n => n.selected && n.type === 'clusterNode').forEach(cn => dissolveCluster(cn.id));
  };

  const handleToggleClusters = () => {
    nodes.filter(n => n.selected && n.type === 'clusterNode').forEach(cn => toggleClusterCollapse(cn.id));
  };

  const handleCreateTapCluster = () => {
    createCluster(undefined, 'tap');
  };

  const handleCreateToolCluster = () => {
    createCluster(undefined, 'tool');
  };

  const hasAnyAction =
    selectedInputCount >= 2 ||
    selectedGroupCount >= 1 ||
    selectedTapCount >= 2 ||
    selectedToolCount >= 2 ||
    selectedClusterCount >= 1;

  if (!hasAnyAction) return null;

  return (
    <div style={{
      position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 100,
      background: 'rgba(22, 26, 36, 0.96)', border: '1px solid var(--border-color, #334155)', borderRadius: '20px',
      padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '12px',
      boxShadow: '0 6px 24px rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* ── TAP CLUSTERING ── */}
      {selectedTapCount >= 2 && (
        <>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#00e5ff' }}>
            ⚡ {selectedTapCount} TAPs Selected
          </span>
          <button
            onClick={handleCreateTapCluster}
            style={{
              background: 'linear-gradient(135deg, #00b0ff 0%, #00e5ff 100%)',
              color: '#0d131f',
              border: 'none',
              padding: '6px 14px',
              fontSize: '11px',
              fontWeight: 'bold',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 0 10px rgba(0, 229, 255, 0.4)',
              transition: 'transform 0.1s ease',
            }}
            onMouseDown={(e) => e.stopPropagation()}
            title="Collapse selected TAPs into a compact stacked summary card"
          >
            📦 Stack TAPs Together
          </button>
        </>
      )}

      {selectedTapCount >= 2 && (selectedToolCount >= 2 || selectedInputCount >= 2 || selectedClusterCount >= 1) && (
        <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255,255,255,0.2)' }} />
      )}

      {/* ── TOOL CLUSTERING ── */}
      {selectedToolCount >= 2 && (
        <>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#c084fc' }}>
            🛠️ {selectedToolCount} Tools Selected
          </span>
          <button
            onClick={handleCreateToolCluster}
            style={{
              background: 'linear-gradient(135deg, #9333ea 0%, #c084fc 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '6px 14px',
              fontSize: '11px',
              fontWeight: 'bold',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 0 10px rgba(192, 132, 252, 0.4)',
              transition: 'transform 0.1s ease',
            }}
            onMouseDown={(e) => e.stopPropagation()}
            title="Collapse selected tools into a compact stacked receiver card"
          >
            📦 Stack Tools Together
          </button>
        </>
      )}

      {selectedToolCount >= 2 && (selectedInputCount >= 2 || selectedClusterCount >= 1) && (
        <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255,255,255,0.2)' }} />
      )}

      {/* ── INPUT PORT GROUPING ── */}
      {selectedInputCount >= 2 && (
        <>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#ffffff' }}>
            {selectedInputCount} Traffic Nodes Selected
          </span>
          <button
            onClick={groupSelectedNodes}
            style={{
              background: 'linear-gradient(135deg, #00b0ff 0%, #00e5ff 100%)',
              color: '#121212',
              border: 'none',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 'bold',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 0 8px rgba(0, 229, 255, 0.4)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            📦 Group Ports Together
          </button>
        </>
      )}

      {selectedInputCount >= 2 && (selectedGroupCount >= 1 || selectedClusterCount >= 1) && (
        <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255,255,255,0.2)' }} />
      )}

      {/* ── PORT GROUP UNGROUPING ── */}
      {selectedGroupCount >= 1 && (
        <>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#ffffff' }}>
            {selectedGroupCount} Port Group{selectedGroupCount > 1 ? 's' : ''} Selected
          </span>
          <button
            onClick={handleUngroup}
            style={{
              background: 'linear-gradient(135deg, #ff1744 0%, #ff5252 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 'bold',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 0 8px rgba(255, 23, 68, 0.4)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            🔓 Ungroup Ports
          </button>
        </>
      )}

      {/* ── CLUSTER MANAGEMENT (Expand / Collapse / Dissolve) ── */}
      {selectedClusterCount >= 1 && (
        <>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#38bdf8' }}>
            {selectedClusterCount} Stacked Cluster{selectedClusterCount > 1 ? 's' : ''} Selected
          </span>
          <button
            onClick={handleToggleClusters}
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 'bold',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 0 8px rgba(59, 130, 246, 0.4)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
            title="Toggle between collapsed stack and expanded layout"
          >
            ⤢ Toggle Expand/Collapse
          </button>
          <button
            onClick={handleDissolveClusters}
            style={{
              background: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 'bold',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
            title="Dissolve cluster stack back to individual standalone nodes"
          >
            🔓 Dissolve Stack
          </button>
        </>
      )}
    </div>
  );
};
