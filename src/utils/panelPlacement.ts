export interface PanelPlacement {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  side: 'left' | 'stack';
}

/**
 * Where to put the enlarged read-out relative to the compact log box it
 * magnifies: preferably just to its left (the config panel this lives in
 * docks to the right edge of the screen), falling back to stacking above/below
 * when there isn't enough horizontal room. Pulled out as a pure function of
 * (anchorRect, viewport) - rather than inline in the component - so the
 * arithmetic can be tested directly without needing a DOM to render into.
 *
 * Every branch clamps its final `left` against the live viewport width
 * (`vw - width - 16`), not just the position implied by the anchor - the
 * anchor's rect is captured once on hover-start and can go stale if the
 * viewport changes size while the panel is still open, and an unclamped value
 * derived from a stale anchor is exactly what let the panel drift off-screen.
 */
export function computeEnlargedPanelPlacement(
  anchorRect: Pick<DOMRect, 'left' | 'top' | 'width' | 'bottom'>,
  vw: number,
  vh: number,
): PanelPlacement {
  const GAP = 22;
  const PANEL_WIDTH = 480;
  const MIN_USABLE_WIDTH = 320;

  const spaceLeft = anchorRect.left - GAP - 16;
  if (spaceLeft >= MIN_USABLE_WIDTH) {
    const width = Math.min(PANEL_WIDTH, spaceLeft, vw - 32);
    const maxHeight = Math.min(vh * 0.7, vh - 32);
    const top = Math.min(Math.max(16, anchorRect.top - 40), Math.max(16, vh - maxHeight - 16));
    const left = Math.min(Math.max(16, anchorRect.left - GAP - width), vw - width - 16);
    return { left, top, width, maxHeight, side: 'left' };
  }

  const width = Math.min(560, vw - 32);
  const spaceBelow = vh - anchorRect.bottom - GAP - 16;
  const preferBelow = spaceBelow > 200;
  // The height used for positioning ("how far above the anchor do we start")
  // and the height actually rendered must be the same number - they used to be
  // computed separately (a raw, unclamped value for `top` vs. a `Math.max(…,
  // 200)`-floored one for `maxHeight`), so on a short viewport the panel could
  // render taller than whichever gap it was placed in, pushing it off-screen.
  const rawMaxHeight = preferBelow ? Math.min(vh * 0.55, spaceBelow) : vh * 0.55;
  const maxHeight = Math.min(Math.max(rawMaxHeight, 200), vh - 32);
  const desiredTop = preferBelow ? anchorRect.bottom + GAP : anchorRect.top - maxHeight - GAP;
  // Same clamp idiom as the 'left' branch above: guarantees top >= 16 and
  // top + maxHeight <= vh - 16, regardless of how `desiredTop` came out.
  const top = Math.min(Math.max(16, desiredTop), Math.max(16, vh - maxHeight - 16));
  const left = Math.min(Math.max(16, anchorRect.left + anchorRect.width / 2 - width / 2), vw - width - 16);
  return { left, top, width, maxHeight, side: 'stack' };
}
