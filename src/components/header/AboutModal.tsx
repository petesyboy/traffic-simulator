/**
 * AboutModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Build information and recent release notes, opened by clicking the version
 * number in the header.
 */

import React from 'react';
import pkg from '../../../package.json';
import { CHANGELOG } from '../../constants/changelog';
import { SUPPORT_EMAIL } from '../../constants/support';

export interface AboutModalProps {
  onClose: () => void;
}

const RECENT_COUNT = 4;

const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div
      className="modal-card"
      style={{ width: '460px', maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex-between" style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', color: '#ff9800', fontWeight: 'bold' }}>
          About This Build
        </h3>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '12px' }}>
        <section>
          <div style={{ background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '14px', textAlign: 'center' }}>
            <strong style={{ color: '#00e5ff', fontSize: '28px', letterSpacing: '0.02em' }}>v{pkg.version}</strong>
          </div>
        </section>

        <section>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#00e5ff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recent Changes
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {CHANGELOG.slice(0, RECENT_COUNT).map(entry => (
              <div key={entry.version} style={{ background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '8px 10px' }}>
                <div className="flex-between" style={{ marginBottom: '3px' }}>
                  <strong style={{ color: '#ffb74d' }}>v{entry.version}</strong>
                  <span style={{ color: '#666', fontSize: '11px' }}>{entry.date}</span>
                </div>
                <div style={{ color: '#ccc', lineHeight: 1.45 }}>{entry.summary}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#00e5ff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Feedback
          </h4>
          <div style={{ background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '10px', color: '#ccc', lineHeight: 1.5 }}>
            Questions, bug reports or feature requests:{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: '#00e5ff' }}>{SUPPORT_EMAIL}</a>
          </div>
        </section>
      </div>
    </div>
  </div>
);

export default AboutModal;
