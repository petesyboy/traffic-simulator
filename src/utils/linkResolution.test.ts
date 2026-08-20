import { describe, it, expect } from 'vitest';
import { diagnoseLink, resolveLinkConnectionProblem, findBestMatchingOptic } from './linkResolution';
import type { CustomNode, HardwareNodeData } from '../store/types';
import { NODE_TYPES } from '../constants/nodeTypes';

describe('linkResolution', () => {
  it('prefers TAA compliant optic variants when resolving matching optics', () => {
    const match = findBestMatchingOptic('GigaVUE-TA25E', 'SFP-553 (25G SFP28 LR)');
    expect(match).toBeDefined();
    expect(match?.optic).toContain('SFP-553T');
  });

  it('detects missing optic on target chassis and resolves by fitting matching 25G TAA optic', () => {
    const nodeA: CustomNode = {
      id: 'ta-a',
      type: NODE_TYPES.HARDWARE,
      position: { x: 0, y: 0 },
      data: {
        label: 'Datacentre A (North)',
        model: 'GigaVUE-TA25E',
        sku: 'TA25E-BASE',
        optics: [{ board: 'Base Ports', optic: 'SFP-553T (25G SFP28 LR)', qty: 2 }],
      } as unknown as CustomNode['data'],
    };

    const nodeB: CustomNode = {
      id: 'ta-b',
      type: NODE_TYPES.HARDWARE,
      position: { x: 300, y: 0 },
      data: {
        label: 'Datacentre B (South)',
        model: 'GigaVUE-TA25E',
        sku: 'TA25E-BASE',
        optics: [], // No optics fitted
      } as unknown as CustomNode['data'],
    };

    const edge = {
      id: 'e-1',
      source: 'ta-a',
      target: 'ta-b',
      data: {
        portLinks: [{ sourcePortId: '1/1/x1', targetPortId: '', opticSku: 'SFP-553T (25G SFP28 LR)' }],
      },
    };

    // Diagnostic check
    const diag = diagnoseLink(edge, [nodeA, nodeB]);
    expect(diag.hasProblem).toBe(true);
    expect(diag.problemType).toBe('missing_target_optic');
    expect(diag.fixActionDescription).toContain('Auto-fit matching 25G');

    // Auto resolution
    const result = resolveLinkConnectionProblem(edge, [nodeA, nodeB], [edge]);
    expect(result.updatedNodes).toHaveLength(2);

    const updatedTarget = result.updatedNodes.find(n => n.id === 'ta-b');
    const targetOptics = (updatedTarget?.data as HardwareNodeData).optics;
    expect(targetOptics).toBeDefined();
    expect(targetOptics).toHaveLength(1);
    expect(targetOptics![0].optic).toContain('SFP-553T');

    // Re-diagnose
    const postDiag = diagnoseLink(result.updatedEdges[0], result.updatedNodes);
    expect(postDiag.hasProblem).toBe(false);
  });
});
