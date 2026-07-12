import { describe, it, expect } from 'vitest';
import { syncOpticsOnTapConnection, validateConfiguration } from './bomEngine';
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
      expect(hcNode?.data.optics?.some((o: any) => o.optic === 'SFP-532' && o.isAutoAdded)).toBe(true);
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
  });
});
