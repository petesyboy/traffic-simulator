import { describe, it, expect } from 'vitest';
import type { CustomNode } from '../store/types';
import {
  getInputFeedCage,
  getInputFeedMedia,
  getInputFeedSpeed,
  isPacketFeedInput,
  resolveInputFeedOptic,
} from './inputFeedOptics';
import { syncOpticsOnTapConnection } from './bomEngine';
import { deriveChassisRequiredOptics } from './opticReallocation';
import { getOpticSpeed } from './hardwareUtils';

const spanNode = (overrides: Record<string, unknown> = {}): CustomNode => ({
  id: 'span-1',
  type: 'inputNode',
  position: { x: 0, y: 0 },
  data: { label: 'SPAN Port 1/1/x1', configType: 'SPAN', portSpeed: '400G', spanFiberMode: 'Multimode (SR)', ...overrides },
});

const chassis = (model: string, data: Record<string, unknown> = {}): CustomNode => ({
  id: 'chassis-1',
  type: 'hardwareNode',
  position: { x: 300, y: 0 },
  data: { label: model, configType: 'Chassis', model, optics: [], ...data },
});

const edge = { id: 'e1', source: 'span-1', target: 'chassis-1' };

describe('inputFeedOptics', () => {
  describe('classification', () => {
    it('treats SPAN/ERSPAN/East-West/VMware inputs as packet feeds, but not the TAP form', () => {
      expect(isPacketFeedInput(spanNode())).toBe(true);
      expect(isPacketFeedInput(spanNode({ configType: 'ERSPAN' }))).toBe(true);
      expect(isPacketFeedInput(spanNode({ configType: 'East/West' }))).toBe(true);
      expect(isPacketFeedInput(spanNode({ configType: 'VMWare' }))).toBe(true);
      expect(isPacketFeedInput(spanNode({ configType: 'TAP' }))).toBe(false);
    });

    it('reads the configured port speed, falling back to linkSpeed and then 10G', () => {
      expect(getInputFeedSpeed(spanNode())).toBe('400G');
      expect(getInputFeedSpeed(spanNode({ portSpeed: '25G' }))).toBe('25G');
      // Legacy nodes predate the Port Speed dropdown: round up to a real port speed.
      expect(getInputFeedSpeed(spanNode({ portSpeed: undefined, linkSpeed: 100000 }))).toBe('100G');
      expect(getInputFeedSpeed(spanNode({ portSpeed: undefined, linkSpeed: 15000 }))).toBe('25G');
      expect(getInputFeedSpeed(spanNode({ portSpeed: undefined }))).toBe('10G');
    });

    it('reads the configured media, defaulting to multimode', () => {
      expect(getInputFeedMedia(spanNode())).toBe('MM');
      expect(getInputFeedMedia(spanNode({ spanFiberMode: 'Singlemode (LR)' }))).toBe('SM');
      expect(getInputFeedMedia(spanNode({ spanFiberMode: 'Direct Attach Copper (DAC)' }))).toBe('Copper');
      expect(getInputFeedMedia(spanNode({ spanFiberMode: '10GBASE-T Copper' }))).toBe('Copper');
      expect(getInputFeedMedia(spanNode({ spanFiberMode: undefined }))).toBe('MM');
    });

    it('puts 40G and faster feeds in a QSFP cage and slower ones in an SFP cage', () => {
      expect(getInputFeedCage(spanNode())).toBe('QSFP');
      expect(getInputFeedCage(spanNode({ portSpeed: '100G' }))).toBe('QSFP');
      expect(getInputFeedCage(spanNode({ portSpeed: '25G' }))).toBe('SFP');
    });
  });

  describe('resolveInputFeedOptic', () => {
    it('fits a 400G QSFP-DD for a 400G SPAN session into a TA400 - not a 10G SFP', () => {
      const optic = resolveInputFeedOptic(spanNode(), 'GigaVUE-TA400');
      expect(optic.startsWith('QDD-')).toBe(true);
      expect(getOpticSpeed(optic)).toBe('400G');
    });

    it('honours the configured media', () => {
      expect(resolveInputFeedOptic(spanNode(), 'GigaVUE-TA400')).toContain('SR4');
      expect(resolveInputFeedOptic(spanNode({ spanFiberMode: 'Singlemode (LR)' }), 'GigaVUE-TA400')).toContain('LR4');
    });

    it('resolves lower speeds against what the chassis supports', () => {
      const tenGig = resolveInputFeedOptic(spanNode({ portSpeed: '10G' }), 'GigaVUE-HC1');
      expect(getOpticSpeed(tenGig)).toBe('10G');

      const hundredGig = resolveInputFeedOptic(spanNode({ portSpeed: '100G' }), 'GigaVUE-TA400');
      expect(getOpticSpeed(hundredGig)).toBe('100G');
    });

    it('steps down to the fastest supported speed when the chassis cannot run the configured one', () => {
      // A TA400 licensed for 100G ports only has its 400G optics filtered out.
      const optic = resolveInputFeedOptic(spanNode(), 'GigaVUE-TA400', '100G');
      expect(getOpticSpeed(optic)).toBe('100G');
    });

    it('keeps the speed when the chassis has no optic in the requested media', () => {
      // A TA400 is optical-only, so a DAC/copper SPAN still gets a 400G part.
      const optic = resolveInputFeedOptic(spanNode({ spanFiberMode: 'Direct Attach Copper (DAC)' }), 'GigaVUE-TA400');
      expect(getOpticSpeed(optic)).toBe('400G');
    });

    it('returns nothing for a model with no optic rules', () => {
      expect(resolveInputFeedOptic(spanNode(), 'Not-A-Real-Model')).toBe('');
    });
  });

  describe('provisioning on connection', () => {
    it('auto-fits one 400G optic on the TA400 for a 400G SPAN feed', () => {
      const nodes = [spanNode(), chassis('GigaVUE-TA400')];
      const optics = syncOpticsOnTapConnection(nodes, [edge]).find(n => n.id === 'chassis-1')?.data.optics;

      expect(optics).toHaveLength(1);
      expect(optics?.[0].qty).toBe(1);
      expect(getOpticSpeed(optics![0].optic)).toBe('400G');
    });

    it('tags the ingress optic so a SPAN-only quote never halves it', () => {
      const nodes = [spanNode(), chassis('GigaVUE-TA400')];
      const optics = syncOpticsOnTapConnection(nodes, [edge]).find(n => n.id === 'chassis-1')?.data.optics;

      expect(optics?.[0].isAutoAdded).toBe(true);
      expect(optics?.[0].autoPurpose).toBe('ingress');
    });

    it('fits one optic per feed, not a north/south pair as a tapped link would', () => {
      const nodes = [
        spanNode(),
        { ...spanNode(), id: 'span-2' },
        chassis('GigaVUE-TA400'),
      ];
      const edges = [edge, { id: 'e2', source: 'span-2', target: 'chassis-1' }];
      const optics = syncOpticsOnTapConnection(nodes, edges).find(n => n.id === 'chassis-1')?.data.optics;

      expect(optics).toHaveLength(1);
      expect(optics?.[0].qty).toBe(2);
    });

    it('counts the feed as a required optic when a chassis is reallocated', () => {
      const nodes = [spanNode(), chassis('GigaVUE-TA400')];
      const required = deriveChassisRequiredOptics(nodes[1], nodes, [edge]);

      expect(required).toHaveLength(1);
      expect(required[0].purpose).toBe('ingress');
      expect(required[0].cage).toBe('QSFP');
      expect(getOpticSpeed(required[0].optic)).toBe('400G');
    });
  });
});
