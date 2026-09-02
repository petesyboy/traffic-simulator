/**
 * GroupNode.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Group bounding-box node renderer.
 */

import React from 'react';
import { Handle, type NodeProps } from '@xyflow/react';
import { getHandleSides } from './nodeStyles';

const GroupNodeComponent: React.FC<NodeProps> = ({ data, selected }) => {
  const { outSide } = getHandleSides(data);
  return (
    /*
     * GroupNode uses width/height from its `style` prop (set dynamically in
     * store.groupSelectedNodes).  The inner div fills 100% of that area so
     * the dashed border covers the entire bounding box.
     */
    <div className={`custom-group-node ${selected ? 'selected' : ''}`} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Label floats above the bounding box */}
      <div className="group-header" style={{ position: 'absolute', top: '-24px', left: '0', fontSize: '11px', fontWeight: 'bold', color: '#00e5ff', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
        <span>📦 {data.label as string}</span>
      </div>
      {/* The group output handle connects to a downstream Traffic Map */}
      <Handle type="source" position={outSide} id="out" style={{ top: '50%' }} />
    </div>
  );
};

export const GroupNode = React.memo(GroupNodeComponent);
