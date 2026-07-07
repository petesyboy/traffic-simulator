import React from 'react';
import type { EdgeProps } from '@xyflow/react';
import { getSmoothStepPath, EdgeLabelRenderer } from '@xyflow/react';

export const DoubleEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  label,
  labelStyle,
  labelBgStyle,
  markerEnd,
  className
}: EdgeProps & { className?: string }) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      {/* Outer thick line (colored, optionally dashed/animated) */}
      <path
        id={id}
        className={`react-flow__edge-path ${className || ''} outer-double-edge`}
        d={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: 6,
        }}
        fill="none"
      />
      
      {/* Inner mask line (background color) to split the thick line into two */}
      <path
        d={edgePath}
        className="inner-double-edge-mask"
        style={{
          stroke: '#121212', // matches canvas background
          strokeWidth: 2,
        }}
        fill="none"
      />

      {/* Label rendering */}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: (labelBgStyle as any)?.fill || '#121212',
              border: `1px solid ${(labelBgStyle as any)?.stroke || '#2a2a2a'}`,
              padding: '2px 6px',
              borderRadius: '4px',
              color: (labelStyle as any)?.fill || '#fff',
              fontSize: (labelStyle as any)?.fontSize || '9px',
              fontWeight: (labelStyle as any)?.fontWeight || 'bold',
              fontFamily: (labelStyle as any)?.fontFamily || 'system-ui, -apple-system, sans-serif',
              pointerEvents: 'all',
              zIndex: 1000,
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};
