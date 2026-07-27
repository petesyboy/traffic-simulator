import React from 'react';
import type { EdgeProps } from '@xyflow/react';
import { getBezierPath, EdgeLabelRenderer } from '@xyflow/react';

// ReactFlow's labelStyle/labelBgStyle are typed as CSSProperties, but this app
// passes SVG presentation attributes (fill/stroke) through them, not CSS props.
type SvgLabelStyle = React.CSSProperties & { fill?: string; stroke?: string };

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
  const [edgePath, labelX, labelY] = getBezierPath({
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
          strokeWidth: 4,
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
              background: (labelBgStyle as SvgLabelStyle)?.fill || '#121212',
              border: `1px solid ${(labelBgStyle as SvgLabelStyle)?.stroke || '#2a2a2a'}`,
              padding: '2px 6px',
              borderRadius: '4px',
              color: (labelStyle as SvgLabelStyle)?.fill || '#fff',
              fontSize: (labelStyle as SvgLabelStyle)?.fontSize || '9px',
              fontWeight: (labelStyle as SvgLabelStyle)?.fontWeight || 'bold',
              fontFamily: (labelStyle as SvgLabelStyle)?.fontFamily || 'system-ui, -apple-system, sans-serif',
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

export const ParallelEdge: React.FC<EdgeProps> = ({
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
  className,
  data
}: EdgeProps & { className?: string; data?: { parallelIndex?: number; totalParallel?: number } }) => {
  const parallelIndex = data?.parallelIndex ?? 0;
  const totalParallel = data?.totalParallel ?? 1;

  let edgePath: string;
  let labelX: number;
  let labelY: number;

  if (totalParallel > 1) {
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    const k = parallelIndex - (totalParallel - 1) / 2;
    // Increased curvature offset to 50px for wider separation
    const offset = k * 50;

    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2;

    const controlX = midX + nx * offset;
    const controlY = midY + ny * offset;

    edgePath = `M ${sourceX},${sourceY} Q ${controlX},${controlY} ${targetX},${targetY}`;
    
    // Stagger labels horizontally along the curve: vary t between 0.35 and 0.65
    const t = totalParallel > 1 ? (0.35 + (parallelIndex / (totalParallel - 1)) * 0.3) : 0.5;
    const mt = 1 - t;
    labelX = mt * mt * sourceX + 2 * mt * t * controlX + t * t * targetX;
    labelY = mt * mt * sourceY + 2 * mt * t * controlY + t * t * targetY;
  } else {
    const [path, lx, ly] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
    edgePath = path;
    labelX = lx;
    labelY = ly;
  }

  return (
    <>
      <path
        id={id}
        className={`react-flow__edge-path ${className || ''}`}
        d={edgePath}
        markerEnd={markerEnd}
        style={style}
        fill="none"
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: (labelBgStyle as SvgLabelStyle)?.fill || '#121212',
              border: `1px solid ${(labelBgStyle as SvgLabelStyle)?.stroke || '#2a2a2a'}`,
              padding: '2px 6px',
              borderRadius: '4px',
              color: (labelStyle as SvgLabelStyle)?.fill || '#fff',
              fontSize: (labelStyle as SvgLabelStyle)?.fontSize || '9px',
              fontWeight: (labelStyle as SvgLabelStyle)?.fontWeight || 'bold',
              fontFamily: (labelStyle as SvgLabelStyle)?.fontFamily || 'system-ui, -apple-system, sans-serif',
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
