/**
 * priceListParser.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads an uploaded worldwide price list (.xlsx/.xls/.csv) straight in the
 * browser via SheetJS, so an SE can refresh SKUs without converting to CSV
 * first and running scripts/parse_skus.py.
 *
 * Column detection mirrors scripts/parse_skus.py's heuristics (same header
 * names, same "skip a title/picture row" quirk) so the two stay in sync.
 */
import * as XLSX from 'xlsx';
import type { PriceListRow } from './skuOverrides';

export interface ParsedPriceList {
  rows: PriceListRow[];
  sheetName: string;
  headers: string[];
}

function findColumnIndex(headers: string[], matchers: ((h: string) => boolean)[]): number {
  for (const matcher of matchers) {
    const idx = headers.findIndex((h) => matcher(h.toLowerCase().trim()));
    if (idx !== -1) return idx;
  }
  return -1;
}

/** Picks the sheet most likely to be the actual price list, out of a multi-tab workbook. */
function pickSheetName(workbook: XLSX.WorkBook): string {
  for (const name of workbook.SheetNames) {
    const raw = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, blankrows: false });
    for (const row of raw.slice(0, 3)) {
      if (
        (row || []).some((cell) =>
          String(cell ?? '')
            .toLowerCase()
            .trim()
            .includes('sku'),
        )
      ) {
        return name;
      }
    }
  }
  return workbook.SheetNames[0];
}

export async function parsePriceListFile(file: File): Promise<ParsedPriceList> {
  const buffer = await file.arrayBuffer();
  // cellDates keeps date-formatted cells (EOS/EOL columns) as JS Dates instead of
  // silently converting them into Excel serial numbers (e.g. "2027-01-01" -> 46388).
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  const sheetName = pickSheetName(workbook);
  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' });

  if (raw.length === 0) {
    return { rows: [], sheetName, headers: [] };
  }

  // A leading title/logo row (no real headers) gets skipped, same as parse_skus.py.
  const firstRowText = (raw[0] || []).join(' ').toLowerCase();
  const headerRowIndex = firstRowText.includes('picture') || firstRowText.includes('effective date') ? 1 : 0;
  const headerRow = (raw[headerRowIndex] || []).map((h) => String(h ?? '').trim());
  const dataRows = raw.slice(headerRowIndex + 1);

  const skuIdx = findColumnIndex(headerRow, [(h) => h === 'sku', (h) => h === 'sku for', (h) => h.includes('sku')]);
  const descIdx = findColumnIndex(headerRow, [
    (h) => h === 'detailed description',
    (h) => h === 'description',
    (h) => h.includes('desc'),
  ]);
  const eosIdx = findColumnIndex(headerRow, [
    (h) => (h.includes('end of sale') || h.includes('eos')) && !h.includes('replacement'),
  ]);
  const eolIdx = findColumnIndex(headerRow, [(h) => h.includes('end of life') || h.includes('eol')]);
  const replIdx = findColumnIndex(headerRow, [(h) => h.includes('replacement')]);
  const priceIdx = findColumnIndex(headerRow, [
    (h) => h === 'list price',
    (h) => h === 'price',
    (h) => h === 'msrp',
    (h) => h === 'list price (usd)',
    (h) => h === 'usd list price',
    (h) => h.includes('list price') && !h.includes('month'),
  ]);
  const monthlyPriceIdx = findColumnIndex(headerRow, [
    (h) => h === 'list price/month',
    (h) => h === 'list price / month',
    (h) => h === 'monthly price',
    (h) => h.includes('month') && (h.includes('price') || h.includes('list')),
  ]);

  if (skuIdx === -1 || descIdx === -1) {
    throw new Error(
      `Could not find SKU/Description columns in sheet "${sheetName}". Headers found: ${headerRow.filter(Boolean).join(', ') || '(none)'}`,
    );
  }

  const cell = (row: unknown[], idx: number): string => {
    if (idx === -1) return '';
    const value = row[idx];
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value ?? '').trim();
  };

  const parseNumericPrice = (row: unknown[], idx: number): number | undefined => {
    if (idx === -1) return undefined;
    const value = row[idx];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const str = String(value ?? '').replace(/[^0-9.]/g, '');
    if (!str) return undefined;
    const num = parseFloat(str);
    return Number.isFinite(num) ? num : undefined;
  };

  const rows: PriceListRow[] = [];
  for (const row of dataRows) {
    const sku = cell(row, skuIdx);
    if (!sku) continue;
    rows.push({
      sku,
      description: cell(row, descIdx),
      eos: eosIdx === -1 ? undefined : cell(row, eosIdx),
      eol: eolIdx === -1 ? undefined : cell(row, eolIdx),
      replacement: replIdx === -1 ? undefined : cell(row, replIdx),
      listPrice: parseNumericPrice(row, priceIdx),
      listPriceMonthly: parseNumericPrice(row, monthlyPriceIdx),
    });
  }

  return { rows, sheetName, headers: headerRow };
}
