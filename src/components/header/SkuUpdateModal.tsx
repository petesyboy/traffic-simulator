/**
 * SkuUpdateModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Lets an SE refresh SKU descriptions/pricing metadata straight from an
 * uploaded worldwide price list (.xlsx/.xls/.csv), instead of converting to
 * CSV and running `npm run update-skus`. Applies immediately in this browser
 * via skuOverrides.ts - it never touches files on disk.
 */
import React, { useRef, useState } from 'react';
import { parsePriceListFile } from '../../utils/priceListParser';
import {
  applyPriceListRows,
  clearSkuOverrides,
  getSkuOverrideInfo,
  type ApplyPriceListResult,
} from '../../utils/skuOverrides';

export interface SkuUpdateModalProps {
  onClose: () => void;
  /** Called after the override data changes (applied or reverted), so the caller can bump skuCatalogueVersion. */
  onChanged: () => void;
}

const SkuUpdateModal: React.FC<SkuUpdateModalProps> = ({ onClose, onChanged }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApplyPriceListResult | null>(null);
  const [info, setInfo] = useState(getSkuOverrideInfo());

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { rows, sheetName } = await parsePriceListFile(file);
      if (rows.length === 0) {
        setError(`No SKU rows found in sheet "${sheetName}". Check it has a SKU and Description column.`);
        return;
      }
      const summary = applyPriceListRows(rows, file.name);
      setResult(summary);
      setInfo(getSkuOverrideInfo());
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  };

  const handleRevert = () => {
    clearSkuOverrides();
    setInfo(null);
    setResult(null);
    setError(null);
    onChanged();
  };

  return (
    <div className="modal-overlay">
      <div
        className="modal-card"
        style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
      >
        <h3 style={{ margin: 0, fontSize: '14px', color: '#ff9800', fontWeight: 'bold' }}>Update Price List</h3>
        <p className="text-muted" style={{ fontSize: '11px', margin: 0, lineHeight: 1.4 }}>
          Import the worldwide price list workbook directly — no need to convert it to CSV first. SKU descriptions, End
          of Sale/Life dates and replacement SKUs are read straight out of the spreadsheet and applied in this browser
          immediately.
        </p>

        {info && (
          <div style={{ fontSize: '11px', color: '#888', background: '#1a1a1a', borderRadius: '4px', padding: '8px' }}>
            Custom list loaded: <strong style={{ color: '#ccc' }}>{info.sourceFileName}</strong> ({info.count} SKUs)
            <br />
            {new Date(info.updatedAt).toLocaleString()}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()} disabled={busy}>
          {busy ? 'Reading…' : 'Choose Price List File'}
        </button>

        {error && <div style={{ fontSize: '11px', color: '#ff5252', lineHeight: 1.4 }}>{error}</div>}

        {result && (
          <div style={{ fontSize: '11px', color: '#4caf50' }}>
            {result.added} added · {result.updated} updated · {result.unchanged} unchanged
            {result.skipped > 0 ? ` · ${result.skipped} skipped (missing SKU/description)` : ''}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
          <button
            className="btn btn-ghost"
            onClick={handleRevert}
            disabled={!info}
            title="Discard the uploaded price list and go back to the bundled SKU data"
          >
            Revert to Bundled
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SkuUpdateModal;
