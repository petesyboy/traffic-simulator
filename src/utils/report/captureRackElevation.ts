/**
 * captureRackElevation.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Rasterises a 42U Rack Elevation View diagram for a specified physical site into
 * a high-resolution PNG data URL for embedding in the PDF solution report (Appendix B).
 *
 * Uses an offscreen <canvas> to render the permanent outer RU numbers (42..1),
 * cabinet rail enclosures, racked modular chassis, and G-TAP trays with nested
 * module stencils.
 */

import type { CustomNode, HardwareNodeData } from '../../store/types';
import { getDeviceRU, getTrayBayCount, getTrayLayout, isRackableGigamonEquipment, getChassisImagePath } from '../hardwareUtils';
import { resolveHardwareIcon } from '../../assets/hardwareIcons';

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

  // If no racked hardware for this site, still render a clean empty 42U rack
  const canvas = document.createElement('canvas');
  const width = 340;
  const height = 1060;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  // Background
  ctx.fillStyle = '#181818';
  ctx.fillRect(0, 0, width, height);

  // Header banner
  ctx.fillStyle = '#0e2238';
  ctx.fillRect(0, 0, width, 32);
  ctx.strokeStyle = '#0056b3';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, width, 32);

  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#00e5ff';
  ctx.textAlign = 'left';
  ctx.fillText(`42U RACK ELEVATION — ${siteName.toUpperCase()}`, 12, 20);

  // Layout metrics
  const railLeft = 8;
  const railWidth = 28;
  const rackLeft = 38;
  const rackWidth = 290;
  const rackTop = 40;
  const unitHeight = 24;
  const totalUnits = 42;
  const rackHeight = totalUnits * unitHeight; // 1008px

  // Cabinet Frame
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(rackLeft, rackTop, rackWidth, rackHeight);
  ctx.strokeStyle = '#444444';
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
          // Fallback to vector box if image fails to load
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

  // Draw Left RU Rail & Slot Backgrounds
  for (let u = totalUnits; u >= 1; u--) {
    const y = rackTop + (totalUnits - u) * unitHeight;

    // Draw RU Number on rail
    ctx.fillStyle = u % 5 === 0 ? '#00e5ff' : '#888888';
    ctx.font = u % 5 === 0 ? 'bold 10px monospace' : '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(String(u), railLeft + railWidth - 4, y + 15);

    // Slot row separator
    ctx.strokeStyle = '#2d2d2d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rackLeft, y + unitHeight);
    ctx.lineTo(rackLeft + rackWidth, y + unitHeight);
    ctx.stroke();
  }

  // Draw Racked Hardware Nodes
  for (let u = totalUnits; u >= 1; u--) {
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
    const boxY = rackTop + (totalUnits - u) * unitHeight;

    const bays = getTrayBayCount(model, sku);
    const trayLayout = getTrayLayout(model, sku);

    // Node frame background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(rackLeft + 1, boxY + 1, rackWidth - 2, boxHeight - 2);

    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rackLeft + 1, boxY + 1, rackWidth - 2, boxHeight - 2);

    if (bays > 0) {
      // ── Modular TAP Tray (e.g. TAP-M200T 1RU or TAP-M100T 0.5RU) ──
      const nested = siteHardware.filter((n) => n.data?.trayId === occupyingNode.id);
      const rowHeight = boxHeight / trayLayout.rows;
      const colWidth = (rackWidth - 10) / trayLayout.cols;

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(rackLeft + 2, boxY + 2, rackWidth - 4, boxHeight - 4);

      for (let r = 0; r < trayLayout.rows; r++) {
        for (let c = 0; c < trayLayout.cols; c++) {
          const slotNum = trayLayout.grid[r][c];
          const mod = nested.find((m) => m.data?.traySlot === slotNum);
          const bayX = rackLeft + 5 + c * colWidth;
          const bayY = boxY + 2 + r * rowHeight;

          ctx.fillStyle = mod ? '#7c2d12' : '#0f172a';
          ctx.fillRect(bayX, bayY, colWidth - 2, rowHeight - 2);
          ctx.strokeStyle = mod ? '#ea580c' : '#334155';
          ctx.lineWidth = 1;
          ctx.strokeRect(bayX, bayY, colWidth - 2, rowHeight - 2);

          if (mod) {
            const modModel = String(mod.data?.model || '');
            const modIcon = resolveHardwareIcon(mod.data?.image || getChassisImagePath(modModel, mod.data?.sku));
            const img = modIcon ? imageMap.get(modIcon) : undefined;
            if (img) {
              ctx.drawImage(img, bayX + 1, bayY + 1, colWidth - 4, rowHeight - 4);
            }
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 7px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`B${slotNum}: ${modModel}`, bayX + 3, bayY + rowHeight - 4);
          } else {
            ctx.fillStyle = '#64748b';
            ctx.font = '7px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`Bay ${slotNum}`, bayX + (colWidth - 2) / 2, bayY + rowHeight / 2 + 2);
          }
        }
      }
    } else {
      // ── Active Chassis (e.g. HC3, HC2, TA25E, TA100, TA200, HC1) ──
      const rawPath = data.image || getChassisImagePath(model, sku);
      const iconPath = resolveHardwareIcon(rawPath);
      const img = iconPath ? imageMap.get(iconPath) : undefined;

      if (img) {
        ctx.drawImage(img, rackLeft + 2, boxY + 2, rackWidth - 4, boxHeight - 4);
      }

      // Semi-transparent label badge on the left
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(rackLeft + 4, boxY + 4, 150, 16);
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1;
      ctx.strokeRect(rackLeft + 4, boxY + 4, 150, 16);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'left';
      const labelText = `${data.label || model} (${ru}U)`;
      ctx.fillText(labelText.length > 24 ? labelText.slice(0, 22) + '…' : labelText, rackLeft + 8, boxY + 15);
    }
  }

  return canvas.toDataURL('image/png');
}
