import React from 'react';
import { FLOW_DIRECTION_OPTIONS, type FlowDirection } from '../../utils/flowDirection';

interface FlowDirectionControlProps {
  /** The shared direction, or null when the selection is mixed. */
  current: FlowDirection | null;
  onChange: (direction: FlowDirection) => void;
  hint: React.ReactNode;
}

/**
 * Segmented left-to-right / right-to-left / auto control. A null `current`
 * means the selection disagrees, and nothing is highlighted - so it is obvious
 * that clicking will change some nodes and not others.
 */
export const FlowDirectionControl: React.FC<FlowDirectionControlProps> = ({ current, onChange, hint }) => (
  <>
    <div style={{ display: 'flex', gap: '4px' }}>
      {FLOW_DIRECTION_OPTIONS.map((opt) => {
        const active = current === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            title={opt.title}
            style={{
              flex: 1,
              padding: '5px 4px',
              fontSize: '10px',
              fontWeight: active ? 700 : 500,
              background: active ? 'rgba(0, 229, 255, 0.15)' : 'var(--bg-tertiary, #1e1e1e)',
              border: `1px solid ${active ? 'var(--accent-cyan, #00e5ff)' : 'var(--border-color, #333)'}`,
              borderRadius: '4px',
              color: active ? 'var(--accent-cyan, #00e5ff)' : 'var(--text-secondary, #ccc)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
    <p style={{ margin: '6px 0 0 0', fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{hint}</p>
  </>
);
