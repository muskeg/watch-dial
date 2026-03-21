// Pure render functions extracted from App.tsx for testability.
// All closed-over React state is replaced with explicit parameters.

export type MarkerStyle = 'none' | 'baton' | 'bauhaus' | 'diver' | 'dots' | 'dagger' | 'custom';

export type CustomMarkerOrientation = 'fixed' | 'toward-center';

export type NumeralStyle = 'none' | 'arabic' | 'roman';

export type NumeralLayout = 'quarters' | 'full';

export type Cutout =
  | {
      id: string;
      name: string;
      kind: 'circle';
      enabled: boolean;
      xMm: number;
      yMm: number;
      diameterMm: number;
    }
  | {
      id: string;
      name: string;
      kind: 'rounded-rect';
      enabled: boolean;
      xMm: number;
      yMm: number;
      widthMm: number;
      heightMm: number;
      radiusMm: number;
      rotationDeg: number;
    };

export interface DrawInnerEdgeOptions {
  innerEdgeColor: string;
  innerEdgeOpacity: number;
  innerEdgeWeight: number;
}

export interface DrawOverlayOptions {
  markerStyle: MarkerStyle;
  markerColor: string;
  markerSecondaryColor: string;
  indicesOpacity: number;
  markerInnerRadius: number;
  markerOuterRadius: number;
  markerWeight: number;
  hideQuarterIndices: boolean;
  numeralStyle: NumeralStyle;
  numeralLayout: NumeralLayout;
  customMarkerImage: HTMLImageElement | null;
  customMarkerOrientation: CustomMarkerOrientation;
  customMarkerRotationDeg: number;
  numeralsOpacity: number;
  numeralColor: string;
  fontWeight: number;
  fontSize: number;
  selectedFont: string;
  numberRadius: number;
  numeralOffsetX: number;
  numeralOffsetY: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}

function quoteFontFamily(value: string): string {
  return value.includes(' ') ? `"${value}"` : value;
}

const quarterIndexPositions = new Set([0, 3, 6, 9]);

const fullRomanLabels = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

// ---------------------------------------------------------------------------
// drawCutoutPath
// ---------------------------------------------------------------------------

export function drawCutoutPath(
  context: CanvasRenderingContext2D,
  cutout: Cutout,
  center: number,
  pixelsPerMm: number,
): void {
  const x = center + cutout.xMm * pixelsPerMm;
  const y = center + cutout.yMm * pixelsPerMm;

  context.beginPath();

  if (cutout.kind === 'circle') {
    context.arc(x, y, (cutout.diameterMm * pixelsPerMm) / 2, 0, Math.PI * 2);
    return;
  }

  const width = cutout.widthMm * pixelsPerMm;
  const height = cutout.heightMm * pixelsPerMm;
  const radius = Math.min(cutout.radiusMm * pixelsPerMm, width / 2, height / 2);

  context.save();
  context.translate(x, y);
  context.rotate(degToRad(cutout.rotationDeg));
  context.roundRect(-width / 2, -height / 2, width, height, radius);
  context.restore();
}

// ---------------------------------------------------------------------------
// applyCutouts
// ---------------------------------------------------------------------------

export function applyCutouts(
  context: CanvasRenderingContext2D,
  cutouts: Cutout[],
  center: number,
  pixelsPerMm: number,
): void {
  if (!cutouts.some((cutout) => cutout.enabled)) {
    return;
  }

  context.save();
  context.globalCompositeOperation = 'destination-out';
  context.fillStyle = '#000000';

  for (const cutout of cutouts) {
    if (!cutout.enabled) {
      continue;
    }

    drawCutoutPath(context, cutout, center, pixelsPerMm);
    context.fill();
  }

  context.restore();
}

// ---------------------------------------------------------------------------
// drawInnerEdge
// ---------------------------------------------------------------------------

export function drawInnerEdge(
  context: CanvasRenderingContext2D,
  center: number,
  radius: number,
  opts: DrawInnerEdgeOptions,
): void {
  const lineWidth = Math.max(1.5, radius * clamp(opts.innerEdgeWeight, 0.002, 0.08));
  const edgeRadius = radius - lineWidth / 2;

  if (edgeRadius <= 0) {
    return;
  }

  context.save();
  context.globalAlpha = opts.innerEdgeOpacity;
  context.strokeStyle = opts.innerEdgeColor;
  context.lineWidth = lineWidth;
  context.beginPath();
  context.arc(center, center, edgeRadius, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

// ---------------------------------------------------------------------------
// drawQuarterNumerals (internal helper, used by drawOverlay)
// ---------------------------------------------------------------------------

function drawQuarterNumerals(
  context: CanvasRenderingContext2D,
  center: number,
  radius: number,
  fontScale: number,
  labels: string[],
  opts: DrawOverlayOptions,
): void {
  context.fillStyle = opts.numeralColor;
  context.font = `${opts.fontWeight} ${opts.fontSize * fontScale}px ${quoteFontFamily(opts.selectedFont)}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const offsetX = (opts.numeralOffsetX / 100) * radius * 2;
  const offsetY = (opts.numeralOffsetY / 100) * radius * 2;

  for (let index = 0; index < labels.length; index += 1) {
    const angle = degToRad(index * 90 - 90);
    const numeralRadius = radius * clamp(opts.numberRadius, 0.45, 1);
    context.fillText(
      labels[index],
      center + Math.cos(angle) * numeralRadius + offsetX,
      center + Math.sin(angle) * numeralRadius + offsetY,
    );
  }
}

// ---------------------------------------------------------------------------
// drawOverlay
// ---------------------------------------------------------------------------

export function drawOverlay(
  context: CanvasRenderingContext2D,
  center: number,
  radius: number,
  fontScale: number,
  stage: 'indices' | 'numerals',
  opts: DrawOverlayOptions,
): void {
  context.save();
  context.strokeStyle = opts.markerColor;
  context.lineCap = 'round';
  context.lineJoin = 'round';

  const bandInner = Math.min(opts.markerInnerRadius, opts.markerOuterRadius);
  const bandOuter = Math.max(opts.markerInnerRadius, opts.markerOuterRadius);
  const bandMiddle = (bandInner + bandOuter) / 2;
  const bandSpan = Math.max(0.01, bandOuter - bandInner);
  const suppressQuarterIndices =
    opts.hideQuarterIndices && opts.numeralStyle !== 'none' && opts.numeralLayout === 'quarters';

  if (stage === 'indices' && opts.markerStyle === 'baton') {
    context.globalAlpha = opts.indicesOpacity;
    for (let marker = 0; marker < 12; marker += 1) {
      if (suppressQuarterIndices && quarterIndexPositions.has(marker)) {
        continue;
      }

      const angle = degToRad(marker * 30 - 90);
      const inner = radius * bandInner;
      const outer = radius * Math.min(0.98, bandOuter);
      context.lineWidth = radius * 0.042 * opts.markerWeight;
      context.beginPath();
      context.moveTo(center + Math.cos(angle) * inner, center + Math.sin(angle) * inner);
      context.lineTo(center + Math.cos(angle) * outer, center + Math.sin(angle) * outer);
      context.stroke();
    }
  }

  if (stage === 'indices' && opts.markerStyle === 'diver') {
    context.globalAlpha = opts.indicesOpacity;
    for (let marker = 0; marker < 60; marker += 1) {
      if (marker === 0) {
        continue;
      }

      if (suppressQuarterIndices && marker % 5 === 0 && quarterIndexPositions.has(marker / 5)) {
        continue;
      }

      const angle = degToRad(marker * 6 - 90);
      const isHour = marker % 5 === 0;
      const minuteInset = bandSpan * 0.26;
      const inner = radius * (isHour ? bandInner : Math.min(0.98, bandInner + minuteInset));
      const outer = radius * Math.min(0.98, isHour ? bandOuter : bandOuter - minuteInset * 0.8);
      context.lineWidth = radius * (isHour ? 0.034 : 0.012) * opts.markerWeight;
      context.beginPath();
      context.moveTo(center + Math.cos(angle) * inner, center + Math.sin(angle) * inner);
      context.lineTo(center + Math.cos(angle) * outer, center + Math.sin(angle) * outer);
      context.stroke();
    }

    if (!suppressQuarterIndices) {
      const triangleRadius = radius * Math.min(0.98, bandOuter + 0.01);
      const triangleBaseRadius = radius * Math.min(0.98, bandOuter - Math.min(0.02, bandSpan * 0.18));
      const triangleOffsetY = radius * 0.018;
      const triangleHalfWidth = radius * 0.06 * opts.markerWeight;
      context.fillStyle = opts.markerColor;
      context.beginPath();
      context.moveTo(center - triangleHalfWidth, center - triangleBaseRadius - triangleOffsetY);
      context.lineTo(center + triangleHalfWidth, center - triangleBaseRadius - triangleOffsetY);
      context.lineTo(center, center - triangleRadius + radius * 0.11 - triangleOffsetY);
      context.closePath();
      context.fill();
    }
  }

  if (stage === 'indices' && opts.markerStyle === 'dots') {
    context.globalAlpha = opts.indicesOpacity;
    context.fillStyle = opts.markerColor;

    for (let marker = 0; marker < 12; marker += 1) {
      if (suppressQuarterIndices && quarterIndexPositions.has(marker)) {
        continue;
      }

      const angle = degToRad(marker * 30 - 90);
      const dotRadius = radius * (marker === 0 ? 0.05 : 0.036) * opts.markerWeight;
      const orbit = radius * bandMiddle;
      context.beginPath();
      context.arc(
        center + Math.cos(angle) * orbit,
        center + Math.sin(angle) * orbit,
        dotRadius,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }

  if (stage === 'indices' && opts.markerStyle === 'bauhaus') {
    context.globalAlpha = opts.indicesOpacity;

    const orbit = radius * bandMiddle;

    // Minute dots (60 positions, skip 5-minute marks)
    context.fillStyle = opts.markerSecondaryColor;
    for (let minute = 0; minute < 60; minute += 1) {
      if (minute % 5 === 0) continue;
      const angle = degToRad(minute * 6 - 90);
      const dotRadius = radius * 0.006 * opts.markerWeight;
      context.beginPath();
      context.arc(
        center + Math.cos(angle) * orbit,
        center + Math.sin(angle) * orbit,
        dotRadius,
        0,
        Math.PI * 2,
      );
      context.fill();
    }

    // Hour dots at 5-minute marks, size increasing from 1 to 12
    context.fillStyle = opts.markerColor;
    const minHourDot = 0.012;
    const maxHourDot = 0.030;
    for (let marker = 0; marker < 12; marker += 1) {
      if (suppressQuarterIndices && quarterIndexPositions.has(marker)) {
        continue;
      }

      const angle = degToRad(marker * 30 - 90);
      // marker 0 = 12 o'clock (largest), 1 = 1 o'clock (smallest), ..., 11 = 11 o'clock
      const step = marker === 0 ? 12 : marker;
      const t = (step - 1) / 11;
      const dotRadius = radius * (minHourDot + t * (maxHourDot - minHourDot)) * opts.markerWeight;
      context.beginPath();
      context.arc(
        center + Math.cos(angle) * orbit,
        center + Math.sin(angle) * orbit,
        dotRadius,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }

  if (stage === 'indices' && opts.markerStyle === 'dagger') {
    context.globalAlpha = opts.indicesOpacity;
    context.fillStyle = opts.markerColor;

    for (let marker = 0; marker < 12; marker += 1) {
      if (suppressQuarterIndices && quarterIndexPositions.has(marker)) {
        continue;
      }

      const angle = degToRad(marker * 30 - 90);
      const tipX = radius * bandInner;
      const tailX = radius * Math.min(0.98, bandOuter - bandSpan * 0.04);
      const upperShoulderX = radius * (bandInner + bandSpan * 0.78);
      const lowerShoulderX = radius * (bandInner + bandSpan * 0.44);
      const tailHalfWidth = radius * 0.017 * opts.markerWeight;
      const shoulderHalfWidth = radius * 0.015 * opts.markerWeight;
      const lowerHalfWidth = radius * 0.0075 * opts.markerWeight;
      const capBulge = radius * 0.024 * opts.markerWeight;

      context.save();
      context.translate(center, center);
      context.rotate(angle);
      context.beginPath();
      context.moveTo(tailX, -tailHalfWidth);
      context.bezierCurveTo(
        tailX + capBulge,
        -tailHalfWidth,
        tailX + capBulge,
        tailHalfWidth,
        tailX,
        tailHalfWidth,
      );
      context.bezierCurveTo(
        upperShoulderX,
        shoulderHalfWidth,
        lowerShoulderX,
        lowerHalfWidth,
        tipX,
        0,
      );
      context.bezierCurveTo(
        lowerShoulderX,
        -lowerHalfWidth,
        upperShoulderX,
        -shoulderHalfWidth,
        tailX,
        -tailHalfWidth,
      );
      context.closePath();
      context.fill();
      context.restore();
    }
  }

  if (stage === 'indices' && opts.markerStyle === 'custom' && opts.customMarkerImage) {
    context.globalAlpha = opts.indicesOpacity;
    const imageAspect = opts.customMarkerImage.width / Math.max(1, opts.customMarkerImage.height);
    const imageHeight = Math.max(radius * 0.05, radius * bandSpan * 1.15) * opts.markerWeight;
    const imageWidth = imageHeight * imageAspect;
    const orbit = radius * bandMiddle;

    for (let marker = 0; marker < 12; marker += 1) {
      if (suppressQuarterIndices && quarterIndexPositions.has(marker)) {
        continue;
      }

      const angle = degToRad(marker * 30 - 90);
      const rotation =
        opts.customMarkerOrientation === 'toward-center'
          ? angle + Math.PI * 1.5 + degToRad(opts.customMarkerRotationDeg)
          : degToRad(opts.customMarkerRotationDeg);

      context.save();
      context.translate(center + Math.cos(angle) * orbit, center + Math.sin(angle) * orbit);
      context.rotate(rotation);
      context.drawImage(opts.customMarkerImage, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
      context.restore();
    }
  }

  if (stage === 'numerals' && opts.numeralStyle === 'arabic' && opts.numeralLayout === 'quarters') {
    context.globalAlpha = opts.numeralsOpacity;
    drawQuarterNumerals(context, center, radius, fontScale, ['12', '3', '6', '9'], opts);
  }

  if (stage === 'numerals' && opts.numeralStyle === 'roman' && opts.numeralLayout === 'quarters') {
    context.globalAlpha = opts.numeralsOpacity;
    drawQuarterNumerals(context, center, radius, fontScale, ['XII', 'III', 'VI', 'IX'], opts);
  }

  if (stage === 'numerals' && opts.numeralStyle === 'arabic' && opts.numeralLayout === 'full') {
    context.globalAlpha = opts.numeralsOpacity;
    context.fillStyle = opts.numeralColor;
    context.font = `${opts.fontWeight} ${opts.fontSize * fontScale}px ${quoteFontFamily(opts.selectedFont)}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const offsetX = (opts.numeralOffsetX / 100) * radius * 2;
    const offsetY = (opts.numeralOffsetY / 100) * radius * 2;

    for (let marker = 0; marker < 12; marker += 1) {
      const angle = degToRad(marker * 30 - 90);
      const label = marker === 0 ? '12' : `${marker}`;
      const numeralRadius = radius * clamp(opts.numberRadius, 0.45, 1);
      context.fillText(
        label,
        center + Math.cos(angle) * numeralRadius + offsetX,
        center + Math.sin(angle) * numeralRadius + offsetY,
      );
    }
  }

  if (stage === 'numerals' && opts.numeralStyle === 'roman' && opts.numeralLayout === 'full') {
    context.globalAlpha = opts.numeralsOpacity;
    context.fillStyle = opts.numeralColor;
    context.font = `${opts.fontWeight} ${opts.fontSize * fontScale}px ${quoteFontFamily(opts.selectedFont)}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const offsetX = (opts.numeralOffsetX / 100) * radius * 2;
    const offsetY = (opts.numeralOffsetY / 100) * radius * 2;

    for (let marker = 0; marker < 12; marker += 1) {
      const angle = degToRad(marker * 30 - 90);
      const numeralRadius = radius * clamp(opts.numberRadius, 0.45, 1);
      context.fillText(
        fullRomanLabels[marker],
        center + Math.cos(angle) * numeralRadius + offsetX,
        center + Math.sin(angle) * numeralRadius + offsetY,
      );
    }
  }

  context.restore();
}
