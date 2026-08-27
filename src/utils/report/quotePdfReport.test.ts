import { describe, it, expect } from 'vitest';
import { buildQuotePdfDocDefinition } from './quotePdfReport';
import { DEFAULT_DISCOUNT_CONFIG, type QuoteLineItem } from '../pricingEngine';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

if (pdfMake.addVirtualFileSystem) {
  const vfsObj = (pdfFonts as unknown as { pdfMake?: { vfs: Record<string, string> } }).pdfMake?.vfs || (pdfFonts as unknown as Record<string, string>);
  pdfMake.addVirtualFileSystem(vfsObj);
}

describe('quotePdfReport', () => {
  const items: QuoteLineItem[] = [
    {
      id: '1',
      sku: 'GVS-HC3A3',
      description: 'GigaVUE-HC3 base unit',
      type: 'Chassis',
      category: 'Chassis',
      qty: 2,
      unitListPrice: 96990,
      isMonthlyPrice: false,
      applyDiscount: true,
    },
    {
      id: '2',
      sku: 'PCD-00003',
      description: 'Power Cord, EU plug',
      type: 'Accessory',
      category: 'Accessory',
      qty: 16,
      unitListPrice: 35,
      isMonthlyPrice: false,
      applyDiscount: true,
    },
    {
      id: '3',
      sku: 'SMT-HC3-GEN3-FVU',
      description: 'FlowVUE license',
      type: 'License',
      category: 'Software',
      qty: 2,
      unitListPrice: 52465,
      isMonthlyPrice: false,
      applyDiscount: true,
    },
    {
      id: '4',
      sku: 'SFP-533T-20P',
      description: '20 pack of 10Gb SFP+',
      type: 'Optic',
      category: 'Optic',
      qty: 11,
      unitListPrice: 31860,
      isMonthlyPrice: false,
      applyDiscount: true,
      note: 'Rounded up from 212 individual units to 11 × SFP-533T-20P (220 total)',
    },
    {
      id: '5',
      sku: 'GSS-HW-AHR-GMO',
      description: 'Advanced Hardware Replacement',
      type: 'Support',
      category: 'Support',
      qty: 1,
      unitListPrice: 339680.9,
      isMonthlyPrice: false,
      applyDiscount: true,
      note: '41.0% of Covered Hardware List Price ($828,490.00)',
    },
  ];

  it('builds a valid document definition for standard quotes', () => {
    const docDef = buildQuotePdfDocDefinition(items, DEFAULT_DISCOUNT_CONFIG, false, false, false, {
      scenarioName: 'Enterprise Core Visibility',
      projectLicenseMode: 'Perpetual',
      defaultTermDuration: '36',
    });

    expect(docDef).toBeDefined();
    expect(docDef.pageSize).toBe('A4');
    expect(docDef.pageOrientation).toBe('portrait');
  });

  it('generates a binary PDF blob successfully via pdfmake without hanging or error', async () => {
    const docDef = buildQuotePdfDocDefinition(items, DEFAULT_DISCOUNT_CONFIG, false, false, false, {
      scenarioName: 'Enterprise Core Visibility',
    });

    const pdfDoc = pdfMake.createPdf(docDef) as unknown as {
      getBlob: () => Promise<Blob>;
    };

    const blob = await pdfDoc.getBlob();
    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
  });
});
