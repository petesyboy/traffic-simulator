import { describe, it, expect } from 'vitest';
import { computeEnlargedPanelPlacement } from './panelPlacement';

// A DOMRect stand-in - only left/top/width/bottom are read by the placement math.
const rect = (left: number, top: number, width: number, height: number) => ({
  left, top, width, bottom: top + height,
});

describe('computeEnlargedPanelPlacement', () => {
  it('never lets the panel extend past the right edge of the viewport, in the "left" branch', () => {
    // Anchor with plenty of room to its left (spaceLeft >= 320), on a wide viewport.
    const p = computeEnlargedPanelPlacement(rect(900, 200, 300, 80), 1280, 800);
    expect(p.side).toBe('left');
    expect(p.left + p.width).toBeLessThanOrEqual(1280 - 16);
    expect(p.left).toBeGreaterThanOrEqual(16);
  });

  it('never lets the panel extend past the right edge, in the "stack" branch', () => {
    // Anchor with too little room to its left, so this falls to 'stack'.
    const p = computeEnlargedPanelPlacement(rect(200, 200, 300, 80), 1280, 800);
    expect(p.side).toBe('stack');
    expect(p.left + p.width).toBeLessThanOrEqual(1280 - 16);
    expect(p.left).toBeGreaterThanOrEqual(16);
  });

  it('stays on-screen on a narrow ~700px viewport with a right-docked anchor - the reported scenario', () => {
    // A config panel docked to the right of a ~700px-wide window: anchor sits
    // roughly 300-620px from the left, matching the reported screenshot.
    const p = computeEnlargedPanelPlacement(rect(316, 150, 304, 90), 700, 900);
    expect(p.left).toBeGreaterThanOrEqual(16);
    expect(p.left + p.width).toBeLessThanOrEqual(700 - 16);
  });

  it('stays on-screen when the anchor rect is stale relative to a since-narrowed viewport', () => {
    // anchorRect captured while the window was 1280 wide (anchor near the far
    // right), then the window narrows to 700 without the anchor being
    // re-measured - exactly the staleness scenario the fix targets.
    const staleAnchor = rect(900, 150, 300, 90); // valid for vw=1280, not for vw=700
    const p = computeEnlargedPanelPlacement(staleAnchor, 700, 900);
    expect(p.left).toBeGreaterThanOrEqual(16);
    expect(p.left + p.width).toBeLessThanOrEqual(700 - 16);
  });

  it('stays on-screen for every anchor position across a sweep of narrow viewport widths', () => {
    for (const vw of [400, 500, 600, 700, 800, 1000, 1280, 1920]) {
      for (const anchorLeft of [0, 50, 100, 200, 300, 400, vw - 50, vw + 200, vw * 2]) {
        const p = computeEnlargedPanelPlacement(rect(anchorLeft, 100, 300, 80), vw, 900);
        expect(p.left).toBeGreaterThanOrEqual(0);
        expect(p.left + p.width).toBeLessThanOrEqual(vw);
      }
    }
  });

  it('never lets the panel width alone exceed the viewport, even before positioning', () => {
    // A pathologically narrow viewport (mobile-width or a heavily zoomed page).
    const p = computeEnlargedPanelPlacement(rect(20, 100, 50, 40), 320, 600);
    expect(p.width).toBeLessThanOrEqual(320 - 32);
    expect(p.left + p.width).toBeLessThanOrEqual(320);
  });

  it('stays within the viewport height in the "stack, place above" sub-branch on a short viewport - the reported scenario', () => {
    // Narrow enough for 'stack' (spaceLeft < 320) and short enough that
    // neither above nor below the anchor has 200px to spare - reproduces what
    // was live-verified in the browser: the panel rendered with its bottom
    // edge 27px past the viewport (top=307, maxHeight=200, vh=480 in that
    // repro; this is the same shape with rounder numbers).
    const p = computeEnlargedPanelPlacement(rect(50, 90, 300, 20), 480, 200);
    expect(p.side).toBe('stack');
    expect(p.top).toBeGreaterThanOrEqual(0);
    expect(p.top + p.maxHeight).toBeLessThanOrEqual(200);
  });

  it('stays within the viewport height in the "stack, place below" sub-branch', () => {
    // Anchor near the top, with plenty of vertical room below it.
    const p = computeEnlargedPanelPlacement(rect(50, 20, 300, 20), 480, 400);
    expect(p.side).toBe('stack');
    expect(p.top).toBeGreaterThanOrEqual(0);
    expect(p.top + p.maxHeight).toBeLessThanOrEqual(400);
  });

  it('stays within the viewport height in the "left" branch across a sweep of viewport heights', () => {
    for (const vh of [200, 300, 400, 600, 800, 1080]) {
      for (const anchorTop of [0, 50, 100, vh - 50, vh + 100]) {
        const p = computeEnlargedPanelPlacement(rect(900, anchorTop, 300, 80), 1280, vh);
        expect(p.top).toBeGreaterThanOrEqual(0);
        expect(p.top + p.maxHeight).toBeLessThanOrEqual(vh);
      }
    }
  });

  it('stays within the viewport height in the "stack" branch across a sweep of viewport heights', () => {
    for (const vh of [200, 300, 400, 600, 800, 1080]) {
      for (const anchorTop of [0, 50, 100, vh - 50, vh + 100]) {
        const p = computeEnlargedPanelPlacement(rect(50, anchorTop, 300, 80), 480, vh);
        expect(p.side).toBe('stack');
        expect(p.top).toBeGreaterThanOrEqual(0);
        expect(p.top + p.maxHeight).toBeLessThanOrEqual(vh);
      }
    }
  });
});
