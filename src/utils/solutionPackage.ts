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
import { buildPhysicalItems, parseAndConvertDimensions } from './bom/physicalItems';
import { buildReportDocDefinition } from './report/buildReportDocDefinition';
import { buildQuotePdfDocDefinition } from './report/quotePdfReport';
import { captureTopologyDiagramForReport, captureSiteTopologyDiagramForReport } from './report/captureTopologyDiagram';
import { captureChassisFrontPanelPng } from './report/captureChassisFrontPanel';
import { captureRackElevationPng } from './report/captureRackElevation';
import { autoDeployRack } from './autoRack';
import { isRackableGigamonEquipment, getModuleSlotPositions, getChassisImagePath } from './hardwareUtils';
import {
  createQuoteItemsFromBom,
  calculateQuoteSummary,
  DEFAULT_DISCOUNT_CONFIG,
  type DiscountCategoryConfig,
  type QuoteLineItem,
} from './pricingEngine';
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

  // ── 4. Commercial Quotation Items, CSV & JSON ──
  onProgress?.('Generating Commercial Quotation Files...');
  const quoteItems: QuoteLineItem[] = createQuoteItemsFromBom(
    finalBom,
    parseInt(defaultTermDuration || '36', 10),
  );
  const discountConfig: DiscountCategoryConfig = { ...DEFAULT_DISCOUNT_CONFIG };
  const quoteSummary = calculateQuoteSummary(quoteItems, discountConfig, false, false, false);

  // Quote CSV
  const quoteHeaders = [
    'Category',
    'SKU',
    'Description',
    'Qty',
    'Term (Months)',
    'Unit List Price',
    'Ext List Price',
    'Discount %',
    'Discount Amount',
    'Ext Net Price',
    'Site / Location',
    'Notes',
  ].join(',');

  const quoteRowLines = quoteSummary.items.map((i) =>
    [
      escapeCsv(i.category),
      escapeCsv(i.sku),
      escapeCsv(i.description),
      i.qty,
      i.termMonths || '',
      i.unitListPrice.toFixed(2),
      i.extendedListPrice.toFixed(2),
      i.effectiveDiscountPercent.toFixed(1) + '%',
      i.discountAmount.toFixed(2),
      i.extendedNetPrice.toFixed(2),
      escapeCsv(i.site || 'Global / Unassigned'),
      escapeCsv(i.note || (i.isCustomOrAdHoc ? 'Ad-hoc SKU' : '')),
    ].join(','),
  );

  const quoteSummaryRows = [
    '',
    `Total Extended List Price,,,,,${quoteSummary.totalListPrice.toFixed(2)}`,
    `Total Discount Savings,,,,,${quoteSummary.totalDiscountAmount.toFixed(2)},(${quoteSummary.effectiveDiscountPercent.toFixed(1)}% Overall Discount)`,
    `Total Commercial Net Investment,,,,,${quoteSummary.totalNetPrice.toFixed(2)}`,
    '',
    'IMPORTANT DISCLAIMER & NON-BINDING NOTICE: This document and the associated figures represent an indicative illustrative order of magnitude quotation generated as an informal engineering and budgetary aid. It is strictly non-binding and non-contractual. Gigamon is under no obligation to honour indicated quantities configurations part numbers list prices or discount rates. Official binding proposals and terms must be obtained directly through formal Gigamon sales channels and authorised partners.',
  ];

  const quoteCsv = [quoteHeaders, ...quoteRowLines, ...quoteSummaryRows].join('\n');
  files.push({
    filename: getStandardExportFilename('quote-csv', scenarioName),
    content: quoteCsv,
    mimeType: 'text/csv',
    category: 'csv',
  });

  // Quote JSON
  const quoteJsonData = {
    version: '1.0',
    type: 'commercial-quote',
    savedAt: new Date().toISOString(),
    scenarioName,
    projectLicenseMode,
    defaultTermDuration,
    projectRegion,
    items: quoteItems,
    discountConfig,
    rawDiscountInputs: {},
    excludeOptics: false,
    freePowerCords: false,
    spanOnlyMode: false,
    summarySnapshot: {
      totalListPrice: quoteSummary.totalListPrice,
      totalDiscountAmount: quoteSummary.totalDiscountAmount,
      totalNetPrice: quoteSummary.totalNetPrice,
      effectiveDiscountPercent: quoteSummary.effectiveDiscountPercent,
      activeLineCount: quoteSummary.activeLineCount,
      totalQty: quoteSummary.totalQty,
    },
  };
  files.push({
    filename: getStandardExportFilename('quote-json', scenarioName),
    content: JSON.stringify(quoteJsonData, null, 2),
    mimeType: 'application/json',
    category: 'json',
  });

  // ── 5. Diagram PNG Screenshot ──
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

  // ── 6. PDF Rendering (Architecture Spec & Commercial Quote) ──
  onProgress?.('Rendering PDF Reports via pdfmake...');
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

    // A. Architecture PDF
    const archDocDef = buildReportDocDefinition({
      nodes: currentNodes,
      edges,
      trafficStreams: trafficStreams || [],
      projectName: scenarioName,
      projectRegion: projectRegion || 'US',
      projectLicenseMode: (projectLicenseMode === 'HTL' ? 'HTL' : 'Perpetual'),
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
    });

    const archBlob = await renderPdfDocToBlob(pdfMake.createPdf(archDocDef));

    files.push({
      filename: getStandardExportFilename('architecture-pdf', scenarioName),
      content: archBlob,
      mimeType: 'application/pdf',
      category: 'pdf',
    });

    // B. Commercial Quote PDF
    const quoteDocDef = buildQuotePdfDocDefinition(
      quoteItems,
      discountConfig,
      false,
      false,
      false,
      {
        scenarioName,
        projectLicenseMode,
        defaultTermDuration,
        projectRegion,
      },
    );

    const quotePdfBlob = await renderPdfDocToBlob(pdfMake.createPdf(quoteDocDef));

    files.push({
      filename: getStandardExportFilename('quote-pdf', scenarioName),
      content: quotePdfBlob,
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
): Promise<{ success: boolean; directoryName?: string; zipFilename?: string; fileCount: number }> {
  const scenarioName = options.currentScenarioName || 'Solution';
  options.onProgress?.('Preparing solution deliverables...');

  const assets = await generateAllSolutionAssets(options);

  // 1. Try modern File System Access Directory Picker (showDirectoryPicker)
  if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
    try {
      const dirHandle = await (window as unknown as {
        showDirectoryPicker: (opts?: { id?: string; mode?: string }) => Promise<FileSystemDirectoryHandle>;
      }).showDirectoryPicker({
        mode: 'readwrite',
      });

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
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled folder chooser
        return { success: false, fileCount: 0 };
      }
      // Otherwise fall through to ZIP package fallback
      console.warn('showDirectoryPicker unavailable or threw, falling back to ZIP package:', err);
    }
  }

  // 2. Universal Fallback: Bundle all files into a structured ZIP archive
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
