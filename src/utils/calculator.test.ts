import { describe, it, expect } from 'vitest';
import {
  sanitizeNumber,
  clamp,
  calculateDeduplication,
  calculatePacketSlicing,
  calculateSslDecryption,
  calculateHeaderStripping,
  calculateMetadataGeneration,
  calculateGtpSampling,
  calculateGtpWhitelisting,
  calculateLoadBalancing,
  calculatePacketsPerSecond,
  calculateBandwidthUtilization,
} from './calculator';

describe('Calculator Core Math Engine', () => {
  describe('sanitizeNumber & clamp utilities', () => {
    it('handles nominal numbers', () => {
      expect(sanitizeNumber(100)).toBe(100);
      expect(sanitizeNumber(0)).toBe(0);
      expect(sanitizeNumber(-50, 0, true)).toBe(-50);
    });

    it('sanitizes invalid inputs gracefully', () => {
      expect(sanitizeNumber(null)).toBe(0);
      expect(sanitizeNumber(undefined)).toBe(0);
      expect(sanitizeNumber(NaN)).toBe(0);
      expect(sanitizeNumber(Infinity)).toBe(0);
      expect(sanitizeNumber(-100)).toBe(0);
      expect(sanitizeNumber('123')).toBe(123);
      expect(sanitizeNumber('invalid_string', 10)).toBe(10);
    });

    it('clamps values correctly', () => {
      expect(clamp(50, 0, 100)).toBe(50);
      expect(clamp(-10, 0, 100)).toBe(0);
      expect(clamp(150, 0, 100)).toBe(100);
    });
  });

  describe('calculateDeduplication', () => {
    it('calculates nominal 20% deduplication on 10,000 Mbps stream', () => {
      const result = calculateDeduplication(10000, 20);
      expect(result.passedBandwidthMbps).toBe(8000);
      expect(result.droppedBandwidthMbps).toBe(2000);
      expect(result.dedupRatio).toBe(0.2);
      expect(result.txPacketsPerSec).toBe(8000 * 250);
      expect(result.droppedPacketsPerSec).toBe(2000 * 250);
    });

    it('handles 0% deduplication (no drops)', () => {
      const result = calculateDeduplication(5000, 0);
      expect(result.passedBandwidthMbps).toBe(5000);
      expect(result.droppedBandwidthMbps).toBe(0);
      expect(result.dedupRatio).toBe(0);
    });

    it('handles 100% deduplication (all dropped)', () => {
      const result = calculateDeduplication(5000, 100);
      expect(result.passedBandwidthMbps).toBe(0);
      expect(result.droppedBandwidthMbps).toBe(5000);
      expect(result.dedupRatio).toBe(1.0);
    });

    it('handles boundary and invalid values safely', () => {
      expect(calculateDeduplication(0).passedBandwidthMbps).toBe(0);
      expect(calculateDeduplication(-1000).passedBandwidthMbps).toBe(0);
      expect(calculateDeduplication(1000, 150).passedBandwidthMbps).toBe(0); // clamped to 100%
      expect(calculateDeduplication(1000, -20).passedBandwidthMbps).toBe(1000); // clamped to 0%
      expect(calculateDeduplication(null, undefined).passedBandwidthMbps).toBe(0);
    });
  });

  describe('calculatePacketSlicing', () => {
    it('calculates nominal slicing to 128 bytes on 1518 byte MTU', () => {
      const result = calculatePacketSlicing(10000, 128, 1518);
      const expectedRatio = 128 / 1518;
      expect(result.slicingRatio).toBeCloseTo(expectedRatio, 5);
      expect(result.slicedBandwidthMbps).toBeCloseTo(10000 * expectedRatio, 2);
      expect(result.savedBandwidthMbps).toBeCloseTo(10000 * (1 - expectedRatio), 2);
      expect(result.txPacketsPerSec).toBe(10000 * 250);
    });

    it('handles minimum ratio clamp (0.01)', () => {
      const result = calculatePacketSlicing(1000, 5, 1518);
      expect(result.slicingRatio).toBe(0.01);
      expect(result.slicedBandwidthMbps).toBe(10);
    });

    it('handles slice size larger than MTU (clamps to 1.0)', () => {
      const result = calculatePacketSlicing(1000, 2000, 1518);
      expect(result.slicingRatio).toBe(1.0);
      expect(result.slicedBandwidthMbps).toBe(1000);
      expect(result.savedBandwidthMbps).toBe(0);
    });

    it('handles invalid/edge inputs', () => {
      expect(calculatePacketSlicing(0).slicedBandwidthMbps).toBe(0);
      expect(calculatePacketSlicing(null, null, null).slicedBandwidthMbps).toBe(0);
    });
  });

  describe('calculateSslDecryption', () => {
    it('calculates 60% decryption split on 10,000 Mbps encrypted stream', () => {
      const result = calculateSslDecryption(10000, true, 60);
      expect(result.decryptedBandwidthMbps).toBe(6000);
      expect(result.encryptedPassthroughBandwidthMbps).toBe(4000);
      expect(result.totalTxBandwidthMbps).toBe(10000);
      expect(result.decryptionRatio).toBe(0.6);
    });

    it('passes cleartext without decryption if unencrypted', () => {
      const result = calculateSslDecryption(10000, false, 60);
      expect(result.decryptedBandwidthMbps).toBe(0);
      expect(result.encryptedPassthroughBandwidthMbps).toBe(0);
      expect(result.totalTxBandwidthMbps).toBe(10000);
    });

    it('handles 100% and 0% decryption bounds', () => {
      const full = calculateSslDecryption(1000, true, 100);
      expect(full.decryptedBandwidthMbps).toBe(1000);
      expect(full.encryptedPassthroughBandwidthMbps).toBe(0);

      const none = calculateSslDecryption(1000, true, 0);
      expect(none.decryptedBandwidthMbps).toBe(0);
      expect(none.encryptedPassthroughBandwidthMbps).toBe(1000);
    });
  });

  describe('calculateHeaderStripping', () => {
    it('calculates standard protocols (VXLAN, ERSPAN, GTP-U, MPLS, VLAN)', () => {
      expect(calculateHeaderStripping(1000, 'VXLAN').strippedBandwidthMbps).toBe(950);
      expect(calculateHeaderStripping(1000, 'ERSPAN').strippedBandwidthMbps).toBe(955);
      expect(calculateHeaderStripping(1000, 'GTP-U').strippedBandwidthMbps).toBe(960);
      expect(calculateHeaderStripping(1000, 'MPLS').strippedBandwidthMbps).toBe(985);
      expect(calculateHeaderStripping(1000, 'VLAN').strippedBandwidthMbps).toBe(992);
    });

    it('handles custom header strip rate', () => {
      const result = calculateHeaderStripping(1000, 'Custom', 10);
      expect(result.strippedBandwidthMbps).toBe(900);
      expect(result.removedHeaderBandwidthMbps).toBe(100);
    });
  });

  describe('calculateMetadataGeneration', () => {
    it('calculates AMI/AMX standard 1.5% scale', () => {
      const amx = calculateMetadataGeneration(10000, 'AMX');
      expect(amx.metadataBandwidthMbps).toBe(150);
      expect(amx.metadataScale).toBe(0.015);

      const ami = calculateMetadataGeneration(10000, 'AMI');
      expect(ami.metadataBandwidthMbps).toBe(150);
    });

    it('calculates generic Application Metadata standard 3.0% scale', () => {
      const result = calculateMetadataGeneration(10000, 'Application Metadata');
      expect(result.metadataBandwidthMbps).toBe(300);
      expect(result.metadataScale).toBe(0.03);
    });

    it('supports custom metadata percentage and format', () => {
      const result = calculateMetadataGeneration(10000, 'AMX', 5, 'JSON');
      expect(result.metadataBandwidthMbps).toBe(500);
      expect(result.format).toBe('JSON');
    });
  });

  describe('calculateGtpSampling & calculateGtpWhitelisting', () => {
    it('calculates GTP Flow sampling nominal 10%', () => {
      const result = calculateGtpSampling(10000, 10);
      expect(result.sampledBandwidthMbps).toBe(1000);
      expect(result.droppedBandwidthMbps).toBe(9000);
      expect(result.sampleRatio).toBe(0.1);
    });

    it('calculates GTP Whitelisting nominal 25%', () => {
      const result = calculateGtpWhitelisting(10000, 25);
      expect(result.sampledBandwidthMbps).toBe(2500);
      expect(result.droppedBandwidthMbps).toBe(7500);
    });
  });

  describe('calculateLoadBalancing', () => {
    it('splits bandwidth evenly across link count', () => {
      const result = calculateLoadBalancing(10000, 4);
      expect(result.bandwidthPerLinkMbps).toBe(2500);
      expect(result.linkCount).toBe(4);
    });

    it('clamps minimum link count to 1', () => {
      const result = calculateLoadBalancing(10000, 0);
      expect(result.linkCount).toBe(1);
      expect(result.bandwidthPerLinkMbps).toBe(10000);
    });
  });

  describe('calculatePacketsPerSecond', () => {
    it('calculates default 250 packets/sec per Mbps', () => {
      expect(calculatePacketsPerSecond(100)).toBe(25000);
    });

    it('calculates custom average packet size PPS', () => {
      // 100 Mbps with 1500 byte packet size = (100 * 1,000,000) / (1500 * 8) = 8333.33 pps
      expect(calculatePacketsPerSecond(100, 1500)).toBeCloseTo(8333.33, 1);
    });
  });

  describe('calculateBandwidthUtilization', () => {
    it('calculates normal utilisation and headroom', () => {
      const result = calculateBandwidthUtilization(40000, 100000);
      expect(result.utilizationPercent).toBe(40);
      expect(result.headroomMbps).toBe(60000);
      expect(result.isSaturated).toBe(false);
    });

    it('detects saturated links at or over 100% capacity', () => {
      const saturated = calculateBandwidthUtilization(100000, 100000);
      expect(saturated.utilizationPercent).toBe(100);
      expect(saturated.headroomMbps).toBe(0);
      expect(saturated.isSaturated).toBe(true);

      const over = calculateBandwidthUtilization(120000, 100000);
      expect(over.utilizationPercent).toBe(120);
      expect(over.isSaturated).toBe(true);
    });

    it('handles 0 capacity gracefully', () => {
      const result = calculateBandwidthUtilization(1000, 0);
      expect(result.utilizationPercent).toBe(0);
      expect(result.isSaturated).toBe(false);
    });
  });
});
