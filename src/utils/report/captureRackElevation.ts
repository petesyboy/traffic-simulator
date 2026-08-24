/**
 * captureRackElevation.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Rasterises a compact, legible Rack Elevation diagram for a specified site
 * into a high-resolution PNG data URL for embedding in the PDF solution report.
 *
 * Implements the "Signal Path" specification:
 * • Collapses excessive empty RUs with a clean indicator ("34U available capacity ↑")
 * • Scales populated blocks so device faceplates and add-in cards are crisp & legible
 * • Uses composited front-panel graphics with all installed add-in cards (GigaSMART, PRT, etc.)
 * • Places appliance labels, roles, and installed module descriptions to the side,
 *   connected by subtle leader lines, so the physical equipment is never obscured.
 * • Role-based colour coding:
 *   - GigaSMART hero units (HC3/HC1/HC2) in Gigamon Accent Orange (#E1592A)
 *   - Aggregation nodes (TA series) in Structural Navy (#16213D)
 *   - Passive TAP trays (M100T/M200T) with outlined/unfilled subtle frames
 */

import type { CustomNode, HardwareNodeData } from '../../store/types';
import {
  getDeviceRU,
  getTrayBayCount,
  getTrayLayout,
  isRackableGigamonEquipment,
  getChassisImagePath,
  getModuleSlotPositions,
} from '../hardwareUtils';
import { resolveHardwareIcon } from '../../assets/hardwareIcons';
import { captureChassisFrontPanelPng } from './captureChassisFrontPanel';
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
  chassisFrontPanelImages?: Record<string, string>,
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
  const unitHeight = 32; // Unit height for high legibility
  const collapsedHeaderHeight = hasCollapsedTop ? 28 : 0;
  const headerHeight = 36;
  const rackTop = headerHeight + collapsedHeaderHeight + 8;
  const rackHeight = renderedUnits * unitHeight;

  // Widen canvas to accommodate the side annotation callout column
  const width = 640;
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
  const railLeft = 12;
  const railWidth = 26;
  const rackLeft = 40;
  const rackWidth = 270;
  const annoLeft = rackLeft + rackWidth + 14;
  const annoWidth = width - annoLeft - 12;

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

  // Preload hardware images (composited with add-in cards where applicable)
  const imageMap = new Map<string, HTMLImageElement>();
  await Promise.all(
    rackedNodes.map(async (n) => {
      const data = n.data as HardwareNodeData;
      const model = String(data.model || '');
      const sku = data.sku as string | undefined;

      // 1. If pre-composited image was passed from ReportModal, use it
      const precomputedImg = chassisFrontPanelImages?.[n.id];
      if (precomputedImg) {
        try {
          const img = await loadImage(precomputedImg);
          imageMap.set(n.id, img);
          return;
        } catch {
          // Fallback to on-the-fly composition
        }
      }

      // 2. Otherwise generate composited front panel on the fly
      const rawPath = data.image || getChassisImagePath(model, sku);
      const iconPath = resolveHardwareIcon(rawPath);
      const slotPositions = getModuleSlotPositions(model, sku);
      const installedBoards = data.installedBoards || {};

      if (iconPath && slotPositions.length > 0 && Object.keys(installedBoards).length > 0) {
        try {
          const compositedPng = await captureChassisFrontPanelPng(iconPath, slotPositions, installedBoards);
          if (compositedPng) {
            const img = await loadImage(compositedPng);
            imageMap.set(n.id, img);
            return;
          }
        } catch {
          // Fallback to base image
        }
      }

      // 3. Fallback to base chassis icon
      if (iconPath) {
        try {
          const img = await loadImage(iconPath);
          imageMap.set(n.id, img);
        } catch {
          // Ignore
        }
      }
    }),
  );

  // Preload slotted module images for TAP trays.
  // TAP module nodes use data.image (set from catalogue on creation) or the model name.
  // getChassisImagePath() only searches ta_series/hc_series, not the taps catalogue,
  // so we must fall back to the model name so resolveHardwareIcon can match via TAP_MODEL_ALIASES.
  const slottedModules = siteHardware.filter((n) => n.data?.trayId);
  const trayModuleImgMap = new Map<string, HTMLImageElement>();
  await Promise.all(
    slottedModules.map(async (m) => {
      const data = m.data as HardwareNodeData;
      const model = String(data.model || '');
      const rawPath = data.image || getChassisImagePath(model, data.sku) || model;
      const iconPath = resolveHardwareIcon(rawPath);
      if (iconPath && !trayModuleImgMap.has(iconPath)) {
        try {
          const img = await loadImage(iconPath);
          trayModuleImgMap.set(iconPath, img);
        } catch {
          // Ignore — bay will show placeholder text
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

  // Draw Racked Hardware Nodes and Side Descriptions
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
    const midY = boxY + boxHeight / 2;

    const bays = getTrayBayCount(model, sku);
    const trayLayout = getTrayLayout(model, sku);

    // Identify role
    const isGigaSmartHero = model.includes('HC3') || model.includes('HC1') || model.includes('HC2') || model.includes('HCT');
    const isTray = bays > 0 || model.includes('M100') || model.includes('M200') || model.includes('TAP');

    const themeColor = isGigaSmartHero
      ? REPORT_COLOURS.accent
      : isTray
      ? '#64748B'
      : REPORT_COLOURS.structural;

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
            const modIcon = resolveHardwareIcon(mod.data?.image || getChassisImagePath(modModel, mod.data?.sku) || modModel);
            const img = modIcon ? trayModuleImgMap.get(modIcon) : undefined;
            if (img) {
              ctx.drawImage(img, bayX + 1, bayY + 1, colWidth - 4, rowHeight - 4);
            }
          } else {
            ctx.fillStyle = '#94A3B8';
            ctx.font = '8px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`Bay ${slotNum}`, bayX + (colWidth - 2) / 2, bayY + rowHeight / 2 + 3);
          }
        }
      }

      // ── Side Callout Description (Tray) ──
      const fittedCount = nested.length;
      const modCounts = new Map<string, number>();
      nested.forEach((m) => {
        const mModel = String(m.data?.model || 'Module');
        modCounts.set(mModel, (modCounts.get(mModel) || 0) + 1);
      });
      const modSummary = Array.from(modCounts.entries())
        .map(([mName, count]) => (count > 1 ? `${count}× ${mName}` : mName))
        .join(', ');

      drawSideCallout(ctx, {
        annoLeft,
        annoWidth,
        midY,
        boxY,
        boxHeight,
        themeColor,
        title: `${model} · ${ru} RU`,
        subtitle: data.label || 'Modular TAP Mounting Tray',
        details: fittedCount > 0 ? `Fitted: ${modSummary}` : 'Empty Tray (Ready for TAP Modules)',
        rackRight: rackLeft + rackWidth,
      });
    } else {
      // ── Powered Chassis (Composited faceplate with add-in cards) ──
      const img = imageMap.get(occupyingNode.id);

      ctx.fillStyle = isGigaSmartHero ? '#FFF7ED' : '#F1F5F9';
      ctx.fillRect(rackLeft + 1, boxY + 1, rackWidth - 2, boxHeight - 2);

      if (img) {
        ctx.drawImage(img, rackLeft + 1, boxY + 1, rackWidth - 2, boxHeight - 2);
      }

      ctx.strokeStyle = themeColor;
      ctx.lineWidth = isGigaSmartHero ? 2 : 1.5;
      ctx.strokeRect(rackLeft + 1, boxY + 1, rackWidth - 2, boxHeight - 2);

      // ── Side Callout Description (Powered Chassis) ──
      const installedBoards = data.installedBoards || {};
      const boardEntries = Object.entries(installedBoards).filter(([, b]) => Boolean(b));
      let detailsText: string;

      if (boardEntries.length > 0) {
        const cardList = boardEntries.map(([slot, b]) => `Slot ${slot}: ${b}`).join(', ');
        detailsText = `Fitted Cards: ${cardList}`;
      } else if (data.optics && Object.keys(data.optics).length > 0) {
        const opticCount = Object.keys(data.optics).length;
        detailsText = `${opticCount} active transceiver ports connected`;
      } else {
        detailsText = isGigaSmartHero
          ? 'GigaSMART Traffic Intelligence Engine'
          : 'High-Density Traffic Aggregation Node';
      }

      drawSideCallout(ctx, {
        annoLeft,
        annoWidth,
        midY,
        boxY,
        boxHeight,
        themeColor,
        title: `${model} · ${ru} RU`,
        subtitle: data.label || model,
        details: detailsText,
        rackRight: rackLeft + rackWidth,
      });
    }
  }

  return canvas.toDataURL('image/png');
}

/** Draws a clean annotation callout card to the side of the rack with a leader line */
function drawSideCallout(
  ctx: CanvasRenderingContext2D,
  opts: {
    annoLeft: number;
    annoWidth: number;
    midY: number;
    boxY: number;
    boxHeight: number;
    themeColor: string;
    title: string;
    subtitle: string;
    details: string;
    rackRight: number;
  },
) {
  const { annoLeft, annoWidth, midY, boxY, boxHeight, themeColor, title, subtitle, details, rackRight } = opts;

  // Leader line connecting rack edge to callout
  ctx.strokeStyle = REPORT_COLOURS.lineStrong;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(rackRight, midY);
  ctx.lineTo(annoLeft, midY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Small indicator dot at rack edge
  ctx.fillStyle = themeColor;
  ctx.beginPath();
  ctx.arc(rackRight, midY, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Callout Card Bounds
  const cardHeight = Math.max(boxHeight - 4, 26);
  const cardY = Math.max(boxY + 2, midY - cardHeight / 2);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(annoLeft, cardY, annoWidth, cardHeight);

  // Border & Left Accent Bar
  ctx.strokeStyle = REPORT_COLOURS.line;
  ctx.lineWidth = 1;
  ctx.strokeRect(annoLeft, cardY, annoWidth, cardHeight);

  ctx.fillStyle = themeColor;
  ctx.fillRect(annoLeft, cardY, 3.5, cardHeight);

  // Text content
  const textX = annoLeft + 8;
  const isMultiLine = cardHeight >= 36;
  const maxTextWidth = annoWidth - 12;

  /** Splits text at comma boundaries to fit within maxWidth, returning up to maxLines lines. */
  function wrapAtCommas(text: string, font: string, maxW: number, maxLines: number): string[] {
    ctx.font = font;
    if (ctx.measureText(text).width <= maxW) return [text];
    const parts = text.split(',').map((s) => s.trim());
    const lines: string[] = [];
    let current = '';
    for (const part of parts) {
      const candidate = current ? `${current}, ${part}` : part;
      if (ctx.measureText(candidate).width > maxW && current) {
        lines.push(current);
        current = part;
        if (lines.length >= maxLines - 1) { current += (parts.slice(parts.indexOf(part) + 1).length ? ', …' : ''); break; }
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines.slice(0, maxLines);
  }

  if (isMultiLine) {
    // Line 1: Appliance Model & RU
    ctx.font = 'bold 9.5px sans-serif';
    ctx.fillStyle = REPORT_COLOURS.structural;
    ctx.textAlign = 'left';
    ctx.fillText(title, textX, cardY + 12);

    // Line 2: Custom Label
    ctx.font = 'bold 8.5px sans-serif';
    ctx.fillStyle = themeColor === REPORT_COLOURS.accent ? REPORT_COLOURS.accent : REPORT_COLOURS.inkSecondary;
    const subTrunc = subtitle.length > 34 ? subtitle.slice(0, 32) + '…' : subtitle;
    ctx.fillText(subTrunc, textX, cardY + 23);

    // Lines 3+: Fitted Cards / Summary — word-wrapped at commas
    if (cardHeight >= 46 && details) {
      ctx.font = '8px sans-serif';
      ctx.fillStyle = REPORT_COLOURS.inkMuted;
      const maxDetailLines = Math.max(1, Math.floor((cardHeight - 38) / 11));
      const detailLines = wrapAtCommas(details, '8px sans-serif', maxTextWidth, maxDetailLines);
      detailLines.forEach((line, i) => {
        ctx.fillText(line, textX, cardY + 34 + i * 11);
      });
    }
  } else {
    // Compact 1-2 line layout for 1RU
    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = REPORT_COLOURS.structural;
    ctx.textAlign = 'left';
    ctx.fillText(`${title} — ${subtitle}`, textX, cardY + 11);

    if (details) {
      ctx.font = '8px sans-serif';
      ctx.fillStyle = REPORT_COLOURS.inkSecondary;
      const detTrunc = details.length > 44 ? details.slice(0, 42) + '…' : details;
      ctx.fillText(detTrunc, textX, cardY + 21);
    }
  }
}


