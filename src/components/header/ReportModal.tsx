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
import {
  captureTopologyDiagramForReport,
  captureSiteTopologyDiagramForReport,
  detectDiagramSplitting,
} from '../../utils/report/captureTopologyDiagram';
import { captureChassisFrontPanelPng } from '../../utils/report/captureChassisFrontPanel';
import { captureRackElevationPng } from '../../utils/report/captureRackElevation';
import { buildReportDocDefinition } from '../../utils/report/buildReportDocDefinition';
import { buildUplinkReportDocDefinition } from '../../utils/report/uplinkReport';
import { buildPatchSheetReportDocDefinition } from '../../utils/report/patchSheetReport';
import { buildCrossoverReportDocDefinition } from '../../utils/report/crossoverReport';
import { autoDeployRack } from '../../utils/autoRack';
import { NODE_TYPES } from '../../constants/nodeTypes';
import { getModuleSlotPositions, getChassisImagePath, isRackableGigamonEquipment } from '../../utils/hardwareUtils';
import { saveWithFilePickerOrPrompt } from '../../utils/fileSaveHelper';
import { resolveHardwareIcon } from '../../assets/hardwareIcons';
import type { HardwareNodeData } from '../../store/types';
import type { TDocumentDefinitions, TCreatedPdf } from 'pdfmake/interfaces';
import gigamonLogo from '../../assets/gigamon-logo.png';

export interface ReportModalProps {
  onClose: () => void;
}

type ReportFormatType = 'signal-path' | 'uplink' | 'patch-sheet' | 'crossover';

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
  const [reportFormat, setReportFormat] = useState<ReportFormatType>('signal-path');
  const [execSummaryText, setExecSummaryText] = useState('');

  const storeSetNodes = useStore((s) => s.setNodes);

  const handleGenerate = async () => {
    setBusy(true);
    setError(null);
    setStep('capturing');
    try {
      // 1. Auto-deploy hardware to racks for each site before generating report
      const uniqueSites = Array.from(
        new Set(
          nodes
            .filter(isRackableGigamonEquipment)
            .map((n) => (n.data?.site as string || '').trim())
            .filter(Boolean)
        )
      );
      if (uniqueSites.length === 0) uniqueSites.push('Global / Unassigned');

      let currentNodes = [...nodes];
      for (const site of uniqueSites) {
        currentNodes = autoDeployRack(currentNodes, site);
      }
      storeSetNodes(currentNodes);

      const [diagramDataUrl, logoDataUrl] = await Promise.all([
        captureTopologyDiagramForReport(),
        fetchAsDataUrl(gigamonLogo).catch(() => undefined),
      ]);

      const chassisFrontPanelImages: Record<string, string> = {};
      const hardwareNodes = currentNodes.filter((n) => n.type === NODE_TYPES.HARDWARE);
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

      // Capture 42U rack elevation diagrams for each site
      const siteRackImages: Record<string, string> = {};
      await Promise.all(
        uniqueSites.map(async (site) => {
          const png = await captureRackElevationPng(currentNodes, site, chassisFrontPanelImages).catch(() => undefined);
          if (png) siteRackImages[site] = png;
        }),
      );

      // Check if multi-site diagram splitting is recommended for legibility
      const splitJudgement = detectDiagramSplitting(currentNodes, edges);
      const siteDiagrams: Record<string, string> = {};

      if (splitJudgement.shouldSplit) {
        for (const partition of splitJudgement.partitions) {
          try {
            const sitePng = await captureSiteTopologyDiagramForReport(partition.nodeIds);
            if (sitePng) siteDiagrams[partition.siteName] = sitePng;
          } catch {
            // Fallback gracefully to overview diagram if sub-diagram capture fails
          }
        }
      }

      setStep('building');
      const reportInput = {
        nodes: currentNodes,
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
        siteRackImages,
        siteDiagrams,
        execSummaryText: execSummaryText.trim() || undefined,
      };

      let docDefinition: TDocumentDefinitions;
      let filenamePrefix = 'SignalPath';

      switch (reportFormat) {
        case 'uplink':
          docDefinition = buildUplinkReportDocDefinition(reportInput);
          filenamePrefix = 'Uplink';
          break;
        case 'patch-sheet':
          docDefinition = buildPatchSheetReportDocDefinition(reportInput);
          filenamePrefix = 'PatchSheet';
          break;
        case 'crossover':
          docDefinition = buildCrossoverReportDocDefinition(reportInput);
          filenamePrefix = 'Crossover';
          break;
        case 'signal-path':
        default:
          docDefinition = buildReportDocDefinition(reportInput);
          filenamePrefix = 'SignalPath';
          break;
      }

      const pdfMake = await loadPdfMake();
      const cleanName = currentScenarioName
        ? currentScenarioName.replace(/[^a-zA-Z0-9_-]/g, '_')
        : 'solution_report';
      const defaultFilename = `${filenamePrefix}_${cleanName}.pdf`;

      const pdfBlob: Blob = await new Promise<Blob>((resolve, reject) => {
        try {
          const pdfDoc = pdfMake.createPdf(docDefinition) as unknown as {
            getBlob: (cb: (blob: Blob) => void) => void;
          };
          pdfDoc.getBlob((blob: Blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('PDF report generation produced an empty file.'));
            }
          });
        } catch (err) {
          reject(err);
        }
      });

      await saveWithFilePickerOrPrompt(pdfBlob, defaultFilename, {
        description: 'PDF Solution Report',
        mimeType: 'application/pdf',
        extension: '.pdf',
      });
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

  const formatOptions: { id: ReportFormatType; title: string; subtitle: string; tag: string; color: string }[] = [
    {
      id: 'signal-path',
      title: 'Signal Path',
      subtitle: 'Complete engineering spec, network topology, Bill of Materials, and rack elevations.',
      tag: 'Technical Spec',
      color: '#16213D',
    },
    {
      id: 'uplink',
      title: 'Uplink',
      subtitle: 'Executive outcome brief, milestone progression, and business risk reframes.',
      tag: 'Executive Brief',
      color: '#0F2E33',
    },
  ];

  return (
    <div className="modal-overlay">
      <div
        className="modal-card"
        style={{ width: '560px', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '15px', color: '#ff9800', fontWeight: 'bold' }}>Generate Report Suite</h3>
          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', letterSpacing: '0.5px' }}>FABRIC DESIGN SYSTEM</span>
        </div>

        {/* Format Selector Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text)' }}>
            Select Report Format
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {formatOptions.map((fmt) => {
              const selected = reportFormat === fmt.id;
              return (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setReportFormat(fmt.id)}
                  disabled={busy}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    textAlign: 'left',
                    padding: '10px',
                    borderRadius: '6px',
                    border: selected ? `2px solid #E1592A` : '1px solid var(--color-border)',
                    background: selected ? 'rgba(225, 89, 42, 0.08)' : 'var(--color-surface)',
                    cursor: busy ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: selected ? '#E1592A' : 'var(--color-text)' }}>
                      {fmt.title}
                    </span>
                    <span
                      style={{
                        fontSize: '8.5px',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        background: fmt.color,
                        color: '#FFFFFF',
                        fontWeight: 'bold',
                      }}
                    >
                      {fmt.tag}
                    </span>
                  </div>
                  <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.35 }}>
                    {fmt.subtitle}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Executive Summary Markdown Box */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <label style={{ fontSize: '11px', fontWeight: 'bold' }} htmlFor="report-exec-summary">
            Executive Summary / Notes (optional)
          </label>
          <p className="text-muted" style={{ fontSize: '10px', margin: 0, lineHeight: 1.4 }}>
            Customer context and notes. Supports Markdown (<strong>**bold**</strong>, <em>*italic*</em>, <code>-</code> lists).
          </p>
          <textarea
            id="report-exec-summary"
            value={execSummaryText}
            onChange={(e) => setExecSummaryText(e.target.value)}
            disabled={busy}
            rows={4}
            style={{
              fontSize: '11px',
              padding: 'var(--space-2)',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
            placeholder={
              'e.g. This deployment gives the SOC full east-west visibility into the datacentre core ahead of the Q4 segmentation project.'
            }
          />
        </div>

        <button className="btn btn-primary" onClick={handleGenerate} disabled={busy}>
          {buttonLabel}
        </button>

        {error && <div style={{ fontSize: '11px', color: '#ff5252', lineHeight: 1.4 }}>{error}</div>}
        {step === 'done' && !error && <div style={{ fontSize: '11px', color: '#4caf50' }}>Report downloaded.</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
