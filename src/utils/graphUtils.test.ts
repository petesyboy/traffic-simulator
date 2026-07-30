import { describe, it, expect } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { CustomNode } from '../store/types';
import { isMetadataEdge } from './graphUtils';

describe('isMetadataEdge', () => {
  it('recognizes a GigaSMART Appliance metadata-out edge directly via sourceHandle, regardless of target type', () => {
    const nodes: CustomNode[] = [
      { id: 'gsa-1', type: 'toolNode', position: { x: 0, y: 0 }, data: { label: 'GSA', configType: 'Packet Tool', toolName: 'GigaSMART Appliance' } },
      { id: 's3-1', type: 'toolNode', position: { x: 200, y: 0 }, data: { label: 'S3', configType: 'Objects', toolName: 'S3 Object Storage' } },
    ];
    const metadataEdge: Edge = { id: 'e-meta', source: 'gsa-1', target: 's3-1', sourceHandle: 'metadata-out' };
    const packetEdge: Edge = { id: 'e-packet', source: 'gsa-1', target: 's3-1', sourceHandle: 'out' };
    const edges = [metadataEdge, packetEdge];

    expect(isMetadataEdge(metadataEdge, nodes, edges)).toBe(true);
    expect(isMetadataEdge(packetEdge, nodes, edges)).toBe(false);
  });
});
