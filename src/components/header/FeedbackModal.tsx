/**
 * FeedbackModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal dialog enabling users to submit feedback, bug reports, and feature
 * suggestions directly to pete.connolly@gigamon.com.
 *
 * Supports launching the system email client via mailto: and copying formatted
 * feedback text to the clipboard for webmail users.
 */

import React, { useState } from 'react';
import pkg from '../../../package.json';
import { SUPPORT_EMAIL } from '../../constants/support';
import { isInternalEdition } from '../../constants/edition';
import { useStore } from '../../store/store';

export interface FeedbackModalProps {
  onClose: () => void;
}

type FeedbackCategory =
  | 'Feature Request'
  | 'Bug Report'
  | 'Enhancement / Suggestion'
  | 'Hardware / SKU Request'
  | 'Other';

const CATEGORIES: FeedbackCategory[] = [
  'Feature Request',
  'Bug Report',
  'Enhancement / Suggestion',
  'Hardware / SKU Request',
  'Other',
];

const FeedbackModal: React.FC<FeedbackModalProps> = ({ onClose }) => {
  const currentScenarioName = useStore((s) => s.currentScenarioName);
  const projectRegion = useStore((s) => s.projectRegion);
  const projectLicenseMode = useStore((s) => s.projectLicenseMode);
  const activeView = useStore((s) => s.activeView);
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);

  const [category, setCategory] = useState<FeedbackCategory>('Feature Request');
  const [subject, setSubject] = useState('');
  const [comments, setComments] = useState('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const buildDiagnosticText = (): string => {
    const edition = isInternalEdition() ? 'Gigamon Internal' : 'Partner Edition';
    return [
      'Diagnostic Information:',
      `• Application Version: v${pkg.version} (${edition})`,
      `• Project Name: ${currentScenarioName || 'Untitled Project'}`,
      `• Deployment Region: ${projectRegion}`,
      `• Licensing Mode: ${projectLicenseMode}`,
      `• Topology Summary: ${nodes.length} nodes, ${edges.length} connections (Active View: ${activeView})`,
      `• User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}`,
      `• Screen Viewport: ${typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'N/A'}`,
      `• Timestamp: ${new Date().toISOString()}`,
    ].join('\n');
  };

  const generateEmailContent = () => {
    const emailSubject = `[Gigamon Flow Mapping Designer] [${category}] ${subject.trim() || 'User Feedback'}`;

    const bodyParts: string[] = [
      `Category: ${category}`,
      `Summary: ${subject.trim() || 'N/A'}`,
      '',
      'Feedback & Comments:',
      comments.trim() || '(No additional comments provided)',
    ];

    if (includeDiagnostics) {
      bodyParts.push('', '──────────────────────────────────────────────────', buildDiagnosticText());
    }

    return {
      to: SUPPORT_EMAIL,
      subject: emailSubject,
      body: bodyParts.join('\n'),
    };
  };

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comments.trim() && !subject.trim()) {
      setErrorMessage('Please enter a brief summary or your comments before sending.');
      return;
    }
    setErrorMessage(null);

    const { to, subject: mailSubject, body } = generateEmailContent();
    const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(body)}`;

    window.location.href = mailtoUrl;
  };

  const handleCopyToClipboard = async () => {
    if (!comments.trim() && !subject.trim()) {
      setErrorMessage('Please enter a brief summary or your comments before copying.');
      return;
    }
    setErrorMessage(null);

    const { to, subject: mailSubject, body } = generateEmailContent();
    const clipboardText = `To: ${to}\nSubject: ${mailSubject}\n\n${body}`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(clipboardText);
      } else {
        // Fallback for older browsers / environments
        const textArea = document.createElement('textarea');
        textArea.value = clipboardText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopyStatus('✓ Copied email draft to clipboard!');
      setTimeout(() => setCopyStatus(null), 3500);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
      setErrorMessage('Unable to access clipboard. Please select and copy text manually.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        style={{
          width: '560px',
          maxWidth: '92vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex-between" style={{ borderBottom: '1px solid #333', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>💬</span>
            <h3 style={{ margin: 0, fontSize: '15px', color: '#ff9800', fontWeight: 'bold' }}>
              Send Feedback or Report an Issue
            </h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        {/* Introduction text */}
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Have an idea for improvement, a feature request, or an issue to report? Complete the form below to
          generate an email directly to{' '}
          <strong style={{ color: '#00e5ff' }}>{SUPPORT_EMAIL}</strong>.
        </p>

        {errorMessage && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid #ef4444',
              borderRadius: '4px',
              padding: '8px 12px',
              fontSize: '12px',
              color: '#fca5a5',
            }}
          >
            {errorMessage}
          </div>
        )}

        {copyStatus && (
          <div
            style={{
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid #22c55e',
              borderRadius: '4px',
              padding: '8px 12px',
              fontSize: '12px',
              color: '#86efac',
              fontWeight: 500,
            }}
          >
            {copyStatus}
          </div>
        )}

        <form onSubmit={handleSendEmail} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Feedback Category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
              className="sim-speed-select"
              style={{
                width: '100%',
                padding: '6px 10px',
                background: '#111',
                border: '1px solid #444',
                color: '#fff',
                borderRadius: '4px',
                fontSize: '12px',
              }}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Subject / Summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Summary / Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Corelight tooltip suggestion, or error when generating BOM"
              style={{
                width: '100%',
                padding: '8px 10px',
                background: '#111',
                border: '1px solid #444',
                color: '#fff',
                borderRadius: '4px',
                fontSize: '12px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Comments / Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Feedback Details & Comments
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Please describe what you would like fixed, added, or improved. Feel free to include reproduction steps or specific requirements..."
              rows={6}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: '#111',
                border: '1px solid #444',
                color: '#fff',
                borderRadius: '4px',
                fontSize: '12px',
                lineHeight: 1.5,
                resize: 'vertical',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Include Diagnostics Checkbox */}
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              fontSize: '12px',
              color: '#ccc',
              cursor: 'pointer',
              userSelect: 'none',
              background: '#18181b',
              padding: '8px 10px',
              borderRadius: '4px',
              border: '1px solid #27272a',
            }}
          >
            <input
              type="checkbox"
              checked={includeDiagnostics}
              onChange={(e) => setIncludeDiagnostics(e.target.checked)}
              style={{ marginTop: '2px', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontWeight: 500, color: '#e2e8f0' }}>
                Include application diagnostic details (recommended)
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Attaches app version (v{pkg.version}), edition, project topology counts, and browser environment to
                assist troubleshooting.
              </span>
            </div>
          </label>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              marginTop: '8px',
              paddingTop: '12px',
              borderTop: '1px solid #333',
            }}
          >
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '6px 14px',
                  cursor: 'pointer',
                }}
                title="Launch your system email client with this message pre-filled"
              >
                <span>✉️</span> Open Email Client
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCopyToClipboard}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#38bdf8',
                  borderColor: 'rgba(56, 189, 248, 0.4)',
                  padding: '6px 14px',
                  cursor: 'pointer',
                }}
                title="Copy formatted email to clipboard to paste into webmail (e.g. Gmail, Outlook 365)"
              >
                <span>📋</span> Copy to Clipboard
              </button>
            </div>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              style={{ fontSize: '12px', color: '#aaa', padding: '6px 12px' }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FeedbackModal;
