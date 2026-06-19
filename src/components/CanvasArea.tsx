import React, { useCallback, useRef, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  useReactFlow,
  useViewport,
  Background,
  Controls
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import { useStore, type CustomNode } from '../store/store';
import { InputNode, FilterNode, ToolNode, MapNode, GigaStreamNode, GigaSmartNode, GroupNode } from './CustomNodes';
import { NODE_TYPES, CONFIG_TYPES } from '../constants/nodeTypes';
import dashboardImg from '../assets/dashboard-mock.webp';

/**
 * nodeTypes MUST be defined outside the component.
 *
 * If it were defined inside CanvasArea, a new object would be created on every
 * render, causing ReactFlow to treat it as a brand-new type map each time and
 * re-mount every node.  By placing it at module scope the reference is stable
 * for the entire lifetime of the application.
 *
 * The keys here must match the `type` field used when adding nodes to the store.
 * We use the NODE_TYPES constants to keep them in sync.
 */
const nodeTypes = {
  [NODE_TYPES.INPUT]:      InputNode,
  [NODE_TYPES.FILTER]:     FilterNode,
  [NODE_TYPES.TOOL]:       ToolNode,
  [NODE_TYPES.MAP]:        MapNode,
  [NODE_TYPES.GIGASTREAM]: GigaStreamNode,
  [NODE_TYPES.GIGASMART]:  GigaSmartNode,
  [NODE_TYPES.GROUP]:      GroupNode,
};

// ─── Federated Search Enclosure ───────────────────────────────────────────────
/**
 * Detects edges between Splunk and S3/Object Storage tool nodes and renders
 * a visual enclosure around each pair to indicate they form a logical
 * "Federated Search" entity.
 *
 * Positioned in flow-space coordinates and scaled/panned via the viewport
 * transform so the enclosures move with the canvas.
 */
import type { Edge } from '@xyflow/react';

interface FederatedEnclosuresProps {
  nodes: CustomNode[];
  edges: Edge[];
  onShowDashboard: () => void;
}

const NODE_EST_WIDTH = 180;
const NODE_EST_HEIGHT = 90;
const ENCLOSURE_PAD = 28;

const FederatedEnclosures: React.FC<FederatedEnclosuresProps> = ({ nodes, edges, onShowDashboard }) => {
  const { x: vpX, y: vpY, zoom } = useViewport();

  /** Group all S3 nodes connected to the same Splunk node. */
  const groups = useMemo(() => {
    // Map of Splunk node ID to the group of nodes (Splunk + all its S3s)
    const splunkGroups = new Map<string, CustomNode[]>();

    for (const edge of edges) {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);
      if (!sourceNode || !targetNode) continue;

      const srcTool = (sourceNode.data?.toolName as string) || '';
      const tgtTool = (targetNode.data?.toolName as string) || '';
      const srcConfig = (sourceNode.data?.configType as string) || '';
      const tgtConfig = (targetNode.data?.configType as string) || '';

      let splunkNode: CustomNode | null = null;
      let s3Node: CustomNode | null = null;

      if (srcTool === 'Splunk' && tgtConfig === 'Storage Tool') {
        splunkNode = sourceNode;
        s3Node = targetNode;
      } else if (srcConfig === 'Storage Tool' && tgtTool === 'Splunk') {
        splunkNode = targetNode;
        s3Node = sourceNode;
      }

      if (splunkNode && s3Node) {
        if (!splunkGroups.has(splunkNode.id)) {
          splunkGroups.set(splunkNode.id, [splunkNode]);
        }
        const groupNodes = splunkGroups.get(splunkNode.id)!;
        if (!groupNodes.some(n => n.id === s3Node!.id)) {
          groupNodes.push(s3Node);
        }
      }
    }
    return Array.from(splunkGroups.values());
  }, [nodes, edges]);

  if (groups.length === 0) return null;

  return (
    <>
      {groups.map((groupNodes) => {
        // Compute bounding box around all nodes in this group.
        // nodeOrigin is [0.5, 0.5] so position is the CENTER of each node.
        const halfW = NODE_EST_WIDTH / 2;
        const halfH = NODE_EST_HEIGHT / 2;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const n of groupNodes) {
          minX = Math.min(minX, n.position.x - halfW);
          minY = Math.min(minY, n.position.y - halfH);
          maxX = Math.max(maxX, n.position.x + halfW);
          maxY = Math.max(maxY, n.position.y + halfH);
        }

        // Add padding around the enclosure
        const left   = (minX - ENCLOSURE_PAD) * zoom + vpX;
        const top    = (minY - ENCLOSURE_PAD) * zoom + vpY;
        const width  = (maxX - minX + ENCLOSURE_PAD * 2) * zoom;
        const height = (maxY - minY + ENCLOSURE_PAD * 2) * zoom;

        // Use a key that changes when the group composition changes
        // This ensures React completely remounts the enclosure and cleans up any visual artifacts
        const groupKey = groupNodes.map(n => n.id).sort().join('-');

        return (
          <div
            key={`federated-${groupKey}`}
            className="federated-enclosure pulse"
            style={{ left, top, width, height }}
          >
            <div className="federated-enclosure-label">
              🔍 Federated Search
            </div>
            <button 
              onClick={onShowDashboard}
              style={{
                position: 'absolute',
                top: '-12px',
                right: '10px',
                background: 'rgba(22, 22, 22, 0.95)',
                border: '1px solid rgba(0, 229, 255, 0.4)',
                borderRadius: '8px',
                padding: '4px 8px',
                fontSize: '10px',
                color: '#00e5ff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                pointerEvents: 'auto',
                boxShadow: '0 0 10px rgba(0, 229, 255, 0.2)'
              }}
            >
              📊 Insights
            </button>
          </div>
        );
      })}
    </>
  );
};

const CanvasArea: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const nodes = useStore((state) => state.nodes);
  const edges = useStore((state) => state.edges);
  const activeEdges = useStore((state) => state.activeEdges);
  const blockedEdges = useStore((state) => state.blockedEdges);
  const isRunning = useStore((state) => state.isRunning);
  
  const onNodesChange = useStore((state) => state.onNodesChange);
  const onEdgesChange = useStore((state) => state.onEdgesChange);
  const onConnect = useStore((state) => state.onConnect);
  const addNode = useStore((state) => state.addNode);
  const addTrafficStream = useStore((state) => state.addTrafficStream);
  const setSelectedNodeId = useStore((state) => state.setSelectedNodeId);
  const fitViewTrigger = useStore((state) => state.fitViewTrigger);
  const { screenToFlowPosition, fitView } = useReactFlow();

  useEffect(() => {
    // Wait for nodes to render and layout boundaries to compute
    const timer = setTimeout(() => {
      fitView({ padding: 0.1 });
    }, 100);
    return () => clearTimeout(timer);
  }, [fitViewTrigger, fitView]);

  // Dynamically apply classes and animation flags to connections
  const styledEdges = edges.map((edge) => {
    const isActive = activeEdges.includes(edge.id);
    const isBlocked = blockedEdges.includes(edge.id);
    
    let className = '';
    let animated = false;
    
    if (isRunning) {
      if (isActive) {
        className = 'active-flow';
        animated = true;
      } else if (isBlocked) {
        className = 'blocked-flow';
      }
    }

    // Dynamic Edge Labeling for GigaSMART Application Metadata
    let label = edge.label;
    const srcNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    
    if (srcNode?.type === 'gigaSmartNode' && 
        (srcNode.data?.actionType === 'Application Metadata' || 
         srcNode.data?.actionType === 'AMX' || 
         srcNode.data?.actionType === 'AMI')) {
      const format = (srcNode.data?.metadataFormat as string) || 'CEF';
      label = `${format} Metadata`;
    }

    // Always animate Federated Search (Splunk <-> S3) links to show "pull" capability
    const srcTool = (srcNode?.data?.toolName as string) || '';
    const tgtTool = (targetNode?.data?.toolName as string) || '';
    const srcConfig = (srcNode?.data?.configType as string) || '';
    const tgtConfig = (targetNode?.data?.configType as string) || '';

    if (srcTool === 'Splunk' && tgtConfig === 'Storage Tool') {
      // Flow from target (S3) back to source (Splunk)
      className = 'reverse-flow';
      animated = true;
    } else if (srcConfig === 'Storage Tool' && tgtTool === 'Splunk') {
      // Flow from source (S3) to target (Splunk)
      className = 'active-flow';
      animated = true;
    }
    
    return {
      ...edge,
      className,
      animated,
      label,
    };
  });

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const rawData = event.dataTransfer.getData('application/reactflow');

      if (!rawData || !reactFlowBounds) {
        return;
      }

      const { type, label, initialData } = JSON.parse(rawData);

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const mergedData = { ...initialData };
      let labelToUse = label;

      if (type === NODE_TYPES.INPUT) {
        // Auto-number new input ports by finding the highest existing index.
        // This gives a friendly label like "SPAN Port 1/1/x3" automatically.
        let maxIndex = 0;
        nodes.forEach((node) => {
          if (node.type === NODE_TYPES.INPUT) {
            const labelStr = String(node.data?.label || '');
            const match = labelStr.match(/(?:x|Tunnel\s+)(\d+)/i);
            if (match) {
              const idx = parseInt(match[1], 10);
              if (idx > maxIndex) maxIndex = idx;
            }
          }
        });
        const nextIdx = maxIndex + 1;

        if (initialData?.configType === CONFIG_TYPES.TAP) {
          labelToUse = `TAP Device 1/1/x${nextIdx}`;
        } else if (initialData?.configType === CONFIG_TYPES.SPAN) {
          labelToUse = `SPAN Port 1/1/x${nextIdx}`;
        } else if (initialData?.configType === CONFIG_TYPES.ERSPAN) {
          labelToUse = `ERSPAN Tunnel ${nextIdx}`;
        } else if (initialData?.configType === CONFIG_TYPES.EAST_WEST) {
          labelToUse = `East/West Traffic ${nextIdx}`;
        } else if (initialData?.configType === CONFIG_TYPES.VMWARE) {
          labelToUse = `VMWare Estate ${nextIdx}`;
        }
      }

      if (initialData?.actionType === 'Deduplication' && mergedData.dedupRate === undefined) {
        mergedData.dedupRate = Math.floor(Math.random() * 41) + 10; // random 10% to 50%
        mergedData.lastDedupUpdate = Date.now();
      }

      const newNode: CustomNode = {
        id: uuidv4(),
        type,
        position,
        data: { label: labelToUse, configType: mergedData.configType || labelToUse, ...mergedData },
      };

      addNode(newNode);

      // Automatically generate a traffic stream whenever an input port is dropped.
      // This gives immediate feedback that the port is "live" without needing manual setup.
      if (type === NODE_TYPES.INPUT) {
        const speeds = [1, 10, 25, 40, 100];
        const randomGbps = speeds[Math.floor(Math.random() * speeds.length)];
        const linkSpeedMbps = randomGbps * 1000;
        const initialBandwidthMbps = linkSpeedMbps * 0.5; // 50% utilization by default
        const labelSpeedStr = randomGbps === 1 ? '500 Mbps' : `${randomGbps * 0.5} Gbps`;
        const randomSubnet = Math.floor(Math.random() * 254) + 1;
        const randomVlan = String(Math.floor(Math.random() * 900) + 100);
        
        addTrafficStream({
          id: `t-${uuidv4()}`,
          name: `${labelToUse} Flow (${labelSpeedStr})`,
          sourceNodeId: newNode.id,
          vlan: randomVlan,
          ipSrc: `192.168.${randomSubnet}.10`,
          ipDst: `10.0.0.${randomSubnet}`,
          portSrc: String(Math.floor(Math.random() * 50000) + 1024),
          portDst: '80',
          protocol: 'tcp',
          bandwidth: initialBandwidthMbps,
          active: true,
        });
      }
    },
    [screenToFlowPosition, addNode, addTrafficStream, nodes]
  );

  const onSelectionChange = useCallback(({ nodes }: { nodes: CustomNode[] }) => {
    if (nodes.length === 1) {
      setSelectedNodeId(nodes[0].id);
    } else {
      setSelectedNodeId(null);
    }
  }, [setSelectedNodeId]);

  const selectedInputNodes = nodes.filter(
    (n) => n.selected && n.type === 'inputNode'
  );

  const selectedGroupNodes = nodes.filter(
    (n) => n.selected && n.type === 'groupNode'
  );

  const selectedEdges = edges.filter((e) => e.selected);
  const showGroupingBanner = selectedInputNodes.length >= 2 || selectedGroupNodes.length >= 1;
  const showEdgeBanner = selectedEdges.length > 0;

  const handleDeleteSelectedEdges = () => {
    onEdgesChange(selectedEdges.map((e) => ({ id: e.id, type: 'remove' })));
  };

  const handleCreateGroup = () => {
    useStore.getState().groupSelectedNodes();
  };

  const handleUngroup = () => {
    selectedGroupNodes.forEach((groupNode) => {
      useStore.getState().ungroupGroup(groupNode.id);
    });
  };

  return (
    <div className="canvas-wrapper" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onSelectionChange={onSelectionChange}
        deleteKeyCode={['Backspace', 'Delete']}
        nodeOrigin={[0.5, 0.5]}
      >
        <Background />
        <Controls />
      </ReactFlow>

      {/* ── Federated Search Enclosures ── */}
      {/* When a Splunk tool is linked to an S3 / Object Storage tool, draw
          a dashed enclosure around both nodes to show they form a logical
          "Federated Search" entity across traditional ingest and object storage. */}
      <FederatedEnclosures nodes={nodes} edges={edges} onShowDashboard={() => setShowDashboard(true)} />

      {showGroupingBanner && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          background: 'rgba(22, 22, 22, 0.95)',
          border: '1px solid var(--border-color)',
          borderRadius: '20px',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
        }}>
          {selectedInputNodes.length >= 2 && (
            <>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#ffffff' }}>
                {selectedInputNodes.length} Traffic Nodes Selected
              </span>
              <button 
                onClick={handleCreateGroup}
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
          {selectedInputNodes.length >= 2 && selectedGroupNodes.length >= 1 && (
            <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)' }} />
          )}
          {selectedGroupNodes.length >= 1 && (
            <>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#ffffff' }}>
                {selectedGroupNodes.length} Port Group{selectedGroupNodes.length > 1 ? 's' : ''} Selected
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
        </div>
      )}

      {showEdgeBanner && (
        <div style={{
          position: 'absolute',
          top: showGroupingBanner ? '72px' : '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          background: 'rgba(22, 22, 22, 0.95)',
          border: '1px solid var(--border-color)',
          borderRadius: '20px',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          transition: 'top 0.2s ease-in-out',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px' }}>🔗</span>
            {selectedEdges.length === 1 ? (
              <>
                Selected Link:{' '}
                <span style={{ color: 'var(--color-orange)' }}>
                  {(() => {
                    const e = selectedEdges[0];
                    const sourceNode = nodes.find((n) => n.id === e.source);
                    const targetNode = nodes.find((n) => n.id === e.target);
                    const srcLabel = sourceNode?.data?.label || 'Source';
                    const dstLabel = targetNode?.data?.label || 'Target';
                    return `${srcLabel} ➔ ${dstLabel}`;
                  })()}
                </span>
              </>
            ) : (
              `${selectedEdges.length} Links Selected`
            )}
          </span>
          <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Press <kbd style={{ background: '#2a2a2a', border: '1px solid #444', padding: '2px 5px', borderRadius: '4px', color: '#fff', fontSize: '10px', fontFamily: 'monospace' }}>Delete</kbd> or <kbd style={{ background: '#2a2a2a', border: '1px solid #444', padding: '2px 5px', borderRadius: '4px', color: '#fff', fontSize: '10px', fontFamily: 'monospace' }}>Backspace</kbd> to delete
          </span>
          <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)' }} />
          <button 
            onClick={handleDeleteSelectedEdges}
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
            🗑️ Remove Link{selectedEdges.length > 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* ── Dashboard Modal ── */}
      {showDashboard && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            background: '#121212',
            border: '1px solid #333',
            borderRadius: '16px',
            width: '90%',
            height: '90%',
            maxWidth: '1200px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 0 40px rgba(0,0,0,0.8)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: '1px solid #333',
              background: 'rgba(255,255,255,0.03)'
            }}>
              <h2 style={{ margin: 0, fontSize: '16px', color: '#00e5ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📊 Federated Network Insights
              </h2>
              <button 
                onClick={() => setShowDashboard(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#aaa',
                  cursor: 'pointer',
                  fontSize: '24px',
                  lineHeight: '1',
                  padding: '4px'
                }}
              >
                &times;
              </button>
            </div>
            <div style={{ flex: 1, padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0a0a0a' }}>
              <img 
                src={dashboardImg}
                alt="Network Insights Dashboard" 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '100%', 
                  objectFit: 'contain',
                  borderRadius: '8px',
                  border: '1px solid #222',
                  boxShadow: '0 4px 20px rgba(0, 229, 255, 0.1)'
                }} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CanvasArea;