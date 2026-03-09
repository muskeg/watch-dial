import { ChangeEvent, CSSProperties, PointerEvent as ReactPointerEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './App.css';

type MarkerStyle = 'none' | 'baton' | 'diver' | 'dots' | 'dagger' | 'custom';

type CustomMarkerOrientation = 'fixed' | 'toward-center';

type NumeralStyle = 'none' | 'arabic' | 'roman';

type NumeralLayout = 'quarters' | 'full';

type Cutout =
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

type DisplayPreset = {
  id: string;
  label: string;
  note: string;
  cutouts: Cutout[];
  dialDiameterMm?: number;
};

type BlendMode =
  | 'source-over'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'soft-light';

type Layer = {
  id: string;
  name: string;
  image: HTMLImageElement;
  visible: boolean;
  opacity: number;
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  blendMode: BlendMode;
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

const markerOptions: { label: string; value: MarkerStyle }[] = [
  { label: 'None', value: 'none' },
  { label: 'Baton', value: 'baton' },
  { label: 'Diver', value: 'diver' },
  { label: 'Dots', value: 'dots' },
  { label: 'Spear', value: 'dagger' },
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
  const heroRef = useRef<HTMLElement | null>(null);
  const previewInteractionRef = useRef<PreviewInteraction | null>(null);
  const [headerOffsetPx, setHeaderOffsetPx] = useState(0);
  const [isHeroCompact, setIsHeroCompact] = useState(false);
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
  const [numeralColor, setNumeralColor] = useState('#f4d7b2');
  const [backgroundColor, setBackgroundColor] = useState('#153040');
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [dialDiameterMm, setDialDiameterMm] = useState(38);
  const [exportDpi, setExportDpi] = useState(600);
  const [markerInnerRadius, setMarkerInnerRadius] = useState(0.76);
  const [markerOuterRadius, setMarkerOuterRadius] = useState(0.93);
  const [markerWeight, setMarkerWeight] = useState(1);
  const [numberRadius, setNumberRadius] = useState(0.73);
  const [hideQuarterIndices, setHideQuarterIndices] = useState(false);
  const [displayPresetId, setDisplayPresetId] = useState('custom');
  const [savedDisplayPresets, setSavedDisplayPresets] = useState<DisplayPreset[]>(() => readSavedDisplayPresets());
  const [presetDraftName, setPresetDraftName] = useState('');
  const [cutouts, setCutouts] = useState<Cutout[]>([]);
  const [gridVisible, setGridVisible] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Add layers, tune the index style, then export a high-resolution PNG.');

  const dialPixelDiameter = Math.max(1, Math.round((dialDiameterMm / 25.4) * exportDpi));
  const squarePixelSize = dialPixelDiameter;
  const allDisplayPresets = [CUSTOM_DISPLAY_PRESET, ...builtInDisplayPresets, ...savedDisplayPresets];
  const selectedDisplayPreset = allDisplayPresets.find((preset) => preset.id === displayPresetId) ?? CUSTOM_DISPLAY_PRESET;
  const isSavedDisplayPreset = savedDisplayPresets.some((preset) => preset.id === displayPresetId);

  useEffect(() => {
    if (selectedLayerId && !layers.some((layer) => layer.id === selectedLayerId)) {
      setSelectedLayerId(null);
    }
  }, [layers, selectedLayerId]);

  useLayoutEffect(() => {
    const hero = heroRef.current;

    if (!hero) {
      return;
    }

    const updateHeaderOffset = () => {
      const styles = window.getComputedStyle(hero);
      const marginBottom = Number.parseFloat(styles.marginBottom) || 0;
      setHeaderOffsetPx(Math.ceil(hero.getBoundingClientRect().height + marginBottom));
    };

    updateHeaderOffset();

    const resizeObserver = new ResizeObserver(() => {
      updateHeaderOffset();
    });

    resizeObserver.observe(hero);
    window.addEventListener('resize', updateHeaderOffset);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeaderOffset);
    };
  }, []);

  useEffect(() => {
    const collapseThreshold = 140;
    const expandThreshold = 24;

    const updateHeroState = () => {
      setIsHeroCompact((current) => {
        if (current) {
          return window.scrollY > expandThreshold;
        }

        return window.scrollY > collapseThreshold;
      });
    };

    updateHeroState();
    window.addEventListener('scroll', updateHeroState, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateHeroState);
    };
  }, []);

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
    layers,
    markerColor,
    markerInnerRadius,
    markerOuterRadius,
    markerWeight,
    customMarkerImage,
    customMarkerOrientation,
    customMarkerRotationDeg,
    hideQuarterIndices,
    numeralColor,
    numberRadius,
    cutouts,
    markerStyle,
    numeralLayout,
    numeralStyle,
    selectedLayerId,
    selectedFont,
    transparentBackground,
  ]);

  async function handleLayerUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (!files.length) {
      return;
    }

    try {
      const loadedLayers = await Promise.all(files.map(loadImage));
      setLayers((current) => [
        ...loadedLayers.map((item, index) => ({
          id: `${Date.now()}-${index}`,
          name: item.name,
          image: item.image,
          visible: true,
          opacity: 1,
          scale: 1,
          rotation: 0,
          offsetX: 0,
          offsetY: 0,
          blendMode: 'source-over' as BlendMode,
        })),
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

      if (getDistance(point, scaleHandle) <= PREVIEW_SCALE_HANDLE_RADIUS + 4) {
        setPreviewCursor('nwse-resize');
        return;
      }

      if (getDistance(point, rotateHandle) <= PREVIEW_ROTATE_HANDLE_RADIUS + 4) {
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

      if (getDistance(point, scaleHandle) <= PREVIEW_SCALE_HANDLE_RADIUS + 4) {
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

      if (getDistance(point, rotateHandle) <= PREVIEW_ROTATE_HANDLE_RADIUS + 4) {
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
    setPreviewCursor('default');
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

  function deleteSavedDisplayPreset() {
    if (!isSavedDisplayPreset) {
      return;
    }

    const presetToDelete = savedDisplayPresets.find((preset) => preset.id === displayPresetId);
    setSavedDisplayPresets((current) => current.filter((preset) => preset.id !== displayPresetId));
    setDisplayPresetId('custom');
    setCutouts([]);
    setStatusMessage(`${presetToDelete?.label ?? 'Preset'} deleted.`);
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

    for (let index = layers.length - 1; index >= 0; index -= 1) {
      const layer = layers[index];

      if (!layer.visible) {
        continue;
      }

      context.save();
      context.globalAlpha = layer.opacity;
      context.globalCompositeOperation = layer.blendMode;
      context.translate(center + (layer.offsetX / 100) * size, center + (layer.offsetY / 100) * size);
      context.rotate(degToRad(layer.rotation));
      const baseScale = size / Math.max(layer.image.width, layer.image.height);
      const outputWidth = layer.image.width * baseScale * layer.scale;
      const outputHeight = layer.image.height * baseScale * layer.scale;
      context.drawImage(layer.image, -outputWidth / 2, -outputHeight / 2, outputWidth, outputHeight);
      context.restore();
    }

    if (showGuides) {
      drawGuides(context, center, radius);
    }

    drawOverlay(context, center, radius, fontScale);
    applyCutouts(context, center, pixelsPerMm);
    context.restore();

    if (showGuides) {
      drawCutoutGuides(context, center, pixelsPerMm);
    }
  }

  function applyCutouts(context: CanvasRenderingContext2D, center: number, pixelsPerMm: number) {
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

  function drawCutoutGuides(context: CanvasRenderingContext2D, center: number, pixelsPerMm: number) {
    if (!cutouts.some((cutout) => cutout.enabled)) {
      return;
    }

    context.save();
    context.strokeStyle = 'rgba(106, 208, 186, 0.92)';
    context.fillStyle = 'rgba(106, 208, 186, 0.12)';
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
    context.moveTo(-width / 2 + radius, -height / 2);
    context.lineTo(width / 2 - radius, -height / 2);
    context.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + radius);
    context.lineTo(width / 2, height / 2 - radius);
    context.quadraticCurveTo(width / 2, height / 2, width / 2 - radius, height / 2);
    context.lineTo(-width / 2 + radius, height / 2);
    context.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - radius);
    context.lineTo(-width / 2, -height / 2 + radius);
    context.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + radius, -height / 2);
    context.closePath();
    context.restore();
  }

  function drawGuides(context: CanvasRenderingContext2D, center: number, radius: number) {
    context.save();
    context.strokeStyle = 'rgba(244, 162, 97, 0.42)';
    context.fillStyle = 'rgba(106, 208, 186, 0.72)';
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
  ) {
    context.save();
    context.strokeStyle = markerColor;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    const bandInner = Math.min(markerInnerRadius, markerOuterRadius);
    const bandOuter = Math.max(markerInnerRadius, markerOuterRadius);
    const bandMiddle = (bandInner + bandOuter) / 2;
    const bandSpan = Math.max(0.01, bandOuter - bandInner);
    const suppressQuarterIndices = hideQuarterIndices && numeralStyle !== 'none' && numeralLayout === 'quarters';

    if (markerStyle === 'baton') {
      for (let marker = 0; marker < 12; marker += 1) {
        if (suppressQuarterIndices && quarterIndexPositions.has(marker)) {
          continue;
        }

        const angle = degToRad(marker * 30 - 90);
        const inner = radius * bandInner;
        const outer = radius * Math.min(0.98, bandOuter);
        context.lineWidth = radius * 0.042 * markerWeight;
        context.beginPath();
        context.moveTo(center + Math.cos(angle) * inner, center + Math.sin(angle) * inner);
        context.lineTo(center + Math.cos(angle) * outer, center + Math.sin(angle) * outer);
        context.stroke();
      }
    }

    if (markerStyle === 'diver') {
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
        context.lineWidth = radius * (isHour ? 0.034 : 0.012) * markerWeight;
        context.beginPath();
        context.moveTo(center + Math.cos(angle) * inner, center + Math.sin(angle) * inner);
        context.lineTo(center + Math.cos(angle) * outer, center + Math.sin(angle) * outer);
        context.stroke();
      }

      const triangleRadius = radius * Math.min(0.98, bandOuter + 0.01);
      const triangleBaseRadius = radius * Math.min(0.98, bandOuter - Math.min(0.02, bandSpan * 0.18));
      const triangleOffsetY = radius * 0.018;
      const triangleHalfWidth = radius * 0.06 * markerWeight;
      context.fillStyle = markerColor;
      context.beginPath();
      context.moveTo(center - triangleHalfWidth, center - triangleBaseRadius - triangleOffsetY);
      context.lineTo(center + triangleHalfWidth, center - triangleBaseRadius - triangleOffsetY);
      context.lineTo(center, center - triangleRadius + radius * 0.11 - triangleOffsetY);
      context.closePath();
      context.fill();
    }

    if (markerStyle === 'dots') {
      context.fillStyle = markerColor;

      for (let marker = 0; marker < 12; marker += 1) {
        if (suppressQuarterIndices && quarterIndexPositions.has(marker)) {
          continue;
        }

        const angle = degToRad(marker * 30 - 90);
        const dotRadius = radius * (marker === 0 ? 0.05 : 0.036) * markerWeight;
        const orbit = radius * bandInner;
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

    if (markerStyle === 'dagger') {
      context.fillStyle = markerColor;

      for (let marker = 0; marker < 12; marker += 1) {
        if (suppressQuarterIndices && quarterIndexPositions.has(marker)) {
          continue;
        }

        const angle = degToRad(marker * 30 - 90);
        const tipX = radius * bandInner;
        const tailX = radius * Math.min(0.98, bandOuter - bandSpan * 0.04);
        const upperShoulderX = radius * (bandInner + bandSpan * 0.78);
        const lowerShoulderX = radius * (bandInner + bandSpan * 0.44);
        const tailHalfWidth = radius * 0.017 * markerWeight;
        const shoulderHalfWidth = radius * 0.015 * markerWeight;
        const lowerHalfWidth = radius * 0.0075 * markerWeight;
        const capBulge = radius * 0.024 * markerWeight;

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

    if (markerStyle === 'custom' && customMarkerImage) {
      const imageAspect = customMarkerImage.width / Math.max(1, customMarkerImage.height);
      const imageHeight = Math.max(radius * 0.05, radius * bandSpan * 1.15) * markerWeight;
      const imageWidth = imageHeight * imageAspect;
      const orbit = radius * bandMiddle;

      for (let marker = 0; marker < 12; marker += 1) {
        if (suppressQuarterIndices && quarterIndexPositions.has(marker)) {
          continue;
        }

        const angle = degToRad(marker * 30 - 90);
        const rotation =
          customMarkerOrientation === 'toward-center'
            ? angle + Math.PI * 1.5 + degToRad(customMarkerRotationDeg)
            : degToRad(customMarkerRotationDeg);

        context.save();
        context.translate(center + Math.cos(angle) * orbit, center + Math.sin(angle) * orbit);
        context.rotate(rotation);
        context.drawImage(customMarkerImage, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
        context.restore();
      }
    }

    if (numeralStyle === 'arabic' && numeralLayout === 'quarters') {
      drawQuarterNumerals(context, center, radius, fontScale, ['12', '3', '6', '9']);
    }

    if (numeralStyle === 'roman' && numeralLayout === 'quarters') {
      drawQuarterNumerals(context, center, radius, fontScale, ['XII', 'III', 'VI', 'IX']);
    }

    if (numeralStyle === 'arabic' && numeralLayout === 'full') {
      context.fillStyle = numeralColor;
      context.font = `${fontWeight} ${fontSize * fontScale}px ${quoteFontFamily(selectedFont)}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      for (let marker = 0; marker < 12; marker += 1) {
        const angle = degToRad(marker * 30 - 90);
        const label = marker === 0 ? '12' : `${marker}`;
        const numeralRadius = radius * numberRadius;
        context.fillText(
          label,
          center + Math.cos(angle) * numeralRadius,
          center + Math.sin(angle) * numeralRadius,
        );
      }

      context.restore();
      return;
    }

    if (numeralStyle === 'roman' && numeralLayout === 'full') {
      context.fillStyle = numeralColor;
      context.font = `${fontWeight} ${fontSize * fontScale}px ${quoteFontFamily(selectedFont)}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      for (let marker = 0; marker < 12; marker += 1) {
        const angle = degToRad(marker * 30 - 90);
        const numeralRadius = radius * numberRadius;
        context.fillText(
          fullRomanLabels[marker],
          center + Math.cos(angle) * numeralRadius,
          center + Math.sin(angle) * numeralRadius,
        );
      }
    }

    context.restore();
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

    for (let index = 0; index < labels.length; index += 1) {
      const angle = degToRad(index * 90 - 90);
      const numeralRadius = radius * numberRadius;
      context.fillText(
        labels[index],
        center + Math.cos(angle) * numeralRadius,
        center + Math.sin(angle) * numeralRadius,
      );
    }
  }

  function exportPng() {
    const safeDpi = clamp(exportDpi, 72, 2400);
    const diameterPixels = Math.max(1, Math.round((dialDiameterMm / 25.4) * safeDpi));
    const squarePixels = diameterPixels;

    if (squarePixels > 9000) {
      setStatusMessage('Export is too large for a browser canvas. Reduce the dial diameter or DPI.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = squarePixels;
    canvas.height = squarePixels;
    const context = canvas.getContext('2d');

    if (!context) {
      setStatusMessage('Unable to create an export canvas.');
      return;
    }

    drawDial(context, squarePixels, false);
    canvas.toBlob((blob) => {
      if (!blob) {
        setStatusMessage('Unable to encode the PNG.');
        return;
      }

      const exportUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
      link.href = exportUrl;
      link.download = `watch-dial-${stamp}-${diameterPixels}px.png`;
      link.click();
      URL.revokeObjectURL(exportUrl);
      setStatusMessage(`PNG exported at ${diameterPixels}px dial diameter (${safeDpi} DPI target).`);
    }, 'image/png');
  }

  return (
    <div className="app-shell" style={{ '--header-offset': `${headerOffsetPx}px` } as CSSProperties}>
      <header className={`hero${isHeroCompact ? ' hero--compact' : ''}`} ref={heroRef}>
        <div className="hero-content">
          <h1>Watch Dial Lab</h1>
          <p className="hero-copy">
            From first sketch to print-ready artwork, shape the balance, typography, and cutouts of your dial.
          </p>
        </div>
      </header>

      <main className="workspace-grid">
        <div className="visual-column">
          <section className="panel preview-panel preview-workspace">
            <div className="section-heading">
              <h2>Preview</h2>
              <button type="button" className="export-button" onClick={exportPng}>
                Download PNG
              </button>
            </div>

            <div className="preview-frame">
              <canvas
                ref={previewCanvasRef}
                className="preview-canvas"
                style={{ cursor: previewCursor }}
                onPointerDown={handlePreviewPointerDown}
                onPointerMove={handlePreviewPointerMove}
                onPointerUp={handlePreviewPointerUp}
                onPointerCancel={handlePreviewPointerUp}
              />
            </div>

            <div className="status-bar">
              <p>{statusMessage}</p>
              <small>
                PNG export matches the selected physical diameter and DPI in pixel count. Some viewers may
                ignore DPI metadata, but the output resolution is correct.
              </small>
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

            <div className="layer-stack">
              {layers.length === 0 ? (
                <div className="empty-state">
                  <p>Drop in dial textures, lume masks, logo art, or base renders.</p>
                </div>
              ) : (
                layers.map((layer, index) => (
                  <article className="layer-card" key={layer.id}>
                    <div className="layer-card__header">
                      <div>
                        <h3>{layer.name}</h3>
                        <p>Layer {layers.length - index}</p>
                      </div>
                      <div className="layer-actions">
                        <button
                          type="button"
                          className={selectedLayerId === layer.id ? 'is-active' : ''}
                          onClick={() => setSelectedLayerId((current) => (current === layer.id ? null : layer.id))}
                        >
                          {selectedLayerId === layer.id ? 'Editing' : 'Edit'}
                        </button>
                        <button type="button" onClick={() => moveLayer(layer.id, -1)}>
                          Up
                        </button>
                        <button type="button" onClick={() => moveLayer(layer.id, 1)}>
                          Down
                        </button>
                        <button type="button" className="danger" onClick={() => removeLayer(layer.id)}>
                          Remove
                        </button>
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
                        Opacity
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={layer.opacity}
                          onChange={(event) => updateLayer(layer.id, { opacity: Number(event.target.value) })}
                        />
                      </label>
                      <label>
                        Blend
                        <select
                          value={layer.blendMode}
                          onChange={(event) =>
                            updateLayer(layer.id, { blendMode: event.target.value as BlendMode })
                          }
                        >
                          {blendModes.map((mode) => (
                            <option key={mode} value={mode}>
                              {mode}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Scale
                        <input
                          type="range"
                          min="0.1"
                          max="3"
                          step="0.01"
                          value={layer.scale}
                          onChange={(event) => updateLayer(layer.id, { scale: Number(event.target.value) })}
                        />
                      </label>
                      <label>
                        Rotation
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          step="1"
                          value={layer.rotation}
                          onChange={(event) => updateLayer(layer.id, { rotation: Number(event.target.value) })}
                        />
                      </label>
                      <label>
                        Offset X
                        <input
                          type="range"
                          min="-40"
                          max="40"
                          step="0.1"
                          value={layer.offsetX}
                          onChange={(event) => updateLayer(layer.id, { offsetX: Number(event.target.value) })}
                        />
                      </label>
                      <label>
                        Offset Y
                        <input
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

        <section className="panel controls-panel setup-panel">
            <div className="section-heading">
              <h2>Dial Setup</h2>
            </div>

            <div className="setup-scroll">
              <div className="control-grid">
                <label>
                  Display Preset
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

                {displayPresetId !== 'custom' ? (
                  <div className="preset-note preset-note--inline">
                    {selectedDisplayPreset.note}
                  </div>
                ) : null}

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
                  <button type="button" className="secondary-button" onClick={saveDisplayPreset}>
                    Save
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={updateSavedDisplayPreset}
                    disabled={!isSavedDisplayPreset}
                  >
                    Update
                  </button>
                  <button
                    type="button"
                    className="secondary-button danger-button"
                    onClick={deleteSavedDisplayPreset}
                    disabled={!isSavedDisplayPreset}
                  >
                    Delete
                  </button>
                </div>

                <section className="settings-group">
                  <div className="settings-group__heading">
                    <h3>Indices</h3>
                  </div>

                  <div className="control-grid compact control-grid--settings-group">
                    <div className="settings-subgroup settings-subgroup--marker-top">
                      <div className="toggle-field">
                        <span>Indices Style</span>
                        <div className="segmented-control">
                          {markerOptions.map((option) => (
                            <button
                              type="button"
                              key={option.value}
                              className={markerStyle === option.value ? 'is-active' : ''}
                              onClick={() => setMarkerStyle(option.value)}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      </div>

                      <div className="settings-subgroup settings-subgroup--marker-color">
                      <label>
                          Indices Color
                        <input
                          type="color"
                          value={markerColor}
                          onChange={(event) => setMarkerColor(event.target.value)}
                          disabled={markerStyle === 'custom'}
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
                          <div className="segmented-control segmented-control--two">
                            {customMarkerOrientationOptions.map((option) => (
                              <button
                                type="button"
                                key={option.value}
                                className={customMarkerOrientation === option.value ? 'is-active' : ''}
                                onClick={() => setCustomMarkerOrientation(option.value)}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <label>
                          Custom Index Rotation
                          <input
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
                        Indices Inner Radius
                        <input
                          type="range"
                          min="0.2"
                          max="0.95"
                          step="0.01"
                          value={markerInnerRadius}
                          onChange={(event) => setMarkerInnerRadius(Number(event.target.value))}
                        />
                      </label>

                      <label>
                        Indices Outer Radius
                        <input
                          type="range"
                          min="0.25"
                          max="0.98"
                          step="0.01"
                          value={markerOuterRadius}
                          onChange={(event) => setMarkerOuterRadius(Number(event.target.value))}
                          disabled={markerStyle === 'dots'}
                        />
                      </label>

                      <label>
                        Indices Weight
                        <input
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
                      <div className="segmented-control segmented-control--three">
                        {numeralStyleOptions.map((option) => (
                          <button
                            type="button"
                            key={option.value}
                            className={numeralStyle === option.value ? 'is-active' : ''}
                            onClick={() => setNumeralStyle(option.value)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="toggle-field">
                      <span>Numeral Layout</span>
                      <div className="segmented-control segmented-control--two">
                        {numeralLayoutOptions.map((option) => (
                          <button
                            type="button"
                            key={option.value}
                            className={numeralLayout === option.value ? 'is-active' : ''}
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
                      Font Size
                      <input
                        type="range"
                        min="16"
                        max="96"
                        step="1"
                        value={fontSize}
                        onChange={(event) => setFontSize(Number(event.target.value))}
                      />
                    </label>

                    <label>
                      Font Weight
                      <input
                        type="range"
                        min="300"
                        max="900"
                        step="100"
                        value={fontWeight}
                        onChange={(event) => setFontWeight(Number(event.target.value))}
                      />
                    </label>

                    <label>
                      Numerals Radius
                      <input
                        type="range"
                        min="0.45"
                        max="0.86"
                        step="0.01"
                        value={numberRadius}
                        onChange={(event) => setNumberRadius(Number(event.target.value))}
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

                <label>
                  Background Color
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(event) => setBackgroundColor(event.target.value)}
                    disabled={transparentBackground}
                  />
                </label>

                <label className="checkbox-row boxed">
                  <input
                    type="checkbox"
                    checked={transparentBackground}
                    onChange={(event) => setTransparentBackground(event.target.checked)}
                  />
                  Transparent Background
                </label>

                <label>
                  Dial Diameter (mm)
                  <input
                    type="number"
                    min="10"
                    max="80"
                    step="0.01"
                    value={dialDiameterMm}
                    onChange={(event) => setDialDiameterMm(Number(event.target.value))}
                  />
                </label>
                <label>
                  Export DPI
                  <input
                    type="number"
                    min="72"
                    max="2400"
                    step="10"
                    value={exportDpi}
                    onChange={(event) => setExportDpi(Number(event.target.value))}
                  />
                </label>
              </div>

              <label className="checkbox-row boxed">
                <input type="checkbox" checked={gridVisible} onChange={(event) => setGridVisible(event.target.checked)} />
                Show Alignment Grid
              </label>

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
                          <button type="button" className="secondary-button danger-button" onClick={() => removeCutout(cutout.id)}>
                            Delete
                          </button>
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

              <div className="spec-list">
                <div>
                  <span>Dial pixel diameter</span>
                  <strong>{dialPixelDiameter}px</strong>
                </div>
                <div>
                  <span>Export square size</span>
                  <strong>{squarePixelSize}px</strong>
                </div>
                <div>
                  <span>Selected font</span>
                  <strong>{selectedFont}</strong>
                </div>
              </div>
            </div>
        </section>
      </main>
    </div>
  );
}

export default App;
