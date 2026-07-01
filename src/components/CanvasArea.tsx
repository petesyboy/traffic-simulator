import React, { useCallback, useRef, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  useReactFlow,
  useViewport,
  Background,
  Controls,
  BackgroundVariant,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import { useStore, type CustomNode } from '../store/store';
import { InputNode, FilterNode, ToolNode, MapNode, GigaStreamNode, GigaSmartNode, GroupNode, HardwareNode } from './CustomNodes';
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
  [NODE_TYPES.HARDWARE]:   HardwareNode,
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

      if (srcTool === 'Splunk' && (tgtConfig === 'Objects' || tgtConfig === 'Storage Tool')) {
        splunkNode = sourceNode;
        s3Node = targetNode;
      } else if ((srcConfig === 'Objects' || srcConfig === 'Storage Tool') && tgtTool === 'Splunk') {
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
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const draggedNodeType = useStore((state) => state.draggedNodeType);
  const nodes = useStore((state) => state.nodes);
  const edges = useStore((state) => state.edges);
  const activeEdges = useStore((state) => state.activeEdges);
  const blockedEdges = useStore((state) => state.blockedEdges);
  const edgeMetrics = useStore((state) => state.edgeMetrics || {});
  const isRunning = useStore((state) => state.isRunning);
  const showGrid = useStore((state) => state.showGrid);
  const snapToGrid = useStore((state) => state.snapToGrid);
  const snapAllNodesToGrid = useStore((state) => state.snapAllNodesToGrid);
  
  const onNodesChange = useStore((state) => state.onNodesChange);
  const onEdgesChange = useStore((state) => state.onEdgesChange);
  const onConnect = useStore((state) => state.onConnect);
  const addNode = useStore((state) => state.addNode);
  const addTrafficStream = useStore((state) => state.addTrafficStream);
  const setSelectedNodeId = useStore((state) => state.setSelectedNodeId);
  const fitViewTrigger = useStore((state) => state.fitViewTrigger);
  const advancedMode = useStore((state) => state.advancedMode);
  const updateNodeData = useStore((state) => state.updateNodeData);
  const setEdges = useStore((state) => state.setEdges);
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
    
    const srcNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);

    // Determine if it's a metadata edge
    const isMetadata = (() => {
      if (!srcNode) return false;
      if (srcNode.type === 'gigaSmartNode') {
        const actionType = srcNode.data?.actionType;
        if (actionType === 'Application Metadata' || actionType === 'AMX' || actionType === 'AMI') {
          return true;
        }
      }
      if (srcNode.type === 'hardwareNode') {
        const apps = (srcNode.data?.gigaSmartApps as any[]) || [];
        const hasMetadataApp = apps.some(app => 
          app.actionType === 'Application Metadata' || app.actionType === 'AMX' || app.actionType === 'AMI'
        );
        if (hasMetadataApp && targetNode?.type === 'toolNode' && 
            (targetNode.data?.configType === 'Metadata Tool' || targetNode.data?.configType === 'Objects' || targetNode.data?.configType === 'Storage Tool')) {
          return true;
        }
      }
      
      // General traceback
      const visited = new Set<string>();
      const queue: string[] = [edge.source];
      visited.add(edge.source);
      let hasMetadataOrigin = false;
      let hasPacketOrigin = false;

      while (queue.length > 0) {
        const currId = queue.shift()!;
        const currNode = nodes.find(n => n.id === currId);
        if (!currNode) continue;

        if (currNode.type === 'inputNode') {
          hasPacketOrigin = true;
        } else if (currNode.type === 'gigaSmartNode') {
          const actionType = currNode.data?.actionType;
          if (actionType === 'Application Metadata' || actionType === 'AMX' || actionType === 'AMI') {
            hasMetadataOrigin = true;
          } else {
            hasPacketOrigin = true;
          }
        } else if (currNode.type === 'hardwareNode') {
          const apps = (currNode.data?.gigaSmartApps as any[]) || [];
          if (apps.some(app => app.actionType === 'Application Metadata' || app.actionType === 'AMX' || app.actionType === 'AMI')) {
            hasMetadataOrigin = true;
          }
          const incoming = edges.filter(e => e.target === currId);
          if (incoming.length === 0) {
            hasPacketOrigin = true;
          }
        }

        const incomingEdges = edges.filter(e => e.target === currId);
        incomingEdges.forEach(e => {
          if (!visited.has(e.source)) {
            visited.add(e.source);
            queue.push(e.source);
          }
        });
      }
      return (hasMetadataOrigin && !hasPacketOrigin) || 
             (targetNode?.type === 'toolNode' && 
              (targetNode.data?.configType === 'Metadata Tool' || 
               ((targetNode.data?.configType === 'Objects' || targetNode.data?.configType === 'Storage Tool') && hasMetadataOrigin)));
    })();

    let className = '';
    let animated = false;
    
    if (isRunning) {
      if (isActive) {
        className = isMetadata ? 'metadata-flow' : 'active-flow';
        animated = true;
      } else if (isBlocked) {
        className = 'blocked-flow';
      }
    }

    // Dynamic Edge Labeling for GigaSMART Application Metadata
    let label = edge.label;
    
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

    if (srcTool === 'Splunk' && (tgtConfig === 'Objects' || tgtConfig === 'Storage Tool')) {
      // Flow from target (S3) back to source (Splunk)
      className = isMetadata ? 'reverse-metadata-flow' : 'reverse-flow';
      animated = true;
    } else if ((srcConfig === 'Objects' || srcConfig === 'Storage Tool') && tgtTool === 'Splunk') {
      // Flow from source (S3) to target (Splunk)
      className = isMetadata ? 'metadata-flow' : 'active-flow';
      animated = true;
    }
    
    // Append throughput if available
    const bps = edgeMetrics[edge.id];
    if (isRunning && bps !== undefined && bps > 0) {
      const throughputLabel = bps >= 1000 ? `${(bps / 1000).toFixed(1)} Gbps` : `${bps.toFixed(0)} Mbps`;
      label = label ? `${label} | ${throughputLabel}` : throughputLabel;
    }

    // Calculate dynamic animation speed based on link utilization
    const getCapacity = (): number => {
      if (!srcNode) return 10000;
      if (srcNode.type === 'inputNode') {
        return (srcNode.data?.linkSpeed as number || 10) * 1000; // Gbps to Mbps
      }
      if (srcNode.type === 'hardwareNode') {
        const model = String(srcNode.data?.model || '').toUpperCase();
        if (model.includes('TA400') || model.includes('HC3')) return 400000;
        if (model.includes('TA200') || model.includes('HC1-PLUS')) return 100000;
        if (model.includes('HC1') || model.includes('TAP')) return 10000;
        
        // If there's optics defined
        const optics = (srcNode.data?.optics as { optic: string, qty: number }[]) || [];
        if (optics.length > 0) {
          let cap = 0;
          for (const opt of optics) {
            if (!opt.optic) continue;
            const name = opt.optic.toUpperCase();
            let speed = 0;
            if (name.includes('400G') || name.startsWith('QDD-')) speed = 400000;
            else if (name.includes('100G') || name.startsWith('Q28-')) speed = 100000;
            else if (name.includes('40G') || name.startsWith('QSF-')) speed = 40000;
            else if (name.includes('25G') || name.startsWith('SFP-55')) speed = 25000;
            else if (name.includes('10G') || name.startsWith('SFP-53')) speed = 10000;
            else if (name.includes('1G') || name.startsWith('SFP-50')) speed = 1000;
            cap += speed * opt.qty;
          }
          if (cap > 0) return cap;
        }
      }
      return 10000; // default 10 Gbps (10000 Mbps)
    };

    let stroke = '#007cff'; // default blue
    if (isRunning) {
      if (isActive) {
        stroke = isMetadata ? '#ff9800' : '#00e5ff';
      } else if (isBlocked) {
        stroke = '#ef5350';
      }
    }
    // Reverse flows
    if (srcTool === 'Splunk' && (tgtConfig === 'Objects' || tgtConfig === 'Storage Tool')) {
      stroke = isMetadata ? '#ff9800' : '#00e5ff';
    } else if ((srcConfig === 'Objects' || srcConfig === 'Storage Tool') && tgtTool === 'Splunk') {
      stroke = isMetadata ? '#ff9800' : '#00e5ff';
    }

    let style: React.CSSProperties = {
      stroke,
      strokeWidth: hoveredEdgeId === edge.id ? '4px' : '1.5px',
      strokeDasharray: '4, 3',
    };

    if (isRunning && bps !== undefined && bps > 0) {
      const capacity = getCapacity();
      const utilization = Math.min(1.0, bps / capacity);
      // Map utilization (0 to 1) to animation duration (2.0s down to 0.2s)
      const duration = 2.0 - 1.8 * utilization;
      style = {
        ...style,
        animationDuration: `${duration.toFixed(2)}s`
      };
    }

    if (hoveredEdgeId === edge.id) {
      style = {
        ...style,
        stroke: '#00e5ff',
        strokeWidth: '4px',
        filter: 'drop-shadow(0px 0px 8px #00e5ff)',
      };
    }
    
    return {
      ...edge,
      className,
      animated: hoveredEdgeId === edge.id ? true : animated,
      label,
      style,
    };
  });

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    if (draggedNodeType === NODE_TYPES.GIGASMART || draggedNodeType === NODE_TYPES.GIGASTREAM) {
      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      let foundEdgeId: string | null = null;
      for (const edge of edges) {
        const srcNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);
        if (!srcNode || !targetNode) continue;

        const srcW = srcNode.measured?.width || srcNode.width || 170;
        const ax = srcNode.position.x + srcW / 2;
        const ay = srcNode.position.y;

        const targetW = targetNode.measured?.width || targetNode.width || 170;
        const bx = targetNode.position.x - targetW / 2;
        const by = targetNode.position.y;

        const px = position.x;
        const py = position.y;

        const dx = bx - ax;
        const dy = by - ay;
        const lenSq = dx * dx + dy * dy;

        let t = 0;
        if (lenSq > 0) {
          t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
          t = Math.max(0, Math.min(1, t));
        }

        const cx = ax + t * dx;
        const cy = ay + t * dy;

        const distSq = (px - cx) * (px - cx) + (py - cy) * (py - cy);
        if (Math.sqrt(distSq) < 80) { // increased to 80 flow units
          foundEdgeId = edge.id;
          break;
        }
      }
      setHoveredEdgeId(foundEdgeId);
    }
  }, [draggedNodeType, edges, nodes, screenToFlowPosition]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const rawData = event.dataTransfer.getData('application/reactflow');

      if (!rawData || !reactFlowBounds) {
        return;
      }

      const { type, label, initialData } = JSON.parse(rawData);

      if (advancedMode && type === NODE_TYPES.GIGASMART) {
        const hasHc = nodes.some(n => n.type === 'hardwareNode' && String(n.data?.model || '').includes('HC'));
        const hasTa = nodes.some(n => n.type === 'hardwareNode' && String(n.data?.model || '').includes('TA'));
        
        if (!hasHc) {
          if (hasTa) {
            alert("GigaSMART is not supported on GigaVUE-TA series nodes. You must add a GigaVUE-HC series node to the canvas first.");
          } else {
            alert("GigaSMART requires a GigaVUE-HC series node. Please add a GigaVUE-HC node to the canvas first.");
          }
          return;
        }
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      if (advancedMode && type === NODE_TYPES.GIGASMART) {
        // Find the closest HC hardware node that the mouse was dropped on.
        // hw nodes are usually quite large, so we check a wide bounding box.
        const targetNode = nodes.find(n => {
          if (n.type !== 'hardwareNode') return false;
          
          const w = n.measured?.width || n.width || 400;
          const h = n.measured?.height || n.height || 200;
          
          // Check 1: Center-origin ([0.5, 0.5])
          const cLeft = n.position.x - w / 2;
          const cRight = n.position.x + w / 2;
          const cTop = n.position.y - h / 2;
          const cBottom = n.position.y + h / 2;
          const insideCenter = position.x >= cLeft && position.x <= cRight &&
                               position.y >= cTop && position.y <= cBottom;
                               
          // Check 2: Top-left-origin ([0, 0])
          const tlLeft = n.position.x;
          const tlRight = n.position.x + w;
          const tlTop = n.position.y;
          const tlBottom = n.position.y + h;
          const insideTopLeft = position.x >= tlLeft && position.x <= tlRight &&
                                position.y >= tlTop && position.y <= tlBottom;
                                
          return insideCenter || insideTopLeft;
        });

        if (targetNode) {
          if (!String(targetNode.data?.model || '').includes('HC')) {
            alert("GigaSMART applications can only be dropped onto GigaVUE-HC series appliances in Advanced Mode.");
            return;
          }
          
          const newApp = {
             id: `gs-${Date.now()}`,
             label,
             actionType: initialData?.actionType || 'Deduplication',
             dedupRate: 20,
             metadataFormat: 'CEF'
          };
          
          const apps = targetNode.data.gigaSmartApps || [];
          updateNodeData(targetNode.id, { gigaSmartApps: [...apps, newApp] });
          return;
        } else {
          alert("In Advanced Mode, GigaSMART applications must be dropped directly onto a GigaVUE-HC series appliance.");
          return;
        }
      }

      const mergedData = { ...initialData };
      let labelToUse = label;

      if (type === NODE_TYPES.INPUT) {
        // Auto-number new input ports by finding the highest existing index.
        let maxIndex = 0;
        nodes.forEach((node) => {
          if (node.type === NODE_TYPES.INPUT) {
            const labelStr = String(node.data?.label || '');
            const match = labelStr.match(/(?:TAP\s+|Port\s+|Tunnel\s+|Traffic\s+|Estate\s+)(\d+)/i);
            if (match) {
              const idx = parseInt(match[1], 10);
              if (idx > maxIndex) maxIndex = idx;
            }
          }
        });
        const nextIdx = maxIndex + 1;

        if (initialData?.configType === 'Network Tap' || initialData?.configType === 'Virtual TAP' || initialData?.configType === CONFIG_TYPES.TAP) {
          labelToUse = `Network TAP ${nextIdx}`;
        } else if (initialData?.configType === 'SPAN Port' || initialData?.configType === CONFIG_TYPES.SPAN) {
          labelToUse = `SPAN Port ${nextIdx}`;
        } else if (initialData?.configType === CONFIG_TYPES.ERSPAN) {
          labelToUse = `ERSPAN Tunnel ${nextIdx}`;
        } else if (initialData?.configType === CONFIG_TYPES.EAST_WEST) {
          labelToUse = `East/West Traffic ${nextIdx}`;
        } else if (initialData?.configType === CONFIG_TYPES.VMWARE || initialData?.configType === 'GigaVUE-VM') {
          labelToUse = `VMWare Estate ${nextIdx}`;
        }
      } else if (type === NODE_TYPES.HARDWARE) {
        let maxIndex = 0;
        const baseModel = String(initialData?.model || initialData?.label || 'Node');
        nodes.forEach((node) => {
          if (node.type === NODE_TYPES.HARDWARE) {
            const nodeBaseModel = String(node.data?.model || node.data?.label || 'Node');
            if (nodeBaseModel === baseModel) {
              const labelStr = String(node.data?.label || '');
              // Match "BaseModel #2" or "BaseModel 2"
              const escapedModel = baseModel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const match = labelStr.match(new RegExp(`^${escapedModel}\\s+#?(\\d+)$`, 'i'));
              if (match) {
                const idx = parseInt(match[1], 10);
                if (idx > maxIndex) maxIndex = idx;
              } else if (labelStr === baseModel) {
                if (1 > maxIndex) maxIndex = 1;
              }
            }
          }
        });
        
        if (maxIndex > 0) {
           labelToUse = `${baseModel} #${maxIndex + 1}`;
        }
      }

      if (initialData?.actionType === 'Deduplication' && mergedData.dedupRate === undefined) {
        mergedData.dedupRate = Math.floor(Math.random() * 41) + 10; // random 10% to 50%
        mergedData.lastDedupUpdate = Date.now();
      }

      let edgeToInterpose: Edge | null = null;
      if (type === NODE_TYPES.GIGASTREAM || type === NODE_TYPES.GIGASMART) {
        for (const edge of edges) {
          const srcNode = nodes.find((n) => n.id === edge.source);
          const targetNode = nodes.find((n) => n.id === edge.target);
          if (!srcNode || !targetNode) continue;

          const srcW = srcNode.measured?.width || srcNode.width || 170;
          const srcH = srcNode.measured?.height || srcNode.height || 75;
          const ax = srcNode.position.x + srcW;
          const ay = srcNode.position.y + srcH / 2;

          const targetH = targetNode.measured?.height || targetNode.height || 75;
          const bx = targetNode.position.x;
          const by = targetNode.position.y + targetH / 2;

          const px = position.x;
          const py = position.y;

          const dx = bx - ax;
          const dy = by - ay;
          const lenSq = dx * dx + dy * dy;

          let t = 0;
          if (lenSq > 0) {
            t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
            t = Math.max(0, Math.min(1, t));
          }

          const cx = ax + t * dx;
          const cy = ay + t * dy;

          const distSq = (px - cx) * (px - cx) + (py - cy) * (py - cy);
          if (Math.sqrt(distSq) < 80) { // increased to 80 flow units
            edgeToInterpose = edge;
            break;
          }
        }
      }

      const newNode: CustomNode = {
        id: uuidv4(),
        type,
        position,
        data: { label: labelToUse, configType: mergedData.configType || labelToUse, ...mergedData },
      };

      addNode(newNode);

      if (edgeToInterpose) {
        const leftEdge: Edge = {
          id: `e-${uuidv4()}`,
          source: edgeToInterpose.source,
          sourceHandle: edgeToInterpose.sourceHandle,
          target: newNode.id,
          targetHandle: 'in',
        };
        const rightEdge: Edge = {
          id: `e-${uuidv4()}`,
          source: newNode.id,
          sourceHandle: 'out',
          target: edgeToInterpose.target,
          targetHandle: edgeToInterpose.targetHandle,
        };
        const updatedEdges = edges.filter(e => e.id !== edgeToInterpose!.id).concat(leftEdge, rightEdge);
        setEdges(updatedEdges);
      }

      setHoveredEdgeId(null);

      // Automatically generate a traffic stream whenever an input port or a G-TAP hardware node is dropped.
      const isInput = type === NODE_TYPES.INPUT;
      const isTapHardware = type === NODE_TYPES.HARDWARE && String(newNode.data?.model || '').includes('TAP');

      if (isInput || isTapHardware) {
        // Determine physical limit per link in Mbps
        let speedLimitMbps = 10000; // default 10G
        if (isInput) {
          const portSpeedStr = String(newNode.data?.portSpeed || '');
          const speedMatch = portSpeedStr.match(/(\d+)G/i);
          if (speedMatch) {
            speedLimitMbps = parseInt(speedMatch[1], 10) * 1000;
          } else if (newNode.data?.linkSpeed) {
            speedLimitMbps = Number(newNode.data.linkSpeed);
          }
        } else if (isTapHardware) {
          const modelStr = String(newNode.data?.model || '');
          if (modelStr.includes('25')) {
            speedLimitMbps = 25000; // 25G
          } else if (modelStr.includes('40')) {
            speedLimitMbps = 40000; // 40G
          } else if (modelStr.includes('100')) {
            speedLimitMbps = 100000; // 100G
          } else if (modelStr.includes('400')) {
            speedLimitMbps = 400000; // 400G
          } else {
            speedLimitMbps = 10000; // default 10G
          }
        }

        const tappedLinksCount = isTapHardware ? ((newNode.data?.tappedLinksCount as number) ?? 1) : 1;
        const numStreamsToCreate = Math.min(tappedLinksCount, 4);

        const profiles = [
          { name: 'Web Traffic', port: '443', proto: 'tcp' },
          { name: 'DB Sync Flow', port: '5432', proto: 'tcp' },
          { name: 'App Services API', port: '8080', proto: 'tcp' },
          { name: 'DNS Queries Query', port: '53', proto: 'udp' },
          { name: 'Video Streaming Media', port: '5004', proto: 'udp' },
          { name: 'VoIP Signaling', port: '5060', proto: 'udp' },
          { name: 'Encrypted VPN Tunnel', port: '500', proto: 'udp' },
          { name: 'ICMP Diagnostics', port: '0', proto: 'icmp' },
        ];

        for (let i = 0; i < numStreamsToCreate; i++) {
          const profile = profiles[(Math.floor(Math.random() * profiles.length) + i) % profiles.length];
          const profileTypes = ['low', 'medium', 'high'];
          const chosenProfileType = profileTypes[Math.floor(Math.random() * profileTypes.length)];

          let bandwidthMbps = 1000;
          if (chosenProfileType === 'low') {
            const lowSpeeds = [10, 50, 100, 250, 500];
            bandwidthMbps = lowSpeeds[Math.floor(Math.random() * lowSpeeds.length)];
          } else if (chosenProfileType === 'medium') {
            const medSpeeds = [1000, 2000, 5000];
            bandwidthMbps = medSpeeds[Math.floor(Math.random() * medSpeeds.length)];
          } else {
            const utilization = 0.3 + Math.random() * 0.45;
            bandwidthMbps = Math.floor(speedLimitMbps * utilization);
          }

          // Enforce physical limits
          if (bandwidthMbps > speedLimitMbps) {
            bandwidthMbps = Math.floor(speedLimitMbps * 0.75);
          }

          const randomSubnet = Math.floor(Math.random() * 254) + 1;
          const randomVlan = String(Math.floor(Math.random() * 900) + 100);
          const streamGbps = bandwidthMbps >= 1000
            ? `${(bandwidthMbps / 1000).toFixed(1).replace('.0', '')} Gbps`
            : `${bandwidthMbps} Mbps`;

          const streamName = numStreamsToCreate > 1
            ? `${labelToUse} - Link ${i + 1} - ${profile.name} (${streamGbps})`
            : `${labelToUse} - ${profile.name} (${streamGbps})`;

          addTrafficStream({
            id: `t-${uuidv4()}`,
            name: streamName,
            sourceNodeId: newNode.id,
            vlan: randomVlan,
            ipSrc: `192.168.${randomSubnet}.25`,
            ipDst: `10.10.${randomSubnet}.5`,
            portSrc: String(Math.floor(Math.random() * 50000) + 1024),
            portDst: profile.port,
            protocol: profile.proto as 'tcp' | 'udp' | 'icmp',
            bandwidth: bandwidthMbps,
            active: true,
            drift: 1,
            lastDriftUpdate: 0
          });
        }
      }
    },
    [screenToFlowPosition, addNode, addTrafficStream, nodes, advancedMode, updateNodeData]
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
        onDragLeave={() => setHoveredEdgeId(null)}
        onSelectionChange={onSelectionChange}
        onNodeDoubleClick={(_, node) => {
          const state = useStore.getState();
          if (state.glowingNodeId === node.id) {
            state.setGlowingNodeId(null);
          } else {
            state.setGlowingNodeId(node.id);
          }
        }}
        onPaneClick={() => {
          useStore.getState().setGlowingNodeId(null);
        }}
        deleteKeyCode={['Backspace', 'Delete']}
        nodeOrigin={[0.5, 0.5]}
        snapToGrid={snapToGrid}
        snapGrid={[15, 15]}
      >
        {showGrid && <Background variant={BackgroundVariant.Lines} color="rgba(255,255,255,0.06)" gap={15} size={1} />}
        <Controls />
        <Panel position="bottom-left" style={{ margin: '0 0 10px 48px', display: 'flex', gap: '8px' }}>
          <button
            onClick={snapAllNodesToGrid}
            title="Align all nodes to the nearest grid points"
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 600,
              background: '#1e1e1e',
              border: '1px solid #333',
              borderRadius: '4px',
              color: '#00e5ff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#252525';
              e.currentTarget.style.borderColor = '#00e5ff';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#1e1e1e';
              e.currentTarget.style.borderColor = '#333';
            }}
          >
            <span>🧲</span> Snap All to Grid
          </button>
        </Panel>
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