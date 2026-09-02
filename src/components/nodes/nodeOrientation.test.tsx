import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReactFlowProvider, Position } from '@xyflow/react';
import { MapNode } from './MapNode';
import { FilterNode } from './FilterNode';
import { HardwareNode } from './HardwareNode';
import { ToolNode } from './ToolNode';
import { InputNode } from './InputNode';
import { GigaStreamNode } from './GigaStreamNode';
import { getHandleSides } from './nodeStyles';

interface RenderedHandle {
  id: string;
  pos: string;
  kind: 'target' | 'source';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- NodeProps needs a full ReactFlow node context the other node tests also stub out
const renderNode = (Component: React.ComponentType<any>, data: Record<string, unknown>): string =>
  renderToStaticMarkup(
    <ReactFlowProvider>
      <Component
        {...({
          id: 'n1',
          data,
          selected: false,
          type: 'test',
          zIndex: 1,
          isConnectable: true,
          positionAbsoluteX: 0,
          positionAbsoluteY: 0,
          dragging: false,
          draggable: true,
          selectable: true,
          deletable: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- NodeProps needs a full ReactFlow node context, stubbed the same way the other node tests do
        } as any)}
      />
    </ReactFlowProvider>,
  );

/** Pulls the handle id, painted side and direction out of rendered ReactFlow markup. */
function handlesOf(html: string): RenderedHandle[] {
  const attr = (tag: string, name: string): string => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? '';
  return (html.match(/<div[^>]*react-flow__handle[^>]*>/g) || []).map((tag) => ({
    id: attr(tag, 'data-handleid'),
    pos: attr(tag, 'data-handlepos'),
    kind: /\bsource\b/.test(tag) ? 'source' : 'target',
  }));
}

const OPPOSITE: Record<string, string> = { left: 'right', right: 'left' };

describe('getHandleSides', () => {
  it('defaults to the classic left-to-right pipeline when no direction is set', () => {
    expect(getHandleSides(undefined)).toEqual({ inSide: Position.Left, outSide: Position.Right });
    expect(getHandleSides({})).toEqual({ inSide: Position.Left, outSide: Position.Right });
    expect(getHandleSides({ flowDirection: 'ltr' })).toEqual({ inSide: Position.Left, outSide: Position.Right });
  });

  it('swaps ingress and egress sides for a mirrored node', () => {
    expect(getHandleSides({ flowDirection: 'rtl' })).toEqual({ inSide: Position.Right, outSide: Position.Left });
  });
});

describe('node renderers honour flowDirection', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see renderNode
  const cases: Array<[string, React.ComponentType<any>, Record<string, unknown>]> = [
    ['MapNode', MapNode, { label: 'Map', configType: 'Traffic Map', conditions: [] }],
    ['FilterNode', FilterNode, { label: 'Filter', configType: 'Tunnel Filter' }],
    ['HardwareNode', HardwareNode, { label: 'TA200', configType: 'Hardware', model: 'GigaVUE-TA200E' }],
    ['ToolNode', ToolNode, { label: 'Splunk', configType: 'Tool' }],
    ['GigaStreamNode', GigaStreamNode, { label: 'GigaStream', configType: 'GigaStream', linkCount: 2 }],
    ['InputNode', InputNode, { label: 'SPAN Port 1', configType: 'SPAN' }],
  ];

  cases.forEach(([name, Component, data]) => {
    it(`${name} ingests on the left and egresses on the right by default`, () => {
      const handles = handlesOf(renderNode(Component, data));
      expect(handles.length).toBeGreaterThan(0);
      handles
        .filter((h) => h.pos === 'left' || h.pos === 'right')
        .forEach((h) => expect(h.pos).toBe(h.kind === 'target' ? 'left' : 'right'));
    });

    it(`${name} mirrors its side handles when flowDirection is rtl`, () => {
      const ltr = handlesOf(renderNode(Component, data));
      const rtl = handlesOf(renderNode(Component, { ...data, flowDirection: 'rtl' }));

      // Handle IDs are what every existing edge, preset and saved project
      // resolves against, so mirroring must never rename or drop one.
      expect(rtl.map((h) => h.id)).toEqual(ltr.map((h) => h.id));

      ltr.forEach((before, i) => {
        const after = rtl[i];
        if (before.pos === 'left' || before.pos === 'right') {
          expect(after.pos).toBe(OPPOSITE[before.pos]);
        } else {
          // Top/bottom handles are vertical stacking aids, not pipeline
          // direction - they stay where they are.
          expect(after.pos).toBe(before.pos);
        }
      });
    });

    it(`${name} renders identically to a mirrored-off node when the field is absent`, () => {
      expect(renderNode(Component, data)).toEqual(renderNode(Component, { ...data, flowDirection: 'ltr' }));
    });
  });

  it('leaves an InputNode top/bottom stacking handle untouched when mirrored', () => {
    const rtl = handlesOf(renderNode(InputNode, { label: 'SPAN Port 1', configType: 'SPAN', flowDirection: 'rtl' }));
    expect(rtl.find((h) => h.id === 'in-top')?.pos).toBe('top');
    expect(rtl.find((h) => h.id === 'out-bottom')?.pos).toBe('bottom');
    expect(rtl.find((h) => h.id === 'in')?.pos).toBe('right');
    expect(rtl.find((h) => h.id === 'out')?.pos).toBe('left');
  });
});
