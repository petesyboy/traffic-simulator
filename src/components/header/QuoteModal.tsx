/**
 * QuoteModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Commercial Quotation & Pricing Engine modal.
 *
 * Features:
 * - Granular category discount schedule (Software, Chassis, Modules, Optics, TAPs, Support)
 * - Selective per-item discount toggles (e.g. discount all software, only specific hardware)
 * - Single-click "Exclude All Optics" toggle
 * - Ad-hoc SKU insertion from full price list catalogue
 * - Inline editable unit list prices and term months
 * - Real-time financial summary metrics
 * - CSV and formal PDF quote export
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../../store/store';
import { generateBom, getSkus } from '../../utils/bomEngine';
import { consolidateSimpleDeviceRows } from '../../utils/bom/consolidateSimpleDevices';
import { buildProjectWideOpticBom } from '../../utils/bom/opticPacks';
import { skuService } from '../../services/skuService';
import {
  type QuoteLineItem,
  type DiscountCategoryConfig,
  type QuoteCategory,
  DEFAULT_DISCOUNT_CONFIG,
  createQuoteItemsFromBom,
  createAdHocQuoteItem,
  convertQuoteItemsLicenseMode,
  calculateQuoteSummary,
  formatCurrency,
  exportQuoteToCsv,
  exportCommercialQuoteToJson,
  parseCommercialQuoteJson,
} from '../../utils/pricingEngine';
import { saveWithFilePickerOrPrompt } from '../../utils/fileSaveHelper';
import { buildQuotePdfDocDefinition } from '../../utils/report/quotePdfReport';
import type { TDocumentDefinitions, TCreatedPdf } from 'pdfmake/interfaces';

export interface QuoteModalProps {
  onClose: () => void;
}

interface PdfMakeStatic {
  createPdf: (documentDefinitions: TDocumentDefinitions) => TCreatedPdf;
  addVirtualFileSystem: (vfs: Record<string, string>) => void;
}

async function loadPdfMake(): Promise<PdfMakeStatic> {
  const pdfMakeModule = (await import('pdfmake/build/pdfmake')) as unknown as { default: PdfMakeStatic };
  const pdfFontsModule = (await import('pdfmake/build/vfs_fonts')) as unknown as { default: Record<string, string> };
  const pdfMake = pdfMakeModule.default;
  pdfMake.addVirtualFileSystem(pdfFontsModule.default);
  return pdfMake;
}

const CATEGORY_COLORS: Record<QuoteCategory, string> = {
  Software: '#a855f7',
  Chassis: '#38bdf8',
  Module: '#06b6d4',
  Optic: '#f59e0b',
  TAP: '#10b981',
  Support: '#ec4899',
  Accessory: '#64748b',
  Other: '#94a3b8',
};

const QuoteModal: React.FC<QuoteModalProps> = ({ onClose }) => {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const globalLicenseMode = useStore((s) => s.projectLicenseMode);
  const setProjectLicenseMode = useStore((s) => s.setProjectLicenseMode);
  const globalTermDuration = useStore((s) => s.defaultTermDuration);
  const setDefaultTermDuration = useStore((s) => s.setDefaultTermDuration);
  const globalRegion = useStore((s) => s.projectRegion);
  const currentScenarioName = useStore((s) => s.currentScenarioName);
  const peakNodeRxMbps = useStore((s) => s.peakNodeRxMbps);

  // Initialize quote items from project-wide consolidated Master BOM rows
  const [items, setItems] = useState<QuoteLineItem[]>(() => {
    const rawBom = consolidateSimpleDeviceRows(
      generateBom(nodes, edges, globalLicenseMode, globalTermDuration, globalRegion, true, peakNodeRxMbps),
    );
    const masterBom = buildProjectWideOpticBom(rawBom, getSkus());
    const defaultTerm = parseInt(globalTermDuration || '12', 10) || 12;
    return createQuoteItemsFromBom(masterBom, defaultTerm);
  });

  // Track license mode switches: re-generate BOM items to reflect Perpetual vs HTL SKUs/pricing
  const prevLicenseModeRef = useRef(globalLicenseMode);
  useEffect(() => {
    if (prevLicenseModeRef.current !== globalLicenseMode) {
      prevLicenseModeRef.current = globalLicenseMode;
      const rawBom = consolidateSimpleDeviceRows(
        generateBom(nodes, edges, globalLicenseMode, globalTermDuration, globalRegion, true, peakNodeRxMbps),
      );
      const masterBom = buildProjectWideOpticBom(rawBom, getSkus());
      const defaultTerm = parseInt(globalTermDuration || '12', 10) || 12;
      const newBomItems = createQuoteItemsFromBom(masterBom, defaultTerm);

      setItems((prevItems) =>
        convertQuoteItemsLicenseMode(prevItems, newBomItems, globalLicenseMode, defaultTerm),
      );
      // Clear out stale buffered inputs
      setRawRowInputs({});
    }
  }, [globalLicenseMode, globalTermDuration, globalRegion, nodes, edges, peakNodeRxMbps]);

  // Track term duration changes: update term for all monthly subscription items
  const prevTermDurationRef = useRef(globalTermDuration);
  useEffect(() => {
    if (prevTermDurationRef.current !== globalTermDuration) {
      prevTermDurationRef.current = globalTermDuration;
      const parsedTerm = parseInt(globalTermDuration || '12', 10) || 12;
      setItems((prevItems) =>
        prevItems.map((it) =>
          it.isMonthlyPrice ? { ...it, termMonths: parsedTerm } : it,
        ),
      );
    }
  }, [globalTermDuration]);

  // Category discount matrix
  const [discountConfig, setDiscountConfig] = useState<DiscountCategoryConfig>(DEFAULT_DISCOUNT_CONFIG);
  // Raw string state for discount inputs to comply with React number input rules
  const [rawDiscountInputs, setRawDiscountInputs] = useState<Record<string, string>>({
    global: '0',
    software: '0',
    chassis: '0',
    modules: '0',
    optics: '0',
    taps: '0',
    support: '0',
    accessories: '0',
  });

  // Exclude all optics toggle
  const [excludeOptics, setExcludeOptics] = useState<boolean>(false);
  // Free power cords (100% discount) toggle
  const [freePowerCords, setFreePowerCords] = useState<boolean>(false);
  // SPAN-only mode toggle (removes TAPs & trays, halves TAP termination optics)
  const [spanOnlyMode, setSpanOnlyMode] = useState<boolean>(false);
  // Collapsible discount schedule for smaller laptop screens
  const [isDiscountsCollapsed, setIsDiscountsCollapsed] = useState<boolean>(false);

  // Ad-hoc SKU search state
  const [skuSearchQuery, setSkuSearchQuery] = useState<string>('');
  const [selectedAdHocSku, setSelectedAdHocSku] = useState<string>('');
  const [adHocQty, setAdHocQty] = useState<string>('1');
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // All available catalogue SKUs for ad-hoc insertion
  const allCatalogueSkus = useMemo(() => skuService.getAllSKUs(), []);

  const filteredCatalogueSkus = useMemo(() => {
    if (!skuSearchQuery.trim()) return allCatalogueSkus.slice(0, 50);
    return skuService.searchSKUs(skuSearchQuery).slice(0, 50);
  }, [allCatalogueSkus, skuSearchQuery]);

  // Financial summary
  const summary = useMemo(
    () => calculateQuoteSummary(items, discountConfig, excludeOptics, freePowerCords, spanOnlyMode),
    [items, discountConfig, excludeOptics, freePowerCords, spanOnlyMode],
  );

  // Calculate live financial impact & savings for each of the 3 top toggles
  const toggleSavings = useMemo(() => {
    // 1. SPAN Only impact
    const withTaps = calculateQuoteSummary(items, discountConfig, excludeOptics, freePowerCords, false);
    const spanOnly = calculateQuoteSummary(items, discountConfig, excludeOptics, freePowerCords, true);
    const spanSavingsNet = Math.max(0, withTaps.totalNetPrice - spanOnly.totalNetPrice);
    const spanSavingsPct = withTaps.totalNetPrice > 0 ? (spanSavingsNet / withTaps.totalNetPrice) * 100 : 0;

    // 2. Exclude All Optics impact
    const withOptics = calculateQuoteSummary(items, discountConfig, false, freePowerCords, spanOnlyMode);
    const noOptics = calculateQuoteSummary(items, discountConfig, true, freePowerCords, spanOnlyMode);
    const opticsSavingsNet = Math.max(0, withOptics.totalNetPrice - noOptics.totalNetPrice);
    const opticsSavingsPct = withOptics.totalNetPrice > 0 ? (opticsSavingsNet / withOptics.totalNetPrice) * 100 : 0;

    // 3. Free Power Cords impact
    const paidCords = calculateQuoteSummary(items, discountConfig, excludeOptics, false, spanOnlyMode);
    const freeCords = calculateQuoteSummary(items, discountConfig, excludeOptics, true, spanOnlyMode);
    const cordsSavingsNet = Math.max(0, paidCords.totalNetPrice - freeCords.totalNetPrice);
    const cordsSavingsPct = paidCords.totalNetPrice > 0 ? (cordsSavingsNet / paidCords.totalNetPrice) * 100 : 0;

    return {
      span: { net: spanSavingsNet, pct: spanSavingsPct },
      optics: { net: opticsSavingsNet, pct: opticsSavingsPct },
      cords: { net: cordsSavingsNet, pct: cordsSavingsPct },
    };
  }, [items, discountConfig, excludeOptics, freePowerCords, spanOnlyMode]);

  // Update discount input handler
  const handleDiscountInputChange = (key: keyof DiscountCategoryConfig, valStr: string) => {
    setRawDiscountInputs((prev) => ({ ...prev, [key]: valStr }));
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed)) {
      setDiscountConfig((prev) => ({ ...prev, [key]: Math.max(0, Math.min(100, parsed)) }));
    }
  };

  // Add ad-hoc SKU to quote
  const handleAddAdHocSku = () => {
    if (!selectedAdHocSku) return;
    const qty = parseInt(adHocQty, 10) || 1;
    const term = parseInt(globalTermDuration || '12', 10) || 12;
    const newItem = createAdHocQuoteItem(selectedAdHocSku, qty, term);
    setItems((prev) => [newItem, ...prev]);
    setSelectedAdHocSku('');
    setSkuSearchQuery('');
    setAdHocQty('1');
  };

  // Raw string state for table row inputs to prevent React cursor jumping / resetting on Backspace
  const [rawRowInputs, setRawRowInputs] = useState<
    Record<string, { qty?: string; termMonths?: string; unitListPrice?: string; discountOverride?: string }>
  >({});

  // Line item modifications
  const handleUpdateItem = (id: string, updates: Partial<QuoteLineItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const handleRowQtyChange = (id: string, val: string) => {
    setRawRowInputs((prev) => ({
      ...prev,
      [id]: { ...prev[id], qty: val },
    }));
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      handleUpdateItem(id, { qty: parsed });
    }
  };

  const handleRowQtyBlur = (id: string, currentQty: number) => {
    const rawVal = rawRowInputs[id]?.qty;
    if (rawVal !== undefined) {
      const parsed = parseInt(rawVal, 10);
      const safeQty = isNaN(parsed) || parsed < 1 ? currentQty || 1 : parsed;
      handleUpdateItem(id, { qty: safeQty });
      setRawRowInputs((prev) => {
        const next = { ...prev };
        if (next[id]) {
          delete next[id].qty;
          if (Object.keys(next[id]).length === 0) delete next[id];
        }
        return next;
      });
    }
  };

  const handleRowTermChange = (id: string, val: string) => {
    setRawRowInputs((prev) => ({
      ...prev,
      [id]: { ...prev[id], termMonths: val },
    }));
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      handleUpdateItem(id, { termMonths: parsed });
    } else if (val.trim() === '') {
      handleUpdateItem(id, { termMonths: undefined });
    }
  };

  const handleRowTermBlur = (id: string, currentTerm?: number) => {
    const rawVal = rawRowInputs[id]?.termMonths;
    if (rawVal !== undefined) {
      const parsed = parseInt(rawVal, 10);
      const safeTerm = isNaN(parsed) || parsed < 1 ? currentTerm : parsed;
      handleUpdateItem(id, { termMonths: safeTerm });
      setRawRowInputs((prev) => {
        const next = { ...prev };
        if (next[id]) {
          delete next[id].termMonths;
          if (Object.keys(next[id]).length === 0) delete next[id];
        }
        return next;
      });
    }
  };

  const handleRowPriceChange = (id: string, val: string) => {
    setRawRowInputs((prev) => ({
      ...prev,
      [id]: { ...prev[id], unitListPrice: val },
    }));
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= 0) {
      handleUpdateItem(id, { unitListPrice: parsed });
    }
  };

  const handleRowPriceBlur = (id: string, currentPrice: number) => {
    const rawVal = rawRowInputs[id]?.unitListPrice;
    if (rawVal !== undefined) {
      const parsed = parseFloat(rawVal);
      const safePrice = isNaN(parsed) || parsed < 0 ? currentPrice || 0 : parsed;
      handleUpdateItem(id, { unitListPrice: safePrice });
      setRawRowInputs((prev) => {
        const next = { ...prev };
        if (next[id]) {
          delete next[id].unitListPrice;
          if (Object.keys(next[id]).length === 0) delete next[id];
        }
        return next;
      });
    }
  };

  const handleRowDiscountChange = (id: string, val: string) => {
    setRawRowInputs((prev) => ({
      ...prev,
      [id]: { ...prev[id], discountOverride: val },
    }));
    if (val.trim() === '') {
      handleUpdateItem(id, { discountOverride: undefined });
    } else {
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        handleUpdateItem(id, { discountOverride: Math.max(0, Math.min(100, parsed)) });
      }
    }
  };

  const handleRowDiscountBlur = (id: string) => {
    const rawVal = rawRowInputs[id]?.discountOverride;
    if (rawVal !== undefined) {
      if (rawVal.trim() === '') {
        handleUpdateItem(id, { discountOverride: undefined });
      } else {
        const parsed = parseFloat(rawVal);
        if (!isNaN(parsed)) {
          handleUpdateItem(id, { discountOverride: Math.max(0, Math.min(100, parsed)) });
        }
      }
      setRawRowInputs((prev) => {
        const next = { ...prev };
        if (next[id]) {
          delete next[id].discountOverride;
          if (Object.keys(next[id]).length === 0) delete next[id];
        }
        return next;
      });
    }
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleResetToBom = () => {
    const rawBom = consolidateSimpleDeviceRows(
      generateBom(nodes, edges, globalLicenseMode, globalTermDuration, globalRegion, true, peakNodeRxMbps),
    );
    const masterBom = buildProjectWideOpticBom(rawBom, getSkus());
    const defaultTerm = parseInt(globalTermDuration || '12', 10) || 12;
    setItems(createQuoteItemsFromBom(masterBom, defaultTerm));
    setDiscountConfig(DEFAULT_DISCOUNT_CONFIG);
    setRawDiscountInputs({
      global: '0',
      software: '0',
      chassis: '0',
      modules: '0',
      optics: '0',
      taps: '0',
      support: '0',
      accessories: '0',
    });
    setRawRowInputs({});
    setExcludeOptics(false);
    setFreePowerCords(false);
    setSpanOnlyMode(false);
  };

  // Quote Save/Load JSON Notification and File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [quoteNotification, setQuoteNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Save customized commercial quote as JSON
  const handleSaveQuoteJson = async () => {
    try {
      const res = await exportCommercialQuoteToJson(
        items,
        discountConfig,
        rawDiscountInputs,
        excludeOptics,
        freePowerCords,
        spanOnlyMode,
        {
          scenarioName: currentScenarioName || 'Solution',
          projectLicenseMode: globalLicenseMode,
          defaultTermDuration: globalTermDuration,
          projectRegion: globalRegion,
        },
      );
      if (res.saved) {
        setQuoteNotification({
          type: 'success',
          message: `Commercial quote JSON saved successfully as "${res.filename}" (${items.length} line items).`,
        });
        setTimeout(() => setQuoteNotification(null), 4000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setQuoteNotification({ type: 'error', message: `Failed to save quote: ${msg}` });
    }
  };

  // CSV Export handler
  const handleExportCsv = async () => {
    try {
      const res = await exportQuoteToCsv(
        items,
        discountConfig,
        excludeOptics,
        freePowerCords,
        spanOnlyMode,
        currentScenarioName || undefined,
      );
      if (res.saved) {
        setQuoteNotification({
          type: 'success',
          message: `Commercial quote CSV exported successfully as "${res.filename}".`,
        });
        setTimeout(() => setQuoteNotification(null), 4000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setQuoteNotification({ type: 'error', message: `Failed to export CSV: ${msg}` });
    }
  };

  // Trigger file selection dialog
  const handleTriggerLoadQuote = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Load and restore quote from JSON file
  const handleQuoteFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const loadedData = parseCommercialQuoteJson(text);

      setItems(loadedData.items);
      setDiscountConfig(loadedData.discountConfig);
      if (loadedData.rawDiscountInputs) {
        setRawDiscountInputs(loadedData.rawDiscountInputs);
      }
      setExcludeOptics(loadedData.excludeOptics);
      setFreePowerCords(loadedData.freePowerCords);
      setSpanOnlyMode(loadedData.spanOnlyMode);
      setRawRowInputs({});
      setQuoteNotification({
        type: 'success',
        message: `Successfully loaded commercial quote from "${file.name}" (${loadedData.items.length} line items).`,
      });
      setTimeout(() => setQuoteNotification(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setQuoteNotification({
        type: 'error',
        message: `Failed to load quote: ${msg}`,
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // PDF Export handler
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    setPdfError(null);
    try {
      const pdfMake = await loadPdfMake();
      const docDef = buildQuotePdfDocDefinition(items, discountConfig, excludeOptics, freePowerCords, spanOnlyMode, {
        scenarioName: currentScenarioName || 'Gigamon_Solution',
        projectLicenseMode: globalLicenseMode,
        defaultTermDuration: globalTermDuration,
        projectRegion: globalRegion,
      });
      const cleanName = currentScenarioName
        ? currentScenarioName.replace(/[^a-zA-Z0-9_-]/g, '_')
        : 'Quote';
      const defaultFilename = `Commercial_Quote_${cleanName}.pdf`;

      const pdfBlob: Blob = await new Promise<Blob>((resolve, reject) => {
        try {
          const pdfDoc = pdfMake.createPdf(docDef) as unknown as {
            getBlob: (cb: (blob: Blob) => void) => void;
          };
          pdfDoc.getBlob((blob: Blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('PDF generation produced an empty file.'));
            }
          });
        } catch (err) {
          reject(err);
        }
      });

      const res = await saveWithFilePickerOrPrompt(pdfBlob, defaultFilename, {
        description: 'PDF Quotation Document',
        mimeType: 'application/pdf',
        extension: '.pdf',
      });

      if (res.saved) {
        setQuoteNotification({
          type: 'success',
          message: `Formal quote PDF saved successfully as "${res.filename}".`,
        });
        setTimeout(() => setQuoteNotification(null), 4000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPdfError(`Failed to generate quotation PDF: ${msg}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        background: 'rgba(0,0,0,0.85)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="modal-card"
        style={{
          width: '1440px',
          maxWidth: '96vw',
          height: 'min(92vh, 960px)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 16px 64px rgba(0,0,0,0.9)',
          background: '#111827',
          border: '1px solid #374151',
          color: '#f3f4f6',
          overflow: 'hidden',
          padding: '16px 20px',
          boxSizing: 'border-box',
        }}
      >
        {/* ── Modal Header ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #374151',
            paddingBottom: '12px',
            marginBottom: '14px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>💼</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#38bdf8' }}>
                Commercial Quotation & Pricing Engine
              </h3>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>{currentScenarioName || 'Layout'}</span>
                <span>•</span>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#d1d5db', cursor: 'pointer' }}>
                  <span style={{ fontSize: '11px' }}>Licence Mode:</span>
                  <select
                    value={globalLicenseMode}
                    onChange={(e) => setProjectLicenseMode(e.target.value as 'HTL' | 'Perpetual')}
                    style={{
                      background: '#1f2937',
                      border: '1px solid #4b5563',
                      borderRadius: '4px',
                      color: globalLicenseMode === 'HTL' ? '#38bdf8' : '#34d399',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      cursor: 'pointer',
                    }}
                    title="Switch project between Hybrid Term Licensing (HTL) and Perpetual Licensing"
                  >
                    <option value="HTL">Hybrid Term (HTL)</option>
                    <option value="Perpetual">Perpetual</option>
                  </select>
                </label>
                {globalLicenseMode === 'HTL' && (
                  <>
                    <span>•</span>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#d1d5db', cursor: 'pointer' }}>
                      <span style={{ fontSize: '11px' }}>Term:</span>
                      <select
                        value={globalTermDuration || '12'}
                        onChange={(e) => setDefaultTermDuration(e.target.value)}
                        style={{
                          background: '#1f2937',
                          border: '1px solid #4b5563',
                          borderRadius: '4px',
                          color: '#c084fc',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          cursor: 'pointer',
                        }}
                        title="Default subscription term in months"
                      >
                        <option value="12">12 Months (1 Yr)</option>
                        <option value="24">24 Months (2 Yrs)</option>
                        <option value="36">36 Months (3 Yrs)</option>
                        <option value="48">48 Months (4 Yrs)</option>
                        <option value="60">60 Months (5 Yrs)</option>
                      </select>
                    </label>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
            {/* SPAN Only Mode Toggle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: spanOnlyMode ? 'rgba(6, 182, 212, 0.15)' : '#1f2937',
                  border: `1px solid ${spanOnlyMode ? '#06b6d4' : '#374151'}`,
                  padding: '5px 9px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: spanOnlyMode ? '#22d3ee' : '#d1d5db',
                  userSelect: 'none',
                }}
                title="Convert solution to SPAN only: removes all TAPs & TAP trays, and halves TAP termination optics"
              >
                <input
                  type="checkbox"
                  checked={spanOnlyMode}
                  onChange={(e) => setSpanOnlyMode(e.target.checked)}
                  style={{ cursor: 'pointer', accentColor: '#06b6d4' }}
                />
                📡 Convert to SPAN Only
              </label>
              {spanOnlyMode && toggleSavings.span.net > 0 && (
                <div
                  style={{
                    fontSize: '10px',
                    color: '#22d3ee',
                    fontWeight: 'bold',
                    marginTop: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                  title="Total commercial investment savings achieved by eliminating physical TAPs & trays"
                >
                  ⬇ {formatCurrency(toggleSavings.span.net)} ({toggleSavings.span.pct.toFixed(1)}% off)
                </div>
              )}
            </div>

            {/* Exclude All Optics Checkbox */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: excludeOptics ? 'rgba(245, 158, 11, 0.15)' : '#1f2937',
                  border: `1px solid ${excludeOptics ? '#f59e0b' : '#374151'}`,
                  padding: '5px 9px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: excludeOptics ? '#fbbf24' : '#d1d5db',
                  userSelect: 'none',
                }}
                title="Exclude all optics and transceivers (for customer-supplied optics)"
              >
                <input
                  type="checkbox"
                  checked={excludeOptics}
                  onChange={(e) => setExcludeOptics(e.target.checked)}
                  style={{ cursor: 'pointer', accentColor: '#f59e0b' }}
                />
                🚫 Exclude All Optics
              </label>
              {excludeOptics && toggleSavings.optics.net > 0 && (
                <div
                  style={{
                    fontSize: '10px',
                    color: '#fbbf24',
                    fontWeight: 'bold',
                    marginTop: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                  title="Total commercial investment savings achieved by excluding all transceivers"
                >
                  ⬇ {formatCurrency(toggleSavings.optics.net)} ({toggleSavings.optics.pct.toFixed(1)}% off)
                </div>
              )}
            </div>

            {/* 100% Discount on Power Cords Checkbox */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: freePowerCords ? 'rgba(34, 197, 94, 0.15)' : '#1f2937',
                  border: `1px solid ${freePowerCords ? '#22c55e' : '#374151'}`,
                  padding: '5px 9px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: freePowerCords ? '#4ade80' : '#d1d5db',
                  userSelect: 'none',
                }}
                title="Apply 100% discount on TA & HC international power cords (PCD-00003/5/7/9 & PCD-000R3/5/7/9, included free of charge)"
              >
                <input
                  type="checkbox"
                  checked={freePowerCords}
                  onChange={(e) => setFreePowerCords(e.target.checked)}
                  style={{ cursor: 'pointer', accentColor: '#22c55e' }}
                />
                🔌 100% Disc Power Cords
              </label>
              {freePowerCords && toggleSavings.cords.net > 0 && (
                <div
                  style={{
                    fontSize: '10px',
                    color: '#4ade80',
                    fontWeight: 'bold',
                    marginTop: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                  title="Total commercial investment savings achieved by 100% discount on power cords"
                >
                  ⬇ {formatCurrency(toggleSavings.cords.net)} ({toggleSavings.cords.pct.toFixed(1)}% off)
                </div>
              )}
            </div>
            <button
              onClick={handleSaveQuoteJson}
              className="btn btn-secondary"
              style={{
                fontSize: '11px',
                padding: '5px 10px',
                background: '#1f2937',
                border: '1px solid #10b981',
                color: '#34d399',
                fontWeight: 600,
              }}
              title="Save this customized commercial quote with all overrides as a JSON file"
            >
              💾 Save Quote
            </button>
            <button
              onClick={handleTriggerLoadQuote}
              className="btn btn-secondary"
              style={{
                fontSize: '11px',
                padding: '5px 10px',
                background: '#1f2937',
                border: '1px solid #38bdf8',
                color: '#38bdf8',
                fontWeight: 600,
              }}
              title="Load and restore a previously saved commercial quote JSON file"
            >
              📂 Load Quote
            </button>
            <button
              onClick={handleResetToBom}
              className="btn btn-ghost"
              style={{ fontSize: '11px', padding: '5px 10px', color: '#9ca3af' }}
              title="Reset items and discounts back to current layout BOM"
            >
              ↺ Reset to BOM
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#9ca3af',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '0 4px',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Scrollable Body ── */}
        <div
          style={{
            overflowY: 'auto',
            overflowX: 'hidden',
            flex: '1 1 auto',
            minHeight: 0,
            paddingRight: '6px',
            paddingBottom: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {/* Notification / Toast Banner */}
          {quoteNotification && (
            <div
              style={{
                padding: '8px 14px',
                marginBottom: '12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                background: quoteNotification.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${quoteNotification.type === 'success' ? '#22c55e' : '#ef4444'}`,
                color: quoteNotification.type === 'success' ? '#4ade80' : '#f87171',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>{quoteNotification.type === 'success' ? '✓ ' : '⚠️ '}{quoteNotification.message}</span>
              <button
                onClick={() => setQuoteNotification(null)}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>
          )}
          {/* ── Section 1: Discount Schedule Matrix ── */}
          <div
            style={{
              background: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              padding: isDiscountsCollapsed ? '8px 16px' : '12px 16px',
              transition: 'all 0.2s ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                marginBottom: isDiscountsCollapsed ? '0' : '10px',
              }}
              onClick={() => setIsDiscountsCollapsed((prev) => !prev)}
              title="Click to expand or collapse category discount schedule"
            >
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🎯 Discount Schedule (%) — Category & Blanket Rules
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: '11px', padding: '2px 8px', color: '#38bdf8' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDiscountsCollapsed((prev) => !prev);
                }}
              >
                {isDiscountsCollapsed ? '▼ Show Discounts' : '▲ Hide Discounts'}
              </button>
            </div>
            {!isDiscountsCollapsed && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#9ca3af', marginBottom: '3px' }}>Global Default %</label>
                <input
                  type="text"
                  value={rawDiscountInputs.global}
                  onChange={(e) => handleDiscountInputChange('global', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    background: '#111827',
                    border: '1px solid #4b5563',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                  placeholder="0"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#c084fc', marginBottom: '3px' }}>All Software %</label>
                <input
                  type="text"
                  value={rawDiscountInputs.software}
                  onChange={(e) => handleDiscountInputChange('software', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    background: '#111827',
                    border: '1px solid #7e22ce',
                    color: '#c084fc',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                  placeholder="0"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#38bdf8', marginBottom: '3px' }}>Chassis / Switches %</label>
                <input
                  type="text"
                  value={rawDiscountInputs.chassis}
                  onChange={(e) => handleDiscountInputChange('chassis', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    background: '#111827',
                    border: '1px solid #0284c7',
                    color: '#38bdf8',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                  placeholder="0"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#22d3ee', marginBottom: '3px' }}>Modules %</label>
                <input
                  type="text"
                  value={rawDiscountInputs.modules}
                  onChange={(e) => handleDiscountInputChange('modules', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    background: '#111827',
                    border: '1px solid #0891b2',
                    color: '#22d3ee',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                  placeholder="0"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#fbbf24', marginBottom: '3px' }}>Optics / Cables %</label>
                <input
                  type="text"
                  value={rawDiscountInputs.optics}
                  onChange={(e) => handleDiscountInputChange('optics', e.target.value)}
                  disabled={excludeOptics}
                  style={{
                    width: '100%',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    background: excludeOptics ? '#374151' : '#111827',
                    border: '1px solid #d97706',
                    color: excludeOptics ? '#6b7280' : '#fbbf24',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                  placeholder="0"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#34d399', marginBottom: '3px' }}>TAPs & Trays %</label>
                <input
                  type="text"
                  value={rawDiscountInputs.taps}
                  onChange={(e) => handleDiscountInputChange('taps', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    background: '#111827',
                    border: '1px solid #059669',
                    color: '#34d399',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                  placeholder="0"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#f472b6', marginBottom: '3px' }}>Support %</label>
                <input
                  type="text"
                  value={rawDiscountInputs.support}
                  onChange={(e) => handleDiscountInputChange('support', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    background: '#111827',
                    border: '1px solid #db2777',
                    color: '#f472b6',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                  placeholder="0"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#a78bfa', marginBottom: '3px' }}>Accessories %</label>
                <input
                  type="text"
                  value={rawDiscountInputs.accessories}
                  onChange={(e) => handleDiscountInputChange('accessories', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    background: '#111827',
                    border: '1px solid #7c3aed',
                    color: '#a78bfa',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                  placeholder="0"
                />
              </div>
            </div>
            )}
          </div>

          {/* ── Section 2: Ad-Hoc SKU Lookup & Add ── */}
          <div
            style={{
              background: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              padding: '10px 16px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#9ca3af', minWidth: '130px' }}>
              ➕ Add SKU to Quote:
            </div>

            <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
              <input
                type="text"
                value={skuSearchQuery}
                onChange={(e) => {
                  setSkuSearchQuery(e.target.value);
                  setSelectedAdHocSku('');
                }}
                placeholder="Search any SKU (e.g. SFP-532, GVS-TAC20, GEM-2500G)..."
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  background: '#111827',
                  border: '1px solid #4b5563',
                  color: '#fff',
                  fontSize: '12px',
                }}
              />
              {skuSearchQuery && !selectedAdHocSku && filteredCatalogueSkus.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    maxHeight: '180px',
                    overflowY: 'auto',
                    background: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '4px',
                    zIndex: 50,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
                    marginTop: '2px',
                  }}
                >
                  {filteredCatalogueSkus.map((s) => (
                    <div
                      key={s.partNumber}
                      onClick={() => {
                        setSelectedAdHocSku(s.partNumber);
                        setSkuSearchQuery(`${s.partNumber} - ${s.description}`);
                      }}
                      style={{
                        padding: '6px 10px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #334155',
                        fontSize: '11px',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#334155')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div>
                        <span style={{ color: '#38bdf8', fontWeight: 'bold', fontFamily: 'monospace' }}>
                          {s.partNumber}
                        </span>
                        <span style={{ color: '#94a3b8', marginLeft: '8px' }}>{s.description}</span>
                      </div>
                      <span style={{ color: '#fbbf24', fontFamily: 'monospace' }}>
                        {s.listPrice ? formatCurrency(s.listPrice) : s.listPriceMonthly ? `${formatCurrency(s.listPriceMonthly)}/mo` : 'Unpriced'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Qty:</span>
              <input
                type="text"
                value={adHocQty}
                onChange={(e) => setAdHocQty(e.target.value)}
                style={{
                  width: '55px',
                  padding: '5px 8px',
                  borderRadius: '4px',
                  background: '#111827',
                  border: '1px solid #4b5563',
                  color: '#fff',
                  fontSize: '12px',
                  textAlign: 'center',
                }}
              />
            </div>

            <button
              onClick={handleAddAdHocSku}
              disabled={!selectedAdHocSku}
              className="btn btn-primary"
              style={{
                fontSize: '12px',
                padding: '6px 14px',
                background: selectedAdHocSku ? '#0284c7' : '#374151',
                border: 'none',
                color: '#fff',
                cursor: selectedAdHocSku ? 'pointer' : 'not-allowed',
              }}
            >
              Add Item
            </button>
          </div>

          {/* ── Section 3: Financial Summary Strip ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
            }}
          >
            <div
              style={{
                background: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                padding: '12px 16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase' }}>Total List Value</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f3f4f6', marginTop: '2px' }}>
                {formatCurrency(summary.totalListPrice)}
              </div>
              <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                {summary.totalQty} units across {summary.activeLineCount} items
              </div>
            </div>

            <div
              style={{
                background: '#1f2937',
                border: '1px solid #059669',
                borderRadius: '8px',
                padding: '12px 16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '10px', color: '#34d399', textTransform: 'uppercase' }}>Commercial Discount Savings</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#34d399', marginTop: '2px' }}>
                {formatCurrency(summary.totalDiscountAmount)}
              </div>
              <div style={{ fontSize: '10px', color: '#10b981', marginTop: '2px' }}>
                {summary.effectiveDiscountPercent.toFixed(1)}% Overall Savings
              </div>
            </div>

            <div
              style={{
                background: '#1f2937',
                border: '1px solid #0284c7',
                borderRadius: '8px',
                padding: '12px 16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '10px', color: '#38bdf8', textTransform: 'uppercase' }}>Net Commercial Investment</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#38bdf8', marginTop: '2px' }}>
                {formatCurrency(summary.totalNetPrice)}
              </div>
              <div style={{ fontSize: '10px', color: '#60a5fa', marginTop: '2px' }}>
                Excluding VAT / Local Taxes
              </div>
            </div>
          </div>

          {/* ── Section 4: Line Items Table ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                📋 Line Items Schedule
              </div>
              <div style={{ fontSize: '11px', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                Showing all <strong>{summary.activeLineCount}</strong> items ({summary.totalQty} total units)
              </div>
            </div>

            <div
              style={{
                border: '1px solid #374151',
                borderRadius: '8px',
                overflowY: 'auto',
                overflowX: 'auto',
                minHeight: '260px',
                flex: '1 1 auto',
                position: 'relative',
                background: '#111827',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#111827' }}>
                  <tr style={{ background: '#111827', borderBottom: '2px solid #374151' }}>
                    <th style={{ position: 'sticky', top: 0, background: '#111827', padding: '10px 12px', color: '#9ca3af', fontSize: '12px' }}>Cat</th>
                    <th style={{ position: 'sticky', top: 0, background: '#111827', padding: '10px 12px', color: '#9ca3af', fontSize: '12px' }}>SKU</th>
                    <th style={{ position: 'sticky', top: 0, background: '#111827', padding: '10px 12px', color: '#9ca3af', fontSize: '12px' }}>Description</th>
                    <th style={{ position: 'sticky', top: 0, background: '#111827', padding: '10px 12px', color: '#9ca3af', fontSize: '12px', textAlign: 'center' }}>Term</th>
                    <th style={{ position: 'sticky', top: 0, background: '#111827', padding: '10px 12px', color: '#9ca3af', fontSize: '12px', textAlign: 'center' }}>Qty</th>
                    <th style={{ position: 'sticky', top: 0, background: '#111827', padding: '10px 12px', color: '#9ca3af', fontSize: '12px', textAlign: 'right' }}>Unit List ($)</th>
                    <th style={{ position: 'sticky', top: 0, background: '#111827', padding: '10px 12px', color: '#9ca3af', fontSize: '12px', textAlign: 'center' }}>Apply Disc?</th>
                    <th style={{ position: 'sticky', top: 0, background: '#111827', padding: '10px 12px', color: '#9ca3af', fontSize: '12px', textAlign: 'center' }}>Disc %</th>
                    <th style={{ position: 'sticky', top: 0, background: '#111827', padding: '10px 12px', color: '#9ca3af', fontSize: '12px', textAlign: 'right' }}>Ext Net ($)</th>
                    <th style={{ position: 'sticky', top: 0, background: '#111827', padding: '10px 12px', color: '#9ca3af', fontSize: '12px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
              <tbody>
                {summary.items.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '28px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
                      No items currently present in quote.
                    </td>
                  </tr>
                ) : (
                  summary.items.map((item, idx) => {
                    const catColor = CATEGORY_COLORS[item.category] || '#94a3b8';
                    const isEven = idx % 2 === 0;

                    return (
                      <tr
                        key={item.id}
                        style={{
                          background: isEven ? '#1f2937' : '#111827',
                          borderBottom: '1px solid #374151',
                        }}
                      >
                        {/* Category */}
                        <td style={{ padding: '10px 12px' }}>
                          <span
                            style={{
                              background: `${catColor}20`,
                              border: `1px solid ${catColor}60`,
                              color: catColor,
                              padding: '3px 7px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              textTransform: 'uppercase',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.category}
                          </span>
                        </td>

                        {/* SKU */}
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#38bdf8', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                          {item.sku}
                        </td>

                        {/* Description */}
                        <td style={{ padding: '10px 12px', color: '#e5e7eb', fontSize: '12px', maxWidth: '320px', lineHeight: '1.4' }}>
                          {item.description}
                          {item.note && (
                            <div style={{ fontSize: '11px', color: '#fbbf24', marginTop: '3px' }}>{item.note}</div>
                          )}
                        </td>

                        {/* Term (Months) */}
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          {item.isMonthlyPrice ? (
                            <input
                              type="text"
                              value={
                                rawRowInputs[item.id]?.termMonths !== undefined
                                  ? rawRowInputs[item.id]!.termMonths!
                                  : String(item.termMonths ?? '')
                              }
                              onChange={(e) => handleRowTermChange(item.id, e.target.value)}
                              onBlur={() => handleRowTermBlur(item.id, item.termMonths)}
                              style={{
                                width: '42px',
                                padding: '4px 6px',
                                borderRadius: '4px',
                                background: '#111827',
                                border: '1px solid #4b5563',
                                color: '#c084fc',
                                fontSize: '12px',
                                textAlign: 'center',
                              }}
                            />
                          ) : (
                            <span style={{ color: '#6b7280' }}>—</span>
                          )}
                        </td>

                        {/* Qty */}
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <input
                            type="text"
                            value={
                              rawRowInputs[item.id]?.qty !== undefined
                                ? rawRowInputs[item.id]!.qty!
                                : String(item.qty)
                            }
                            onChange={(e) => handleRowQtyChange(item.id, e.target.value)}
                            onBlur={() => handleRowQtyBlur(item.id, item.qty)}
                            style={{
                              width: '48px',
                              padding: '4px 6px',
                              borderRadius: '4px',
                              background: '#111827',
                              border: '1px solid #4b5563',
                              color: '#fff',
                              fontSize: '12px',
                              textAlign: 'center',
                              fontWeight: 'bold',
                            }}
                          />
                        </td>

                        {/* Unit List Price (Editable!) */}
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <input
                            type="text"
                            value={
                              rawRowInputs[item.id]?.unitListPrice !== undefined
                                ? rawRowInputs[item.id]!.unitListPrice!
                                : String(item.unitListPrice ?? 0)
                            }
                            onChange={(e) => handleRowPriceChange(item.id, e.target.value)}
                            onBlur={() => handleRowPriceBlur(item.id, item.unitListPrice)}
                            style={{
                              width: '80px',
                              padding: '4px 6px',
                              borderRadius: '4px',
                              background: '#111827',
                              border: item.unitListPrice === 0 ? '1px solid #f59e0b' : '1px solid #4b5563',
                              color: item.unitListPrice === 0 ? '#fbbf24' : '#fff',
                              fontSize: '12px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                            }}
                          />
                          {item.isMonthlyPrice && (
                            <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>/mo</div>
                          )}
                        </td>

                        {/* Apply Discount Checkbox (Selective hardware discounts!) */}
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={item.applyDiscount}
                            onChange={(e) => handleUpdateItem(item.id, { applyDiscount: e.target.checked })}
                            style={{ cursor: 'pointer', accentColor: '#0284c7', width: '15px', height: '15px' }}
                            title="Toggle discount for this specific line"
                          />
                        </td>

                        {/* Discount % Override */}
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <input
                            type="text"
                            value={
                              rawRowInputs[item.id]?.discountOverride !== undefined
                                ? rawRowInputs[item.id]!.discountOverride!
                                : item.discountOverride !== undefined
                                  ? String(item.discountOverride)
                                  : item.effectiveDiscountPercent > 0
                                    ? String(item.effectiveDiscountPercent)
                                    : ''
                            }
                            onChange={(e) => handleRowDiscountChange(item.id, e.target.value)}
                            onBlur={() => handleRowDiscountBlur(item.id)}
                            disabled={!item.applyDiscount}
                            placeholder={item.applyDiscount ? 'Auto' : '0'}
                            style={{
                              width: '48px',
                              padding: '4px 6px',
                              borderRadius: '4px',
                              background: !item.applyDiscount ? '#374151' : '#111827',
                              border: '1px solid #4b5563',
                              color: item.effectiveDiscountPercent > 0 ? '#34d399' : '#9ca3af',
                              fontSize: '12px',
                              textAlign: 'center',
                            }}
                          />
                        </td>

                        {/* Ext Net Price */}
                        <td
                          style={{
                            padding: '10px 12px',
                            textAlign: 'right',
                            fontFamily: 'monospace',
                            fontWeight: 'bold',
                            color: '#38bdf8',
                            fontSize: '13px',
                          }}
                        >
                          {formatCurrency(item.extendedNetPrice)}
                        </td>

                        {/* Delete action */}
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              fontSize: '14px',
                              padding: '3px 6px',
                            }}
                            title="Remove item from quote"
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>
          </div>

          {pdfError && (
            <div
              style={{
                padding: '10px 14px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '6px',
                color: '#f87171',
                fontSize: '12px',
              }}
            >
              ⚠️ {pdfError}
            </div>
          )}
        </div>

        {/* ── Action Footer ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid #374151',
            paddingTop: '12px',
            marginTop: '8px',
            flexShrink: 0,
            gap: '16px',
          }}
        >
          <div style={{ fontSize: '10px', color: '#9ca3af', lineHeight: '1.3', maxWidth: '65%' }}>
            <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>⚠️ Indicative / Order of Magnitude Only:</span>{' '}
            Informal budgetary and engineering aid for SEs, sales leadership, and customers. Strictly non-binding and non-contractual; does not constitute a formal commercial offer by Gigamon.
          </div>

          {/* Hidden File Input for Loading Quote JSON */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleQuoteFileSelected}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
            <button
              onClick={handleSaveQuoteJson}
              className="btn btn-secondary"
              style={{
                fontSize: '12px',
                padding: '6px 13px',
                background: '#1f2937',
                border: '1px solid #10b981',
                color: '#34d399',
                fontWeight: 600,
              }}
              title="Save this customized quote (with all overrides, term durations, and discounts) to a JSON file"
            >
              💾 Save Quote JSON
            </button>

            <button
              onClick={handleTriggerLoadQuote}
              className="btn btn-secondary"
              style={{
                fontSize: '12px',
                padding: '6px 13px',
                background: '#1f2937',
                border: '1px solid #38bdf8',
                color: '#38bdf8',
                fontWeight: 600,
              }}
              title="Restore a previously saved commercial quote JSON file"
            >
              📂 Load Quote JSON
            </button>

            <button
              onClick={handleExportCsv}
              className="btn btn-secondary"
              style={{
                fontSize: '12px',
                padding: '6px 13px',
                background: '#1f2937',
                border: '1px solid #4b5563',
                color: '#f3f4f6',
              }}
            >
              📊 Export Quote CSV
            </button>

            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="btn btn-primary"
              style={{
                fontSize: '12px',
                padding: '6px 15px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                border: '1px solid #38bdf8',
                color: '#ffffff',
                fontWeight: 'bold',
                cursor: isExportingPdf ? 'wait' : 'pointer',
              }}
            >
              {isExportingPdf ? '⏳ Generating Quote PDF...' : '📄 Export Formal Quote PDF'}
            </button>

            <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: '12px', color: '#9ca3af' }}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteModal;
