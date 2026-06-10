import React from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';

// Base styles for our nodes
const nodeStyle: React.CSSProperties = {
  padding: '10px 15px',
  borderRadius: '8px',
  background: '#fff',
  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  minWidth: '150px',
  fontSize: '14px',
  textAlign: 'center',
  border: '2px solid #222',
  width: '100%',
  height: '100%',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontWeight: 'bold',
  marginBottom: '5px',
};

const metaStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#666',
  marginTop: '4px',
  textAlign: 'left',
};

export const InputNode: React.FC<NodeProps> = ({ data, selected }) => (
  <>
    <NodeResizer minWidth={150} isVisible={selected} />
    <div style={{ ...nodeStyle, borderColor: '#4CAF50' }}>
      <div style={labelStyle}>{data.label as string}</div>
      <div style={metaStyle}>Type: Network Input</div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  </>
);

export const MapNode: React.FC<NodeProps> = ({ data, selected }) => (
  <>
    <NodeResizer minWidth={150} isVisible={selected} />
    <div style={{ ...nodeStyle, borderColor: '#9C27B0' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div style={labelStyle}>{data.label as string}</div>
      <div style={metaStyle}>Type: Traffic Map</div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  </>
);

export const FilterNode: React.FC<NodeProps> = ({ data, selected }) => (
  <>
    <NodeResizer minWidth={150} isVisible={selected} />
    <div style={{ ...nodeStyle, borderColor: '#2196F3' }}>
      <Handle type="target" position={Position.Left} id="in" />
      
      <div style={labelStyle}>{data.label as string}</div>
      
      {/* Conditionally display the custom properties if they exist */}
      {data.vlanIds && <div style={metaStyle}><b>VLANs:</b> {data.vlanIds as string}</div>}
      {data.ipSubnet && <div style={metaStyle}><b>IPs:</b> {data.ipSubnet as string}</div>}
      {data.ports && <div style={metaStyle}><b>Ports:</b> {data.ports as string}</div>}
      
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  </>
);

export const ToolNode: React.FC<NodeProps> = ({ data, selected }) => (
  <>
    <NodeResizer minWidth={150} isVisible={selected} />
    <div style={{ ...nodeStyle, borderColor: '#FF9800' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div style={labelStyle}>{data.label as string}</div>
      <div style={metaStyle}>Destination Tool</div>
    </div>
  </>
);