import { describe, it, expect } from 'vitest';
import { autoDeployRack, clearRackDeploy, getDeviceHierarchyRank } from './autoRack';
import type { CustomNode, HardwareNodeData } from '../store/types';

const makeHwNode = (
  id: string,
  model: string,
  sku?: string,
  site?: string,
  extraData?: Partial<HardwareNodeData>
): CustomNode => ({
  id,
  type: 'hardwareNode',
  position: { x: 0, y: 0 },
  data: {
    label: id,
    model,
    sku: sku || model,
    configType: 'Hardware',
    site,
    ...extraData,
  } as HardwareNodeData,
});

describe('autoRack', () => {
  describe('getDeviceHierarchyRank', () => {
    it('ranks heavy modular chassis at the bottom (lower rank numbers)', () => {
      const hc3Rank = getDeviceHierarchyRank('GigaVUE-HC3');
      const hc2Rank = getDeviceHierarchyRank('GigaVUE-HC2');
      const ta400Rank = getDeviceHierarchyRank('GigaVUE-TA400');
      const ta200Rank = getDeviceHierarchyRank('GigaVUE-TA200');
      const hc1Rank = getDeviceHierarchyRank('GigaVUE-HC1');
      const ta25Rank = getDeviceHierarchyRank('GigaVUE-TA25');
      const trayRank = getDeviceHierarchyRank('TAP-M200T');

      expect(hc3Rank).toBeLessThan(hc2Rank);
      expect(hc2Rank).toBeLessThan(ta400Rank);
      expect(ta400Rank).toBeLessThan(ta200Rank);
      expect(ta200Rank).toBeLessThan(hc1Rank);
      expect(hc1Rank).toBeLessThan(ta25Rank);
      expect(ta25Rank).toBeLessThan(trayRank);
    });
  });

  describe('autoDeployRack', () => {
    it('slots TAP modules and breakout panels into site TAP trays and racks equipment from U1 upwards', () => {
      const nodes: CustomNode[] = [
        makeHwNode('hc3-1', 'GigaVUE-HC3', 'GVS-HC301', 'DC1'),
        makeHwNode('ta200-1', 'GigaVUE-TA200', 'TA-200', 'DC1'),
        makeHwNode('hc1-1', 'GigaVUE-HC1', 'GVS-HC101', 'DC1'),
        // 2 TAP modules requiring a tray
        makeHwNode('tap-mod-1', 'TAP-M253T', 'TAP-M253T', 'DC1'),
        makeHwNode('pnl-mod-1', 'PNL-M341T', 'PNL-M341T', 'DC1'),
      ];

      const deployed = autoDeployRack(nodes, 'DC1');

      // Check chassis placement
      const hc3 = deployed.find(n => n.id === 'hc3-1');
      const ta200 = deployed.find(n => n.id === 'ta200-1');
      const hc1 = deployed.find(n => n.id === 'hc1-1');

      expect(hc3?.data?.rackId).toBe('rack_DC1');
      expect(hc3?.data?.rackU).toBe(1); // 3U, takes U1..U3

      expect(ta200?.data?.rackId).toBe('rack_DC1');
      expect(ta200?.data?.rackU).toBe(4); // 1U, takes U4

      expect(hc1?.data?.rackId).toBe('rack_DC1');
      expect(hc1?.data?.rackU).toBe(5); // 1U, takes U5

      // Check that a tray was synced and racked above the active chassis
      const tray = deployed.find(n => n.data?.model === 'TAP-M100T');
      expect(tray).toBeDefined();
      expect(tray?.data?.rackId).toBe('rack_DC1');
      expect(tray?.data?.rackU).toBe(6);

      // Check that tap modules were slotted into tray bays
      const tapMod1 = deployed.find(n => n.id === 'tap-mod-1');
      const pnlMod1 = deployed.find(n => n.id === 'pnl-mod-1');

      expect(tapMod1?.data?.trayId).toBe(tray?.id);
      expect(tapMod1?.data?.traySlot).toBe(1);
      expect(tapMod1?.data?.rackId).toBeUndefined();

      expect(pnlMod1?.data?.trayId).toBe(tray?.id);
      expect(pnlMod1?.data?.traySlot).toBe(2);
      expect(pnlMod1?.data?.rackId).toBeUndefined();
    });

    it('only deploys nodes matching the requested site', () => {
      const nodes: CustomNode[] = [
        makeHwNode('dc1-hc1', 'GigaVUE-HC1', 'GVS-HC101', 'DC1'),
        makeHwNode('dc2-hc1', 'GigaVUE-HC1', 'GVS-HC101', 'DC2'),
      ];

      const deployed = autoDeployRack(nodes, 'DC1');

      const dc1Node = deployed.find(n => n.id === 'dc1-hc1');
      const dc2Node = deployed.find(n => n.id === 'dc2-hc1');

      expect(dc1Node?.data?.rackId).toBe('rack_DC1');
      expect(dc1Node?.data?.rackU).toBe(1);

      expect(dc2Node?.data?.rackId).toBeUndefined();
      expect(dc2Node?.data?.rackU).toBeUndefined();
    });
  });

  describe('clearRackDeploy', () => {
    it('clears rackU, rackId, trayId, and traySlot for the specified site', () => {
      const nodes: CustomNode[] = [
        makeHwNode('dc1-hc1', 'GigaVUE-HC1', 'GVS-HC101', 'DC1', {
          rackId: 'rack_DC1',
          rackU: 10,
        }),
        makeHwNode('dc1-mod', 'TAP-M253T', 'TAP-M253T', 'DC1', {
          trayId: 'tray-1',
          traySlot: 2,
        }),
        makeHwNode('dc2-hc1', 'GigaVUE-HC1', 'GVS-HC101', 'DC2', {
          rackId: 'rack_DC2',
          rackU: 5,
        }),
      ];

      const cleared = clearRackDeploy(nodes, 'DC1');

      const dc1Chassis = cleared.find(n => n.id === 'dc1-hc1');
      const dc1Mod = cleared.find(n => n.id === 'dc1-mod');
      const dc2Chassis = cleared.find(n => n.id === 'dc2-hc1');

      expect(dc1Chassis?.data?.rackId).toBeUndefined();
      expect(dc1Chassis?.data?.rackU).toBeUndefined();
      expect(dc1Mod?.data?.trayId).toBeUndefined();
      expect(dc1Mod?.data?.traySlot).toBeUndefined();

      // DC2 remains intact
      expect(dc2Chassis?.data?.rackId).toBe('rack_DC2');
      expect(dc2Chassis?.data?.rackU).toBe(5);
    });
  });
});
