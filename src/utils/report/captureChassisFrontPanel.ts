/**
 * captureChassisFrontPanel.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Rasterises the same chassis front-panel graphic shown in ChassisSummaryModal
 * (base photo + installed-module faceplates composited at their catalogue
 * `box` positions) into a single PNG data URL, for embedding in the PDF
 * solution report. Uses an offscreen <canvas> rather than DOM capture
 * (html-to-image) since ChassisFrontPanel is never mounted during report
 * generation — driving pixels directly keeps this independent of DOM/portal
 * lifecycle.
 */
import type { HardwareNodeData } from '../../store/types';
import { getBoardIcon } from '../../utils/hardwareUtils';
import { resolveHardwareIcon } from '../../assets/hardwareIcons';
import type { SlotPosition } from '../../components/nodes/ChassisFrontPanel';

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${src}`));
    img.src = src;
  });

/**
 * Returns a PNG data URL of the composited front panel, or `undefined` if the
 * chassis has no photo or no positioned slots to draw (mirrors the `hasFrontPanel`
 * gate in ChassisSummaryModal).
 */
export async function captureChassisFrontPanelPng(
  chassisImage: string | undefined,
  slotPositions: SlotPosition[],
  installedBoards: NonNullable<HardwareNodeData['installedBoards']>,
): Promise<string | undefined> {
  if (!chassisImage) return undefined;

  const baseImg = await loadImage(chassisImage);
  const canvas = document.createElement('canvas');
  canvas.width = baseImg.naturalWidth;
  canvas.height = baseImg.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);

  for (const { number, box } of slotPositions) {
    const boardName = installedBoards[number];
    if (!boardName || !box) continue;
    const rawIcon = getBoardIcon(boardName);
    const moduleIcon = rawIcon ? resolveHardwareIcon(rawIcon) : undefined;
    if (!moduleIcon) continue;
    try {
      const modImg = await loadImage(moduleIcon);
      ctx.drawImage(
        modImg,
        box.x * canvas.width,
        box.y * canvas.height,
        box.width * canvas.width,
        box.height * canvas.height,
      );
    } catch {
      // Missing/unresolvable module icon — skip it rather than failing the whole panel.
    }
  }

  return canvas.toDataURL('image/png');
}
