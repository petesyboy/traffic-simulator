/**
 * calculator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Core mathematical and traffic-sizing engine for the Gigamon Flow Mapping Simulator.
 *
 * Implements pure, isolated calculation functions for:
 * - Deduplication savings & packet reduction
 * - Packet slicing ratios & bandwidth saving
 * - SSL/TLS decryption offloading & passthrough splits
 * - Protocol header stripping (VXLAN, ERSPAN, GTP-U, MPLS, VLAN, Custom)
 * - Application Metadata (AMI / AMX / CEF / JSON) generation sizing
 * - GTP flow sampling & whitelisting
 * - Load balancing distributions
 * - Packet rates (PPS) and bandwidth utilisation / capacity sizing
 */

/** Helper to safely parse and sanitise numeric inputs against null, undefined, strings, NaN, or negative values. */
export function sanitizeNumber(value: unknown, defaultValue = 0, allowNegative = false): number {
  if (value === null || value === undefined) return defaultValue;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || Number.isNaN(num)) return defaultValue;
  if (!allowNegative && num < 0) return 0;
  return num;
}

/** Clamps a number between a minimum and maximum bound. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface DeduplicationResult {
  passedBandwidthMbps: number;
  droppedBandwidthMbps: number;
  dedupRatio: number; // 0.0 to 1.0
  txPacketsPerSec: number;
  droppedPacketsPerSec: number;
}

/**
 * Calculates deduplication traffic reduction.
 * Default dedup rate is 20% if unspecified.
 */
export function calculateDeduplication(bandwidthMbps: unknown, dedupRatePercent: unknown = 20): DeduplicationResult {
  const bw = sanitizeNumber(bandwidthMbps);
  const rate = clamp(sanitizeNumber(dedupRatePercent, 20), 0, 100);
  const dropFraction = rate / 100;

  const droppedBandwidth = bw * dropFraction;
  const passedBandwidth = bw - droppedBandwidth;

  return {
    passedBandwidthMbps: passedBandwidth,
    droppedBandwidthMbps: droppedBandwidth,
    dedupRatio: dropFraction,
    txPacketsPerSec: passedBandwidth * 250,
    droppedPacketsPerSec: droppedBandwidth * 250,
  };
}

export interface PacketSlicingResult {
  slicedBandwidthMbps: number;
  savedBandwidthMbps: number;
  slicingRatio: number; // Clamped 0.01 to 1.0
  txPacketsPerSec: number;
  droppedPacketsPerSec: number;
}

/**
 * Calculates packet slicing bandwidth reduction.
 * Standard Ethernet MTU baseline is 1518 bytes; default slice size is 128 bytes.
 * Packet count is preserved while payload bandwidth is reduced.
 */
export function calculatePacketSlicing(
  bandwidthMbps: unknown,
  sliceSizeBytes: unknown = 128,
  originalPacketSizeBytes: unknown = 1518,
): PacketSlicingResult {
  const bw = sanitizeNumber(bandwidthMbps);
  const sliceSize = sanitizeNumber(sliceSizeBytes, 128);
  const originalSize = Math.max(1, sanitizeNumber(originalPacketSizeBytes, 1518));

  const ratio = clamp(sliceSize / originalSize, 0.01, 1.0);
  const slicedBandwidth = bw * ratio;
  const savedBandwidth = bw - slicedBandwidth;

  return {
    slicedBandwidthMbps: slicedBandwidth,
    savedBandwidthMbps: savedBandwidth,
    slicingRatio: ratio,
    txPacketsPerSec: bw * 250,
    droppedPacketsPerSec: savedBandwidth * 250,
  };
}

export interface SslDecryptionResult {
  decryptedBandwidthMbps: number;
  encryptedPassthroughBandwidthMbps: number;
  decryptionRatio: number;
  totalTxBandwidthMbps: number;
}

/**
 * Calculates SSL/TLS decryption offloading split.
 * Default decryption rate is 60% of encrypted payload if unspecified.
 */
export function calculateSslDecryption(
  bandwidthMbps: unknown,
  isEncrypted = true,
  decryptionRatePercent: unknown = 60,
): SslDecryptionResult {
  const bw = sanitizeNumber(bandwidthMbps);
  if (!isEncrypted) {
    return {
      decryptedBandwidthMbps: 0,
      encryptedPassthroughBandwidthMbps: 0,
      decryptionRatio: 0,
      totalTxBandwidthMbps: bw,
    };
  }

  const rate = clamp(sanitizeNumber(decryptionRatePercent, 60), 0, 100);
  const decFraction = rate / 100;
  const decryptedBandwidth = bw * decFraction;
  const encryptedBandwidth = bw - decryptedBandwidth;

  return {
    decryptedBandwidthMbps: decryptedBandwidth,
    encryptedPassthroughBandwidthMbps: encryptedBandwidth,
    decryptionRatio: decFraction,
    totalTxBandwidthMbps: bw,
  };
}

export const HEADER_STRIP_PROTOCOL_SCALES: Record<string, number> = {
  VXLAN: 0.95,
  ERSPAN: 0.955,
  'GTP-U': 0.96,
  MPLS: 0.985,
  VLAN: 0.992,
};

export interface HeaderStrippingResult {
  strippedBandwidthMbps: number;
  removedHeaderBandwidthMbps: number;
  scaleFactor: number;
  droppedPacketsPerSec: number;
}

/**
 * Calculates header/trailer stripping bandwidth reduction across protocols.
 */
export function calculateHeaderStripping(
  bandwidthMbps: unknown,
  protocol = 'VXLAN',
  customRatePercent?: unknown,
): HeaderStrippingResult {
  const bw = sanitizeNumber(bandwidthMbps);
  let scale: number;

  if (protocol === 'Custom' || !HEADER_STRIP_PROTOCOL_SCALES[protocol]) {
    if (customRatePercent !== undefined && customRatePercent !== null) {
      const customRate = clamp(sanitizeNumber(customRatePercent, 6), 0, 100);
      scale = 1 - customRate / 100;
    } else {
      scale = 0.94;
    }
  } else {
    scale = HEADER_STRIP_PROTOCOL_SCALES[protocol];
  }

  scale = clamp(scale, 0, 1.0);
  const strippedBandwidth = bw * scale;
  const removedHeaderBandwidth = bw - strippedBandwidth;

  return {
    strippedBandwidthMbps: strippedBandwidth,
    removedHeaderBandwidthMbps: removedHeaderBandwidth,
    scaleFactor: scale,
    droppedPacketsPerSec: removedHeaderBandwidth * 250,
  };
}

export interface MetadataGenerationResult {
  metadataBandwidthMbps: number;
  droppedPayloadBandwidthMbps: number;
  metadataScale: number;
  format: 'CEF' | 'JSON';
}

/**
 * Sizing for Application Metadata Intelligence (AMI) and Application Metadata Extraction (AMX).
 * AMI/AMX defaults to 1.5% traffic volume; generic Application Metadata defaults to 3.0%.
 */
export function calculateMetadataGeneration(
  bandwidthMbps: unknown,
  actionType = 'Application Metadata',
  customRatePercent?: unknown,
  format: 'CEF' | 'JSON' = 'CEF',
): MetadataGenerationResult {
  const bw = sanitizeNumber(bandwidthMbps);
  let scale: number;

  if (customRatePercent !== undefined && customRatePercent !== null) {
    scale = clamp(sanitizeNumber(customRatePercent) / 100, 0, 1.0);
  } else {
    const isAmiAmx = actionType === 'AMX' || actionType === 'AMI';
    scale = isAmiAmx ? 0.015 : 0.03;
  }

  const metadataBandwidth = bw * scale;
  const droppedPayloadBandwidth = bw - metadataBandwidth;

  return {
    metadataBandwidthMbps: metadataBandwidth,
    droppedPayloadBandwidthMbps: droppedPayloadBandwidth,
    metadataScale: scale,
    format,
  };
}

export interface SamplingResult {
  sampledBandwidthMbps: number;
  droppedBandwidthMbps: number;
  sampleRatio: number;
  txPacketsPerSec: number;
}

/**
 * Calculates GTP Flow Sampling and IP FlowVUE sampling rates.
 */
export function calculateGtpSampling(bandwidthMbps: unknown, samplePercent: unknown = 10): SamplingResult {
  const bw = sanitizeNumber(bandwidthMbps);
  const rate = clamp(sanitizeNumber(samplePercent, 10), 0, 100) / 100;
  const sampledBandwidth = bw * rate;
  const droppedBandwidth = bw - sampledBandwidth;

  return {
    sampledBandwidthMbps: sampledBandwidth,
    droppedBandwidthMbps: droppedBandwidth,
    sampleRatio: rate,
    txPacketsPerSec: bw * 250 * rate,
  };
}

/**
 * Calculates GTP Whitelisting pass-through rates.
 */
export function calculateGtpWhitelisting(bandwidthMbps: unknown, passPercent: unknown = 25): SamplingResult {
  const bw = sanitizeNumber(bandwidthMbps);
  const rate = clamp(sanitizeNumber(passPercent, 25), 0, 100) / 100;
  const whitelistBandwidth = bw * rate;
  const droppedBandwidth = bw - whitelistBandwidth;

  return {
    sampledBandwidthMbps: whitelistBandwidth,
    droppedBandwidthMbps: droppedBandwidth,
    sampleRatio: rate,
    txPacketsPerSec: bw * 250 * rate,
  };
}

export interface LoadBalancingResult {
  totalBandwidthMbps: number;
  linkCount: number;
  bandwidthPerLinkMbps: number;
}

/**
 * Calculates equal distribution load balancing across egress port groups / tool links.
 */
export function calculateLoadBalancing(bandwidthMbps: unknown, linkCount: unknown = 2): LoadBalancingResult {
  const bw = sanitizeNumber(bandwidthMbps);
  const links = Math.max(1, Math.floor(sanitizeNumber(linkCount, 2)));

  return {
    totalBandwidthMbps: bw,
    linkCount: links,
    bandwidthPerLinkMbps: bw / links,
  };
}

/**
 * Calculates packets per second for a given bandwidth stream.
 * Standard default: 250 packets/sec per 1 Mbps (derived from ~500 byte average enterprise packet).
 */
export function calculatePacketsPerSecond(bandwidthMbps: unknown, avgPacketSizeBytes?: unknown): number {
  const bw = sanitizeNumber(bandwidthMbps);
  if (avgPacketSizeBytes !== undefined && avgPacketSizeBytes !== null) {
    const bytes = Math.max(1, sanitizeNumber(avgPacketSizeBytes, 500));
    return (bw * 1_000_000) / (bytes * 8);
  }
  return bw * 250;
}

export interface BandwidthUtilizationResult {
  currentMbps: number;
  maxCapacityMbps: number;
  utilizationPercent: number;
  headroomMbps: number;
  isSaturated: boolean;
}

/**
 * Calculates port/chassis bandwidth utilisation and headroom.
 */
export function calculateBandwidthUtilization(currentMbps: unknown, maxCapacityMbps: unknown): BandwidthUtilizationResult {
  const current = sanitizeNumber(currentMbps);
  const maxCap = Math.max(0, sanitizeNumber(maxCapacityMbps));

  const percent = maxCap > 0 ? (current / maxCap) * 100 : 0;
  const headroom = Math.max(0, maxCap - current);
  const isSaturated = maxCap > 0 && current >= maxCap;

  return {
    currentMbps: current,
    maxCapacityMbps: maxCap,
    utilizationPercent: percent,
    headroomMbps: headroom,
    isSaturated,
  };
}
