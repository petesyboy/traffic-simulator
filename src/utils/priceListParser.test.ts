import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parsePriceListFile } from './priceListParser';

/** Builds a fake File-like object (arrayBuffer() + name) from rows of cells, avoiding
 *  a dependency on the DOM File constructor being available in the test environment. */
function xlsxFile(rows: unknown[][], name = 'price-list.xlsx', sheetName = 'Sheet1'): File {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return {
    name,
    arrayBuffer: async () => buffer,
  } as unknown as File;
}

function csvFile(text: string, name = 'price-list.csv'): File {
  const buffer = new TextEncoder().encode(text).buffer;
  return {
    name,
    arrayBuffer: async () => buffer,
  } as unknown as File;
}

describe('parsePriceListFile', () => {
  it('parses SKU and Description columns from a plain header row', async () => {
    const file = xlsxFile([
      ['SKU', 'Description'],
      ['ABC-123', 'Widget A'],
      ['DEF-456', 'Widget B'],
    ]);
    const { rows } = await parsePriceListFile(file);
    expect(rows).toEqual([
      { sku: 'ABC-123', description: 'Widget A', eos: undefined, eol: undefined, replacement: undefined },
      { sku: 'DEF-456', description: 'Widget B', eos: undefined, eol: undefined, replacement: undefined },
    ]);
  });

  it('skips a leading title row containing "Effective Date"', async () => {
    const file = xlsxFile([
      ['Gigamon Worldwide Price List — Effective Date: 2026-01-01'],
      ['SKU', 'Description'],
      ['ABC-123', 'Widget A'],
    ]);
    const { rows } = await parsePriceListFile(file);
    expect(rows).toEqual([
      { sku: 'ABC-123', description: 'Widget A', eos: undefined, eol: undefined, replacement: undefined },
    ]);
  });

  it('skips a leading title row mentioning "Picture" (e.g. a cover-tab note)', async () => {
    const file = xlsxFile([
      ['Gigamon Worldwide Price List (see Picture tab for images)'],
      ['SKU', 'Description'],
      ['ABC-123', 'Widget A'],
    ]);
    const { rows } = await parsePriceListFile(file);
    expect(rows).toEqual([
      { sku: 'ABC-123', description: 'Widget A', eos: undefined, eol: undefined, replacement: undefined },
    ]);
  });

  it('picks up EOS, EOL and Replacement SKU columns', async () => {
    const file = xlsxFile([
      ['SKU', 'Detailed Description', 'End of Sale Date', 'End of Life Date', 'Replacement SKU'],
      ['ABC-123', 'Widget A', '2026-06-01', '2027-06-01', 'ABC-999'],
    ]);
    const { rows } = await parsePriceListFile(file);
    expect(rows).toEqual([
      { sku: 'ABC-123', description: 'Widget A', eos: '2026-06-01', eol: '2027-06-01', replacement: 'ABC-999' },
    ]);
  });

  it('throws a helpful error when no SKU/Description columns are found', async () => {
    const file = xlsxFile([
      ['Part Number', 'Notes'],
      ['ABC-123', 'Widget A'],
    ]);
    await expect(parsePriceListFile(file)).rejects.toThrow(/Could not find SKU\/Description columns/);
  });

  it('skips rows with no SKU value', async () => {
    const file = xlsxFile([
      ['SKU', 'Description'],
      ['', 'No SKU here'],
      ['ABC-123', 'Widget A'],
    ]);
    const { rows } = await parsePriceListFile(file);
    expect(rows).toHaveLength(1);
    expect(rows[0].sku).toBe('ABC-123');
  });

  it('picks the sheet whose header row mentions SKU out of a multi-sheet workbook', async () => {
    const sheet1 = XLSX.utils.aoa_to_sheet([['Cover Page'], ['Nothing useful here']]);
    const sheet2 = XLSX.utils.aoa_to_sheet([
      ['SKU', 'Description'],
      ['ABC-123', 'Widget A'],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet1, 'Cover');
    XLSX.utils.book_append_sheet(workbook, sheet2, 'Price List');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const file = { name: 'multi.xlsx', arrayBuffer: async () => buffer } as unknown as File;

    const { rows, sheetName } = await parsePriceListFile(file);
    expect(sheetName).toBe('Price List');
    expect(rows).toEqual([
      { sku: 'ABC-123', description: 'Widget A', eos: undefined, eol: undefined, replacement: undefined },
    ]);
  });

  it('keeps a date-formatted EOS cell as an ISO date string, not an Excel serial number', async () => {
    const file = xlsxFile([
      ['SKU', 'Description', 'End of Sale Date'],
      ['ABC-123', 'Widget A', '2027-01-01'],
    ]);
    const { rows } = await parsePriceListFile(file);
    expect(rows[0].eos).toBe('2027-01-01');
    expect(rows[0].eos).not.toMatch(/^\d+$/); // must not have decayed into a serial number like "46388"
  });

  it('parses a plain CSV file the same way', async () => {
    const file = csvFile('SKU,Description\nABC-123,Widget A\nDEF-456,Widget B\n');
    const { rows } = await parsePriceListFile(file);
    expect(rows).toEqual([
      { sku: 'ABC-123', description: 'Widget A', eos: undefined, eol: undefined, replacement: undefined },
      { sku: 'DEF-456', description: 'Widget B', eos: undefined, eol: undefined, replacement: undefined },
    ]);
  });
});
