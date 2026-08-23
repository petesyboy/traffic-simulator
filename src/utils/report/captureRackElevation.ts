/**
 * captureRackElevation.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Rasterises a compact, legible Rack Elevation diagram for a specified site
 * into a high-resolution PNG data URL for embedding in the PDF solution report.
 *
 * Implements the "Signal Path" specification:
 * • Collapses excessive empty RUs with a clean indicator ("34U available capacity ↑")
 * • Scales populated block so device labels and module bays are crisp & legible
 * • Role-based colour coding:
 *   - GigaSMART hero units (HC3/HC1/HC2) in Gigamon Accent Orange (#E1592A)
 *   - Aggregation nodes (TA series) in Structural Navy (#16213D)
 *   - Passive TAP trays (M100T/M200T) with outlined/unfilled subtle frames
 */

import type { CustomNode, HardwareNodeData } from '../../store/types';
import { getDeviceRU, getTrayBayCount, getTrayLayout, isRackableGigamonEquipment, getChassisImagePath } from '../hardwareUtils';
import { resolveHardwareIcon } from '../../assets/hardwareIcons';
import { REPORT_COLOURS } from './reportStyles';

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      return reject(new Error('Image not supported in this environment'));
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${src}`));
    img.src = src;
  });

export async function captureRackElevationPng(
  nodes: CustomNode[],
  siteName: string,
): Promise<string | undefined> {
  if (typeof document === 'undefined') return undefined;

  const effectiveSite = siteName === 'Global / Unassigned' ? undefined : siteName;
  const rackId = siteName === 'Global / Unassigned' ? 'rack_global' : `rack_${siteName}`;

  // Filter hardware belonging to this site
  const siteHardware = nodes.filter((n) => {
    if (!isRackableGigamonEquipment(n)) return false;
    const s = (n.data?.site as string || '').trim();
    if (!effectiveSite) {
      return !s || s === 'Global / Unassigned' || s === 'Unassigned';
    }
    return s === effectiveSite;
  });

  const rackedNodes = siteHardware.filter(
    (n) => n.data?.rackId === rackId && typeof n.data?.rackU === 'number',
  );

  // Determine occupied RU boundaries
  let minU: number;
  let maxU: number;
  let hasCollapsedTop = false;
  let emptyCountTop = 0;

  if (rackedNodes.length > 0) {
    let highestOccupiedU = 1;
    let lowestOccupiedU = 42;

    rackedNodes.forEach((n) => {
      const startU = Number(n.data?.rackU);
      const ru = getDeviceRU(String(n.data?.model || ''), n.data?.sku as string | undefined);
      const topU = ru >= 1 ? startU + ru - 1 : startU;
      if (topU > highestOccupiedU) highestOccupiedU = topU;
      if (startU < lowestOccupiedU) lowestOccupiedU = startU;
    });

    // If populated units fit in a fraction of 42U, draw compact view
    if (highestOccupiedU <= 16) {
      minU = 1;
      maxU = Math.min(highestOccupiedU + 2, 16);
      emptyCountTop = 42 - maxU;
      hasCollapsedTop = emptyCountTop > 0;
    } else {
      minU = 1;
      maxU = 42;
    }
  } else {
    // Empty rack view
    minU = 1;
    maxU = 12;
    emptyCountTop = 30;
    hasCollapsedTop = true;
  }

  const renderedUnits = maxU - minU + 1;
  const unitHeight = 32; // Larger unit height for high legibility
  const collapsedHeaderHeight = hasCollapsedTop ? 28 : 0;
  const headerHeight = 36;
  const rackTop = headerHeight + collapsedHeaderHeight + 8;
  const rackHeight = renderedUnits * unitHeight;
  const width = 420;
  const height = rackTop + rackHeight + 16;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Header Banner
  ctx.fillStyle = REPORT_COLOURS.structural;
  ctx.fillRect(0, 0, width, headerHeight);

  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = REPORT_COLOURS.structuralInk;
  ctx.textAlign = 'left';
  ctx.fillText(`RACK ELEVATION — ${siteName.toUpperCase()}`, 14, 22);

  // Layout metrics
  const railLeft = 10;
  const railWidth = 32;
  const rackLeft = 46;
  const rackWidth = width - rackLeft - 14;

  // Collapsed space indicator banner
  if (hasCollapsedTop) {
    const colY = headerHeight + 6;
    ctx.fillStyle = REPORT_COLOURS.paper;
    ctx.fillRect(rackLeft, colY, rackWidth, 22);
    ctx.strokeStyle = REPORT_COLOURS.lineStrong;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(rackLeft, colY, rackWidth, 22);
    ctx.setLineDash([]);

    ctx.fillStyle = REPORT_COLOURS.inkSecondary;
    ctx.font = 'italic 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`↑  ${emptyCountTop}U Unpopulated Capacity Available (U${maxU + 1} – U42)  ↑`, rackLeft + rackWidth / 2, colY + 15);
  }

  // Cabinet Frame
  ctx.fillStyle = '#FAFAF8';
  ctx.fillRect(rackLeft, rackTop, rackWidth, rackHeight);
  ctx.strokeStyle = REPORT_COLOURS.structural;
  ctx.lineWidth = 2;
  ctx.strokeRect(rackLeft, rackTop, rackWidth, rackHeight);

  // Preload relevant hardware images
  const imageMap = new Map<string, HTMLImageElement>();
  await Promise.all(
    rackedNodes.map(async (n) => {
      const data = n.data as HardwareNodeData;
      const model = String(data.model || '');
      const rawPath = data.image || getChassisImagePath(model, data.sku);
      const iconPath = resolveHardwareIcon(rawPath);
      if (iconPath && !imageMap.has(iconPath)) {
        try {
          const img = await loadImage(iconPath);
          imageMap.set(iconPath, img);
        } catch {
          // Ignore
        }
      }
    }),
  );

  // Preload slotted module images for trays
  const slottedModules = siteHardware.filter((n) => n.data?.trayId);
  await Promise.all(
    slottedModules.map(async (m) => {
      const data = m.data as HardwareNodeData;
      const model = String(data.model || '');
      const rawPath = data.image || getChassisImagePath(model, data.sku);
      const iconPath = resolveHardwareIcon(rawPath);
      if (iconPath && !imageMap.has(iconPath)) {
        try {
          const img = await loadImage(iconPath);
          imageMap.set(iconPath, img);
        } catch {
          // Ignore
        }
      }
    }),
  );

  // Draw RU Rail & Grid Lines
  for (let u = maxU; u >= minU; u--) {
    const y = rackTop + (maxU - u) * unitHeight;

    // Draw RU Number on rail
    ctx.fillStyle = u % 5 === 0 ? REPORT_COLOURS.accent : REPORT_COLOURS.inkSecondary;
    ctx.font = u % 5 === 0 ? 'bold 11px monospace' : '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(String(u), railLeft + railWidth - 4, y + 20);

    // Slot row separator
    ctx.strokeStyle = REPORT_COLOURS.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rackLeft, y + unitHeight);
    ctx.lineTo(rackLeft + rackWidth, y + unitHeight);
    ctx.stroke();
  }

  // Draw Racked Hardware Nodes
  for (let u = maxU; u >= minU; u--) {
    const occupyingNode = rackedNodes.find((n) => {
      const startU = Number(n.data?.rackU);
      const ru = getDeviceRU(String(n.data?.model || ''), n.data?.sku as string | undefined);
      const topU = ru >= 1 ? startU + ru - 1 : startU;
      return topU === u;
    });

    const isCovered = rackedNodes.some((n) => {
      const startU = Number(n.data?.rackU);
      const ru = getDeviceRU(String(n.data?.model || ''), n.data?.sku as string | undefined);
      if (ru <= 1) return false;
      const topU = startU + ru - 1;
      return u >= startU && u < topU;
    });

    if (isCovered || !occupyingNode) continue;

    const data = occupyingNode.data as HardwareNodeData;
    const model = String(data.model || '');
    const sku = data.sku as string | undefined;
    const ru = getDeviceRU(model, sku);
    const boxHeight = ru * unitHeight;
    const boxY = rackTop + (maxU - u) * unitHeight;

    const bays = getTrayBayCount(model, sku);
    const trayLayout = getTrayLayout(model, sku);

    // Identify role
    const isGigaSmartHero = model.includes('HC3') || model.includes('HC1') || model.includes('HC2') || model.includes('HCT');
    const isTray = bays > 0 || model.includes('M100') || model.includes('M200') || model.includes('TAP');

    if (isTray) {
      // ── Modular TAP Tray (Outlined/unfilled passive style) ──
      const nested = siteHardware.filter((n) => n.data?.trayId === occupyingNode.id);
      const rowHeight = boxHeight / trayLayout.rows;
      const colWidth = (rackWidth - 10) / trayLayout.cols;

      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(rackLeft + 1, boxY + 1, rackWidth - 2, boxHeight - 2);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rackLeft + 1, boxY + 1, rackWidth - 2, boxHeight - 2);

      for (let r = 0; r < trayLayout.rows; r++) {
        for (let c = 0; c < trayLayout.cols; c++) {
          const slotNum = trayLayout.grid[r][c];
          const mod = nested.find((m) => m.data?.traySlot === slotNum);
          const bayX = rackLeft + 5 + c * colWidth;
          const bayY = boxY + 2 + r * rowHeight;

          ctx.fillStyle = mod ? '#F1F5F9' : '#FFFFFF';
          ctx.fillRect(bayX, bayY, colWidth - 2, rowHeight - 2);
          ctx.strokeStyle = mod ? '#64748B' : '#E2E8F0';
          ctx.lineWidth = 1;
          ctx.strokeRect(bayX, bayY, colWidth - 2, rowHeight - 2);

          if (mod) {
            const modModel = String(mod.data?.model || '');
            const modIcon = resolveHardwareIcon(mod.data?.image || getChassisImagePath(modModel, mod.data?.sku));
            const img = modIcon ? imageMap.get(modIcon) : undefined;
            if (img) {
              ctx.drawImage(img, bayX + 1, bayY + 1, colWidth - 4, rowHeight - 4);
            }
            ctx.fillStyle = REPORT_COLOURS.structural;
            ctx.font = 'bold 8px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`B${slotNum}: ${modModel}`, bayX + 3, bayY + rowHeight - 5);
          } else {
            ctx.fillStyle = '#94A3B8';
            ctx.font = '8px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`Bay ${slotNum}`, bayX + (colWidth - 2) / 2, bayY + rowHeight / 2 + 3);
          }
        }
      }
    } else {
      // ── Powered Chassis (Hero GigaSMART Orange vs Aggregation Structural Navy) ──
      const rawPath = data.image || getChassisImagePath(model, sku);
      const iconPath = resolveHardwareIcon(rawPath);
      const img = iconPath ? imageMap.get(iconPath) : undefined;

      const borderColor = isGigaSmartHero ? REPORT_COLOURS.accent : REPORT_COLOURS.structural;
      const badgeBg = isGigaSmartHero ? REPORT_COLOURS.accent : REPORT_COLOURS.structural;

      ctx.fillStyle = isGigaSmartHero ? '#FFF7ED' : '#F1F5F9';
      ctx.fillRect(rackLeft + 1, boxY + 1, rackWidth - 2, boxHeight - 2);

      if (img) {
        ctx.drawImage(img, rackLeft + 2, boxY + 2, rackWidth - 4, boxHeight - 4);
      }

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(rackLeft + 1, boxY + 1, rackWidth - 2, boxHeight - 2);

      // Label badge
      ctx.fillStyle = badgeBg;
      ctx.fillRect(rackLeft + 4, boxY + 4, 180, 20);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9.5px sans-serif';
      ctx.textAlign = 'left';
      const labelText = `${data.label || model} (${ru}U)`;
      ctx.fillText(labelText.length > 28 ? labelText.slice(0, 26) + '…' : labelText, rackLeft + 8, boxY + 17);
    }
  }

  return canvas.toDataURL('image/png');
}

