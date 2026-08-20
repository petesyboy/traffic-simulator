import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LinkDetailPanel } from './LinkDetailPanel';
import { useStore } from '../../store/store';
import type { CustomNode } from '../../store/types';
import { NODE_TYPES } from '../../constants/nodeTypes';

const initialState = useStore.getState();

describe('LinkDetailPanel', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
  });

  it('renders optic, speed, port, and purpose details for an inter-chassis TA25 to TA25 link', () => {
    const nodeA: CustomNode = {
      id: 'ta-1',
      type: NODE_TYPES.HARDWARE,
      position: { x: 0, y: 0 },
      data: {
        label: 'GigaVUE-TA25E North',
        model: 'GigaVUE-TA25E',
        sku: 'TA25E-BASE',
        site: 'Datacentre A (North)',
        optics: [
          { board: 'Base Ports', optic: 'SFP-553T (25G SFP28 LR)', qty: 2 },
        ],
      } as unknown as CustomNode['data'],
    };

    const nodeB: CustomNode = {
      id: 'ta-2',
      type: NODE_TYPES.HARDWARE,
      position: { x: 300, y: 0 },
      data: {
        label: 'GigaVUE-TA25E South',
        model: 'GigaVUE-TA25E',
        sku: 'TA25E-BASE',
        site: 'Datacentre B (South)',
        optics: [
          { board: 'Base Ports', optic: 'SFP-553T (25G SFP28 LR)', qty: 2 },
        ],
      } as unknown as CustomNode['data'],
    };

    const edge = {
      id: 'edge-1',
      source: 'ta-1',
      target: 'ta-2',
      selected: true,
      data: {
        portLinks: [
          { sourcePortId: '1/1/x1', targetPortId: '1/1/x3', opticSku: 'SFP-553T (25G SFP28 LR)' },
        ],
      },
    };

    useStore.setState({
      nodes: [nodeA, nodeB],
      edges: [edge],
      selectedNodeId: null,
    });

    const html = renderToStaticMarkup(
      <LinkDetailPanel selectedEdge={edge} selectedEdges={[edge]} nodes={[nodeA, nodeB]} edges={[edge]} />
    );

    // Checks header & purpose
    expect(html).toContain('Inter-Chassis Fabric Interconnect');
    expect(html).toContain('Selected Link Details');

    // Checks speed & media
    expect(html).toContain('25G');
    expect(html).toContain('Singlemode (SMF)');

    // Checks source and target device names and ports
    expect(html).toContain('GigaVUE-TA25E North');
    expect(html).toContain('GigaVUE-TA25E South');
    expect(html).toContain('Port 1/1/x1');
    expect(html).toContain('Port 1/1/x3');
  });
});
