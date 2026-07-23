import { describe, it, expect } from 'vitest';
import { syncOpticsOnTapConnection, validateConfiguration, setMockSkusMetadata } from './bomEngine';
import { type CustomNode } from '../store/types';

describe('BOM Engine', () => {
  describe('syncOpticsOnTapConnection', () => {
    it('should add auto-added optics when a TAP is connected', () => {
      const nodes: CustomNode[] = [
        {
          id: 'tap-1',
          type: 'inputNode',
          position: { x: 0, y: 0 },
          data: { label: 'TAP', configType: 'TAP', tapFiberMode: 'Multimode', tappedLinksCount: 1 }
        },
        {
          id: 'hc-1',
          type: 'hardwareNode',
          position: { x: 200, y: 0 },
          data: { label: 'HC1', configType: 'HC', model: 'GigaVUE-HC1', optics: [] }
        }
      ];
      const edges = [{ id: 'e1', source: 'tap-1', target: 'hc-1' }];
      
      const syncedNodes = syncOpticsOnTapConnection(nodes, edges);
      const hcNode = syncedNodes.find(n => n.id === 'hc-1');
      
      expect(hcNode?.data.optics).toBeDefined();
      expect(hcNode?.data.optics?.some((o: any) => o.optic.includes('SFP-532') && o.isAutoAdded)).toBe(true);
    });

    it('should auto-add resolved TAA copper optic SFP-501T (1G SFP Copper) when 3 copper links are tapped to TA25E', () => {
      const nodes: CustomNode[] = [
        {
          id: 'tap-1',
          type: 'hardwareNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'Active Copper TAP',
            configType: 'TAP',
            model: 'TAP-A-TX2',
            sku: 'TAP-A-TX2',
            tappedLinksCount: 3,
            tappedLinkOptic: '1G-SFP-CU',
            tappedLinkAllocations: [{ qty: 3, optic: '1G-SFP-CU' }]
          }
        },
        {
          id: 'ta25e-1',
          type: 'hardwareNode',
          position: { x: 200, y: 0 },
          data: { label: 'TA25E', configType: 'TA', model: 'GigaVUE-TA25E', optics: [] }
        }
      ];
      const edges = [{ id: 'e1', source: 'tap-1', target: 'ta25e-1' }];

      const syncedNodes = syncOpticsOnTapConnection(nodes, edges);
      const taNode = syncedNodes.find(n => n.id === 'ta25e-1');

      expect(taNode?.data.optics).toBeDefined();
      expect(taNode?.data.optics?.length).toBe(1);
      expect(taNode?.data.optics?.[0]).toEqual({
        board: 'Base Ports',
        optic: 'SFP-501T (1G SFP Copper)',
        qty: 6,
        isAutoAdded: true
      });
    });

    it('should resolve a fully descriptive optic string (not a bare SKU) and the correct board name for a GigaVUE-HC1, whose base board is not literally named "Base Ports"', () => {
      const nodes: CustomNode[] = [
        {
          id: 'tap-1',
          type: 'hardwareNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'M251T Module',
            configType: 'TAP',
            model: 'TAP-M251T',
            sku: 'TAP-M251T',
            tappedLinksCount: 2,
            tappedLinkAllocations: [
              { qty: 2, optic: 'Passive Optical Splitter (Multimode)', toolOptic: '10G-SFP-SR' }
            ]
          }
        },
        {
          id: 'hc-1',
          type: 'hardwareNode',
          position: { x: 200, y: 0 },
          data: { label: 'HC1', configType: 'HC', model: 'GigaVUE-HC1', optics: [] }
        }
      ];
      const edges = [{ id: 'e1', source: 'tap-1', target: 'hc-1' }];

      const syncedNodes = syncOpticsOnTapConnection(nodes, edges);
      const hcNode = syncedNodes.find(n => n.id === 'hc-1');

      // Bare "SFP-532T" (no parenthetical) fails downstream fiber-type classification
      // (getOpticFiberType), which caused a false "fiber mismatch" warning even though
      // the correct quantity (2 links x 2 = 4) was already being added.
      expect(hcNode?.data.optics?.[0]).toEqual({
        board: 'HC1-X12G4 (Main board)',
        optic: 'SFP-532T (10G SFP+ SR)',
        qty: 4,
        isAutoAdded: true
      });
    });

    it('should merge multiple TAP-M251T modules feeding the same chassis into a single optic line, not split/undercounted lines', () => {
      const nodes: CustomNode[] = [
        {
          id: 'tap-1',
          type: 'hardwareNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'M251T Module A',
            configType: 'TAP',
            model: 'TAP-M251T',
            sku: 'TAP-M251T',
            tappedLinksCount: 1,
            tappedLinkAllocations: [{ qty: 1, optic: '10G-SFP-SR' }]
          }
        },
        {
          id: 'tap-2',
          type: 'hardwareNode',
          position: { x: 0, y: 100 },
          data: {
            label: 'M251T Module B',
            configType: 'TAP',
            model: 'TAP-M251T',
            sku: 'TAP-M251T',
            tappedLinksCount: 5
            // No tappedLinkAllocations -> exercises the legacy fallback raw-optic string.
          }
        },
        {
          id: 'hc-1',
          type: 'hardwareNode',
          position: { x: 200, y: 0 },
          data: { label: 'HC1', configType: 'HC', model: 'GigaVUE-HC1', optics: [] }
        }
      ];
      const edges = [
        { id: 'e1', source: 'tap-1', target: 'hc-1' },
        { id: 'e2', source: 'tap-2', target: 'hc-1' }
      ];

      const syncedNodes = syncOpticsOnTapConnection(nodes, edges);
      const hcNode = syncedNodes.find(n => n.id === 'hc-1');
      const sfpLines = hcNode?.data.optics?.filter((o: any) => o.optic.includes('SFP-532')) || [];

      expect(sfpLines.length).toBe(1);
      expect(sfpLines[0].qty).toBe(12);
    });
  });

  describe('validateConfiguration', () => {
    it('should return error if GigaSMART node is not connected to HC', () => {
      const nodes: CustomNode[] = [
        {
          id: 'gs-1',
          type: 'gigaSmartNode',
          position: { x: 0, y: 0 },
          data: { label: 'Dedup', configType: 'GigaSMART', actionType: 'Deduplication' }
        }
      ];
      const errors = validateConfiguration(nodes, []);
      expect(errors.some(e => e.type === 'no_hc_for_gigasmart')).toBe(true);
    });

    it('should return error if SFP capacity is exceeded', () => {
      const nodes: CustomNode[] = [
        {
          id: 'hc-1',
          type: 'hardwareNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'HC1',
            configType: 'HC',
            model: 'GigaVUE-HC1',
            optics: [{ board: 'Base Ports', optic: 'SFP-532', qty: 20 }] // HC1 base has 12 SFP cages
          }
        }
      ];
      const errors = validateConfiguration(nodes, []);
      expect(errors.some(e => e.type === 'port_capacity_exceeded')).toBe(true);
    });

    it('should flag an error if an optic SKU is marked as End of Sale in skus_metadata', () => {
      setMockSkusMetadata({
        'SFP-532T': { eos: '2025-07-07', replacement: 'SFP-532T-Replacement' }
      });
      
      const nodes: CustomNode[] = [
        {
          id: 'hc-1',
          type: 'hardwareNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'HC1',
            configType: 'HC',
            model: 'GigaVUE-HC1',
            optics: [{ board: 'Base Ports', optic: 'SFP-532', qty: 2 }]
          }
        }
      ];
      const errors = validateConfiguration(nodes, []);
      expect(errors.some(e => e.type === 'eos_eol_sku_used' && e.message.includes('End of Sale') && e.message.includes('SFP-532T-Replacement'))).toBe(true);
      
      // Clean up mock
      setMockSkusMetadata(null);
    });
  });
});
