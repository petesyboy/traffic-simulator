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
import { buildPatchSheetReportDocDefinition } from '../../utils/report/patchSheetReport';
import { buildCrossoverReportDocDefinition } from '../../utils/report/crossoverReport';
import { autoDeployRack } from '../../utils/autoRack';
import { NODE_TYPES } from '../../constants/nodeTypes';
import { getModuleSlotPositions, getChassisImagePath, isRackableGigamonEquipment } from '../../utils/hardwareUtils';
import { saveWithFilePickerOrPrompt } from '../../utils/fileSaveHelper';
import { getStandardExportFilename, type ExportDocumentType } from '../../utils/exportNaming';
import { exportSolutionToDirectoryOrZip } from '../../utils/solutionPackage';
import { resolveHardwareIcon } from '../../assets/hardwareIcons';
import { ProjectNamePromptModal, isUntitledProject } from './index';
import { isInternalEdition } from '../../constants/edition';
import { generateGleanExecutiveSummaryPrompt } from '../../utils/gleanPromptGenerator';
import type { HardwareNodeData } from '../../store/types';
import type { TDocumentDefinitions, TCreatedPdf } from 'pdfmake/interfaces';
import gigamonLogo from '../../assets/gigamon-logo.png';
import {
  getAllTemplates,
  saveTemplate,
  deleteTemplate,
  exportTemplateToJson,
  importTemplateFromFile,
  ALL_SECTIONS_ENABLED,
  type ReportTemplate,
  type ReportSectionToggles,
} from '../../utils/reportTemplates';

export interface ReportModalProps {
  onClose: () => void;
}

type ReportFormatType = 'signal-path' | 'patch-sheet' | 'crossover';

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
  const setCurrentScenarioName = useStore((s) => s.setCurrentScenarioName);
  const peakNodeRxMbps = useStore((s) => s.peakNodeRxMbps);
  const nodeMetrics = useStore((s) => s.nodeMetrics);
  const isRunning = useStore((s) => s.isRunning);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'idle' | 'capturing' | 'building' | 'done'>('idle');
  const [reportFormat, setReportFormat] = useState<ReportFormatType>('signal-path');
  const [showNamePrompt, setShowNamePrompt] = useState<boolean>(false);
  const [pendingNameAction, setPendingNameAction] = useState<((confirmedName: string) => void) | null>(null);
  const [savedReportFilename, setSavedReportFilename] = useState<string | null>(null);

  // Report Template: branding, section toggles, and markdown executive summary.
  const [templates, setTemplates] = useState<ReportTemplate[]>(() => getAllTemplates());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('default-signal-path');
  const [execSummaryText, setExecSummaryText] = useState(
    templates.find((t) => t.id === 'default-signal-path')?.execSummaryTemplateMarkdown || '',
  );
  const [sectionToggles, setSectionToggles] = useState<ReportSectionToggles>(ALL_SECTIONS_ENABLED);
  const [coBrandingMode, setCoBrandingMode] = useState<'gigamon-only' | 'co-branded'>('gigamon-only');
  const [partnerName, setPartnerName] = useState('');
  const [partnerLogoDataUrl, setPartnerLogoDataUrl] = useState<string | undefined>(undefined);
  const [gleanCopyStatus, setGleanCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [isGeneratingGleanPrompt, setIsGeneratingGleanPrompt] = useState<boolean>(false);

  const handleExportGleanPrompt = async (precomputedPrompt?: string) => {
    setIsGeneratingGleanPrompt(true);
    try {
      const prompt =
        precomputedPrompt ||
        (await generateGleanExecutiveSummaryPrompt({
          nodes,
          edges,
          trafficStreams,
          scenarioName: currentScenarioName,
          projectRegion,
          projectLicenseMode,
          defaultTermDuration,
          peakNodeRxMbps,
          advancedMode,
        }));
      const filename = getStandardExportFilename('glean-prompt-markdown', currentScenarioName);
      await saveWithFilePickerOrPrompt(prompt, filename, {
        description: 'Glean AI Executive Summary Prompt',
        mimeType: 'text/markdown',
        extension: '.md',
      });
    } catch (err) {
      console.error('Failed to export Glean prompt:', err);
    } finally {
      setIsGeneratingGleanPrompt(false);
    }
  };

  const handleCopyGleanPrompt = async () => {
    setIsGeneratingGleanPrompt(true);
    try {
      const prompt = await generateGleanExecutiveSummaryPrompt({
        nodes,
        edges,
        trafficStreams,
        scenarioName: currentScenarioName,
        projectRegion,
        projectLicenseMode,
        defaultTermDuration,
        peakNodeRxMbps,
        advancedMode,
      });

      let copied = false;

      // Attempt synchronous scratch textarea copy first to safeguard user gesture
      try {
        const scratch = document.getElementById('glean-prompt-scratch') as HTMLTextAreaElement | null;
        if (scratch) {
          scratch.value = prompt;
          scratch.focus();
          scratch.select();
          copied = document.execCommand('copy');
        }
      } catch {
        copied = false;
      }

      // Modern Clipboard API attempt if available
      if (!copied && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(prompt);
          copied = true;
        } catch {
          copied = false;
        }
      }

      if (copied) {
        setGleanCopyStatus('copied');
        setTimeout(() => setGleanCopyStatus('idle'), 2500);
      } else {
        setGleanCopyStatus('error');
        await handleExportGleanPrompt(prompt);
      }
    } catch (err) {
      console.error('Failed to generate Glean prompt:', err);
      setGleanCopyStatus('error');
    } finally {
      setIsGeneratingGleanPrompt(false);
    }
  };

  const applyTemplate = (template: ReportTemplate) => {
    setSelectedTemplateId(template.id);
    setExecSummaryText(template.execSummaryTemplateMarkdown);
    setSectionToggles(template.sections);
    setCoBrandingMode(template.coBrandingMode);
    setPartnerName(template.partnerName || '');
    setPartnerLogoDataUrl(template.partnerLogoDataUrl);
  };

  const handleSaveAsNewTemplate = () => {
    const name = window.prompt('Name this template:');
    if (!name || !name.trim()) return;
    const saved = saveTemplate({
      id: `custom-${Date.now()}`,
      name: name.trim(),
      partnerName: partnerName || undefined,
      partnerLogoDataUrl,
      coBrandingMode,
      execSummaryTemplateMarkdown: execSummaryText,
      sections: sectionToggles,
    });
    setTemplates(getAllTemplates());
    setSelectedTemplateId(saved.id);
  };

  const handleDeleteTemplate = () => {
    const current = templates.find((t) => t.id === selectedTemplateId);
    if (!current || current.isBuiltIn) return;
    if (!window.confirm(`Delete template "${current.name}"?`)) return;
    deleteTemplate(current.id);
    setTemplates(getAllTemplates());
    applyTemplate(templates.find((t) => t.id === 'default-signal-path')!);
  };

  const handleExportTemplate = async () => {
    const current = templates.find((t) => t.id === selectedTemplateId);
    if (!current) return;
    const toExport: ReportTemplate = {
      ...current,
      partnerName: partnerName || undefined,
      partnerLogoDataUrl,
      coBrandingMode,
      execSummaryTemplateMarkdown: execSummaryText,
      sections: sectionToggles,
    };
    await saveWithFilePickerOrPrompt(exportTemplateToJson(toExport), `${toExport.name}.json`, {
      description: 'Report Template',
      mimeType: 'application/json',
      extension: '.json',
    });
  };

  const handleImportTemplate = async (file: File) => {
    try {
      const imported = await importTemplateFromFile(file);
      const saved = saveTemplate({ ...imported, id: `custom-${Date.now()}` });
      setTemplates(getAllTemplates());
      applyTemplate(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import that template file.');
    }
  };

  const handlePartnerLogoFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setPartnerLogoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const storeSetNodes = useStore((s) => s.setNodes);

  const ensureProjectNamed = (action: (confirmedName: string) => void) => {
    if (isUntitledProject(currentScenarioName)) {
      setPendingNameAction(() => action);
      setShowNamePrompt(true);
    } else {
      action(currentScenarioName!);
    }
  };

  const handleNamePromptConfirm = (newName: string) => {
    setCurrentScenarioName(newName);
    setShowNamePrompt(false);
    if (pendingNameAction) {
      const action = pendingNameAction;
      setPendingNameAction(null);
      setTimeout(() => {
        action(newName);
      }, 50);
    }
  };

  const handleGenerate = () => {
    setError(null);
    setSavedReportFilename(null);

    ensureProjectNamed(async (resolvedScenarioName) => {
      let exportDocType: ExportDocumentType = 'architecture-pdf';
      switch (reportFormat) {
        case 'patch-sheet':
          exportDocType = 'patch-sheet-pdf';
          break;
        case 'crossover':
          exportDocType = 'crossover-pdf';
          break;
        case 'signal-path':
        default:
          exportDocType = 'architecture-pdf';
          break;
      }
      const defaultFilename = getStandardExportFilename(exportDocType, resolvedScenarioName);

      setBusy(true);

      try {
        const saveRes = await saveWithFilePickerOrPrompt(
          async () => {
            setStep('capturing');

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
              projectName: resolvedScenarioName,
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
              sections: sectionToggles,
              coBrandingMode,
              partnerName: partnerName.trim() || undefined,
              partnerLogoDataUrl,
            };

            let docDefinition: TDocumentDefinitions;

            switch (reportFormat) {
              case 'patch-sheet':
                docDefinition = buildPatchSheetReportDocDefinition(reportInput);
                break;
              case 'crossover':
                docDefinition = buildCrossoverReportDocDefinition(reportInput);
                break;
              case 'signal-path':
              default:
                docDefinition = buildReportDocDefinition(reportInput);
                break;
            }

            const pdfMake = await loadPdfMake();

            return await new Promise<Blob>((resolve, reject) => {
              try {
                const timeout = setTimeout(() => {
                  reject(new Error('PDF generation timed out after 10 seconds.'));
                }, 10000);

                const pdfDoc = pdfMake.createPdf(docDefinition) as unknown as {
                  getBlob: (cb?: (blob: Blob) => void) => Promise<Blob> | void;
                };

                const res = pdfDoc.getBlob((blob: Blob) => {
                  clearTimeout(timeout);
                  if (blob) resolve(blob);
                  else reject(new Error('PDF report generation produced an empty file.'));
                });

                if (res && typeof (res as Promise<Blob>).then === 'function') {
                  (res as Promise<Blob>)
                    .then((blob) => {
                      clearTimeout(timeout);
                      if (blob) resolve(blob);
                      else reject(new Error('PDF report generation produced an empty file.'));
                    })
                    .catch((err) => {
                      clearTimeout(timeout);
                      reject(err);
                    });
                }
              } catch (err) {
                reject(err);
              }
            });
          },
          defaultFilename,
          {
            description: 'PDF Solution Report',
            mimeType: 'application/pdf',
            extension: '.pdf',
          }
        );

        if (saveRes.saved) {
          setStep('done');
          setSavedReportFilename(saveRes.filename);
        } else {
          setStep('idle');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not generate the report.');
        setStep('idle');
      } finally {
        setBusy(false);
      }
    });
  };

  const [isExportingAll, setIsExportingAll] = useState(false);
  const [exportAllStatus, setExportAllStatus] = useState<string | null>(null);

  const handleExportAll = () => {
    ensureProjectNamed(async (resolvedScenarioName) => {
      setIsExportingAll(true);
      setError(null);
      setExportAllStatus('Preparing deliverables (all reports, CSVs, JSON, diagram)...');
      try {
        const res = await exportSolutionToDirectoryOrZip({
          nodes,
          edges,
          trafficStreams,
          currentScenarioName: resolvedScenarioName,
          advancedMode,
          projectLicenseMode,
          defaultTermDuration,
          projectRegion,
          peakNodeRxMbps,
          nodeMetrics,
          isRunning,
          onProgress: (status) => setExportAllStatus(status),
        });

        if (res.success) {
          setExportAllStatus(
            res.directoryName
              ? `Successfully exported the ${res.fileCount} files into folder "${res.directoryName}"!`
              : `Successfully exported the ${res.fileCount} files in ZIP package "${res.zipFilename}"!`
          );
        } else {
          setExportAllStatus(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not export deliverables package.');
        setExportAllStatus(null);
      } finally {
        setIsExportingAll(false);
      }
    });
  };

  const buttonLabel = {
    idle: 'Generate Report',
    capturing: 'Capturing diagram…',
    building: 'Building PDF…',
    done: 'Generate Report',
  }[step];

  // Patch Sheet & Crossover formats are deprecated from the UI (kept in code, see
  // patchSheetReport.ts / crossoverReport.ts) in favour of a single, customisable
  // Signal Path & Architecture report.
  const formatOptions: { id: ReportFormatType; title: string; subtitle: string; tag: string; color: string }[] = [
    {
      id: 'signal-path',
      title: 'Signal Path & Architecture',
      subtitle: 'Complete engineering spec, network topology, Bill of Materials, and rack elevations.',
      tag: 'Technical Spec',
      color: '#16213D',
    },
  ];

  return (
    <div className="modal-overlay">
      {/* Hidden scratch textarea for guaranteed synchronous copy execution */}
      <textarea
        id="glean-prompt-scratch"
        tabIndex={-1}
        aria-hidden="true"
        style={{ position: 'fixed', left: '-9999px', top: '-9999px', opacity: 0, pointerEvents: 'none' }}
        readOnly
      />
      <div
        className="modal-card"
        style={{
          width: '620px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Pinned Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-header, #0d0d0d)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>📊</span>
            <h3 style={{ margin: 0, fontSize: '15px', color: '#ff9800', fontWeight: 'bold' }}>Generate Report Suite</h3>
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.5px', fontWeight: 600 }}>
            FABRIC DESIGN SYSTEM
          </span>
        </div>

        {/* Scrollable Body Container */}
        <div
          style={{
            padding: '16px 20px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4, 14px)',
          }}
        >
          {/* Format Selector Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              Select Report Format
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
              {formatOptions.map((fmt) => {
                const selected = reportFormat === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setReportFormat(fmt.id)}
                    disabled={busy || isExportingAll}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: selected ? `2px solid #E1592A` : '1px solid var(--border-color)',
                      background: selected ? 'rgba(225, 89, 42, 0.08)' : 'var(--bg-surface)',
                      cursor: busy || isExportingAll ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: selected ? '#E1592A' : 'var(--text-primary)' }}>
                        {fmt.title}
                      </span>
                      <span
                        style={{
                          fontSize: '9px',
                          padding: '2px 8px',
                          borderRadius: '3px',
                          background: fmt.color,
                          color: '#FFFFFF',
                          fontWeight: 'bold',
                        }}
                      >
                        {fmt.tag}
                      </span>
                    </div>
                    <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.35 }}>
                      {fmt.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Report Template Picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-primary)' }}>Report Template</label>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={selectedTemplateId}
                disabled={busy || isExportingAll}
                onChange={(e) => {
                  const t = templates.find((tpl) => tpl.id === e.target.value);
                  if (t) applyTemplate(t);
                }}
                className="form-select"
                style={{ flex: '1 1 200px', fontSize: '11px', padding: '6px 10px' }}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.isBuiltIn ? '' : ' (Custom)'}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-secondary" style={{ fontSize: '10.5px', padding: '5px 9px' }} onClick={handleSaveAsNewTemplate} disabled={busy || isExportingAll}>
                Save As New
              </button>
              <button type="button" className="btn btn-secondary" style={{ fontSize: '10.5px', padding: '5px 9px' }} onClick={handleExportTemplate} disabled={busy || isExportingAll}>
                Export
              </button>
              <label className="btn btn-secondary" style={{ fontSize: '10.5px', padding: '5px 9px', margin: 0, cursor: busy || isExportingAll ? 'not-allowed' : 'pointer' }}>
                Import
                <input
                  type="file"
                  accept="application/json"
                  hidden
                  disabled={busy || isExportingAll}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportTemplate(file);
                    e.target.value = '';
                  }}
                />
              </label>
              {!templates.find((t) => t.id === selectedTemplateId)?.isBuiltIn && (
                <button type="button" className="btn btn-secondary" style={{ fontSize: '10.5px', padding: '5px 9px' }} onClick={handleDeleteTemplate} disabled={busy || isExportingAll}>
                  Delete
                </button>
              )}
            </div>
          </div>

          {/* Branding */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-primary)' }}>Branding</label>
            <p className="text-muted" style={{ fontSize: '10.5px', margin: 0, lineHeight: 1.4 }}>
              The Gigamon badge always appears on every report. Co-branding adds a partner logo alongside it — it never replaces it.
            </p>
            <div style={{ display: 'flex', gap: '14px', fontSize: '11px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={coBrandingMode === 'gigamon-only'}
                  onChange={() => setCoBrandingMode('gigamon-only')}
                  disabled={busy || isExportingAll}
                />
                Gigamon Only
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={coBrandingMode === 'co-branded'}
                  onChange={() => setCoBrandingMode('co-branded')}
                  disabled={busy || isExportingAll}
                />
                Co-Branded with Partner
              </label>
            </div>
            {coBrandingMode === 'co-branded' && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                <input
                  type="text"
                  placeholder="Partner company name"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  disabled={busy || isExportingAll}
                  className="form-input"
                  style={{ flex: 1, fontSize: '11px', padding: '6px 10px' }}
                />
                <label className="btn btn-secondary" style={{ fontSize: '10.5px', padding: '5px 10px', margin: 0, cursor: busy || isExportingAll ? 'not-allowed' : 'pointer' }}>
                  {partnerLogoDataUrl ? 'Change Logo' : 'Upload Logo'}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={busy || isExportingAll}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePartnerLogoFile(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Section Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-primary)' }}>Include / Exclude Sections</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '10.5px' }}>
              {(
                [
                  ['executiveSummary', 'Executive Summary & Key Metrics'],
                  ['topologyDiagram', 'Topology Diagram'],
                  ['componentNarrative', 'Component Narrative'],
                  ['billOfMaterials', 'Bill of Materials'],
                  ['rackElevation', 'Physical Rack & Deployment'],
                ] as [keyof ReportSectionToggles, string][]
              ).map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={sectionToggles[key]}
                    disabled={busy || isExportingAll}
                    onChange={(e) => setSectionToggles({ ...sectionToggles, [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Executive Summary Markdown Box & Glean Assistant */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 6px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-primary)' }} htmlFor="report-exec-summary">
                Executive Summary / Notes (optional)
              </label>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Supports Markdown</span>
            </div>
            <p className="text-muted" style={{ fontSize: '10.5px', margin: 0, lineHeight: 1.4 }}>
              Customer context and notes. Supports Markdown (<strong>**bold**</strong>, <em>*italic*</em>, <code>-</code> lists) and dynamic tokens:
            </p>

            {/* Token Chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '2px' }}>
              {['projectName', 'partnerName', 'siteCount', 'totalLinks', 'hardwareCount', 'licenseModel', 'date'].map((token) => (
                <button
                  key={token}
                  type="button"
                  className="token-chip"
                  disabled={busy || isExportingAll}
                  onClick={() => setExecSummaryText((prev) => `${prev}{{${token}}}`)}
                  title={`Insert {{${token}}} token into summary`}
                >
                  {`{{${token}}}`}
                </button>
              ))}
            </div>

            {/* Prominent Glean AI Card */}
            {isInternalEdition() && (
              <div className="glean-assistant-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px' }}>✨</span>
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Glean AI Assistant
                    </span>
                    <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(225, 89, 42, 0.15)', color: '#E1592A', fontWeight: 600 }}>
                      Internal Gigamon SE
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className={`btn-glean-copy ${gleanCopyStatus === 'copied' ? 'copied' : ''}`}
                      disabled={busy || isExportingAll || isGeneratingGleanPrompt}
                      onClick={handleCopyGleanPrompt}
                      title="Copies full context, BOM, and prompt for Glean to generate an Executive Summary"
                    >
                      {isGeneratingGleanPrompt
                        ? '⏳ Generating...'
                        : gleanCopyStatus === 'copied'
                          ? '✓ Copied to Clipboard!'
                          : gleanCopyStatus === 'error'
                            ? '⚠️ Downloaded as .md'
                            : '📋 Copy Glean Prompt'}
                    </button>
                    <button
                      type="button"
                      className="btn-glean-export"
                      disabled={busy || isExportingAll || isGeneratingGleanPrompt}
                      onClick={() => handleExportGleanPrompt()}
                      title="Export prompt as a .md file to upload into Glean"
                    >
                      📄 Export Prompt (.md)
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.45, background: 'rgba(0, 0, 0, 0.2)', padding: '6px 8px', borderRadius: '4px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Quick Workflow:</span>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '3px', flexWrap: 'wrap' }}>
                    <span><strong>1.</strong> Click <em>Copy Glean Prompt</em></span>
                    <span><strong>2.</strong> Paste into Glean AI</span>
                    <span><strong>3.</strong> Paste Markdown response below</span>
                  </div>
                </div>
              </div>
            )}

            <textarea
              id="report-exec-summary"
              value={execSummaryText}
              onChange={(e) => setExecSummaryText(e.target.value)}
              disabled={busy || isExportingAll}
              rows={4}
              className="form-input"
              style={{
                fontSize: '11px',
                padding: '8px 10px',
                resize: 'vertical',
                minHeight: '80px',
                lineHeight: 1.45,
                marginTop: '4px',
              }}
              placeholder={
                'e.g. This deployment gives the SOC full east-west visibility into the datacentre core ahead of the Q4 segmentation project.'
              }
            />
          </div>

          {error && (
            <div style={{ fontSize: '11px', color: '#ff5252', lineHeight: 1.4, padding: '6px 10px', background: 'rgba(255, 82, 82, 0.1)', borderRadius: '4px', border: '1px solid rgba(255, 82, 82, 0.3)' }}>
              {error}
            </div>
          )}
          {exportAllStatus && (
            <div style={{ fontSize: '11px', color: '#4caf50', lineHeight: 1.4, padding: '6px 10px', background: 'rgba(76, 175, 80, 0.1)', borderRadius: '4px', border: '1px solid rgba(76, 175, 80, 0.3)' }}>
              {exportAllStatus}
            </div>
          )}
        </div>

        {/* Pinned Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary, #161618)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={busy || isExportingAll}
          >
            Close
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleExportAll}
              disabled={busy || isExportingAll}
              title="Open Directory Chooser to pick or create a target folder and dump all reports, CSVs, commercial quotes, JSON, and PNG diagram"
              style={{
                padding: '6px 14px',
                fontSize: '11px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                border: '1px solid #E1592A',
                color: '#E1592A',
                background: 'rgba(225, 89, 42, 0.08)',
              }}
            >
              {isExportingAll ? 'Dumping All...' : '📁 Dump All to Folder...'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ minWidth: '130px', padding: '6px 16px', fontSize: '11.5px', fontWeight: 700 }}
              onClick={handleGenerate}
              disabled={busy || isExportingAll}
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      </div>

      {showNamePrompt && (
        <ProjectNamePromptModal
          defaultName=""
          onConfirm={handleNamePromptConfirm}
          onCancel={() => {
            setShowNamePrompt(false);
            setPendingNameAction(null);
          }}
        />
      )}

      {savedReportFilename && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ width: '360px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#4caf50' }}>✓ Report Generated</h3>
            <p style={{ fontSize: '12px', lineHeight: 1.5, margin: '0 0 6px 0' }}>
              Report generated and written to:
            </p>
            <p
              style={{
                fontSize: '12px',
                fontFamily: 'monospace',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '4px',
                padding: '8px',
                wordBreak: 'break-all',
                margin: '0 0 12px 0',
              }}
            >
              {savedReportFilename}
            </p>
            <p className="text-muted" style={{ fontSize: '10px', lineHeight: 1.4, margin: '0 0 16px 0' }}>
              Saved to the folder you chose in the save dialog — browsers don't expose the full disk path to the page.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setSavedReportFilename(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportModal;

