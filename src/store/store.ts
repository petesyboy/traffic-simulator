import { create } from 'zustand';
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from '@xyflow/react';

export type RFState = {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  updateNodeData: (nodeId: string, data: any) => void;
  restoreState: (nodes: Node[], edges: Edge[]) => void;
};

export const useStore = create<RFState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  
  onNodesChange: (changes: NodeChange[]) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },
  
  onEdgesChange: (changes: EdgeChange[]) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },
  
  onConnect: (connection: Connection) => {
    set({ edges: addEdge(connection, get().edges) });
  },
  
  addNode: (node: Node) => {
    set({ nodes: get().nodes.concat(node) });
  },
  
  setSelectedNodeId: (nodeId: string | null) => {
    set({ selectedNodeId: nodeId });
  },
  
  updateNodeData: (nodeId: string, data: any) => {
    set({
      nodes: get().nodes.map((node) => 
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      ),
    });
  },

  restoreState: (nodes: Node[], edges: Edge[]) => {
    set({ nodes, edges });
  },
}));