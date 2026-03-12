import { createCanvas } from 'canvas';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import {
  type Cutout,
  type DrawInnerEdgeOptions,
  type DrawOverlayOptions,
  type MarkerStyle,
  type NumeralLayout,
  type NumeralStyle,
  applyCutouts,
  drawCutoutPath,
  drawInnerEdge,
  drawOverlay,
} from '../dial-renderer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SNAPSHOT_DIR = resolve(__dirname, '../__snapshots__');

function matchPngSnapshot(buf: Buffer, name: string) {
  if (!existsSync(SNAPSHOT_DIR)) {
    mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }
  const file = resolve(SNAPSHOT_DIR, `${name}.png`);
  if (!existsSync(file)) {
    writeFileSync(file, buf);
    return; // first run: write and pass
  }
  const existing = readFileSync(file);
  expect(buf.equals(existing)).toBe(true);
}

function makeWhiteCanvas(size: number) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function hasNonWhitePixel(canvas: ReturnType<typeof createCanvas>): boolean {
  const ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255 || data[i + 3] !== 255) {
      return true;
    }
  }
  return false;
}

function getPixel(
  canvas: ReturnType<typeof createCanvas>,
  x: number,
  y: number,
): [number, number, number, number] {
  const ctx = canvas.getContext('2d');
  const d = ctx.getImageData(x, y, 1, 1).data;
  return [d[0], d[1], d[2], d[3]];
}

const DEFAULT_OVERLAY_OPTS: DrawOverlayOptions = {
  markerStyle: 'baton',
  markerColor: '#f7efe0',
  indicesOpacity: 1,
  markerInnerRadius: 0.80,
  markerOuterRadius: 0.93,
  markerWeight: 1,
  hideQuarterIndices: false,
  numeralStyle: 'none',
  numeralLayout: 'quarters',
  customMarkerImage: null,
  customMarkerOrientation: 'fixed',
  customMarkerRotationDeg: 0,
  numeralsOpacity: 1,
  numeralColor: '#f4d7b2',
  fontWeight: 700,
  fontSize: 48,
  selectedFont: 'sans-serif',
  numberRadius: 0.70,
  numeralOffsetX: 0,
  numeralOffsetY: 0,
};

// ---------------------------------------------------------------------------
// drawCutoutPath
// ---------------------------------------------------------------------------

describe('drawCutoutPath', () => {
  it('circle cutout punches a hole at its center', () => {
    const SIZE = 200;
    const canvas = makeWhiteCanvas(SIZE);
    const ctx = canvas.getContext('2d');

    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000';

    const cutout: Cutout = {
      id: 'test',
      name: 'test',
      kind: 'circle',
      enabled: true,
      xMm: 0,
      yMm: 0,
      diameterMm: 4,
    };
    // pixelsPerMm = 10 → radius = 20 px, circle at (100, 100)
    drawCutoutPath(ctx as unknown as CanvasRenderingContext2D, cutout, SIZE / 2, 10);
    ctx.fill();

    const [, , , a] = getPixel(canvas, SIZE / 2, SIZE / 2);
    expect(a).toBe(0); // hole punched — alpha cleared to 0

    // PNG snapshot
    matchPngSnapshot(canvas.toBuffer('image/png'), 'cutout-circle');
  });

  it('rounded-rect cutout punches a hole at its center', () => {
    const SIZE = 200;
    const canvas = makeWhiteCanvas(SIZE);
    const ctx = canvas.getContext('2d');

    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000';

    const cutout: Cutout = {
      id: 'test',
      name: 'test',
      kind: 'rounded-rect',
      enabled: true,
      xMm: 0,
      yMm: 0,
      widthMm: 10,
      heightMm: 6,
      radiusMm: 0.5,
      rotationDeg: 0,
    };
    // pixelsPerMm = 10 → rect 100×60 centered at (100, 100)
    drawCutoutPath(ctx as unknown as CanvasRenderingContext2D, cutout, SIZE / 2, 10);
    ctx.fill();

    const [, , , a] = getPixel(canvas, SIZE / 2, SIZE / 2);
    expect(a).toBe(0); // hole punched — alpha cleared to 0

    // PNG snapshot
    matchPngSnapshot(canvas.toBuffer('image/png'), 'cutout-rounded-rect');
  });
});

// ---------------------------------------------------------------------------
// drawOverlay — MarkerStyle variants
// ---------------------------------------------------------------------------

const SIZE = 400;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2;
const FONT_SCALE = SIZE / 760;

describe('drawOverlay — MarkerStyle', () => {
  const markerStyles: MarkerStyle[] = ['none', 'baton', 'diver', 'dots', 'dagger'];

  for (const style of markerStyles) {
    it(`markerStyle "${style}" — renders correctly`, () => {
      const canvas = makeWhiteCanvas(SIZE);
      const ctx = canvas.getContext('2d');
      const opts: DrawOverlayOptions = { ...DEFAULT_OVERLAY_OPTS, markerStyle: style };
      drawOverlay(ctx as unknown as CanvasRenderingContext2D, CENTER, RADIUS, FONT_SCALE, 'indices', opts);

      if (style === 'none') {
        expect(hasNonWhitePixel(canvas)).toBe(false);
      } else {
        expect(hasNonWhitePixel(canvas)).toBe(true);
      }

      matchPngSnapshot(canvas.toBuffer('image/png'), `marker-${style}`);
    });
  }

  it.skip('markerStyle "custom" — skipped (requires image resource)', () => {
    // custom marker requires a loaded HTMLImageElement; skip in CI
  });
});

// ---------------------------------------------------------------------------
// drawOverlay — NumeralStyle × NumeralLayout combinations
// ---------------------------------------------------------------------------

describe('drawOverlay — NumeralStyle × NumeralLayout', () => {
  const numeralStyles: NumeralStyle[] = ['arabic', 'roman'];
  const numeralLayouts: NumeralLayout[] = ['quarters', 'full'];

  for (const ns of numeralStyles) {
    for (const nl of numeralLayouts) {
      it(`numeralStyle "${ns}" × numeralLayout "${nl}" — renders text`, () => {
        const canvas = makeWhiteCanvas(SIZE);
        const ctx = canvas.getContext('2d');
        const opts: DrawOverlayOptions = {
          ...DEFAULT_OVERLAY_OPTS,
          markerStyle: 'none',
          numeralStyle: ns,
          numeralLayout: nl,
        };
        drawOverlay(ctx as unknown as CanvasRenderingContext2D, CENTER, RADIUS, FONT_SCALE, 'numerals', opts);

        // Numerals are drawn in a non-white color — canvas should have non-white pixels
        expect(hasNonWhitePixel(canvas)).toBe(true);

        matchPngSnapshot(canvas.toBuffer('image/png'), `numeral-${ns}-${nl}`);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// drawInnerEdge
// ---------------------------------------------------------------------------

describe('drawInnerEdge', () => {
  it('draws a ring that is visible on white canvas', () => {
    const canvas = makeWhiteCanvas(SIZE);
    const ctx = canvas.getContext('2d');
    const opts: DrawInnerEdgeOptions = {
      innerEdgeColor: '#f7efe0',
      innerEdgeOpacity: 1,
      innerEdgeWeight: 0.012,
    };
    drawInnerEdge(ctx as unknown as CanvasRenderingContext2D, CENTER, RADIUS, opts);

    // The edge color is non-white — canvas should have non-white pixels
    expect(hasNonWhitePixel(canvas)).toBe(true);

    matchPngSnapshot(canvas.toBuffer('image/png'), 'inner-edge');
  });
});

// ---------------------------------------------------------------------------
// applyCutouts
// ---------------------------------------------------------------------------

describe('applyCutouts', () => {
  it('applies enabled cutouts using destination-out', () => {
    const canvas = makeWhiteCanvas(SIZE);
    const ctx = canvas.getContext('2d');

    // First fill with a solid color so destination-out produces transparent pixels
    ctx.fillStyle = '#153040';
    ctx.fillRect(0, 0, SIZE, SIZE);

    const cutouts: Cutout[] = [
      {
        id: 'pinion',
        name: 'Hands Post',
        kind: 'circle',
        enabled: true,
        xMm: 0,
        yMm: 0,
        diameterMm: 4,
      },
    ];
    // pixelsPerMm=20 → radius=40 px → center pixel should be transparent
    applyCutouts(ctx as unknown as CanvasRenderingContext2D, cutouts, CENTER, 20);

    const [, , , a] = getPixel(canvas, CENTER, CENTER);
    expect(a).toBe(0);
  });
});
