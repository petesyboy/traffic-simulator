import React from 'react';
import type { EdgeProps } from '@xyflow/react';
import { getBezierPath, getSmoothStepPath, EdgeLabelRenderer, Position } from '@xyflow/react';

// How far past the source/target node the path drops before turning, when
// looping a "backward" edge (e.g. a GigaSMART Appliance's packet return to a
// TA/HC placed to its left) around underneath the row instead of letting a
// bezier curve fold back over the nodes it connects.
const BACKWARD_LOOP_DROP = 120;
// Minimum gap (source.x - target.x) before an edge is treated as backward -
// avoids flipping routing for edges that are only trivially reversed.
const BACKWARD_MARGIN = 40;

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
          stroke: 'var(--canvas-bg, #121212)', // matches canvas background
          strokeWidth: 2,
        }}
        fill="none"
      />

      {/* Invisible wide hit-area so the edge is easy to click without lining up on the thin visible stroke */}
      <path d={edgePath} fill="none" strokeOpacity={0} strokeWidth={20} className="react-flow__edge-interaction" />

      {/* Label rendering */}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: (labelBgStyle as SvgLabelStyle)?.fill || 'var(--node-bg, #121212)',
              border: `1px solid ${(labelBgStyle as SvgLabelStyle)?.stroke || 'var(--border-color, #2a2a2a)'}`,
              padding: '2px 6px',
              borderRadius: '4px',
              color: (labelStyle as SvgLabelStyle)?.fill || 'var(--text-primary, #fff)',
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

// Routes an edge as a fixed-column bus: a horizontal stub from the edge's own
// endpoint out to a shared vertical trunk column (`data.trunkX`), then a
// horizontal run into the other endpoint. Every edge that shares the same
// trunkX (e.g. all "infra -> pipeline" edges in Mission Demo) therefore draws
// its vertical segment on top of the others, reading as one shared backbone
// with individual taps rather than a fan of point-to-point lines - the
// before/after topology diagram style, not something a generic bezier/step
// edge can reproduce since each edge only knows its own two endpoints.
export const MissionBusEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
  className,
  data
}: EdgeProps & { className?: string; data?: { trunkX?: number; dotAtSource?: boolean; color?: string } }) => {
  const trunkX = data?.trunkX ?? (sourceX + targetX) / 2;
  const strokeColor = data?.color || '#ff9800';
  // The tap dot sits where this edge's own row meets the shared trunk - at
  // the source's height when the source is the varying endpoint (e.g. each
  // infra node feeding into one fixed pipeline handle), or the target's
  // height when it's the other way around (one fixed pipeline handle
  // fanning out to each tool).
  const dotY = data?.dotAtSource ? sourceY : targetY;
  const edgePath = `M ${sourceX},${sourceY} L ${trunkX},${sourceY} L ${trunkX},${targetY} L ${targetX},${targetY}`;

  return (
    <>
      <path
        id={id}
        className={`react-flow__edge-path ${className || ''}`}
        d={edgePath}
        markerEnd={markerEnd}
        style={{ ...style, stroke: strokeColor, strokeWidth: style.strokeWidth || 2 }}
        fill="none"
      />
      {/* Invisible wide hit-area so the edge is easy to click without lining up on the thin visible stroke */}
      <path d={edgePath} fill="none" strokeOpacity={0} strokeWidth={20} className="react-flow__edge-interaction" />
      <circle cx={trunkX} cy={dotY} r={4} fill={strokeColor} stroke="var(--canvas-bg, #121212)" strokeWidth={1.5} />
    </>
  );
};

/**
 * Multi-coloured chaotic bezier edge for "Organization A (Chaos & Blind Spots)"
 * in the Mission Demo, illustrating tangled point-to-point SPAN/TAP connections.
 */
export const MissionChaosEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  className,
  data
}: EdgeProps & { className?: string; data?: { color?: string; curvature?: number; showTapBox?: boolean } }) => {
  const color = data?.color || '#a855f7';
  const curvature = data?.curvature ?? 0.25;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature,
  });

  return (
    <>
      <path
        id={id}
        className={`react-flow__edge-path ${className || ''}`}
        d={edgePath}
        markerEnd={markerEnd}
        style={{ ...style, stroke: color, strokeWidth: style.strokeWidth || 1.8, strokeDasharray: 'none' }}
        fill="none"
      />
      <path d={edgePath} fill="none" strokeOpacity={0} strokeWidth={20} className="react-flow__edge-interaction" />

      {/* Decorative Purple TAP 'T' box on the line if enabled */}
      {data?.showTapBox && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${sourceX + (labelX - sourceX) * 0.35}px,${sourceY + (labelY - sourceY) * 0.35}px)`,
              background: '#7e22ce',
              border: '1px solid #c084fc',
              borderRadius: '2px',
              padding: '1px 3px',
              color: '#ffffff',
              fontSize: '8px',
              fontWeight: 900,
              fontFamily: 'monospace',
              pointerEvents: 'none',
              zIndex: 1000,
              boxShadow: '0 0 6px rgba(168, 85, 247, 0.6)',
              lineHeight: 1,
            }}
          >
            T
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

/**
 * Subtle grey/slate backbone edge connecting internal network tiers
 * (Cloud <-> Routers <-> Core <-> Dist <-> Access).
 */
export const MissionBackboneEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  className
}: EdgeProps & { className?: string }) => {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  return (
    <>
      <path
        id={id}
        className={`react-flow__edge-path ${className || ''}`}
        d={edgePath}
        markerEnd={markerEnd}
        style={{ ...style, stroke: '#64748b', strokeWidth: 2, strokeDasharray: '4, 4', opacity: 0.85 }}
        fill="none"
      />
      <path d={edgePath} fill="none" strokeOpacity={0} strokeWidth={10} className="react-flow__edge-interaction" />
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
  // A bezier curve folds back over the nodes it connects when a link runs
  // against its own flow (e.g. a GSA returning packets to a TA/HC placed behind
  // it) - those are routed as a stepped path looping underneath the row instead.
  //
  // "Against its own flow" is decided by the side the source's egress handle
  // sits on, not simply by right-to-left: a mirrored node egresses on its left,
  // so reaching a target further left is its normal case, and treating that as a
  // backhaul loop turns every link in a right-to-left layout into a colliding
  // square.
  const egressPointsLeft = sourcePosition === Position.Left;
  const isBackward =
    totalParallel <= 1 &&
    (egressPointsLeft ? targetX > sourceX + BACKWARD_MARGIN : sourceX > targetX + BACKWARD_MARGIN);

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
  } else if (isBackward) {
    const [path, lx, ly] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      centerY: Math.max(sourceY, targetY) + BACKWARD_LOOP_DROP,
      borderRadius: 12,
      offset: 30,
    });
    edgePath = path;
    labelX = lx;
    labelY = ly;
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
      {/* Invisible wide hit-area so the edge is easy to click without lining up on the thin visible stroke */}
      <path d={edgePath} fill="none" strokeOpacity={0} strokeWidth={20} className="react-flow__edge-interaction" />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: (labelBgStyle as SvgLabelStyle)?.fill || 'var(--node-bg, #121212)',
              border: `1px solid ${(labelBgStyle as SvgLabelStyle)?.stroke || 'var(--border-color, #2a2a2a)'}`,
              padding: '2px 6px',
              borderRadius: '4px',
              color: (labelStyle as SvgLabelStyle)?.fill || 'var(--text-primary, #fff)',
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
