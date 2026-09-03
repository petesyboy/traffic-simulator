import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Position } from '@xyflow/react';
import { ParallelEdge } from './CustomEdges';

/** The rendered `d` of the edge path. */
function pathOf(props: {
  sourceX: number;
  targetX: number;
  sourcePosition: Position;
  targetPosition: Position;
}): string {
  const edgeProps = {
    id: 'e1',
    sourceY: 100,
    targetY: 100,
    source: 'a',
    target: 'b',
    ...props,
  } as unknown as React.ComponentProps<typeof ParallelEdge>;

  const html = renderToStaticMarkup(
    <svg>
      <ParallelEdge {...edgeProps} />
    </svg>,
  );
  return html.match(/ d="([^"]*)"/)?.[1] ?? '';
}

/** getBezierPath emits a single cubic; getSmoothStepPath emits line segments. */
const isCurve = (d: string) => d.includes('C') && !d.includes('L');
const isStepped = (d: string) => d.includes('L');

describe('ParallelEdge routing', () => {
  const ltr = { sourcePosition: Position.Right, targetPosition: Position.Left };
  const rtl = { sourcePosition: Position.Left, targetPosition: Position.Right };

  it('curves a normal left-to-right link', () => {
    expect(isCurve(pathOf({ sourceX: 0, targetX: 400, ...ltr }))).toBe(true);
  });

  it('curves a normal right-to-left link', () => {
    // The regression: a mirrored node egresses on its left, so a target further
    // left is its normal direction and must stay a curve, not become a
    // stepped backhaul loop.
    expect(isCurve(pathOf({ sourceX: 400, targetX: 0, ...rtl }))).toBe(true);
  });

  it('steps a left-to-right link that doubles back', () => {
    expect(isStepped(pathOf({ sourceX: 400, targetX: 0, ...ltr }))).toBe(true);
  });

  it('steps a right-to-left link that doubles back', () => {
    expect(isStepped(pathOf({ sourceX: 0, targetX: 400, ...rtl }))).toBe(true);
  });

  it('keeps curving when the two ends nearly line up', () => {
    // Within the margin either way, so neither direction counts as doubling back.
    expect(isCurve(pathOf({ sourceX: 0, targetX: 20, ...ltr }))).toBe(true);
    expect(isCurve(pathOf({ sourceX: 20, targetX: 0, ...rtl }))).toBe(true);
  });
});
