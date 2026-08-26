import { describe, it, expect } from 'vitest';
import { getCandidateReplacementOptics, performOpticBulkReplace } from './opticBulkReplace';
import type { CustomNode } from '../store/store';
import type { Edge } from '@xyflow/react';

describe('opticBulkReplace', () => {
  describe('getCandidateReplacementOptics', () => {
    it('returns compatible SFP replacement optics for SFP-533 on TA25E', () => {
      const candidates = getCandidateReplacementOptics('GigaVUE-TA25E', 'SFP-533 (10G SFP+ LR)');
      expect(candidates.length).toBeGreaterThan(0);

      // Should include SFP-533T (TAA swap) and SFP-532 (MM swap)
      expect(candidates.some(c => c.startsWith('SFP-533T'))).toBe(true);
      expect(candidates.some(c => c.startsWith('SFP-532'))).toBe(true);

      // Should NOT include QSFP optics like Q28-502T
      expect(candidates.some(c => c.startsWith('Q28'))).toBe(false);
      // Should NOT include the exact source optic SFP-533 itself
      expect(candidates.some(c => c.startsWith('SFP-533 '))).toBe(false);
    });

    it('returns compatible QSFP replacement optics for Q28-502T on TA100', () => {
      const candidates = getCandidateReplacementOptics('GigaVUE-TA100', 'Q28-502T (100G QSFP28 SR4)');
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.some(c => c.startsWith('Q28-503'))).toBe(true);
      expect(candidates.some(c => c.startsWith('SFP'))).toBe(false);
    });
  });

  describe('performOpticBulkReplace', () => {
    const mockNodes: CustomNode[] = [
      {
        id: 'tap-1',
        type: 'hardwareNode',
        position: { x: 0, y: 0 },
        data: {
          label: 'G-TAP M Series TAP-M273T',
          configType: 'Hardware',
          model: 'G-TAP M Series TAP-M273T',
          sku: 'TAP-M273T',
          tappedLinksCount: 10,
          tappedLinkOptic: 'SFP-533',
          tapFiberMode: 'Singlemode',
          tappedLinkAllocations: [
            { qty: 10, optic: 'SFP-533' }
          ]
        }
      },
      {
        id: 'ta25e-1',
        type: 'hardwareNode',
        position: { x: 200, y: 0 },
        data: {
          label: 'GigaVUE-TA25E Nuuk',
          configType: 'Hardware',
          model: 'GigaVUE-TA25E',
          sku: 'TA25E-BASE',
          optics: [
            { board: 'Base Ports', optic: 'SFP-533 (10G SFP+ LR)', qty: 20 }
          ]
        }
      }
    ];

    const mockEdges: Edge[] = [
      {
        id: 'edge-1',
        source: 'tap-1',
        target: 'ta25e-1'
      }
    ];

    it('replaces SFP-533 with SFP-533T (same SM fiber mode) and updates connected TAP optic', () => {
      const result = performOpticBulkReplace(mockNodes, mockEdges, {
        targetNodeId: 'ta25e-1',
        sourceOptic: 'SFP-533 (10G SFP+ LR)',
        targetOptic: 'SFP-533T (10G SFP+ LR TAA)',
        syncConnectedTaps: true
      });

      expect(result.replacedChassisOpticCount).toBe(20);
      expect(result.updatedTapCount).toBe(1);
      expect(result.fiberModeChanged).toBe(false);

      const updatedChassis = result.updatedNodes.find(n => n.id === 'ta25e-1');
      expect(updatedChassis?.data.optics?.some((o: any) => o.optic.includes('SFP-533T'))).toBe(true);

      const updatedTap = result.updatedNodes.find(n => n.id === 'tap-1');
      expect(updatedTap?.data.tappedLinkOptic).toBe('SFP-533T');
      expect((updatedTap?.data.tappedLinkAllocations as any[])[0].optic).toBe('SFP-533T');
      // TAP SKU stays TAP-M273T because SM fiber mode was unchanged
      expect(updatedTap?.data.sku).toBe('TAP-M273T');
    });

    it('replaces SFP-533 (SM) with SFP-532 (MM) and converts connected TAP to Multimode TAP-M253T', () => {
      const result = performOpticBulkReplace(mockNodes, mockEdges, {
        targetNodeId: 'ta25e-1',
        sourceOptic: 'SFP-533 (10G SFP+ LR)',
        targetOptic: 'SFP-532 (10G SFP+ SR)',
        syncConnectedTaps: true
      });

      expect(result.replacedChassisOpticCount).toBe(20);
      expect(result.updatedTapCount).toBe(1);
      expect(result.fiberModeChanged).toBe(true);
      expect(result.sourceFiberMode).toBe('SM');
      expect(result.targetFiberMode).toBe('MM');

      const updatedTap = result.updatedNodes.find(n => n.id === 'tap-1');
      expect(updatedTap?.data.tappedLinkOptic).toBe('SFP-532');
      expect((updatedTap?.data.tappedLinkAllocations as any[])[0].optic).toBe('SFP-532');
      // Converted to Multimode TAP-M253T
      expect(updatedTap?.data.sku).toBe('TAP-M253T');
      expect(updatedTap?.data.tapFiberMode).toBe('Multimode');
    });
  });
});
