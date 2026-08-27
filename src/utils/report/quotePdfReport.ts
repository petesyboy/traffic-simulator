/**
 * quotePdfReport.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates an official, customer-facing PDF quotation matching the layout,
 * typography, and commercial rules of Gigamon Salesforce CPQ quotes.
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
  quoteNumber?: string;
  posId?: string;
  createdDate?: string;
  expiresOn?: string;
  salesRep?: string;
  salesRepEmail?: string;
  reseller?: string;
  resellerContact?: string;
  resellerEmail?: string;
  resellerPhone?: string;
  distributor?: string;
  distributorContact?: string;
  distributorEmail?: string;
  distributorPhone?: string;
  paymentTerms?: string;
  billingFrequency?: string;
  logoDataUrl?: string;
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

  // Quote Metadata
  const createdDateStr =
    options.createdDate ||
    `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;

  const expiresDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiresOnStr =
    options.expiresOn ||
    `${expiresDate.getMonth() + 1}/${expiresDate.getDate()}/${expiresDate.getFullYear()}`;

  const quoteNumber = options.quoteNumber || 'Q-207013-1';
  const posId = options.posId || 'POS0258668';
  const salesRep = options.salesRep || 'Marko Ramo';
  const salesRepEmail = options.salesRepEmail || 'marko.ramo@gigamon.com';
  const paymentTerms = options.paymentTerms || 'Net 45';
  const billingFrequency = options.billingFrequency || 'All in Advance';

  const endCustomer = options.customerName || options.scenarioName || 'Göteborgs Stad';
  const reseller = options.reseller || 'Atea Sverige AB';
  const resellerContact = options.resellerContact || 'Peter Thuresson';
  const resellerEmail = options.resellerEmail || 'peter.thuresson@atea.se';
  const resellerPhone = options.resellerPhone || '+46 31 748 20 15';

  const distributor = options.distributor || 'Exclusive Networks Sweden AB';
  const distributorContact = options.distributorContact || 'Johan Bjorn';
  const distributorEmail = options.distributorEmail || 'jbjorn@exclusive-networks.com';
  const distributorPhone = options.distributorPhone || '+33 141315304';

  // ── CPQ Table Rows ──
  const cpqTableBody: Content[][] = [
    [
      { text: '#', style: 'tableHeader', alignment: 'left' },
      { text: 'SKU', style: 'tableHeader', alignment: 'left' },
      { text: 'Incl. In\nSupport', style: 'tableHeader', alignment: 'center' },
      { text: 'Description', style: 'tableHeader', alignment: 'left' },
      { text: 'Qty', style: 'tableHeader', alignment: 'center' },
      { text: 'List Price', style: 'tableHeader', alignment: 'right' },
      { text: 'Unit Price', style: 'tableHeader', alignment: 'right' },
      { text: 'Net\nDisc %', style: 'tableHeader', alignment: 'center' },
      { text: 'Net Price', style: 'tableHeader', alignment: 'right' },
    ],
  ];

  summary.items.forEach((item, index) => {
    const isSupportCovered = Boolean(item.inclInSupport);
    const discPct = Math.round(item.effectiveDiscountPercent);
    const unitList = item.effectiveUnitList;
    const unitPrice = item.unitNetPrice;

    // Formatting description with term e.g. "36 months"
    const termSnippet = item.termMonths ? `\n${item.termMonths} months` : '';
    const noteSnippet = item.note && !item.note.includes('months') ? `\n${item.note}` : '';
    const fullDesc = `${item.description}${termSnippet}${noteSnippet}`;

    cpqTableBody.push([
      { text: String(index + 1), fontSize: 7, color: '#111827', margin: [0, 2, 0, 2] },
      { text: item.sku, fontSize: 7, bold: true, color: '#111827', margin: [0, 2, 0, 2] },
      { text: isSupportCovered ? 'Yes' : '', fontSize: 7, alignment: 'center', color: '#111827', margin: [0, 2, 0, 2] },
      { text: fullDesc, fontSize: 6.8, color: '#374151', margin: [0, 2, 0, 2] },
      { text: String(item.qty), fontSize: 7, alignment: 'center', color: '#111827', margin: [0, 2, 0, 2] },
      { text: formatCurrency(unitList), fontSize: 7, alignment: 'right', color: '#111827', margin: [0, 2, 0, 2] },
      { text: formatCurrency(unitPrice), fontSize: 7, alignment: 'right', color: '#111827', margin: [0, 2, 0, 2] },
      { text: discPct > 0 ? String(discPct) : '—', fontSize: 7, alignment: 'center', color: '#111827', margin: [0, 2, 0, 2] },
      { text: formatCurrency(item.extendedNetPrice), fontSize: 7, alignment: 'right', color: '#111827', margin: [0, 2, 0, 2] },
    ]);
  });

  return {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [28, 28, 28, 36],
    footer: (currentPage) => ({
      margin: [28, 10, 28, 0],
      columns: [
        {
          text: 'Thank you for your business and the opportunity to serve your needs!',
          fontSize: 7.5,
          color: '#e0531c',
          italics: true,
        },
        {
          text: `Page ${currentPage}`,
          fontSize: 7.5,
          alignment: 'right',
          color: '#6b7280',
        },
      ],
    }),
    content: [
      // ── Header & Identity Row ──
      {
        columns: [
          {
            width: '*',
            stack: [
              {
                text: 'Gigamon®',
                fontSize: 22,
                bold: true,
                color: '#e0531c',
              },
              {
                text: '3300 Olcott Street Santa Clara, CA 95054 USA | 408.263.2022',
                fontSize: 7,
                color: '#6b7280',
                margin: [0, 2, 0, 8],
              },
            ],
          },
          {
            width: 170,
            stack: [
              { text: `Quote: ${quoteNumber}`, fontSize: 9, bold: true, alignment: 'right', color: '#111827' },
              { text: `POSID: ${posId}`, fontSize: 8, alignment: 'right', color: '#374151' },
              { text: `Created Date: ${createdDateStr}`, fontSize: 8, alignment: 'right', color: '#374151' },
              { text: `Expires On: ${expiresOnStr}`, fontSize: 8, alignment: 'right', color: '#374151' },
            ],
          },
        ],
        margin: [0, 0, 0, 8],
      },

      // ── Sales Rep & Commercial Terms Row ──
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'Sales Rep:', fontSize: 7.5, bold: true, color: '#111827' },
              { text: salesRep, fontSize: 7.5, color: '#374151' },
              { text: salesRepEmail, fontSize: 7.5, color: '#1d4ed8' },
            ],
          },
          {
            width: 170,
            stack: [
              { text: `Payment Terms: ${paymentTerms}`, fontSize: 7.5, alignment: 'right', color: '#374151' },
              { text: `Billing Frequency: ${billingFrequency}`, fontSize: 7.5, alignment: 'right', color: '#374151' },
            ],
          },
        ],
        margin: [0, 0, 0, 10],
      },

      // ── 3-Column Stakeholders Block ──
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'End Customer:', fontSize: 7.5, bold: true, color: '#111827' },
              { text: endCustomer, fontSize: 7.5, color: '#374151', margin: [0, 1, 0, 6] },
              { text: 'Ship To:', fontSize: 7.5, bold: true, color: '#111827' },
              { text: endCustomer, fontSize: 7.5, color: '#374151' },
            ],
          },
          {
            width: '*',
            stack: [
              { text: 'Reseller:', fontSize: 7.5, bold: true, color: '#111827' },
              { text: reseller, fontSize: 7.5, color: '#374151' },
              { text: resellerContact, fontSize: 7.5, color: '#374151' },
              { text: resellerEmail, fontSize: 7.5, color: '#1d4ed8' },
              { text: resellerPhone, fontSize: 7.5, color: '#374151', margin: [0, 0, 0, 6] },
              { text: 'Support Provider:', fontSize: 7.5, bold: true, color: '#111827' },
              { text: 'Gigamon Inc.', fontSize: 7.5, color: '#374151' },
            ],
          },
          {
            width: '*',
            stack: [
              { text: 'Bill To:', fontSize: 7.5, bold: true, color: '#111827' },
              { text: distributor, fontSize: 7.5, color: '#374151' },
              { text: distributorContact, fontSize: 7.5, color: '#374151' },
              { text: distributorEmail, fontSize: 7.5, color: '#1d4ed8' },
              { text: distributorPhone, fontSize: 7.5, color: '#374151', margin: [0, 0, 0, 6] },
              { text: 'Bill To Address:', fontSize: 7.5, bold: true, color: '#111827' },
            ],
          },
        ],
        margin: [0, 0, 0, 12],
      },

      // ── Itemized Line Items Table ──
      {
        table: {
          headerRows: 1,
          widths: [14, 82, 38, '*', 20, 52, 52, 28, 54],
          body: cpqTableBody,
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? 0.75 : 0.4),
          vLineWidth: () => 0.4,
          hLineColor: () => '#d1d5db',
          vLineColor: () => '#e5e7eb',
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#f3f4f6' : '#ffffff'),
        },
        margin: [0, 0, 0, 10],
      },

      // ── Subtotal & Total Block ──
      {
        stack: [
          {
            text: `SUBTOTAL: ${formatCurrency(summary.totalNetPrice)}`,
            fontSize: 8.5,
            bold: true,
            alignment: 'right',
            color: '#111827',
            margin: [0, 4, 0, 3],
          },
          {
            text: `QUOTE TOTAL: USD ${formatCurrency(summary.totalNetPrice).replace('$', '')}`,
            fontSize: 9.5,
            bold: true,
            alignment: 'right',
            color: '#111827',
            margin: [0, 0, 0, 3],
          },
          {
            text: 'All dollar amounts shown above are in USD.',
            fontSize: 7.5,
            bold: true,
            color: '#111827',
            margin: [0, 6, 0, 0],
          },
        ],
        unbreakable: true,
        margin: [0, 0, 0, 16],
      },

      // ── Page Break to Official Terms & Conditions Page ──
      {
        text: '',
        pageBreak: 'before',
      },

      // ── Official Gigamon Terms & Conditions Page ──
      {
        stack: [
          {
            text: 'By placing an order with Gigamon based on this quote, the channel partner listed above, if any, shall require, or shall require any sub-reseller to require, the above End Customer to agree to the Terms and Conditions and, to the extent applicable, the Supplemental Terms set forth below.',
            fontSize: 6.8,
            color: '#374151',
            margin: [0, 0, 0, 6],
          },
          {
            text: 'If the End Customer listed above is placing an order directly with Gigamon based on this quote, by submitting a purchase order, installing or using the Gigamon products and/or services, End Customer agrees (i) the products and/or services set forth herein are governed by the Terms and Conditions set forth below unless End Customer has entered into a separate written agreement signed by Gigamon ("Signed Agreement"), which shall govern, and (ii) to the extent applicable the Supplemental Terms set forth below apply in addition to the terms of any Signed Agreement or the Terms and Conditions.',
            fontSize: 6.8,
            color: '#374151',
            margin: [0, 0, 0, 6],
          },
          {
            text: 'The purchaser named in the "Bill to" line of this quote will provide all reasonable assistance (such as documentation or approvals) requested by Gigamon to (i) facilitate the shipping of the order (e.g. proof of receipt & delivery) or (ii) comply with legal/regulatory requirements.',
            fontSize: 6.8,
            color: '#374151',
            margin: [0, 0, 0, 10],
          },
          {
            text: 'Terms & Conditions',
            fontSize: 8,
            bold: true,
            color: '#111827',
            margin: [0, 0, 0, 3],
          },
          {
            text: 'End Customer\'s access and use of the Gigamon products and / or services shall be governed by the applicable terms and conditions set forth at https://www.gigamon.com/support/terms-and-conditions.html. Any additional or different pre-printed terms on any purchase order or other document are rejected and have no force or effect on Gigamon. All pricing in this quote does not include shipping costs, insurance, customs duty, tariffs, or taxes.',
            fontSize: 6.8,
            color: '#374151',
            margin: [0, 0, 0, 6],
          },
          {
            text: 'Late Renewals. For any late-renewals of support or term license subscriptions, Customer will be charged a reinstatement fee equal to fifteen (15%) percent of the annual value of the renewal fee, in addition to retroactive fees to cover the renewed support or term-license subscription, commencing from the prior expiration date through the expiration of the applicable renewal period.',
            fontSize: 6.8,
            color: '#374151',
            margin: [0, 0, 0, 10],
          },
          {
            text: 'Supplemental Terms',
            fontSize: 8,
            bold: true,
            color: '#111827',
            margin: [0, 0, 0, 3],
          },
          {
            text: 'Term-Licensed Software: If this quote includes products offered on a term license basis, such software is provided for the duration of the term license set forth in this quote, beginning on the date the license keys are provided to End Customer, the date the Software is made available for download by End Customer, or for embedded software the date the hardware is delivered. At the expiration of the term license, End Customer shall have no further right to use such Gigamon products and shall remove the Gigamon software from its network infrastructure and not use it or transfer it to any third party.',
            fontSize: 6.8,
            color: '#374151',
            margin: [0, 0, 0, 6],
          },
          {
            text: 'Data Use Limits Software: If this quote includes products with data consumption limits (e.g. with the SKU prefix of "VBL" or "GEM" or that are otherwise designated as data metered products) such products are governed by the Supplemental Terms set forth at https://www.gigamon.com/DataUseTerms.pdf.',
            fontSize: 6.8,
            color: '#374151',
            margin: [0, 0, 0, 6],
          },
        ],
      },
    ],
    styles: {
      tableHeader: {
        fontSize: 6.8,
        bold: true,
        color: '#111827',
        fillColor: '#f3f4f6',
        margin: [0, 2, 0, 2],
      },
    },
  };
}

