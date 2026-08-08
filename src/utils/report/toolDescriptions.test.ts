import { describe, it, expect } from 'vitest';
import { describeToolPurpose, describeToolOverloadRisk, TOOL_PURPOSE_DESCRIPTIONS } from './toolDescriptions';

describe('describeToolPurpose', () => {
  it('returns the catalogued sentence for a known tool', () => {
    expect(describeToolPurpose('Splunk')).toContain('SIEM');
  });

  it('falls back to a generic sentence for an unlisted/custom tool', () => {
    expect(describeToolPurpose('My Custom Tool')).toBe(
      'Monitors and analyses the traffic it receives to detect threats, measure performance, or support investigations.',
    );
  });

  it('falls back to a generic sentence when no tool name is given', () => {
    expect(describeToolPurpose(undefined)).toBe(
      'Monitors and analyses the traffic it receives to detect threats, measure performance, or support investigations.',
    );
  });

  it('has an entry for all 19 built-in catalogue tools (14 packet + 4 metadata + 1 objects)', () => {
    expect(Object.keys(TOOL_PURPOSE_DESCRIPTIONS)).toHaveLength(19);
  });
});

describe('describeToolOverloadRisk', () => {
  it('uses the catalogue default ingest limit and appliance model for a known tool', () => {
    const text = describeToolOverloadRisk('Vectra');
    expect(text).toContain('50.00 Gbps');
    expect(text).toContain('S101 Sensor');
    expect(text).toContain('dropped packets');
  });

  it('prefers the node-level ingest limit over the catalogue default when both are set', () => {
    const text = describeToolOverloadRisk('Vectra', 2000);
    expect(text).toContain('2.00 Gbps');
    expect(text).not.toContain('50.00 Gbps');
  });

  it('falls back to a soft generic sentence for a tool with no modelled ingest profile', () => {
    const text = describeToolOverloadRisk('Splunk');
    expect(text).toContain('falls behind');
  });

  it('falls back to the soft generic sentence when no tool name is given and no override is set', () => {
    const text = describeToolOverloadRisk(undefined);
    expect(text).toContain('falls behind');
  });
});
