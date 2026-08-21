/**
 * SkuUpdateModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Lets an SE refresh SKU descriptions/pricing metadata straight from an
 * uploaded worldwide price list (.xlsx/.xls/.csv), instead of converting to
 * CSV and running scripts manually. Applies immediately in this browser
 * via skuService / skuOverrides, while preserving backups for rollback.
 */
import React, { useRef, useState } from 'react';
import { parsePriceListFile } from '../../utils/priceListParser';
import {
  applyPriceListRows,
  clearSkuOverrides,
  revertToPreviousOverrides,
  getSkuOverrideInfo,
  getBackupOverrideInfo,
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
  const [backupInfo, setBackupInfo] = useState(getBackupOverrideInfo());

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
      setBackupInfo(getBackupOverrideInfo());
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  };

  const handleRevertToPrevious = () => {
    const success = revertToPreviousOverrides();
    if (success) {
      setInfo(getSkuOverrideInfo());
      setBackupInfo(getBackupOverrideInfo());
      setResult(null);
      setError(null);
      onChanged();
    }
  };

  const handleRestoreBuiltin = () => {
    clearSkuOverrides();
    setInfo(null);
    setBackupInfo(getBackupOverrideInfo());
    setResult(null);
    setError(null);
    onChanged();
  };

  return (
    <div className="modal-overlay">
      <div
        className="modal-card"
        style={{ width: '440px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
      >
        <h3 style={{ margin: 0, fontSize: '14px', color: '#ff9800', fontWeight: 'bold' }}>Update Price List</h3>
        <p className="text-muted" style={{ fontSize: '11px', margin: 0, lineHeight: 1.4 }}>
          Import the worldwide price list workbook directly (.xlsx, .xls, or .csv). SKU descriptions, list prices, End
          of Sale/Life dates, and replacement SKUs are read straight out of the spreadsheet and established as the active
          single source of truth.
        </p>

        {info ? (
          <div style={{ fontSize: '11px', color: '#888', background: '#1a1a1a', borderRadius: '4px', padding: '8px' }}>
            Active custom list: <strong style={{ color: '#4caf50' }}>{info.sourceFileName}</strong> ({info.count} SKUs)
            <br />
            <span style={{ fontSize: '10px', color: '#777' }}>Applied: {new Date(info.updatedAt).toLocaleString()}</span>
          </div>
        ) : (
          <div style={{ fontSize: '11px', color: '#888', background: '#1a1a1a', borderRadius: '4px', padding: '8px' }}>
            Active source: <strong style={{ color: '#2196f3' }}>Built-in Master Catalogue</strong>
          </div>
        )}

        {backupInfo && (
          <div style={{ fontSize: '10px', color: '#888', background: '#141414', borderRadius: '4px', padding: '6px 8px', borderLeft: '3px solid #ff9800' }}>
            Previous backup available: <strong style={{ color: '#ccc' }}>{backupInfo.sourceFileName}</strong> ({backupInfo.count} SKUs)
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
          {busy ? 'Reading…' : 'Choose Price List File (.xlsx / .csv)'}
        </button>

        {error && <div style={{ fontSize: '11px', color: '#ff5252', lineHeight: 1.4 }}>{error}</div>}

        {result && (
          <div style={{ fontSize: '11px', color: '#4caf50' }}>
            {result.added} added · {result.updated} updated · {result.unchanged} unchanged
            {result.skipped > 0 ? ` · ${result.skipped} skipped (missing SKU/description)` : ''}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {backupInfo && (
              <button
                className="btn btn-ghost"
                onClick={handleRevertToPrevious}
                title="Restore the previous custom price list backup"
                style={{ fontSize: '11px' }}
              >
                Revert to Backup
              </button>
            )}
            <button
              className="btn btn-ghost"
              onClick={handleRestoreBuiltin}
              disabled={!info}
              title="Discard custom uploaded price list and restore the built-in master catalogue"
              style={{ fontSize: '11px' }}
            >
              Restore Built-in
            </button>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: '11px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SkuUpdateModal;
