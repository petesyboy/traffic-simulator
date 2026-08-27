/**
 * quotePdfReport.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates an executive, customer-facing PDF quotation for the solution BOM
 * using the dark cyan/slate/blue design language consistent with the
 * Gigamon Architecture Report.
 */

import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  calculateQuoteSummary,
  formatCurrency,
  type QuoteLineItem,
  type DiscountCategoryConfig,
} from '../pricingEngine';

export interface QuotePdfOptions {
  scenarioName?: string;
  projectLicenseMode?: string;
  defaultTermDuration?: string;
  projectRegion?: string;
  customerName?: string;
  preparedBy?: string;
}

export function buildQuotePdfDocDefinition(
  items: QuoteLineItem[],
  config: DiscountCategoryConfig,
  excludeOptics: boolean,
  freePowerCords: boolean = false,
  spanOnlyMode: boolean = false,
  options: QuotePdfOptions = {},
): TDocumentDefinitions {
  const summary = calculateQuoteSummary(items, config, excludeOptics, freePowerCords, spanOnlyMode);
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const scenario = options.scenarioName || 'Gigamon Visibility Solution';

  // ── Executive Summary Cards ──
  const summaryCard = (title: string, value: string, sub?: string, color: string = '#00e5ff'): Content => ({
    stack: [
      { text: title.toUpperCase(), fontSize: 7, bold: true, color: '#888888', margin: [0, 0, 0, 3] },
      { text: value, fontSize: 14, bold: true, color },
      sub ? { text: sub, fontSize: 7, color: '#aaaaaa', margin: [0, 2, 0, 0] } : { text: '' },
    ],
    margin: [6, 8, 6, 8],
  });

  // ── Category Breakdown Table ──
  const categoryRows: Content[][] = Object.values(summary.categoryBreakdown)
    .filter((c) => c.itemCount > 0)
    .map((c) => [
      { text: c.category, fontSize: 7, bold: true, color: '#ffffff' },
      { text: String(c.totalQty), fontSize: 7, alignment: 'center' as const, color: '#cccccc' },
      { text: formatCurrency(c.listPrice), fontSize: 7, alignment: 'right' as const, color: '#cccccc' },
      {
        text: `${formatCurrency(c.discountAmount)} (${c.listPrice > 0 ? ((c.discountAmount / c.listPrice) * 100).toFixed(1) : '0.0'}%)`,
        fontSize: 7,
        alignment: 'right' as const,
        color: '#22c55e',
      },
      { text: formatCurrency(c.netPrice), fontSize: 7, bold: true, alignment: 'right' as const, color: '#00e5ff' },
    ]);

  // ── Itemized Line Items Table ──
  const tableBody: Content[][] = [
    [
      { text: 'Cat', style: 'tableHeader' },
      { text: 'Part Number (SKU)', style: 'tableHeader' },
      { text: 'Description', style: 'tableHeader' },
      { text: 'Term', style: 'tableHeader', alignment: 'center' },
      { text: 'Qty', style: 'tableHeader', alignment: 'center' },
      { text: 'Unit List', style: 'tableHeader', alignment: 'right' },
      { text: 'Ext List', style: 'tableHeader', alignment: 'right' },
      { text: 'Disc %', style: 'tableHeader', alignment: 'center' },
      { text: 'Ext Net Price', style: 'tableHeader', alignment: 'right' },
    ],
  ];

  summary.items.forEach((item, index) => {
    const isZebra = index % 2 === 1;
    const bg = isZebra ? '#1f2937' : '#111827';
    const isAhrEligible = Boolean(item.inclInSupport);

    const skuCell: Content = isAhrEligible
      ? {
          text: [
            { text: item.sku, bold: true, color: '#38bdf8' },
            { text: ' [AHR]', bold: true, color: '#f472b6', fontSize: 5.5 },
          ],
          fontSize: 6.5,
          fillColor: bg,
        }
      : { text: item.sku, fontSize: 6.5, bold: true, color: '#38bdf8', fillColor: bg };

    tableBody.push([
      { text: item.category, fontSize: 6.5, color: '#9ca3af', fillColor: bg },
      skuCell,
      {
        text: item.description + (item.note ? `\nNote: ${item.note}` : ''),
        fontSize: 6.5,
        color: '#f3f4f6',
        fillColor: bg,
      },
      { text: item.termMonths ? `${item.termMonths}m` : '—', fontSize: 6.5, alignment: 'center', color: '#d1d5db', fillColor: bg },
      { text: String(item.qty), fontSize: 6.5, bold: true, alignment: 'center', color: '#ffffff', fillColor: bg },
      { text: formatCurrency(item.effectiveUnitList), fontSize: 6.5, alignment: 'right', color: '#d1d5db', fillColor: bg },
      { text: formatCurrency(item.extendedListPrice), fontSize: 6.5, alignment: 'right', color: '#d1d5db', fillColor: bg },
      {
        text: item.effectiveDiscountPercent > 0 ? `${item.effectiveDiscountPercent.toFixed(1)}%` : '—',
        fontSize: 6.5,
        alignment: 'center',
        color: item.effectiveDiscountPercent > 0 ? '#22c55e' : '#9ca3af',
        fillColor: bg,
      },
      {
        text: formatCurrency(item.extendedNetPrice),
        fontSize: 6.5,
        bold: true,
        alignment: 'right',
        color: '#38bdf8',
        fillColor: bg,
      },
    ]);
  });

  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [24, 24, 24, 26],
    watermark: {
      text: 'DRAFT',
      color: '#38bdf8',
      opacity: 0.05,
      bold: true,
      italics: false,
    },
    background: () => ({
      canvas: [
        {
          type: 'rect',
          x: 0,
          y: 0,
          w: 841.89,
          h: 595.28,
          color: '#0b0f19',
        },
      ],
    }),
    footer: (currentPage, pageCount) => ({
      margin: [24, 10, 24, 0],
      columns: [
        {
          text: `Gigamon Indicative Quotation (Illustrative Order of Magnitude • Non-Binding) • ${scenario}`,
          fontSize: 6.5,
          color: '#6b7280',
        },
        {
          text: `Page ${currentPage} of ${pageCount}`,
          fontSize: 6.5,
          alignment: 'right',
          color: '#6b7280',
        },
      ],
    }),
    content: [
      // ── Header Banner ──
      {
        columns: [
          {
            stack: [
              { text: 'GIGAMON SOLUTION QUOTATION', fontSize: 16, bold: true, color: '#38bdf8' },
              { text: `Scenario: ${scenario}`, fontSize: 10, bold: true, color: '#f3f4f6', margin: [0, 2, 0, 0] },
              spanOnlyMode
                ? { text: 'Architecture: SPAN-Only (TAPs Removed & TAP Optics Halved)', fontSize: 7.5, bold: true, color: '#06b6d4', margin: [0, 2, 0, 0] }
                : { text: '' },
            ],
          },
          {
            stack: [
              { text: `Date: ${dateStr}`, fontSize: 8, alignment: 'right', color: '#9ca3af' },
              {
                text: `Optics Policy: ${excludeOptics ? 'Customer Supplied (Optics Excluded)' : 'Gigamon Optics Included'}`,
                fontSize: 8,
                bold: true,
                alignment: 'right',
                color: excludeOptics ? '#f59e0b' : '#10b981',
                margin: [0, 2, 0, 0],
              },
              freePowerCords
                ? { text: 'Power Cords: 100% Discount Applied (Free of Charge)', fontSize: 7.5, bold: true, alignment: 'right', color: '#22c55e', margin: [0, 2, 0, 0] }
                : { text: '' },
            ],
          },
        ],
        margin: [0, 0, 0, 14],
      },

      // ── Financial Summary Tile Grid ──
      {
        table: {
          widths: ['*', '*', '*', '*'],
          body: [
            [
              {
                fillColor: '#1e293b',
                stack: [summaryCard('Total List Value', formatCurrency(summary.totalListPrice), `${summary.totalQty} total units`, '#94a3b8')],
              },
              {
                fillColor: '#1e293b',
                stack: [summaryCard('Commercial Discount', formatCurrency(summary.totalDiscountAmount), `${summary.effectiveDiscountPercent.toFixed(1)}% savings`, '#22c55e')],
              },
              {
                fillColor: '#1e293b',
                stack: [summaryCard('Net Commercial Investment', formatCurrency(summary.totalNetPrice), 'Target price (excl tax)', '#38bdf8')],
              },
              {
                fillColor: '#1e293b',
                stack: [
                  summaryCard(
                    'Line Items Active',
                    `${summary.activeLineCount} SKUs`,
                    excludeOptics ? `(${summary.allLineCount - summary.activeLineCount} optics omitted)` : 'All BOM items included',
                    '#a855f7',
                  ),
                ],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => '#334155',
          vLineColor: () => '#334155',
        },
        margin: [0, 0, 0, 14],
      },

      // ── Category Summary Mini-Table ──
      {
        text: 'CATEGORY PRICING SUMMARY',
        fontSize: 8,
        bold: true,
        color: '#94a3b8',
        margin: [0, 0, 0, 4],
      },
      {
        table: {
          widths: ['*', 70, 110, 130, 120],
          body: [
            [
              { text: 'Category', style: 'tableHeader' },
              { text: 'Total Qty', style: 'tableHeader', alignment: 'center' },
              { text: 'List Price', style: 'tableHeader', alignment: 'right' },
              { text: 'Discount Savings', style: 'tableHeader', alignment: 'right' },
              { text: 'Net Price', style: 'tableHeader', alignment: 'right' },
            ],
            ...categoryRows,
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#334155',
          vLineColor: () => '#334155',
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#1e293b' : '#0f172a'),
        },
        margin: [0, 0, 0, 14],
      },

      // ── Itemized Line Items Table ──
      {
        text: 'ITEMISED BILL OF MATERIALS & COMMERCIAL BREAKDOWN',
        fontSize: 8,
        bold: true,
        color: '#94a3b8',
        margin: [0, 0, 0, 4],
      },
      {
        table: {
          headerRows: 1,
          widths: [48, 85, '*', 32, 28, 78, 80, 42, 85],
          body: tableBody,
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#334155',
          vLineColor: () => '#334155',
        },
        margin: [0, 0, 0, 10],
      },

      // ── Notes & Commercial Disclaimer ──
      {
        text: 'IMPORTANT COMMERCIAL NOTICE & NON-BINDING DISCLAIMER',
        fontSize: 7.5,
        bold: true,
        color: '#f59e0b',
        margin: [0, 4, 0, 2],
      },
      {
        text:
          'This document and the associated figures represent an indicative, illustrative order of magnitude quotation generated as an informal engineering and budgetary aid for systems engineers, sales directors, and customers. It is strictly non-binding, non-contractual, and does not constitute a formal commercial offer or binding commitment by Gigamon. Gigamon reserves the right to modify, adjust, or decline any indicated quantities, configurations, part numbers, list prices, discounts, or terms. Formal, binding commercial proposals must be requested and issued through official Gigamon sales channels and authorised partners.',
        fontSize: 6.5,
        color: '#9ca3af',
        lineHeight: 1.25,
      },
    ],
    styles: {
      tableHeader: {
        fontSize: 6.5,
        bold: true,
        color: '#ffffff',
        fillColor: '#1e293b',
        margin: [1, 2, 1, 2],
      },
    },
  };
}


