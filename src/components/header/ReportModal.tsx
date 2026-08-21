/**
 * ReportModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates a customer-facing PDF solution report: cover page, executive
 * summary, topology diagram, plain-English description of what's been built,
 * and a Bill of Materials appendix (plus a physical/rack appendix in Advanced
 * Mode). Generation is a multi-step async pipeline (diagram capture → BOM
 * computation → PDF build), so — unlike the one-click PNG screenshot export —
 * this needs a visible busy state and error surface, following the same
 * pattern as SkuUpdateModal.tsx.
 */
import React, { useState } from 'react';
import { useStore } from '../../store/store';
import { captureTopologyDiagramForReport } from '../../utils/report/captureTopologyDiagram';
import { captureChassisFrontPanelPng } from '../../utils/report/captureChassisFrontPanel';
import { buildReportDocDefinition } from '../../utils/report/buildReportDocDefinition';
import { NODE_TYPES } from '../../constants/nodeTypes';
import { getModuleSlotPositions, getChassisImagePath } from '../../utils/hardwareUtils';
import { resolveHardwareIcon } from '../../assets/hardwareIcons';
import type { HardwareNodeData } from '../../store/types';
import type { TDocumentDefinitions, TCreatedPdf } from 'pdfmake/interfaces';
import gigamonLogo from '../../assets/gigamon-logo.png';

export interface ReportModalProps {
  onClose: () => void;
}

interface PdfMakeStatic {
  createPdf: (documentDefinitions: TDocumentDefinitions) => TCreatedPdf;
  addVirtualFileSystem: (vfs: Record<string, string>) => void;
}

/**
 * pdfmake's browser build is CommonJS (`module.exports = {...}`) and, under
 * Vite's dev/prod bundling, only surfaces as a single `default` export — its
 * own @types package models it as named ESM exports instead, which doesn't
 * match what's actually on the module at runtime. Loaded lazily (only when
 * the user opens this modal) rather than as a module-level side effect, so a
 * loader mismatch here can't crash the whole app on startup.
 */
async function loadPdfMake(): Promise<PdfMakeStatic> {
  const pdfMakeModule = (await import('pdfmake/build/pdfmake')) as unknown as { default: PdfMakeStatic };
  const pdfFontsModule = (await import('pdfmake/build/vfs_fonts')) as unknown as { default: Record<string, string> };
  const pdfMake = pdfMakeModule.default;
  pdfMake.addVirtualFileSystem(pdfFontsModule.default);
  return pdfMake;
}

const fetchAsDataUrl = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const ReportModal: React.FC<ReportModalProps> = ({ onClose }) => {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const trafficStreams = useStore((s) => s.trafficStreams);
  const advancedMode = useStore((s) => s.advancedMode);
  const projectLicenseMode = useStore((s) => s.projectLicenseMode);
  const defaultTermDuration = useStore((s) => s.defaultTermDuration);
  const projectRegion = useStore((s) => s.projectRegion);
  const currentScenarioName = useStore((s) => s.currentScenarioName);
  const peakNodeRxMbps = useStore((s) => s.peakNodeRxMbps);
  const nodeMetrics = useStore((s) => s.nodeMetrics);
  const isRunning = useStore((s) => s.isRunning);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'idle' | 'capturing' | 'building' | 'done'>('idle');
  const [execSummaryText, setExecSummaryText] = useState('');

  const handleGenerate = async () => {
    setBusy(true);
    setError(null);
    setStep('capturing');
    try {
      const [diagramDataUrl, logoDataUrl] = await Promise.all([
        captureTopologyDiagramForReport(),
        fetchAsDataUrl(gigamonLogo).catch(() => undefined),
      ]);

      const chassisFrontPanelImages: Record<string, string> = {};
      const hardwareNodes = nodes.filter((n) => n.type === NODE_TYPES.HARDWARE);
      await Promise.all(
        hardwareNodes.map(async (n) => {
          const data = n.data as HardwareNodeData;
          const model = String(data.model || '');
          const chassisImage = resolveHardwareIcon(getChassisImagePath(model, data.sku));
          const slotPositions = getModuleSlotPositions(model, data.sku);
          const png = await captureChassisFrontPanelPng(chassisImage, slotPositions, data.installedBoards || {}).catch(
            () => undefined,
          );
          if (png) chassisFrontPanelImages[n.id] = png;
        }),
      );

      setStep('building');
      const docDefinition = buildReportDocDefinition({
        nodes,
        edges,
        trafficStreams,
        projectName: currentScenarioName || 'Untitled Project',
        projectRegion,
        projectLicenseMode,
        defaultTermDuration,
        peakNodeRxMbps,
        advancedMode,
        diagramDataUrl,
        logoDataUrl,
        nodeMetrics,
        isRunning,
        chassisFrontPanelImages,
        execSummaryText: execSummaryText.trim() || undefined,
      });

      const pdfMake = await loadPdfMake();
      const cleanName = currentScenarioName
        ? currentScenarioName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')
        : 'solution_report';
      await pdfMake.createPdf(docDefinition).download(`${cleanName}.pdf`);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate the report.');
      setStep('idle');
    } finally {
      setBusy(false);
    }
  };

  const buttonLabel = {
    idle: 'Generate Report',
    capturing: 'Capturing diagram…',
    building: 'Building PDF…',
    done: 'Generate Report',
  }[step];

  return (
    <div className="modal-overlay">
      <div
        className="modal-card"
        style={{ width: '420px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
      >
        <h3 style={{ margin: 0, fontSize: '14px', color: '#ff9800', fontWeight: 'bold' }}>Generate Solution Report</h3>
        <p className="text-muted" style={{ fontSize: '11px', margin: 0, lineHeight: 1.4 }}>
          Produces a PDF describing the current topology in plain English — traffic sources, maps, filters, GigaSMART
          processing, and destinations — with the topology diagram, Bill of Materials, and physical rack deployment appendices.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <label style={{ fontSize: '11px', fontWeight: 'bold' }} htmlFor="report-exec-summary">
            Executive Summary (optional)
          </label>
          <p className="text-muted" style={{ fontSize: '10px', margin: 0, lineHeight: 1.4 }}>
            A short summary of what's being deployed and why, in the customer's own context. Left blank, the report
            uses a generic summary paragraph instead. Supports basic Markdown: <strong>**bold**</strong>,{' '}
            <em>*italic*</em>, <code>`code`</code>, <code># headings</code>, and <code>-</code>/<code>1.</code> lists.
          </p>
          <textarea
            id="report-exec-summary"
            value={execSummaryText}
            onChange={(e) => setExecSummaryText(e.target.value)}
            disabled={busy}
            rows={5}
            style={{
              fontSize: '11px',
              padding: 'var(--space-2)',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
            placeholder={
              'e.g. This deployment gives the SOC full east-west visibility into the datacentre core ahead of the Q4 segmentation project.\n\n' +
              '**Key outcomes:**\n- Full east/west visibility\n- Reduced tool load via deduplication'
            }
          />
        </div>

        <button className="btn btn-primary" onClick={handleGenerate} disabled={busy}>
          {buttonLabel}
        </button>

        {error && <div style={{ fontSize: '11px', color: '#ff5252', lineHeight: 1.4 }}>{error}</div>}
        {step === 'done' && !error && <div style={{ fontSize: '11px', color: '#4caf50' }}>Report downloaded.</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
