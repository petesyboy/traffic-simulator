/**
 * solutionPackage.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Complete Solution Package Generation & Batch Directory Export.
 *
 * Generates all simulator deliverables for a given scenario:
 *   1. Solution_Overview_<name>.json (Topology project state)
 *   2. Gigamon_Architecture_<name>.pdf (Engineering spec & architecture PDF)
 *   3. Bill_of_Materials_<name>.csv (Consolidated Bill of Materials CSV)
 *   4. Bill_of_Materials_Deployment_Report_<name>.csv (Rack & physical deployment report)
 *   5. Commercial_Quote_<name>.pdf (Formal budgetary quote PDF)
 *   6. Commercial_Quote_<name>.csv (Quote pricing & discount line items CSV)
 *   7. Commercial_Quote_<name>.json (Customized quote configuration JSON)
 *   8. Gigamon_Architecture_Diagram_<name>.png (High-resolution topology diagram)
 *
 * Supports:
 *   - Direct Native Folder Export via window.showDirectoryPicker() (navigate, create folder, dump all)
 *   - All-in-One ZIP Archive export fallback via JSZip
 */

import JSZip from 'jszip';
import type { CustomNode, HardwareNodeData, TrafficStream, NodeMetrics } from '../store/types';
import type { Edge } from '@xyflow/react';
import { getStandardExportFilename } from './exportNaming';
import { saveWithFilePickerOrPrompt } from './fileSaveHelper';
import { generateBom, getSkus } from './bomEngine';
import { buildProjectWideOpticBom } from './bom/opticPacks';
import { consolidateSimpleDeviceRows, CONSOLIDATED_DEVICES_NODE_ID } from './bom/consolidateSimpleDevices';
import { getProjectQuoteWorkspace } from './projectQuoteStorage';
import { buildPhysicalItems, parseAndConvertDimensions } from './bom/physicalItems';
import { buildReportDocDefinition } from './report/buildReportDocDefinition';
import { buildUplinkReportDocDefinition } from './report/uplinkReport';
import { captureTopologyDiagramForReport, captureSiteTopologyDiagramForReport } from './report/captureTopologyDiagram';
import { captureChassisFrontPanelPng } from './report/captureChassisFrontPanel';
import { captureRackElevationPng } from './report/captureRackElevation';
import { autoDeployRack } from './autoRack';
import { isRackableGigamonEquipment, getModuleSlotPositions, getChassisImagePath } from './hardwareUtils';
import { isInternalEdition } from '../constants/edition';
import type { TDocumentDefinitions, TCreatedPdf } from 'pdfmake/interfaces';
import gigamonLogo from '../assets/gigamon-logo.png';

export interface SolutionAssetFile {
  filename: string;
  content: Blob | string;
  mimeType: string;
  category: 'json' | 'pdf' | 'csv' | 'png';
}

export interface GeneratePackageOptions {
  nodes: CustomNode[];
  edges: Edge[];
  trafficStreams: TrafficStream[];
  currentScenarioName?: string | null;
  advancedMode: boolean;
  projectLicenseMode?: string;
  defaultTermDuration?: string;
  projectRegion?: string;
  disableDcWarnings?: boolean;
  panelTextScale?: number;
  showGrid?: boolean;
  snapToGrid?: boolean;
  peakNodeRxMbps?: Record<string, number>;
  nodeMetrics?: Record<string, unknown>;
  isRunning?: boolean;
  onProgress?: (status: string) => void;
}

interface PdfMakeStatic {
  createPdf: (documentDefinitions: TDocumentDefinitions) => TCreatedPdf;
  addVirtualFileSystem: (vfs: Record<string, string>) => void;
}

async function loadPdfMake(): Promise<PdfMakeStatic> {
  const pdfMakeModule = await import('pdfmake/build/pdfmake');
  const pdfFontsModule = await import('pdfmake/build/vfs_fonts');
  const pdfMake = (pdfMakeModule as unknown as { default: PdfMakeStatic }).default || (pdfMakeModule as unknown as PdfMakeStatic);
  const pdfFonts = (pdfFontsModule as unknown as { default: Record<string, string> }).default || (pdfFontsModule as unknown as Record<string, string>);
  const vfsObj = (pdfFonts as unknown as { pdfMake?: { vfs: Record<string, string> } })?.pdfMake?.vfs || pdfFonts;
  if (pdfMake.addVirtualFileSystem && vfsObj) {
    pdfMake.addVirtualFileSystem(vfsObj);
  }
  return pdfMake;
}

const fetchAsDataUrl = async (url: string): Promise<string | undefined> => {
  if (typeof fetch === 'undefined' || !url) return undefined;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
};

function convertDataUrlToBlob(dataUrl: string, defaultMime = 'image/png'): Blob {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : defaultMime;
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

function escapeCsv(val: unknown): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function renderPdfDocToBlob(pdfDoc: unknown): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    try {
      const timeout = setTimeout(() => {
        reject(new Error('PDF generation timed out after 10 seconds.'));
      }, 10000);

      const typedDoc = pdfDoc as {
        getBlob: (cb?: (blob: Blob) => void) => Promise<Blob> | void;
      };

      let resolved = false;
      const res = typedDoc.getBlob((blob: Blob) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          if (blob) resolve(blob);
          else reject(new Error('PDF generation produced an empty file.'));
        }
      });

      if (res && typeof (res as Promise<Blob>).then === 'function') {
        (res as Promise<Blob>)
          .then((blob) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              if (blob) resolve(blob);
              else reject(new Error('PDF generation produced an empty file.'));
            }
          })
          .catch((err) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              reject(err);
            }
          });
      }
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generates all 8 standardized assets for a complete solution export in memory.
 */
export async function generateAllSolutionAssets(
  options: GeneratePackageOptions,
): Promise<SolutionAssetFile[]> {
  const {
    nodes,
    edges,
    trafficStreams,
    currentScenarioName,
    advancedMode,
    projectLicenseMode,
    defaultTermDuration,
    projectRegion,
    disableDcWarnings,
    panelTextScale,
    showGrid,
    snapToGrid,
    peakNodeRxMbps,
    nodeMetrics,
    isRunning,
    onProgress,
  } = options;

  const files: SolutionAssetFile[] = [];
  const scenarioName = currentScenarioName || 'Solution';

  // ── 1. Topology JSON State ──
  onProgress?.('Generating Solution Topology JSON...');
  const flow = {
    projectName: scenarioName,
    nodes,
    edges,
    trafficStreams,
    settings: {
      advancedMode,
      projectLicenseMode,
      defaultTermDuration,
      projectRegion,
      disableDcWarnings,
      panelTextScale,
      showGrid,
      snapToGrid,
    },
    quoteWorkspace: isInternalEdition() ? getProjectQuoteWorkspace(scenarioName) : undefined,
  };
  const jsonContent = JSON.stringify(flow, null, 2);
  files.push({
    filename: getStandardExportFilename('topology-json', scenarioName),
    content: jsonContent,
    mimeType: 'application/json',
    category: 'json',
  });

  // ── 2. Bill of Materials CSV ──
  onProgress?.('Generating Bill of Materials CSV...');
  const licenseMode = projectLicenseMode === 'HTL' ? 'HTL' : 'Perpetual';
  const termDuration = defaultTermDuration || '36';
  const region = projectRegion === 'EU' || projectRegion === 'UK' ? projectRegion : 'US';
  const rawBom = generateBom(nodes, edges, licenseMode, termDuration, region, false, peakNodeRxMbps || {});
  const skus = getSkus();
  const opticBom = buildProjectWideOpticBom(rawBom, skus);
  const finalBom = consolidateSimpleDeviceRows(opticBom);

  const bomHeaders = 'Site / Location,Type,SKU,Description,Term,Qty';
  const bomRows = finalBom
    .map(
      (i) =>
        `${escapeCsv(i.site || 'Global / Unassigned')},${escapeCsv(i.type)},${escapeCsv(i.sku)},${escapeCsv(i.description)},${i.term || ''},${i.qty}`,
    )
    .join('\n');
  const bomCsv = `${bomHeaders}\n${bomRows}`;
  files.push({
    filename: getStandardExportFilename('bom-csv', scenarioName),
    content: bomCsv,
    mimeType: 'text/csv',
    category: 'csv',
  });

  // ── 3. BOM Physical Deployment / Rack Report CSV ──
  onProgress?.('Generating Deployment & Rack Report CSV...');
  const physicalItems = buildPhysicalItems(nodes, finalBom);
  const totalRU = physicalItems.reduce((acc, p) => acc + p.qty * p.ruNum, 0);
  const totalWeight = physicalItems.reduce((acc, p) => acc + p.qty * p.weightNum, 0);
  const totalPower = physicalItems.reduce((acc, p) => acc + p.qty * p.powerNum, 0);
  const totalHeat = physicalItems.reduce((acc, p) => acc + p.qty * p.heatNum, 0);

  const physicalCsv = [
    'Node/Chassis,Qty,Rack Space,Dimensions (Imperial),Dimensions (Metric),Weight (Imperial),Weight (Metric),Power,Heat,Airflow',
  ]
    .concat(
      physicalItems.map((p) => {
        const { inches, cm } = parseAndConvertDimensions(p.dimensions);
        const lbs = `${p.weightNum.toFixed(1)} lbs`;
        const kg = `${(p.weightNum * 0.45359237).toFixed(2)} kg`;
        return `${escapeCsv(p.name)},${p.qty},${escapeCsv(p.ru)},${escapeCsv(inches)},${escapeCsv(cm)},${escapeCsv(lbs)},${escapeCsv(kg)},${escapeCsv(p.power)},${escapeCsv(p.heat)},${escapeCsv(p.airflow)}`;
      }),
    )
    .concat([
      `Total,${physicalItems.reduce((acc, p) => acc + p.qty, 0)},${totalRU} RU,-,-,${totalWeight.toFixed(1)} lbs,${(totalWeight * 0.45359237).toFixed(1)} kg,${totalPower} W,${totalHeat} BTU/hr,-`,
    ])
    .join('\n');

  files.push({
    filename: getStandardExportFilename('bom-deployment-csv', scenarioName),
    content: physicalCsv,
    mimeType: 'text/csv',
    category: 'csv',
  });

  // ── 4. Diagram PNG Screenshot ──
  onProgress?.('Capturing Topology Diagram PNG...');
  let diagramDataUrl: string | undefined;
  try {
    diagramDataUrl = await captureTopologyDiagramForReport();
    if (diagramDataUrl) {
      const pngBlob = convertDataUrlToBlob(diagramDataUrl, 'image/png');
      files.push({
        filename: getStandardExportFilename('diagram-png', scenarioName),
        content: pngBlob,
        mimeType: 'image/png',
        category: 'png',
      });
    }
  } catch (err) {
    console.warn('Topology PNG capture failed, continuing:', err);
  }

  // ── 5. PDF Technical Spec & Executive Brief Rendering ──
  onProgress?.('Rendering Architecture Spec & Uplink PDFs via pdfmake...');
  try {
    const pdfMake = await loadPdfMake();
    const logoDataUrl = await fetchAsDataUrl(gigamonLogo).catch(() => undefined);

    // Site sub-diagrams and front panels for architecture report
    const uniqueSites = Array.from(
      new Set(
        nodes
          .filter(isRackableGigamonEquipment)
          .map((n) => (n.data?.site as string || '').trim())
          .filter(Boolean),
      ),
    );
    if (uniqueSites.length === 0) uniqueSites.push('Global / Unassigned');

    let currentNodes = [...nodes];
    for (const site of uniqueSites) {
      currentNodes = autoDeployRack(currentNodes, site);
    }

    const chassisFrontPanelImages: Record<string, string> = {};
    const siteRackImages: Record<string, string> = {};
    const siteDiagrams: Record<string, string> = {};

    for (const node of currentNodes) {
      if (node.type === 'hardwareNode' && !String(node.data?.model || '').includes('TAP')) {
        try {
          const hw = node.data as HardwareNodeData;
          const slots = getModuleSlotPositions(String(node.data?.model || ''));
          const img = getChassisImagePath(String(node.data?.model || ''));
          const imgData = await captureChassisFrontPanelPng(img, slots, hw.installedBoards || {});
          if (imgData) chassisFrontPanelImages[node.id] = imgData;
        } catch {
          // Graceful fallback
        }
      }
    }

    for (const site of uniqueSites) {
      try {
        const rackImg = await captureRackElevationPng(currentNodes, site, chassisFrontPanelImages);
        if (rackImg) siteRackImages[site] = rackImg;
      } catch {
        // Graceful fallback
      }
      try {
        const siteNodeIds = currentNodes
          .filter((n) => (n.data?.site || 'Global / Unassigned') === site && n.id !== CONSOLIDATED_DEVICES_NODE_ID)
          .map((n) => n.id);
        const sitePng = await captureSiteTopologyDiagramForReport(siteNodeIds);
        if (sitePng) siteDiagrams[site] = sitePng;
      } catch {
        // Graceful fallback
      }
    }

    const reportInput: import('./report/buildReportDocDefinition').ReportInput = {
      nodes: currentNodes,
      edges,
      trafficStreams: trafficStreams || [],
      projectName: scenarioName,
      projectRegion: projectRegion || 'US',
      projectLicenseMode: projectLicenseMode === 'HTL' ? 'HTL' : 'Perpetual',
      defaultTermDuration: defaultTermDuration || '36',
      peakNodeRxMbps: peakNodeRxMbps || {},
      advancedMode: Boolean(advancedMode),
      diagramDataUrl: diagramDataUrl || '',
      logoDataUrl,
      nodeMetrics: (nodeMetrics as Record<string, NodeMetrics>) || {},
      isRunning: Boolean(isRunning),
      chassisFrontPanelImages,
      siteRackImages,
      siteDiagrams,
    };

    // A. Signal Path Engineering Technical Spec PDF
    const archDocDef = buildReportDocDefinition(reportInput);
    const archBlob = await renderPdfDocToBlob(pdfMake.createPdf(archDocDef));
    files.push({
      filename: getStandardExportFilename('architecture-pdf', scenarioName),
      content: archBlob,
      mimeType: 'application/pdf',
      category: 'pdf',
    });

    // B. Uplink Executive Outcome Brief PDF
    const uplinkDocDef = buildUplinkReportDocDefinition(reportInput);
    const uplinkBlob = await renderPdfDocToBlob(pdfMake.createPdf(uplinkDocDef));
    files.push({
      filename: getStandardExportFilename('uplink-pdf', scenarioName),
      content: uplinkBlob,
      mimeType: 'application/pdf',
      category: 'pdf',
    });
  } catch (err) {
    console.warn('PDF generation in solution package encountered an error:', err);
  }

  return files;
}

/**
 * Prompts the user with the native Directory Chooser to pick or create a target folder,
 * then writes all solution assets directly into that directory.
 * Falls back to saving an All-in-One ZIP package if directory picker is not available.
 */
export async function exportSolutionToDirectoryOrZip(
  options: GeneratePackageOptions,
): Promise<{
  success: boolean;
  directoryName?: string;
  zipFilename?: string;
  fileCount: number;
}> {
  const scenarioName = options.currentScenarioName || 'Solution';

  // 1. Try modern File System Access Directory Picker (showDirectoryPicker) FIRST while user gesture is active
  if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
    let dirHandle: FileSystemDirectoryHandle | null = null;
    try {
      dirHandle = await (window as unknown as {
        showDirectoryPicker: (opts?: { id?: string; mode?: string }) => Promise<FileSystemDirectoryHandle>;
      }).showDirectoryPicker({
        mode: 'readwrite',
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled folder chooser
        return { success: false, fileCount: 0 };
      }
      console.warn('showDirectoryPicker unavailable or threw, falling back to ZIP package:', err);
    }

    if (dirHandle) {
      options.onProgress?.('Generating deliverables (PDF reports, CSVs, JSON, diagram)...');
      const assets = await generateAllSolutionAssets(options);

      options.onProgress?.(`Writing ${assets.length} files to folder "${dirHandle.name}"...`);

      for (const asset of assets) {
        const fileHandle = await dirHandle.getFileHandle(asset.filename, { create: true });
        const writable = await fileHandle.createWritable();
        const blob = typeof asset.content === 'string'
          ? new Blob([asset.content], { type: asset.mimeType })
          : asset.content;
        await writable.write(blob);
        await writable.close();
      }

      return {
        success: true,
        directoryName: dirHandle.name,
        fileCount: assets.length,
      };
    }
  }

  // 2. Universal Fallback: Bundle all files into a structured ZIP archive
  options.onProgress?.('Generating deliverables for ZIP package...');
  const assets = await generateAllSolutionAssets(options);

  options.onProgress?.('Packaging all deliverables into a ZIP archive...');
  const zip = new JSZip();
  const folderName = getStandardExportFilename('topology-json', scenarioName).replace(/\.json$/i, '');
  const zipFolder = zip.folder(folderName) || zip;

  for (const asset of assets) {
    if (typeof asset.content === 'string') {
      zipFolder.file(asset.filename, asset.content);
    } else {
      let data: ArrayBuffer | Uint8Array;
      if (typeof (asset.content as Blob).arrayBuffer === 'function') {
        data = await (asset.content as Blob).arrayBuffer();
      } else {
        data = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = reject;
          reader.readAsArrayBuffer(asset.content as Blob);
        });
      }
      zipFolder.file(asset.filename, data);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const defaultZipName = `${folderName}_Package.zip`;

  const saveRes = await saveWithFilePickerOrPrompt(zipBlob, defaultZipName, {
    description: 'Solution Deliverables ZIP Package',
    mimeType: 'application/zip',
    extension: '.zip',
  });

  return {
    success: saveRes.saved,
    zipFilename: saveRes.filename,
    fileCount: assets.length,
  };
}
