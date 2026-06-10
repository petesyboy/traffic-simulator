import React, { useCallback, useRef } from 'react';
import {
  ReactFlow,
  useReactFlow,
  Background,
  Controls,
  type Node
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../store/store';
import { InputNode, FilterNode, ToolNode, MapNode } from './CustomNodes';

const nodeTypes = {
  inputNode: InputNode,
  filterNode: FilterNode,
  toolNode: ToolNode,
  mapNode: MapNode,
};

const CanvasArea: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const nodes = useStore((state) => state.nodes);
  const edges = useStore((state) => state.edges);
  const onNodesChange = useStore((state) => state.onNodesChange);
  const onEdgesChange = useStore((state) => state.onEdgesChange);
  const onConnect = useStore((state) => state.onConnect);
  const addNode = useStore((state) => state.addNode);
  const setSelectedNodeId = useStore((state) => state.setSelectedNodeId);
  const { screenToFlowPosition } = useReactFlow();

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

      const { type, label } = JSON.parse(rawData);

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: uuidv4(),
        type,
        position,
        data: { label: label, configType: label },
      };

      addNode(newNode);
    },
    [screenToFlowPosition, addNode]
  );

  const onSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => {
    if (nodes.length === 1) {
      setSelectedNodeId(nodes[0].id);
    } else {
      setSelectedNodeId(null);
    }
  }, [setSelectedNodeId]);

  return (
    <div className="canvas-wrapper" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
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
    </div>
  );
};

export default CanvasArea;