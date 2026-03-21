import { ChangeEvent, DragEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import './App.css';
import * as renderer from './dial-renderer';
import type { BlendMode, Cutout, CustomMarkerOrientation, DisplayPreset, LayerPlacement, MarkerStyle, NumeralLayout, NumeralStyle, SavedDesignMeta, SerializedDesign, SerializedLayer } from './design-storage';
import { deleteDesign, isSerializedDesign, listSavedDesigns, loadDesign, saveDesign } from './design-storage';

type Layer = {
  id: string;
  name: string;
  creationIndex: number;
  image: HTMLImageElement;
  visible: boolean;
  opacity: number;
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  blendMode: BlendMode;
  placement: LayerPlacement;
};

type FontOption = {
  id: string;
  label: string;
  family: string;
};

type LayerRenderMetrics = {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotationRad: number;
};

type PreviewInteraction =
  | {
      mode: 'move';
      layerId: string;
      startPointer: { x: number; y: number };
      startOffsetX: number;
      startOffsetY: number;
    }
  | {
      mode: 'scale';
      layerId: string;
      startDistance: number;
      startScale: number;
    }
  | {
      mode: 'rotate';
      layerId: string;
      startAngle: number;
      startRotation: number;
    };

const builtInFonts: FontOption[] = [
  { id: 'bebas', label: 'Bebas Neue', family: 'Bebas Neue' },
  { id: 'orbitron', label: 'Orbitron', family: 'Orbitron' },
  { id: 'cinzel', label: 'Cinzel', family: 'Cinzel' },
  { id: 'cormorant', label: 'Cormorant Garamond', family: 'Cormorant Garamond' },
  { id: 'dm-serif', label: 'DM Serif Display', family: 'DM Serif Display' },
  { id: 'libre-baskerville', label: 'Libre Baskerville', family: 'Libre Baskerville' },
  { id: 'oswald', label: 'Oswald', family: 'Oswald' },
  { id: 'rajdhani', label: 'Rajdhani', family: 'Rajdhani' },
  { id: 'chivo-mono', label: 'Chivo Mono', family: 'Chivo Mono' },
  { id: 'space-grotesk', label: 'Space Grotesk', family: 'Space Grotesk' },
  { id: 'archivo-black', label: 'Archivo Black', family: 'Archivo Black' },
  { id: 'fraunces', label: 'Fraunces', family: 'Fraunces' },
];

const blendModes: BlendMode[] = [
  'source-over',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'soft-light',
];

const blendModeLabels: Record<BlendMode, string> = {
  'source-over': 'Normal',
  'multiply': 'Multiply',
  'screen': 'Screen',
  'overlay': 'Overlay',
  'darken': 'Darken',
  'lighten': 'Lighten',
  'soft-light': 'Soft Light',
};

const layerPlacementOptions: { label: string; value: LayerPlacement }[] = [
  { label: 'Base', value: 'below-overlays' },
  { label: 'Over Indices', value: 'above-indices' },
  { label: 'Over Numerals', value: 'above-numerals' },
];

const markerOptions: { label: string; value: MarkerStyle }[] = [
  { label: 'None', value: 'none' },
  { label: 'Baton', value: 'baton' },
  { label: 'Diver', value: 'diver' },
  { label: 'Dots', value: 'dots' },
  { label: 'Spear', value: 'dagger' },
  { label: 'Bauhaus', value: 'bauhaus' },
  { label: 'Custom', value: 'custom' },
];

const customMarkerOrientationOptions: { label: string; value: CustomMarkerOrientation }[] = [
  { label: 'As Is', value: 'fixed' },
  { label: 'Toward Center', value: 'toward-center' },
];

const quarterIndexPositions = new Set([0, 3, 6, 9]);

const PREVIEW_SIZE = 760;
const PREVIEW_SCALE_HANDLE_RADIUS = 14;
const PREVIEW_ROTATE_HANDLE_RADIUS = 14;
const PREVIEW_ROTATE_HANDLE_OFFSET = 36;
// Larger hit areas for touch accessibility (visual handles stay at the radii above)
const PREVIEW_SCALE_HIT_RADIUS = 22;
const PREVIEW_ROTATE_HIT_RADIUS = 22;

const numeralStyleOptions: { label: string; value: NumeralStyle }[] = [
  { label: 'None', value: 'none' },
  { label: 'Arabic', value: 'arabic' },
  { label: 'Roman', value: 'roman' },
];

const numeralLayoutOptions: { label: string; value: NumeralLayout }[] = [
  { label: 'Quarters', value: 'quarters' },
  { label: 'Full', value: 'full' },
];

const fullRomanLabels = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

const DISPLAY_PRESETS_STORAGE_KEY = 'watch-dial.display-presets.v1';
const AUTOSAVE_ID = '__autosave__';

const CUSTOM_DISPLAY_PRESET: DisplayPreset = {
  id: 'custom',
  label: 'Custom',
  note: 'Build your own display openings and save them as reusable presets.',
  cutouts: [],
};

const builtInDisplayPresets: DisplayPreset[] = [
  {
    id: 'nh35-3h',
    label: 'NH35 Date 3H',
    note: 'NH35 date dial at 3H with 28.50 mm dial size, 2.05 mm hands post hole, and 2.90 x 2.00 mm date window.',
    dialDiameterMm: 28.5,
    cutouts: [
      { id: 'pinion', name: 'Hands Post', kind: 'circle', enabled: true, xMm: 0, yMm: 0, diameterMm: 2.05 },
      {
        id: 'date',
        name: 'Date Window',
        kind: 'rounded-rect',
        enabled: true,
        xMm: 10.55,
        yMm: 0,
        widthMm: 2.9,
        heightMm: 2,
        radiusMm: 0.15,
        rotationDeg: 0,
      },
    ],
  },
  {
    id: 'nh35-6h',
    label: 'NH35 Date 6H',
    note: 'NH35 date dial at 6H with 28.50 mm dial size, 2.05 mm hands post hole, and 2.00 x 2.90 mm date window.',
    dialDiameterMm: 28.5,
    cutouts: [
      { id: 'pinion', name: 'Hands Post', kind: 'circle', enabled: true, xMm: 0, yMm: 0, diameterMm: 2.05 },
      {
        id: 'date',
        name: 'Date Window',
        kind: 'rounded-rect',
        enabled: true,
        xMm: 0,
        yMm: 10.55,
        widthMm: 2,
        heightMm: 2.9,
        radiusMm: 0.15,
        rotationDeg: 0,
      },
    ],
  },
  {
    id: 'nh36-3h',
    label: 'NH36 Day-Date 3H',
    note: 'NH36 day-date dial at 3H with 28.50 mm dial size, 2.05 mm hands post hole, and 7.00 x 2.00 mm aperture centered 8.45 mm from dial center.',
    dialDiameterMm: 28.5,
    cutouts: [
      { id: 'pinion', name: 'Hands Post', kind: 'circle', enabled: true, xMm: 0, yMm: 0, diameterMm: 2.05 },
      {
        id: 'day-date',
        name: 'Day-Date Window',
        kind: 'rounded-rect',
        enabled: true,
        xMm: 8.45,
        yMm: 0,
        widthMm: 7,
        heightMm: 2,
        radiusMm: 0.15,
        rotationDeg: 0,
      },
    ],
  },
  {
    id: 'nh36-6h',
    label: 'NH36 Day-Date 6H',
    note: 'NH36 day-date dial at 6H with 28.50 mm dial size, 2.05 mm hands post hole, and 2.00 x 7.00 mm aperture centered 8.45 mm from dial center.',
    dialDiameterMm: 28.5,
    cutouts: [
      { id: 'pinion', name: 'Hands Post', kind: 'circle', enabled: true, xMm: 0, yMm: 0, diameterMm: 2.05 },
      {
        id: 'day-date',
        name: 'Day-Date Window',
        kind: 'rounded-rect',
        enabled: true,
        xMm: 0,
        yMm: 8.45,
        widthMm: 2,
        heightMm: 7,
        radiusMm: 0.15,
        rotationDeg: 0,
      },
    ],
  },
  {
    id: 'nh38-open-heart',
    label: 'NH38 Open Heart',
    note: 'NH38 open-heart dial with 28.50 mm dial size, 2.05 mm hands post hole, and 10.00 mm aperture centered 6.827 mm left of dial center and 0.0558 mm above the horizontal centerline.',
    dialDiameterMm: 28.5,
    cutouts: [
      { id: 'pinion', name: 'Hands Post', kind: 'circle', enabled: true, xMm: 0, yMm: 0, diameterMm: 2.05 },
      {
        id: 'open-heart',
        name: 'Open Heart',
        kind: 'circle',
        enabled: true,
        xMm: -6.827,
        yMm: -0.0558,
        diameterMm: 10,
      },
    ],
  },
  {
    id: 'miyota-9015-date-3h',
    label: 'Miyota 9015 Date 3H',
    note: 'Miyota 9015 date at 3H with 30.00 mm dial, 2.00 mm hands post, and 2.70 × 2.00 mm date window centred 10.20 mm from dial centre.',
    dialDiameterMm: 30,
    cutouts: [
      { id: 'pinion', name: 'Hands Post', kind: 'circle', enabled: true, xMm: 0, yMm: 0, diameterMm: 2.0 },
      {
        id: 'date',
        name: 'Date Window',
        kind: 'rounded-rect',
        enabled: true,
        xMm: 10.2,
        yMm: 0,
        widthMm: 2.7,
        heightMm: 2.0,
        radiusMm: 0.15,
        rotationDeg: 0,
      },
    ],
  },
  {
    id: 'miyota-9039-no-date',
    label: 'Miyota 9039 No-Date',
    note: 'Miyota 9039 no-date with 30.00 mm dial and 2.00 mm hands post. Same dial footprint as the 9015, no date window.',
    dialDiameterMm: 30,
    cutouts: [
      { id: 'pinion', name: 'Hands Post', kind: 'circle', enabled: true, xMm: 0, yMm: 0, diameterMm: 2.0 },
    ],
  },
];

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createCircleCutout(name: string, diameterMm: number): Cutout {
  return {
    id: createId('cutout'),
    name,
    kind: 'circle',
    enabled: true,
    xMm: 0,
    yMm: 0,
    diameterMm,
  };
}

function createRoundedRectCutout(name: string, widthMm: number, heightMm: number): Cutout {
  return {
    id: createId('cutout'),
    name,
    kind: 'rounded-rect',
    enabled: true,
    xMm: 0,
    yMm: 0,
    widthMm,
    heightMm,
    radiusMm: 0.15,
    rotationDeg: 0,
  };
}

function readSavedDisplayPresets() {
  if (typeof window === 'undefined') {
    return [] as DisplayPreset[];
  }

  try {
    const raw = window.localStorage.getItem(DISPLAY_PRESETS_STORAGE_KEY);

    if (!raw) {
      return [] as DisplayPreset[];
    }

    const parsed = JSON.parse(raw) as DisplayPreset[];

    if (!Array.isArray(parsed)) {
      return [] as DisplayPreset[];
    }

    return parsed.filter((preset) => preset.id !== 'custom');
  } catch {
    return [] as DisplayPreset[];
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function degToRad(value: number) {
  return (value * Math.PI) / 180;
}

function quoteFontFamily(value: string) {
  return value.includes(' ') ? `"${value}"` : value;
}

function cloneCutouts(cutouts: Cutout[]) {
  return cutouts.map((cutout) => ({ ...cutout }));
}

function loadImage(file: File) {
  return new Promise<{ name: string; image: HTMLImageElement }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ name: file.name.replace(/\.[^.]+$/, ''), image });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Unable to read ${file.name}`));
    };

    image.src = objectUrl;
  });
}

function imageToDataUrl(image: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return image.src;
  ctx.drawImage(image, 0, 0);
  return canvas.toDataURL('image/png');
}

function dataUrlToImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function readUint32BigEndian(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] * 0x1000000) +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  ) >>> 0;
}

let crcTable: Uint32Array | null = null;

function getCrcTable() {
  if (crcTable) {
    return crcTable;
  }

  const table = new Uint32Array(256);

  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }

  crcTable = table;
  return table;
}

function computeCrc32(bytes: Uint8Array) {
  const table = getCrcTable();
  let crc = 0xffffffff;

  for (let i = 0; i < bytes.length; i += 1) {
    crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createPngChunk(type: string, data: Uint8Array) {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length, false);

  for (let i = 0; i < 4; i += 1) {
    chunk[4 + i] = type.charCodeAt(i);
  }

  chunk.set(data, 8);

  const crcInput = new Uint8Array(4 + data.length);
  crcInput.set(chunk.subarray(4, 8), 0);
  crcInput.set(data, 4);
  view.setUint32(8 + data.length, computeCrc32(crcInput), false);

  return chunk;
}

function concatUint8Arrays(parts: Uint8Array[]) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(size);
  let offset = 0;

  for (const part of parts) {
    merged.set(part, offset);
    offset += part.length;
  }

  return merged;
}

async function addPngDpiMetadata(blob: Blob, dpi: number) {
  const effectiveDpi = Math.max(1, Math.round(dpi));
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const pngSignature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  if (bytes.length < pngSignature.length) {
    return blob;
  }

  for (let i = 0; i < pngSignature.length; i += 1) {
    if (bytes[i] !== pngSignature[i]) {
      return blob;
    }
  }

  const pixelsPerMeter = Math.max(1, Math.round(effectiveDpi / 0.0254));
  const physData = new Uint8Array(9);
  const physView = new DataView(physData.buffer);
  physView.setUint32(0, pixelsPerMeter, false);
  physView.setUint32(4, pixelsPerMeter, false);
  physData[8] = 1;
  const physChunk = createPngChunk('pHYs', physData);

  const outputChunks: Uint8Array[] = [pngSignature];
  let offset = pngSignature.length;
  let insertedPhys = false;

  while (offset + 8 <= bytes.length) {
    const length = readUint32BigEndian(bytes, offset);
    const chunkTotal = 12 + length;

    if (offset + chunkTotal > bytes.length) {
      return blob;
    }

    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = String.fromCharCode(typeBytes[0], typeBytes[1], typeBytes[2], typeBytes[3]);
    const chunk = bytes.subarray(offset, offset + chunkTotal);

    if (type === 'IHDR') {
      outputChunks.push(chunk);
      outputChunks.push(physChunk);
      insertedPhys = true;
    } else if (type !== 'pHYs') {
      outputChunks.push(chunk);
    }

    offset += chunkTotal;
  }

  if (!insertedPhys) {
    return blob;
  }

  const outputBytes = concatUint8Arrays(outputChunks);
  return new Blob([outputBytes], { type: 'image/png' });
}

function makeLayer(name: string, image: HTMLImageElement, creationIndex: number): Layer {
  return {
    id: createId('layer'),
    name,
    creationIndex,
    image,
    visible: true,
    opacity: 1,
    scale: 1,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    blendMode: 'source-over',
    placement: 'below-overlays',
  };
}

function getLayerRenderMetrics(layer: Layer, size: number): LayerRenderMetrics {
  const baseScale = size / Math.max(layer.image.width, layer.image.height);

  return {
    centerX: size / 2 + (layer.offsetX / 100) * size,
    centerY: size / 2 + (layer.offsetY / 100) * size,
    width: layer.image.width * baseScale * layer.scale,
    height: layer.image.height * baseScale * layer.scale,
    rotationRad: degToRad(layer.rotation),
  };
}

function toLocalPoint(point: { x: number; y: number }, metrics: LayerRenderMetrics) {
  const dx = point.x - metrics.centerX;
  const dy = point.y - metrics.centerY;
  const cos = Math.cos(metrics.rotationRad);
  const sin = Math.sin(metrics.rotationRad);

  return {
    x: dx * cos + dy * sin,
    y: -dx * sin + dy * cos,
  };
}

function toWorldPoint(point: { x: number; y: number }, metrics: LayerRenderMetrics) {
  const cos = Math.cos(metrics.rotationRad);
  const sin = Math.sin(metrics.rotationRad);

  return {
    x: metrics.centerX + point.x * cos - point.y * sin,
    y: metrics.centerY + point.x * sin + point.y * cos,
  };
}

function getDistance(left: { x: number; y: number }, right: { x: number; y: number }) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function isPointInLayer(point: { x: number; y: number }, metrics: LayerRenderMetrics) {
  const local = toLocalPoint(point, metrics);
  return Math.abs(local.x) <= metrics.width / 2 && Math.abs(local.y) <= metrics.height / 2;
}

function App() {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewInteractionRef = useRef<PreviewInteraction | null>(null);
  const nextLayerIndex = useRef(1);
  const designRestoredRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serializeRef = useRef<() => SerializedDesign>(null!);
  const [heroCollapsed, setHeroCollapsed] = useState(false);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [previewCursor, setPreviewCursor] = useState('default');
  const [markerStyle, setMarkerStyle] = useState<MarkerStyle>('baton');
  const [customMarkerImage, setCustomMarkerImage] = useState<HTMLImageElement | null>(null);
  const [customMarkerName, setCustomMarkerName] = useState('');
  const [customMarkerOrientation, setCustomMarkerOrientation] = useState<CustomMarkerOrientation>('fixed');
  const [customMarkerRotationDeg, setCustomMarkerRotationDeg] = useState(0);
  const [numeralStyle, setNumeralStyle] = useState<NumeralStyle>('arabic');
  const [numeralLayout, setNumeralLayout] = useState<NumeralLayout>('quarters');
  const [fontOptions, setFontOptions] = useState<FontOption[]>(builtInFonts);
  const [selectedFont, setSelectedFont] = useState<string>(builtInFonts[0].family);
  const [fontSize, setFontSize] = useState(48);
  const [fontWeight, setFontWeight] = useState(700);
  const [markerColor, setMarkerColor] = useState('#f7efe0');
  const [markerSecondaryColor, setMarkerSecondaryColor] = useState('#f7efe0');
  const [indicesOpacity, setIndicesOpacity] = useState(1);
  const [numeralColor, setNumeralColor] = useState('#f4d7b2');
  const [numeralsOpacity, setNumeralsOpacity] = useState(1);
  const [backgroundColor, setBackgroundColor] = useState('#153040');
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [innerEdgeEnabled, setInnerEdgeEnabled] = useState(false);
  const [innerEdgeColor, setInnerEdgeColor] = useState('#f7efe0');
  const [innerEdgeOpacity, setInnerEdgeOpacity] = useState(0.4);
  const [innerEdgeWeight, setInnerEdgeWeight] = useState(0.012);
  const [dialDiameterMm, setDialDiameterMm] = useState(38);
  const [exportDpi, setExportDpi] = useState(600);
  const [markerInnerRadius, setMarkerInnerRadius] = useState(0.80);
  const [markerOuterRadius, setMarkerOuterRadius] = useState(0.93);
  const [markerWeight, setMarkerWeight] = useState(1);
  const [numberRadius, setNumberRadius] = useState(0.70);
  const [numeralOffsetX, setNumeralOffsetX] = useState(0);
  const [numeralOffsetY, setNumeralOffsetY] = useState(0);
  const [hideQuarterIndices, setHideQuarterIndices] = useState(false);
  const [displayPresetId, setDisplayPresetId] = useState('custom');
  const [savedDisplayPresets, setSavedDisplayPresets] = useState<DisplayPreset[]>(() => readSavedDisplayPresets());
  const [presetDraftName, setPresetDraftName] = useState('');
  const [cutouts, setCutouts] = useState<Cutout[]>([]);
  const [gridVisible, setGridVisible] = useState(true);
  const [statusMessage, setStatusMessageState] = useState('Add layers, tune the index style, then export a high-resolution PNG.');
  const [toastKey, setToastKey] = useState(0);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [pendingRemoveKind, setPendingRemoveKind] = useState<'layer' | 'cutout' | 'preset' | 'design' | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [savedDesigns, setSavedDesigns] = useState<SavedDesignMeta[]>([]);
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);
  const [designNameDraft, setDesignNameDraft] = useState('My Design');
  const [toastVisible, setToastVisible] = useState(false);

  function setStatusMessage(text: string) {
    setStatusMessageState(text);
    setToastKey((k) => k + 1);
  }

  const dialPixelDiameter = Math.max(1, Math.round((dialDiameterMm / 25.4) * exportDpi));
  const allDisplayPresets = [CUSTOM_DISPLAY_PRESET, ...builtInDisplayPresets, ...savedDisplayPresets];
  const selectedDisplayPreset = allDisplayPresets.find((preset) => preset.id === displayPresetId) ?? CUSTOM_DISPLAY_PRESET;
  const isSavedDisplayPreset = savedDisplayPresets.some((preset) => preset.id === displayPresetId);

  // Keep serializeRef current so the debounced auto-save always captures the latest state
  serializeRef.current = serializeCurrentDesign;

  // Show toast on every setStatusMessage call, even if text is the same
  useEffect(() => {
    if (!toastKey) return;
    setToastVisible(true);
    const timer = setTimeout(() => setToastVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [toastKey]);

  useEffect(() => {
    if (selectedLayerId && !layers.some((layer) => layer.id === selectedLayerId)) {
      setSelectedLayerId(null);
    }
  }, [layers, selectedLayerId]);

  useEffect(() => {
    window.localStorage.setItem(DISPLAY_PRESETS_STORAGE_KEY, JSON.stringify(savedDisplayPresets));
  }, [savedDisplayPresets]);

  useEffect(() => {
    setPresetDraftName(selectedDisplayPreset.label);
  }, [selectedDisplayPreset.id, selectedDisplayPreset.label]);

  useEffect(() => {
    const canvas = previewCanvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const renderPreview = () => {
      canvas.width = PREVIEW_SIZE * dpr;
      canvas.height = PREVIEW_SIZE * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawDial(context, PREVIEW_SIZE, gridVisible);
      drawSelectedLayerOverlay(context, PREVIEW_SIZE);
    };

    if (numeralStyle === 'none') {
      renderPreview();
      return;
    }

    let cancelled = false;
    const fontSpec = `${fontWeight} ${Math.max(16, fontSize)}px ${quoteFontFamily(selectedFont)}`;

    void document.fonts
      .load(fontSpec)
      .then(() => {
        if (!cancelled) {
          renderPreview();
        }
      })
      .catch(() => {
        if (!cancelled) {
          renderPreview();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    backgroundColor,
    fontSize,
    fontWeight,
    gridVisible,
    indicesOpacity,
    innerEdgeColor,
    innerEdgeEnabled,
    innerEdgeWeight,
    innerEdgeOpacity,
    layers,
    markerColor,
    markerSecondaryColor,
    markerInnerRadius,
    markerOuterRadius,
    markerWeight,
    customMarkerImage,
    customMarkerOrientation,
    customMarkerRotationDeg,
    hideQuarterIndices,
    numeralColor,
    numeralOffsetX,
    numeralOffsetY,
    numeralsOpacity,
    numberRadius,
    cutouts,
    markerStyle,
    numeralLayout,
    numeralStyle,
    selectedLayerId,
    selectedFont,
    transparentBackground,
  ]);

  // Restore auto-save on mount and hydrate the saved-designs list
  useEffect(() => {
    async function restore() {
      try {
        const [saved, metas] = await Promise.all([loadDesign(AUTOSAVE_ID), listSavedDesigns()]);
        setSavedDesigns(metas.filter((m) => m.id !== AUTOSAVE_ID));
        if (saved) {
          await applySerializedDesign(saved);
        }
      } catch {
        // Ignore on first visit / corrupted data
      } finally {
        designRestoredRef.current = true;
      }
    }
    void restore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced auto-save — fires 1.5 s after the last design state change
  useEffect(() => {
    if (!designRestoredRef.current) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      try {
        const design = serializeRef.current();
        void saveDesign({ id: AUTOSAVE_ID, name: '__autosave__', savedAt: design.savedAt, design });
      } catch { /* ignore */ }
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [
    layers, markerStyle, customMarkerImage, customMarkerName, customMarkerOrientation,
    customMarkerRotationDeg, numeralStyle, numeralLayout, selectedFont, fontSize, fontWeight,
    markerColor, markerSecondaryColor, indicesOpacity, numeralColor, numeralsOpacity, backgroundColor,
    transparentBackground, innerEdgeEnabled, innerEdgeColor, innerEdgeOpacity, innerEdgeWeight,
    dialDiameterMm, exportDpi, markerInnerRadius, markerOuterRadius, markerWeight,
    numberRadius, numeralOffsetX, numeralOffsetY, hideQuarterIndices, displayPresetId,
    savedDisplayPresets, cutouts,
  ]);

  async function handleLayerUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (!files.length) {
      return;
    }

    try {
      const loadedLayers = await Promise.all(files.map(loadImage));
      const indices = loadedLayers.map(() => nextLayerIndex.current++);
      setLayers((current) => [
        ...loadedLayers.map((item, i) => makeLayer(item.name, item.image, indices[i])),
        ...current,
      ]);
      setStatusMessage(`${files.length} layer${files.length > 1 ? 's' : ''} loaded.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load one or more images.';
      setStatusMessage(message);
    } finally {
      event.target.value = '';
    }
  }

  async function handleFontUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const family = `UploadedFont${Date.now()}`;
    const objectUrl = URL.createObjectURL(file);

    try {
      const font = new FontFace(family, `url(${objectUrl})`);
      await font.load();
      document.fonts.add(font);
      setFontOptions((current) => [...current, { id: family, label: `${file.name} (uploaded)`, family }]);
      setSelectedFont(family);
      setStatusMessage(`Font ${file.name} loaded.`);
    } catch {
      setStatusMessage(`Unable to load font ${file.name}. Use TTF, OTF, WOFF, or WOFF2.`);
    } finally {
      URL.revokeObjectURL(objectUrl);
      event.target.value = '';
    }
  }

  async function handleCustomMarkerUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const loaded = await loadImage(file);
      setCustomMarkerImage(loaded.image);
      setCustomMarkerName(loaded.name);
      setMarkerStyle('custom');
      setStatusMessage(`${file.name} loaded for custom indices.`);
    } catch {
      setStatusMessage(`Unable to load ${file.name} as a custom index image.`);
    } finally {
      event.target.value = '';
    }
  }

  function clearCustomMarker() {
    setCustomMarkerImage(null);
    setCustomMarkerName('');
    if (markerStyle === 'custom') {
      setMarkerStyle('none');
    }
    setStatusMessage('Custom index image cleared.');
  }

  function updateLayer(id: string, updates: Partial<Layer>) {
    setLayers((current) => current.map((layer) => (layer.id === id ? { ...layer, ...updates } : layer)));
  }

  function moveLayer(id: string, direction: -1 | 1) {
    setLayers((current) => {
      const index = current.findIndex((layer) => layer.id === id);

      if (index < 0) {
        return current;
      }

      const nextIndex = index + direction;

      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  }

  function removeLayer(id: string) {
    setLayers((current) => current.filter((layer) => layer.id !== id));
  }

  function duplicateLayer(id: string) {
    const newId = createId('layer');
    const newIndex = nextLayerIndex.current++;

    setLayers((current) => {
      const index = current.findIndex((layer) => layer.id === id);

      if (index < 0) {
        return current;
      }

      const source = current[index];
      const duplicate: Layer = {
        ...source,
        id: newId,
        creationIndex: newIndex,
        name: `${source.name} Copy`,
      };
      const next = [...current];
      next.splice(index, 0, duplicate);
      return next;
    });

    setSelectedLayerId(newId);
    setStatusMessage('Layer duplicated.');
  }

  function drawSelectedLayerOverlay(context: CanvasRenderingContext2D, size: number) {
    if (!selectedLayerId) {
      return;
    }

    const layer = layers.find((item) => item.id === selectedLayerId && item.visible);

    if (!layer) {
      return;
    }

    const metrics = getLayerRenderMetrics(layer, size);
    const corners = [
      toWorldPoint({ x: -metrics.width / 2, y: -metrics.height / 2 }, metrics),
      toWorldPoint({ x: metrics.width / 2, y: -metrics.height / 2 }, metrics),
      toWorldPoint({ x: metrics.width / 2, y: metrics.height / 2 }, metrics),
      toWorldPoint({ x: -metrics.width / 2, y: metrics.height / 2 }, metrics),
    ];
    const scaleHandle = corners[1];
    const rotateHandle = toWorldPoint({ x: 0, y: -metrics.height / 2 - PREVIEW_ROTATE_HANDLE_OFFSET }, metrics);

    context.save();
    context.strokeStyle = 'rgba(244, 162, 97, 0.95)';
    context.fillStyle = 'rgba(244, 162, 97, 0.18)';
    context.lineWidth = 2;
    context.setLineDash([8, 6]);
    context.beginPath();
    context.moveTo(corners[0].x, corners[0].y);
    for (let index = 1; index < corners.length; index += 1) {
      context.lineTo(corners[index].x, corners[index].y);
    }
    context.closePath();
    context.stroke();

    context.setLineDash([]);
    context.beginPath();
    context.moveTo(toWorldPoint({ x: 0, y: -metrics.height / 2 }, metrics).x, toWorldPoint({ x: 0, y: -metrics.height / 2 }, metrics).y);
    context.lineTo(rotateHandle.x, rotateHandle.y);
    context.stroke();

    context.fillStyle = '#f4a261';
    context.beginPath();
    context.arc(scaleHandle.x, scaleHandle.y, PREVIEW_SCALE_HANDLE_RADIUS, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(rotateHandle.x, rotateHandle.y, PREVIEW_ROTATE_HANDLE_RADIUS, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function getPreviewPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * PREVIEW_SIZE,
      y: ((event.clientY - rect.top) / rect.height) * PREVIEW_SIZE,
    };
  }

  function getSelectedLayerHandles(layer: Layer) {
    const metrics = getLayerRenderMetrics(layer, PREVIEW_SIZE);
    return {
      metrics,
      scaleHandle: toWorldPoint({ x: metrics.width / 2, y: -metrics.height / 2 }, metrics),
      rotateHandle: toWorldPoint({ x: 0, y: -metrics.height / 2 - PREVIEW_ROTATE_HANDLE_OFFSET }, metrics),
    };
  }

  function updatePreviewCursor(point: { x: number; y: number }) {
    const selectedLayer = selectedLayerId ? layers.find((layer) => layer.id === selectedLayerId && layer.visible) : undefined;

    if (selectedLayer) {
      const { metrics, scaleHandle, rotateHandle } = getSelectedLayerHandles(selectedLayer);

      if (getDistance(point, scaleHandle) <= PREVIEW_SCALE_HIT_RADIUS) {
        setPreviewCursor('nwse-resize');
        return;
      }

      if (getDistance(point, rotateHandle) <= PREVIEW_ROTATE_HIT_RADIUS) {
        setPreviewCursor('crosshair');
        return;
      }

      if (isPointInLayer(point, metrics)) {
        setPreviewCursor('move');
        return;
      }
    }

    for (const layer of layers) {
      if (!layer.visible) {
        continue;
      }

      if (isPointInLayer(point, getLayerRenderMetrics(layer, PREVIEW_SIZE))) {
        setPreviewCursor('move');
        return;
      }
    }

    setPreviewCursor('default');
  }

  function handlePreviewPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const point = getPreviewPoint(event);
    const selectedLayer = selectedLayerId ? layers.find((layer) => layer.id === selectedLayerId && layer.visible) : undefined;

    if (selectedLayer) {
      const { metrics, scaleHandle, rotateHandle } = getSelectedLayerHandles(selectedLayer);

      if (getDistance(point, scaleHandle) <= PREVIEW_SCALE_HIT_RADIUS) {
        previewInteractionRef.current = {
          mode: 'scale',
          layerId: selectedLayer.id,
          startDistance: Math.max(1, getDistance(point, { x: metrics.centerX, y: metrics.centerY })),
          startScale: selectedLayer.scale,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setPreviewCursor('nwse-resize');
        return;
      }

      if (getDistance(point, rotateHandle) <= PREVIEW_ROTATE_HIT_RADIUS) {
        previewInteractionRef.current = {
          mode: 'rotate',
          layerId: selectedLayer.id,
          startAngle: Math.atan2(point.y - metrics.centerY, point.x - metrics.centerX),
          startRotation: selectedLayer.rotation,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setPreviewCursor('crosshair');
        return;
      }

      if (isPointInLayer(point, metrics)) {
        previewInteractionRef.current = {
          mode: 'move',
          layerId: selectedLayer.id,
          startPointer: point,
          startOffsetX: selectedLayer.offsetX,
          startOffsetY: selectedLayer.offsetY,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setPreviewCursor('move');
        return;
      }
    }

    for (const layer of layers) {
      if (!layer.visible) {
        continue;
      }

      if (!isPointInLayer(point, getLayerRenderMetrics(layer, PREVIEW_SIZE))) {
        continue;
      }

      setSelectedLayerId(layer.id);
      previewInteractionRef.current = {
        mode: 'move',
        layerId: layer.id,
        startPointer: point,
        startOffsetX: layer.offsetX,
        startOffsetY: layer.offsetY,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setPreviewCursor('move');
      setStatusMessage(`Editing ${layer.name} in preview. Drag to move, use the corner to scale, and the top handle to rotate.`);
      return;
    }

    setSelectedLayerId(null);
    setPreviewCursor('default');
  }

  function handlePreviewPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const point = getPreviewPoint(event);
    const interaction = previewInteractionRef.current;

    if (!interaction) {
      updatePreviewCursor(point);
      return;
    }

    const layer = layers.find((item) => item.id === interaction.layerId);

    if (!layer) {
      previewInteractionRef.current = null;
      setPreviewCursor('default');
      return;
    }

    const metrics = getLayerRenderMetrics(layer, PREVIEW_SIZE);

    if (interaction.mode === 'move') {
      const deltaX = ((point.x - interaction.startPointer.x) / PREVIEW_SIZE) * 100;
      const deltaY = ((point.y - interaction.startPointer.y) / PREVIEW_SIZE) * 100;
      updateLayer(layer.id, {
        offsetX: clamp(interaction.startOffsetX + deltaX, -40, 40),
        offsetY: clamp(interaction.startOffsetY + deltaY, -40, 40),
      });
      return;
    }

    if (interaction.mode === 'scale') {
      const currentDistance = Math.max(1, getDistance(point, { x: metrics.centerX, y: metrics.centerY }));
      updateLayer(layer.id, {
        scale: clamp(interaction.startScale * (currentDistance / interaction.startDistance), 0.1, 3),
      });
      return;
    }

    const currentAngle = Math.atan2(point.y - metrics.centerY, point.x - metrics.centerX);
    updateLayer(layer.id, {
      rotation: interaction.startRotation + ((currentAngle - interaction.startAngle) * 180) / Math.PI,
    });
  }

  function handlePreviewPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (previewInteractionRef.current) {
      previewInteractionRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    updatePreviewCursor(getPreviewPoint(event));
  }

  function applyDisplayPreset(presetId: string) {
    const preset = allDisplayPresets.find((item) => item.id === presetId);

    if (!preset) {
      return;
    }

    setDisplayPresetId(presetId);
    setCutouts(cloneCutouts(preset.cutouts));

    if (preset.dialDiameterMm) {
      setDialDiameterMm(preset.dialDiameterMm);
    }

    setStatusMessage(`${preset.label} preset applied.`);
  }

  function updateCutout(id: string, updates: Partial<Cutout>) {
    setCutouts((current) =>
      current.map((cutout) => (cutout.id === id ? ({ ...cutout, ...updates } as Cutout) : cutout)),
    );
  }

  function addCutout(kind: 'hands-post' | 'circle' | 'rounded-rect') {
    const nextCutout =
      kind === 'hands-post'
        ? createCircleCutout('Hands Post', 2.05)
        : kind === 'circle'
          ? createCircleCutout('Circle Cutout', 4)
          : createRoundedRectCutout('Rounded Window', 3, 2);

    setDisplayPresetId('custom');
    setCutouts((current) => [...current, nextCutout]);
    setStatusMessage(`${nextCutout.name} added to the custom display.`);
  }

  function removeCutout(id: string) {
    setDisplayPresetId('custom');
    setCutouts((current) => current.filter((cutout) => cutout.id !== id));
  }

  function saveDisplayPreset() {
    const label = presetDraftName.trim();

    if (!label) {
      setStatusMessage('Enter a preset name before saving.');
      return;
    }

    const preset: DisplayPreset = {
      id: createId('saved-preset'),
      label,
      note: 'Saved display preset.',
      dialDiameterMm,
      cutouts: cloneCutouts(cutouts),
    };

    setSavedDisplayPresets((current) => [...current, preset]);
    setDisplayPresetId(preset.id);
    setStatusMessage(`${label} saved to local presets.`);
  }

  function updateSavedDisplayPreset() {
    if (!isSavedDisplayPreset) {
      return;
    }

    const label = presetDraftName.trim();

    if (!label) {
      setStatusMessage('Enter a preset name before updating.');
      return;
    }

    setSavedDisplayPresets((current) =>
      current.map((preset) =>
        preset.id === displayPresetId
          ? {
              ...preset,
              label,
              dialDiameterMm,
              cutouts: cloneCutouts(cutouts),
            }
          : preset,
      ),
    );
    setStatusMessage(`${label} updated.`);
  }

  function deleteSavedDisplayPreset(targetId: string) {
    const presetToDelete = savedDisplayPresets.find((preset) => preset.id === targetId);
    setSavedDisplayPresets((current) => current.filter((preset) => preset.id !== targetId));
    if (displayPresetId === targetId) {
      setDisplayPresetId('custom');
      setCutouts([]);
    }
    setStatusMessage(`${presetToDelete?.label ?? 'Preset'} deleted.`);
  }

  function requestRemove(id: string, kind: 'layer' | 'cutout' | 'preset' | 'design') {
    setPendingRemoveId(id);
    setPendingRemoveKind(kind);
  }

  function confirmRemove() {
    if (!pendingRemoveId || !pendingRemoveKind) return;
    if (pendingRemoveKind === 'layer') removeLayer(pendingRemoveId);
    if (pendingRemoveKind === 'cutout') removeCutout(pendingRemoveId);
    if (pendingRemoveKind === 'preset') deleteSavedDisplayPreset(pendingRemoveId);
    if (pendingRemoveKind === 'design') void handleDeleteDesign(pendingRemoveId);
    setPendingRemoveId(null);
    setPendingRemoveKind(null);
  }

  function cancelRemove() {
    setPendingRemoveId(null);
    setPendingRemoveKind(null);
  }

  function handleLayerDragOver(event: DragEvent<HTMLDivElement>) {
    if (event.dataTransfer.types.includes('Files')) {
      event.preventDefault();
      setIsDragOver(true);
    }
  }

  function handleLayerDragLeave() {
    setIsDragOver(false);
  }

  async function handleLayerDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
    const files = Array.from(event.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    try {
      const loadedLayers = await Promise.all(files.map(loadImage));
      const indices = loadedLayers.map(() => nextLayerIndex.current++);
      setLayers((current) => [
        ...loadedLayers.map((item, i) => makeLayer(item.name, item.image, indices[i])),
        ...current,
      ]);
      setStatusMessage(`${files.length} layer${files.length > 1 ? 's' : ''} loaded.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load one or more images.';
      setStatusMessage(message);
    }
  }

  function drawDial(context: CanvasRenderingContext2D, size: number, showGuides: boolean) {
    const center = size / 2;
    const radius = size / 2;
    const fontScale = size / 760;
    const pixelsPerMm = (radius * 2) / dialDiameterMm;

    context.clearRect(0, 0, size, size);

    context.save();
    context.beginPath();
    context.arc(center, center, radius, 0, Math.PI * 2);
    context.clip();

    if (!transparentBackground) {
      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, size, size);
    }

    drawLayers(context, size, ['below-overlays']);

    if (innerEdgeEnabled) {
      drawInnerEdge(context, center, radius);
    }

    if (showGuides) {
      drawGuides(context, center, radius);
    }

    drawOverlay(context, center, radius, fontScale, 'indices');
    drawLayers(context, size, ['above-indices']);
    drawOverlay(context, center, radius, fontScale, 'numerals');
    drawLayers(context, size, ['above-numerals']);
    applyCutouts(context, center, pixelsPerMm);
    context.restore();

    if (showGuides) {
      drawCutoutGuides(context, center, pixelsPerMm);
    }
  }

  function drawLayers(context: CanvasRenderingContext2D, size: number, placements: LayerPlacement[]) {
    for (let index = layers.length - 1; index >= 0; index -= 1) {
      const layer = layers[index];

      if (!layer.visible || !placements.includes(layer.placement ?? 'below-overlays')) {
        continue;
      }

      context.save();
      context.globalAlpha = layer.opacity;
      context.globalCompositeOperation = layer.blendMode;
      context.translate(size / 2 + (layer.offsetX / 100) * size, size / 2 + (layer.offsetY / 100) * size);
      context.rotate(degToRad(layer.rotation));
      const baseScale = size / Math.max(layer.image.width, layer.image.height);
      const outputWidth = layer.image.width * baseScale * layer.scale;
      const outputHeight = layer.image.height * baseScale * layer.scale;
      context.drawImage(layer.image, -outputWidth / 2, -outputHeight / 2, outputWidth, outputHeight);
      context.restore();
    }
  }

  function drawInnerEdge(context: CanvasRenderingContext2D, center: number, radius: number) {
    renderer.drawInnerEdge(context, center, radius, { innerEdgeColor, innerEdgeOpacity, innerEdgeWeight });
  }

  function applyCutouts(context: CanvasRenderingContext2D, center: number, pixelsPerMm: number) {
    renderer.applyCutouts(context, cutouts, center, pixelsPerMm);
  }

  function drawCutoutGuides(context: CanvasRenderingContext2D, center: number, pixelsPerMm: number) {
    if (!cutouts.some((cutout) => cutout.enabled)) {
      return;
    }

    const { cutoutStroke, cutoutFill } = computeGuideColors();
    context.save();
    context.strokeStyle = cutoutStroke;
    context.fillStyle = cutoutFill;
    context.lineWidth = 1.5;
    context.setLineDash([6, 4]);

    for (const cutout of cutouts) {
      if (!cutout.enabled) {
        continue;
      }

      drawCutoutPath(context, cutout, center, pixelsPerMm);
      context.fill();
      context.stroke();
    }

    context.restore();
  }

  function drawCutoutPath(
    context: CanvasRenderingContext2D,
    cutout: Cutout,
    center: number,
    pixelsPerMm: number,
  ) {
    renderer.drawCutoutPath(context, cutout, center, pixelsPerMm);
  }

  function computeGuideColors() {
    if (transparentBackground) {
      return { line: 'rgba(244, 162, 97, 0.55)', dot: 'rgba(106, 208, 186, 0.80)', cutoutStroke: 'rgba(106, 208, 186, 0.92)', cutoutFill: 'rgba(106, 208, 186, 0.12)' };
    }
    const hex = backgroundColor.replace(/^#/, '');
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum > 0.35) {
        return { line: 'rgba(180, 70, 10, 0.65)', dot: 'rgba(20, 130, 110, 0.85)', cutoutStroke: 'rgba(20, 130, 110, 0.92)', cutoutFill: 'rgba(20, 130, 110, 0.15)' };
      }
    }
    return { line: 'rgba(244, 162, 97, 0.42)', dot: 'rgba(106, 208, 186, 0.72)', cutoutStroke: 'rgba(106, 208, 186, 0.92)', cutoutFill: 'rgba(106, 208, 186, 0.12)' };
  }

  function drawGuides(context: CanvasRenderingContext2D, center: number, radius: number) {
    const { line, dot } = computeGuideColors();
    context.save();
    context.strokeStyle = line;
    context.fillStyle = dot;
    context.lineWidth = Math.max(1, radius * 0.004);
    context.setLineDash([radius * 0.02, radius * 0.015]);

    const guideRings = [markerInnerRadius, markerOuterRadius, numberRadius, 1]
      .filter((ring, index, rings) => ring > 0 && ring <= 1 && rings.indexOf(ring) === index)
      .sort((left, right) => left - right);
    for (const ring of guideRings) {
      context.beginPath();
      context.arc(center, center, radius * ring, 0, Math.PI * 2);
      context.stroke();
    }

    context.beginPath();
    context.moveTo(center - radius, center);
    context.lineTo(center + radius, center);
    context.moveTo(center, center - radius);
    context.lineTo(center, center + radius);
    context.moveTo(center - radius * 0.707, center - radius * 0.707);
    context.lineTo(center + radius * 0.707, center + radius * 0.707);
    context.moveTo(center + radius * 0.707, center - radius * 0.707);
    context.lineTo(center - radius * 0.707, center + radius * 0.707);
    context.stroke();

    context.setLineDash([]);
    context.beginPath();
    context.arc(center, center, Math.max(2, radius * 0.014), 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawOverlay(
    context: CanvasRenderingContext2D,
    center: number,
    radius: number,
    fontScale: number,
    stage: 'indices' | 'numerals',
  ) {
    renderer.drawOverlay(context, center, radius, fontScale, stage, {
      markerStyle,
      markerColor,
      markerSecondaryColor,
      indicesOpacity,
      markerInnerRadius,
      markerOuterRadius,
      markerWeight,
      hideQuarterIndices,
      numeralStyle,
      numeralLayout,
      customMarkerImage,
      customMarkerOrientation,
      customMarkerRotationDeg,
      numeralsOpacity,
      numeralColor,
      fontWeight,
      fontSize,
      selectedFont,
      numberRadius,
      numeralOffsetX,
      numeralOffsetY,
    });
  }

  function drawQuarterNumerals(
    context: CanvasRenderingContext2D,
    center: number,
    radius: number,
    fontScale: number,
    labels: string[],
  ) {
    context.fillStyle = numeralColor;
    context.font = `${fontWeight} ${fontSize * fontScale}px ${quoteFontFamily(selectedFont)}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const offsetX = (numeralOffsetX / 100) * radius * 2;
    const offsetY = (numeralOffsetY / 100) * radius * 2;

    for (let index = 0; index < labels.length; index += 1) {
      const angle = degToRad(index * 90 - 90);
      const numeralRadius = radius * clamp(numberRadius, 0.45, 1);
      context.fillText(
        labels[index],
        center + Math.cos(angle) * numeralRadius + offsetX,
        center + Math.sin(angle) * numeralRadius + offsetY,
      );
    }
  }

  function exportPng() {
    if (dialPixelDiameter > 16_000) {
      setStatusMessage('Export canvas would exceed 16 000 px. Reduce the dial diameter or DPI.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = dialPixelDiameter;
    canvas.height = dialPixelDiameter;
    const context = canvas.getContext('2d');

    if (!context) {
      setStatusMessage('Unable to create an export canvas.');
      return;
    }

    drawDial(context, dialPixelDiameter, false);
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setStatusMessage('Unable to encode the PNG.');
        return;
      }

      const exportBlob = await addPngDpiMetadata(blob, exportDpi);

      const exportUrl = URL.createObjectURL(exportBlob);
      const link = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
      link.href = exportUrl;
      link.download = `watch-dial-${stamp}-${dialPixelDiameter}px.png`;
      link.click();
      URL.revokeObjectURL(exportUrl);
      setStatusMessage(`PNG exported at ${dialPixelDiameter}px dial diameter (${exportDpi} DPI).`);
    }, 'image/png');
  }

  // ─── Serialization ──────────────────────────────────────────────────────────

  function serializeCurrentDesign(): SerializedDesign {
    return {
      version: 1,
      savedAt: Date.now(),
      layers: layers.map(({ image, ...rest }) => ({ ...rest, imageSrc: imageToDataUrl(image) } satisfies SerializedLayer)),
      markerStyle,
      customMarkerImageSrc: customMarkerImage ? imageToDataUrl(customMarkerImage) : null,
      customMarkerName,
      customMarkerOrientation,
      customMarkerRotationDeg,
      numeralStyle,
      numeralLayout,
      selectedFont,
      fontSize,
      fontWeight,
      markerColor,
      markerSecondaryColor,
      indicesOpacity,
      numeralColor,
      numeralsOpacity,
      backgroundColor,
      transparentBackground,
      innerEdgeEnabled,
      innerEdgeColor,
      innerEdgeOpacity,
      innerEdgeWeight,
      dialDiameterMm,
      exportDpi,
      markerInnerRadius,
      markerOuterRadius,
      markerWeight,
      numberRadius,
      numeralOffsetX,
      numeralOffsetY,
      hideQuarterIndices,
      displayPresetId,
      savedDisplayPresets,
      cutouts,
    };
  }

  async function applySerializedDesign(saved: SerializedDesign) {
    const restoredLayers = await Promise.all(
      saved.layers.map(async ({ imageSrc, ...rest }) => ({
        ...rest,
        image: await dataUrlToImage(imageSrc),
      } as Layer)),
    );

    const maxIndex = restoredLayers.reduce((max, l) => Math.max(max, l.creationIndex), 0);
    nextLayerIndex.current = maxIndex + 1;
    setLayers(restoredLayers);
    setMarkerStyle(saved.markerStyle);
    setCustomMarkerName(saved.customMarkerName);
    setCustomMarkerOrientation(saved.customMarkerOrientation);
    setCustomMarkerRotationDeg(saved.customMarkerRotationDeg);
    setNumeralStyle(saved.numeralStyle);
    setNumeralLayout(saved.numeralLayout);
    setSelectedFont(saved.selectedFont);
    setFontSize(saved.fontSize);
    setFontWeight(saved.fontWeight);
    setMarkerColor(saved.markerColor);
    setMarkerSecondaryColor(saved.markerSecondaryColor ?? saved.markerColor);
    setIndicesOpacity(saved.indicesOpacity);
    setNumeralColor(saved.numeralColor);
    setNumeralsOpacity(saved.numeralsOpacity);
    setBackgroundColor(saved.backgroundColor);
    setTransparentBackground(saved.transparentBackground);
    setInnerEdgeEnabled(saved.innerEdgeEnabled);
    setInnerEdgeColor(saved.innerEdgeColor);
    setInnerEdgeOpacity(saved.innerEdgeOpacity);
    setInnerEdgeWeight(saved.innerEdgeWeight);
    setDialDiameterMm(saved.dialDiameterMm);
    setExportDpi(saved.exportDpi);
    setMarkerInnerRadius(saved.markerInnerRadius);
    setMarkerOuterRadius(saved.markerOuterRadius);
    setMarkerWeight(saved.markerWeight);
    setNumberRadius(saved.numberRadius);
    setNumeralOffsetX(saved.numeralOffsetX);
    setNumeralOffsetY(saved.numeralOffsetY);
    setHideQuarterIndices(saved.hideQuarterIndices);
    setDisplayPresetId(saved.displayPresetId);
    setSavedDisplayPresets(saved.savedDisplayPresets);
    setCutouts(saved.cutouts);
    if (saved.customMarkerImageSrc) {
      setCustomMarkerImage(await dataUrlToImage(saved.customMarkerImageSrc));
    } else {
      setCustomMarkerImage(null);
    }
  }

  // ─── Design library handlers ────────────────────────────────────────────────

  async function handleSaveDesign() {
    const name = designNameDraft.trim();
    if (!name) {
      setStatusMessage('Enter a design name before saving.');
      return;
    }
    const design = serializeCurrentDesign();
    const existing = savedDesigns.find((d) => d.name.toLowerCase() === name.toLowerCase());
    const id = existing?.id ?? createId('design');
    await saveDesign({ id, name, savedAt: design.savedAt, design });
    if (existing) {
      setSavedDesigns((current) =>
        current.map((d) => (d.id === id ? { id, name, savedAt: design.savedAt } : d)),
      );
      setStatusMessage(`Design "${name}" updated.`);
    } else {
      setSavedDesigns((current) => [...current, { id, name, savedAt: design.savedAt }]);
      setStatusMessage(`Design "${name}" saved.`);
    }
  }

  async function handleLoadDesign(id: string) {
    try {
      const design = await loadDesign(id);
      if (!design) {
        setStatusMessage('Could not load design.');
        return;
      }
      await applySerializedDesign(design);
      const meta = savedDesigns.find((d) => d.id === id);
      setStatusMessage(`Design "${meta?.name ?? 'design'}" loaded.`);
    } catch {
      setStatusMessage('Failed to load design.');
    }
  }

  async function handleDeleteDesign(id: string) {
    try {
      const meta = savedDesigns.find((d) => d.id === id);
      await deleteDesign(id);
      setSavedDesigns((current) => current.filter((d) => d.id !== id));
      setStatusMessage(`Design "${meta?.name ?? 'design'}" deleted.`);
    } catch {
      setStatusMessage('Failed to delete design.');
    }
  }

  function handleExportDesign() {
    const design = serializeCurrentDesign();
    const name = (designNameDraft.trim() || 'watch-dial').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const blob = new Blob([JSON.stringify(design, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatusMessage(`Design exported as "${link.download}".`);
  }

  async function handleImportDesign(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isSerializedDesign(parsed)) {
        setStatusMessage('Invalid design file — expected a Watch Dial Lab .json export.');
        return;
      }
      await applySerializedDesign(parsed);
      setDesignNameDraft(file.name.replace(/\.json$/i, ''));
      setStatusMessage(`Design imported from "${file.name}".`);
    } catch {
      setStatusMessage(`Failed to import "${file.name}". Make sure it's a valid design file.`);
    } finally {
      event.target.value = '';
    }
  }

  return (
    <div className="app-shell">
      {/* Accessible status region for screen readers + visible toast */}
      <p role="status" aria-live="polite" className={`status-message${toastVisible ? ' status-message--visible' : ''}`}>{statusMessage}</p>

      <main className="workspace-grid">
        <header className={`hero${heroCollapsed ? ' hero--collapsed' : ''}`}>
          <h1>Watch Dial Lab</h1>
          <p className="hero-copy">
            Free watch dial designer — build print-ready dial artwork for NH35, NH36, NH38, and custom movements. Design indices, numerals, date windows, and image layers, then export a high-resolution PNG at any DPI.
          </p>
        </header>
        <div className="visual-column">
          <section className="panel preview-panel preview-workspace">
            <div className="section-heading">
              <h2>Preview</h2>
              <div className="preview-header-actions">
                <button type="button" className="export-button" onClick={exportPng}>
                  Export PNG
                </button>
              </div>
            </div>

            <figure className="preview-figure">
              <div className="preview-frame">
                <canvas
                  ref={previewCanvasRef}
                  className="preview-canvas"
                  role="img"
                  aria-label="Interactive watch dial preview. Click a layer to select it, then drag to move, use the corner handle to scale, or the top handle to rotate."
                  style={{ cursor: previewCursor }}
                  onPointerDown={handlePreviewPointerDown}
                  onPointerMove={handlePreviewPointerMove}
                  onPointerUp={handlePreviewPointerUp}
                  onPointerCancel={handlePreviewPointerUp}
                />
              </div>
              <label className="checkbox-row grid-toggle" title="Toggle alignment guides on the preview canvas">
                <input type="checkbox" checked={gridVisible} onChange={(event) => setGridVisible(event.target.checked)} />
                Grid
              </label>
              <figcaption className="preview-caption">
                {selectedLayerId
                  ? `Editing layer — drag to move · corner handle to scale · top handle to rotate`
                  : `Click a layer in the canvas to select it`}
              </figcaption>
            </figure>

            <div className="export-group">
              <div className="control-grid compact">
                <label>
                  Dial Diameter (mm)
                  <input
                    type="number"
                    min="10"
                    max="80"
                    step="0.01"
                    defaultValue={dialDiameterMm}
                    key={dialDiameterMm}
                    onBlur={(event) => {
                      const clamped = clamp(Number(event.target.value), 10, 80);
                      event.target.value = String(clamped);
                      setDialDiameterMm(clamped);
                    }}
                  />
                </label>
                <label>
                  Export DPI
                  <input
                    type="number"
                    min="72"
                    step="10"
                    defaultValue={exportDpi}
                    key={exportDpi}
                    onBlur={(event) => {
                      const clamped = Math.max(72, Number(event.target.value) || 72);
                      event.target.value = String(clamped);
                      setExportDpi(clamped);
                    }}
                  />
                </label>
              </div>
              <div className="spec-list">
                <div>
                  <span>Output size</span>
                  <strong>{dialPixelDiameter} × {dialPixelDiameter} px</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="panel controls-panel layers-panel">
            <div className="section-heading">
              <h2>Layers</h2>
              <label className="upload-button">
                <input type="file" accept="image/*" multiple onChange={handleLayerUpload} />
                Add Images
              </label>
            </div>

            <div
              className={`layer-stack${isDragOver ? ' layer-stack--drag-over' : ''}`}
              onDragOver={handleLayerDragOver}
              onDragLeave={handleLayerDragLeave}
              onDrop={handleLayerDrop}
            >
              {layers.length === 0 ? (
                <div className="empty-state">
                  <p>Drop image files here, or use Add Images above.</p>
                </div>
              ) : (
                layers.map((layer, index) => (
                  <article className="layer-card" key={layer.id}>
                    <div className="layer-card__header">
                      <div>
                        <h3>{layer.name}</h3>
                        <p>Layer {layer.creationIndex} — renders {index === 0 ? 'on top' : index === layers.length - 1 ? 'at base' : 'in stack'}</p>
                      </div>
                      <div className="layer-actions">
                        <button
                          type="button"
                          className={selectedLayerId === layer.id ? 'is-active' : ''}
                          aria-pressed={selectedLayerId === layer.id}
                          onClick={() => setSelectedLayerId((current) => (current === layer.id ? null : layer.id))}
                        >
                          {selectedLayerId === layer.id ? 'Editing' : 'Edit'}
                        </button>
                        <button type="button" title="Move up in stack (renders higher)" onClick={() => moveLayer(layer.id, -1)}>
                          ↑ Up
                        </button>
                        <button type="button" title="Move down in stack (renders lower)" onClick={() => moveLayer(layer.id, 1)}>
                          ↓ Down
                        </button>
                        <button type="button" onClick={() => duplicateLayer(layer.id)}>
                          Duplicate
                        </button>
                        {pendingRemoveId === layer.id && pendingRemoveKind === 'layer' ? (
                          <>
                            <button type="button" className="danger confirm-danger" onClick={confirmRemove}>
                              Confirm Remove
                            </button>
                            <button type="button" className="secondary-button" onClick={cancelRemove}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button type="button" className="danger" onClick={() => requestRemove(layer.id, 'layer')}>
                            Remove
                          </button>
                        )}
                      </div>
                    </div>

                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={layer.visible}
                        onChange={(event) => updateLayer(layer.id, { visible: event.target.checked })}
                      />
                      Visible
                    </label>

                    <div className="control-grid compact">
                      <label>
                        <span className="label-with-value">Opacity <output htmlFor={`opacity-${layer.id}`}>{Math.round(layer.opacity * 100)}%</output></span>
                        <input
                          id={`opacity-${layer.id}`}
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={layer.opacity}
                          onChange={(event) => updateLayer(layer.id, { opacity: Number(event.target.value) })}
                        />
                      </label>
                      <label>
                        Placement
                        <select
                          value={layer.placement}
                          onChange={(event) => updateLayer(layer.id, { placement: event.target.value as LayerPlacement })}
                        >
                          {layerPlacementOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Blend Mode
                        <select
                          value={layer.blendMode}
                          onChange={(event) =>
                            updateLayer(layer.id, { blendMode: event.target.value as BlendMode })
                          }
                        >
                          {blendModes.map((mode) => (
                            <option key={mode} value={mode}>
                              {blendModeLabels[mode]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="label-with-value">Scale <output htmlFor={`scale-${layer.id}`}>{layer.scale.toFixed(2)}×</output></span>
                        <input
                          id={`scale-${layer.id}`}
                          type="range"
                          min="0.1"
                          max="3"
                          step="0.01"
                          value={layer.scale}
                          onChange={(event) => updateLayer(layer.id, { scale: Number(event.target.value) })}
                        />
                      </label>
                      <label>
                        <span className="label-with-value">Rotation <output htmlFor={`rotation-${layer.id}`}>{layer.rotation}°</output></span>
                        <input
                          id={`rotation-${layer.id}`}
                          type="range"
                          min="-180"
                          max="180"
                          step="1"
                          value={layer.rotation}
                          onChange={(event) => updateLayer(layer.id, { rotation: Number(event.target.value) })}
                        />
                      </label>
                      <label>
                        <span className="label-with-value">Offset X <output htmlFor={`offset-x-${layer.id}`}>{layer.offsetX.toFixed(1)}</output></span>
                        <input
                          id={`offset-x-${layer.id}`}
                          type="range"
                          min="-40"
                          max="40"
                          step="0.1"
                          value={layer.offsetX}
                          onChange={(event) => updateLayer(layer.id, { offsetX: Number(event.target.value) })}
                        />
                      </label>
                      <label>
                        <span className="label-with-value">Offset Y <output htmlFor={`offset-y-${layer.id}`}>{layer.offsetY.toFixed(1)}</output></span>
                        <input
                          id={`offset-y-${layer.id}`}
                          type="range"
                          min="-40"
                          max="40"
                          step="0.1"
                          value={layer.offsetY}
                          onChange={(event) => updateLayer(layer.id, { offsetY: Number(event.target.value) })}
                        />
                      </label>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="controls-column" onScroll={(e) => { if (e.currentTarget.scrollTop > 40) setHeroCollapsed(true); }}>
        <section className="panel controls-panel designs-panel">
          <div className="section-heading">
            <h2>Designs</h2>
          </div>

          <div className="preset-actions designs-save-row">
            <label className="designs-name-label">
              Design Name
              <input
                type="text"
                value={designNameDraft}
                onChange={(event) => setDesignNameDraft(event.target.value)}
                placeholder="My Design"
              />
            </label>
            <button type="button" className="secondary-button" onClick={() => void handleSaveDesign()}>
              Save
            </button>
            <div className="designs-file-buttons">
              <button type="button" className="secondary-button" onClick={handleExportDesign}>
                Export .json
              </button>
              <label className="upload-button secondary">
                <input type="file" accept=".json" onChange={(event) => void handleImportDesign(event)} />
                Import .json
              </label>
            </div>
          </div>

          {savedDesigns.length > 0 ? (
            <div className="designs-load-row">
              <label className="designs-select-label">
                Saved Designs
                <select
                  value={selectedDesignId ?? ''}
                  onChange={(event) => setSelectedDesignId(event.target.value || null)}
                >
                  <option value="">— select a design —</option>
                  {savedDesigns.map((meta) => (
                    <option key={meta.id} value={meta.id}>{meta.name}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="secondary-button"
                disabled={!selectedDesignId}
                onClick={() => selectedDesignId && void handleLoadDesign(selectedDesignId)}
              >
                Load
              </button>
              {pendingRemoveId === selectedDesignId && pendingRemoveKind === 'design' ? (
                <>
                  <button type="button" className="secondary-button danger-button confirm-danger" onClick={confirmRemove}>
                    Confirm Delete
                  </button>
                  <button type="button" className="secondary-button" onClick={cancelRemove}>
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="secondary-button danger-button"
                  disabled={!selectedDesignId}
                  onClick={() => selectedDesignId && requestRemove(selectedDesignId, 'design')}
                >
                  Delete
                </button>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <p>No saved designs yet. Save your current work above, or import a .json file.</p>
            </div>
          )}
        </section>
        <section className="panel controls-panel setup-panel">
            <div className="section-heading">
              <h2>Dial Setup</h2>
            </div>

            <div className="setup-scroll">
              <div className="control-grid">
                <label>
                  Display / Movement Preset
                  <select value={displayPresetId} onChange={(event) => applyDisplayPreset(event.target.value)}>
                    <option value={CUSTOM_DISPLAY_PRESET.id}>{CUSTOM_DISPLAY_PRESET.label}</option>
                    <optgroup label="Built-in">
                      {builtInDisplayPresets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label}
                        </option>
                      ))}
                    </optgroup>
                    {savedDisplayPresets.length ? (
                      <optgroup label="Saved">
                        {savedDisplayPresets.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.label}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                  </select>
                </label>

                {/* Always show preset note — custom preset has its own guidance text */}
                <div className="preset-note preset-note--inline">
                  {selectedDisplayPreset.note}
                </div>

                <div className="preset-actions">
                  <label>
                    Preset Name
                    <input
                      type="text"
                      value={presetDraftName}
                      onChange={(event) => setPresetDraftName(event.target.value)}
                      placeholder="My display preset"
                    />
                  </label>
                  {isSavedDisplayPreset ? (
                    <>
                      <button type="button" className="secondary-button" onClick={updateSavedDisplayPreset}>
                        Update
                      </button>
                      <button type="button" className="secondary-button" onClick={saveDisplayPreset}>
                        Save as New
                      </button>
                      {pendingRemoveId === displayPresetId && pendingRemoveKind === 'preset' ? (
                        <>
                          <button type="button" className="secondary-button danger-button confirm-danger" onClick={confirmRemove}>
                            Confirm Delete
                          </button>
                          <button type="button" className="secondary-button" onClick={cancelRemove}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="secondary-button danger-button"
                          onClick={() => requestRemove(displayPresetId, 'preset')}
                        >
                          Delete
                        </button>
                      )}
                    </>
                  ) : (
                    <button type="button" className="secondary-button" onClick={saveDisplayPreset}>
                      Save
                    </button>
                  )}
                </div>

                <section className="settings-group">
                  <div className="settings-group__heading">
                    <h3>Indices</h3>
                  </div>

                  <div className="control-grid compact control-grid--settings-group">
                    <div className="settings-subgroup settings-subgroup--marker-top">
                      <div className="toggle-field">
                        <span>Indices Style</span>
                        <div className="segmented-control" role="group" aria-label="Indices style">
                          {markerOptions.map((option) => (
                            <button
                              type="button"
                              key={option.value}
                              className={markerStyle === option.value ? 'is-active' : ''}
                              aria-pressed={markerStyle === option.value}
                              onClick={() => setMarkerStyle(option.value)}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      </div>

                      <div className="settings-subgroup settings-subgroup--marker-color">
                        {markerStyle === 'custom' ? null : (
                          <label>
                            Indices Color
                            <input type="color" value={markerColor} onChange={(event) => setMarkerColor(event.target.value)} />
                          </label>
                        )}
                        {markerStyle === 'bauhaus' ? (
                          <label>
                            Minute Dots Color
                            <input type="color" value={markerSecondaryColor} onChange={(event) => setMarkerSecondaryColor(event.target.value)} />
                          </label>
                        ) : null}
                      <label>
                        <span className="label-with-value">Indices Opacity <output htmlFor="indices-opacity">{Math.round(indicesOpacity * 100)}%</output></span>
                        <input
                          id="indices-opacity"
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={indicesOpacity}
                          onChange={(event) => setIndicesOpacity(Number(event.target.value))}
                        />
                      </label>
                    </div>

                    {markerStyle === 'custom' ? (
                      <div className="settings-subgroup settings-subgroup--marker-custom">
                        <label className="upload-button secondary">
                          <input type="file" accept="image/*" onChange={handleCustomMarkerUpload} />
                          {customMarkerImage ? 'Replace Index Image' : 'Upload Index Image'}
                        </label>

                        <div className="toggle-field">
                          <span>Custom Index Orientation</span>
                          <div className="segmented-control segmented-control--two" role="group" aria-label="Custom index orientation">
                            {customMarkerOrientationOptions.map((option) => (
                              <button
                                type="button"
                                key={option.value}
                                className={customMarkerOrientation === option.value ? 'is-active' : ''}
                                aria-pressed={customMarkerOrientation === option.value}
                                onClick={() => setCustomMarkerOrientation(option.value)}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <label>
                          <span className="label-with-value">Custom Index Rotation <output htmlFor="custom-index-rotation">{customMarkerRotationDeg}°</output></span>
                          <input
                            id="custom-index-rotation"
                            type="range"
                            min="-180"
                            max="180"
                            step="1"
                            value={customMarkerRotationDeg}
                            onChange={(event) => setCustomMarkerRotationDeg(Number(event.target.value))}
                          />
                        </label>

                        <button
                          type="button"
                          className="secondary-button"
                          onClick={clearCustomMarker}
                          disabled={!customMarkerImage}
                        >
                          Clear Index Image
                        </button>

                        {customMarkerImage ? (
                          <div className="custom-marker-note">Using {customMarkerName || 'uploaded index'} across the dial.</div>
                        ) : (
                          <div className="custom-marker-note">Upload a transparent PNG or SVG-backed image asset to repeat around the dial.</div>
                        )}
                      </div>
                    ) : null}

                    <div className="settings-subgroup settings-subgroup--marker-band">
                      <label>
                        <span className="label-with-value">Indices Inner Radius <output htmlFor="indices-inner-radius">{markerInnerRadius.toFixed(2)}</output></span>
                        <input
                          id="indices-inner-radius"
                          type="range"
                          min="0.2"
                          max="0.95"
                          step="0.01"
                          value={markerInnerRadius}
                          onChange={(event) => {
                            const v = Number(event.target.value);
                            setMarkerInnerRadius(v);
                            if (v > markerOuterRadius) setMarkerOuterRadius(v);
                          }}
                        />
                      </label>

                      <label>
                        <span className="label-with-value">Indices Outer Radius <output htmlFor="indices-outer-radius">{markerOuterRadius.toFixed(2)}</output></span>
                        <input
                          id="indices-outer-radius"
                          type="range"
                          min="0.25"
                          max="0.98"
                          step="0.01"
                          value={markerOuterRadius}
                          onChange={(event) => {
                            const v = Number(event.target.value);
                            setMarkerOuterRadius(v);
                            if (v < markerInnerRadius) setMarkerInnerRadius(v);
                          }}
                          disabled={markerStyle === 'dots' || markerStyle === 'bauhaus'}
                        />
                      </label>

                      <label>
                        <span className="label-with-value">Indices Weight <output htmlFor="indices-weight">{markerWeight.toFixed(2)}</output></span>
                        <input
                          id="indices-weight"
                          type="range"
                          min="0.5"
                          max="2"
                          step="0.01"
                          value={markerWeight}
                          onChange={(event) => setMarkerWeight(Number(event.target.value))}
                        />
                      </label>
                    </div>
                  </div>
                </section>

                <section className="settings-group">
                  <div className="settings-group__heading">
                    <h3>Numerals</h3>
                  </div>

                  <div className="control-grid compact control-grid--settings-group">
                    <div className="toggle-field">
                      <span>Numeral Style</span>
                      <div className="segmented-control segmented-control--three" role="group" aria-label="Numeral style">
                        {numeralStyleOptions.map((option) => (
                          <button
                            type="button"
                            key={option.value}
                            className={numeralStyle === option.value ? 'is-active' : ''}
                            aria-pressed={numeralStyle === option.value}
                            onClick={() => setNumeralStyle(option.value)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="toggle-field">
                      <span>Numeral Layout</span>
                      <div className="segmented-control segmented-control--two" role="group" aria-label="Numeral layout">
                        {numeralLayoutOptions.map((option) => (
                          <button
                            type="button"
                            key={option.value}
                            className={numeralLayout === option.value ? 'is-active' : ''}
                            aria-pressed={numeralLayout === option.value}
                            onClick={() => setNumeralLayout(option.value)}
                            disabled={numeralStyle === 'none'}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label>
                      Numeral Color
                      <input type="color" value={numeralColor} onChange={(event) => setNumeralColor(event.target.value)} />
                    </label>

                    <label>
                      <span className="label-with-value">Numerals Opacity <output htmlFor="numerals-opacity">{Math.round(numeralsOpacity * 100)}%</output></span>
                      <input
                        id="numerals-opacity"
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={numeralsOpacity}
                        onChange={(event) => setNumeralsOpacity(Number(event.target.value))}
                      />
                    </label>

                    <label>
                      Numerals Font
                      <select value={selectedFont} onChange={(event) => setSelectedFont(event.target.value)}>
                        {fontOptions.map((font) => (
                          <option key={font.id} value={font.family}>
                            {font.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="upload-button secondary">
                      <input type="file" accept=".ttf,.otf,.woff,.woff2,font/*" onChange={handleFontUpload} />
                      Upload Font
                    </label>

                    <label>
                      <span className="label-with-value">Font Size <output htmlFor="font-size">{fontSize}px ≈ {((fontSize / PREVIEW_SIZE) * dialDiameterMm).toFixed(1)} mm</output></span>
                      <input
                        id="font-size"
                        type="range"
                        min="16"
                        max="384"
                        step="1"
                        value={fontSize}
                        onChange={(event) => setFontSize(Number(event.target.value))}
                      />
                    </label>

                    <label>
                      <span className="label-with-value">Font Weight <output htmlFor="font-weight">{fontWeight}</output></span>
                      <input
                        id="font-weight"
                        type="range"
                        min="300"
                        max="900"
                        step="100"
                        value={fontWeight}
                        onChange={(event) => setFontWeight(Number(event.target.value))}
                      />
                    </label>

                    <label>
                      <span className="label-with-value">Numerals Radius <output htmlFor="numerals-radius">{numberRadius.toFixed(2)}</output></span>
                      <input
                        id="numerals-radius"
                        type="range"
                        min="0.45"
                        max="1"
                        step="0.01"
                        value={numberRadius}
                        onChange={(event) => setNumberRadius(Number(event.target.value))}
                      />
                    </label>

                    <label>
                      <span className="label-with-value">Numerals Offset X <output htmlFor="numerals-offset-x">{numeralOffsetX.toFixed(1)}</output></span>
                      <input
                        id="numerals-offset-x"
                        type="range"
                        min="-25"
                        max="25"
                        step="0.1"
                        value={numeralOffsetX}
                        onChange={(event) => setNumeralOffsetX(Number(event.target.value))}
                      />
                    </label>

                    <label>
                      <span className="label-with-value">Numerals Offset Y <output htmlFor="numerals-offset-y">{numeralOffsetY.toFixed(1)}</output></span>
                      <input
                        id="numerals-offset-y"
                        type="range"
                        min="-25"
                        max="25"
                        step="0.1"
                        value={numeralOffsetY}
                        onChange={(event) => setNumeralOffsetY(Number(event.target.value))}
                      />
                    </label>

                    {numeralLayout === 'quarters' && numeralStyle !== 'none' ? (
                      <label className="checkbox-row boxed">
                        <input
                          type="checkbox"
                          checked={hideQuarterIndices}
                          onChange={(event) => setHideQuarterIndices(event.target.checked)}
                        />
                        Remove quarter indices
                      </label>
                    ) : null}
                  </div>
                </section>

                <section className="settings-group">
                  <div className="settings-group__heading">
                    <h3>Background</h3>
                  </div>
                  <div className="background-row">
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(event) => setBackgroundColor(event.target.value)}
                      disabled={transparentBackground}
                      title="Background color"
                    />
                    <label className="checkbox-row boxed">
                      <input
                        type="checkbox"
                        checked={transparentBackground}
                        onChange={(event) => setTransparentBackground(event.target.checked)}
                      />
                      Transparent
                    </label>
                  </div>
                </section>

                <section className="settings-group">
                  <div className="settings-group__heading">
                    <h3>Edge</h3>
                  </div>

                  <div className="control-grid compact control-grid--settings-group">
                    <label className="checkbox-row boxed">
                      <input
                        type="checkbox"
                        checked={innerEdgeEnabled}
                        onChange={(event) => setInnerEdgeEnabled(event.target.checked)}
                      />
                      Show edge
                    </label>

                    <label>
                      Edge Color
                      <input
                        type="color"
                        value={innerEdgeColor}
                        onChange={(event) => setInnerEdgeColor(event.target.value)}
                        disabled={!innerEdgeEnabled}
                      />
                    </label>

                    <label>
                      <span className="label-with-value">Edge Opacity <output htmlFor="edge-opacity">{Math.round(innerEdgeOpacity * 100)}%</output></span>
                      <input
                        id="edge-opacity"
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={innerEdgeOpacity}
                        onChange={(event) => setInnerEdgeOpacity(Number(event.target.value))}
                        disabled={!innerEdgeEnabled}
                      />
                    </label>

                    <label>
                      <span className="label-with-value">Edge Weight <output htmlFor="edge-weight">{innerEdgeWeight.toFixed(3)}</output></span>
                      <input
                        id="edge-weight"
                        type="range"
                        min="0.002"
                        max="0.08"
                        step="0.002"
                        value={innerEdgeWeight}
                        onChange={(event) => setInnerEdgeWeight(Number(event.target.value))}
                        disabled={!innerEdgeEnabled}
                      />
                    </label>
                  </div>
                </section>
              </div>

              <div className="cutouts-panel">
                <div className="section-heading section-heading--tight">
                  <h2>Cutouts</h2>
                </div>

                <div className="cutout-toolbar">
                  <button type="button" className="secondary-button" onClick={() => addCutout('hands-post')}>
                    Add Hands Post
                  </button>
                  <button type="button" className="secondary-button" onClick={() => addCutout('circle')}>
                    Add Circle
                  </button>
                  <button type="button" className="secondary-button" onClick={() => addCutout('rounded-rect')}>
                    Add Rounded Window
                  </button>
                </div>

                {cutouts.length === 0 ? (
                  <div className="empty-state">
                    <p>Select a display preset to load hands post and complication cutouts.</p>
                  </div>
                ) : (
                  <div className="cutout-list">
                    {cutouts.map((cutout) => (
                      <article className="cutout-card" key={cutout.id}>
                        <div className="cutout-card__header">
                          <label className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={cutout.enabled}
                              onChange={(event) => updateCutout(cutout.id, { enabled: event.target.checked })}
                            />
                            Enabled
                          </label>
                          {pendingRemoveId === cutout.id && pendingRemoveKind === 'cutout' ? (
                            <div className="confirm-remove-row">
                              <button type="button" className="secondary-button danger-button confirm-danger" onClick={confirmRemove}>
                                Confirm Delete
                              </button>
                              <button type="button" className="secondary-button" onClick={cancelRemove}>
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button type="button" className="secondary-button danger-button" onClick={() => requestRemove(cutout.id, 'cutout')}>
                              Delete
                            </button>
                          )}
                        </div>

                        <div className="control-grid compact">
                          <label>
                            Name
                            <input
                              type="text"
                              value={cutout.name}
                              onChange={(event) => updateCutout(cutout.id, { name: event.target.value })}
                            />
                          </label>
                          <label>
                            X (mm)
                            <input
                              type="number"
                              step="0.01"
                              value={cutout.xMm}
                              onChange={(event) => updateCutout(cutout.id, { xMm: Number(event.target.value) })}
                            />
                          </label>
                          <label>
                            Y (mm)
                            <input
                              type="number"
                              step="0.01"
                              value={cutout.yMm}
                              onChange={(event) => updateCutout(cutout.id, { yMm: Number(event.target.value) })}
                            />
                          </label>
                          {cutout.kind === 'circle' ? (
                            <label>
                              Diameter (mm)
                              <input
                                type="number"
                                min="0.2"
                                step="0.01"
                                value={cutout.diameterMm}
                                onChange={(event) =>
                                  updateCutout(cutout.id, { diameterMm: Number(event.target.value) })
                                }
                              />
                            </label>
                          ) : (
                            <>
                              <label>
                                Width (mm)
                                <input
                                  type="number"
                                  min="0.2"
                                  step="0.01"
                                  value={cutout.widthMm}
                                  onChange={(event) => updateCutout(cutout.id, { widthMm: Number(event.target.value) })}
                                />
                              </label>
                              <label>
                                Height (mm)
                                <input
                                  type="number"
                                  min="0.2"
                                  step="0.01"
                                  value={cutout.heightMm}
                                  onChange={(event) => updateCutout(cutout.id, { heightMm: Number(event.target.value) })}
                                />
                              </label>
                              <label>
                                Corner Radius (mm)
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={cutout.radiusMm}
                                  onChange={(event) => updateCutout(cutout.id, { radiusMm: Number(event.target.value) })}
                                />
                              </label>
                              <label>
                                Rotation (deg)
                                <input
                                  type="number"
                                  step="0.1"
                                  value={cutout.rotationDeg}
                                  onChange={(event) =>
                                    updateCutout(cutout.id, { rotationDeg: Number(event.target.value) })
                                  }
                                />
                              </label>
                            </>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <a className="coffee-link" href="https://www.buymeacoffee.com/muskegg" target="_blank" rel="noreferrer">
              <img
                src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
                alt="Buy Me A Coffee"
                width="217"
                height="60"
              />
            </a>
        </section>
        </div>
      </main>
    </div>
  );
}

export default App;
