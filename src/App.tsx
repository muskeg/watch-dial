import { ChangeEvent, CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './App.css';

type MarkerStyle = 'none' | 'baton' | 'diver' | 'dots';

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
];

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

const displayPresets: DisplayPreset[] = [
  {
    id: 'custom',
    label: 'Custom',
    note: 'No preset cutouts applied.',
    cutouts: [],
  },
  {
    id: 'nh35-3h',
    label: 'NH35 Date 3H',
    note: 'NH35 date dial at 3H with 28.50 mm dial size, 2.05 mm pinion hole, and 2.90 x 2.00 mm date window.',
    cutouts: [
      { id: 'pinion', name: 'Hands Pinion', kind: 'circle', enabled: true, xMm: 0, yMm: 0, diameterMm: 2.05 },
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
    note: 'NH35 date dial at 6H with 28.50 mm dial size, 2.05 mm pinion hole, and 2.00 x 2.90 mm date window.',
    cutouts: [
      { id: 'pinion', name: 'Hands Pinion', kind: 'circle', enabled: true, xMm: 0, yMm: 0, diameterMm: 2.05 },
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
    note: 'NH36 day-date dial at 3H with 28.50 mm dial size, 2.05 mm pinion hole, and 7.00 x 2.00 mm aperture centered 8.45 mm from dial center.',
    cutouts: [
      { id: 'pinion', name: 'Hands Pinion', kind: 'circle', enabled: true, xMm: 0, yMm: 0, diameterMm: 2.05 },
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
    note: 'NH36 day-date dial at 6H with 28.50 mm dial size, 2.05 mm pinion hole, and 2.00 x 7.00 mm aperture centered 8.45 mm from dial center.',
    cutouts: [
      { id: 'pinion', name: 'Hands Pinion', kind: 'circle', enabled: true, xMm: 0, yMm: 0, diameterMm: 2.05 },
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
    note: 'NH38 open-heart dial with 28.50 mm dial size, 2.05 mm pinion hole, and 10.00 mm aperture centered 6.827 mm left of dial center and 0.0558 mm above the horizontal centerline.',
    cutouts: [
      { id: 'pinion', name: 'Hands Pinion', kind: 'circle', enabled: true, xMm: 0, yMm: 0, diameterMm: 2.05 },
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

function App() {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const [headerOffsetPx, setHeaderOffsetPx] = useState(0);
  const [isHeroCompact, setIsHeroCompact] = useState(false);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [markerStyle, setMarkerStyle] = useState<MarkerStyle>('baton');
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
  const [markerRadius, setMarkerRadius] = useState(0.845);
  const [markerWeight, setMarkerWeight] = useState(1);
  const [numberRadius, setNumberRadius] = useState(0.73);
  const [displayPresetId, setDisplayPresetId] = useState('custom');
  const [cutouts, setCutouts] = useState<Cutout[]>([]);
  const [gridVisible, setGridVisible] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Add layers, tune the index style, then export a high-resolution PNG.');

  const dialPixelDiameter = Math.max(1, Math.round((dialDiameterMm / 25.4) * exportDpi));
  const squarePixelSize = dialPixelDiameter;

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
    const canvas = previewCanvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    const previewSize = 760;
    const dpr = window.devicePixelRatio || 1;
    const renderPreview = () => {
      canvas.width = previewSize * dpr;
      canvas.height = previewSize * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawDial(context, previewSize, gridVisible);
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
    markerRadius,
    markerWeight,
    numeralColor,
    numberRadius,
    cutouts,
    markerStyle,
    numeralLayout,
    numeralStyle,
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

  function applyDisplayPreset(presetId: string) {
    const preset = displayPresets.find((item) => item.id === presetId);

    if (!preset) {
      return;
    }

    setDisplayPresetId(presetId);
    setCutouts(cloneCutouts(preset.cutouts));

    if (presetId.startsWith('nh')) {
      setDialDiameterMm(28.5);
    }

    setStatusMessage(`${preset.label} preset applied.`);
  }

  function updateCutout(id: string, updates: Partial<Cutout>) {
    setCutouts((current) =>
      current.map((cutout) => (cutout.id === id ? ({ ...cutout, ...updates } as Cutout) : cutout)),
    );
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

    context.save();
  const borderWidth = Math.max(1.5, size * 0.0035);
    context.strokeStyle = 'rgba(247, 239, 224, 0.45)';
  context.lineWidth = borderWidth;
    context.beginPath();
  context.arc(center, center, Math.max(0, radius - borderWidth / 2), 0, Math.PI * 2);
    context.stroke();
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

    const guideRings = [0.5, markerRadius, numberRadius, 1];
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

    if (markerStyle === 'baton') {
      for (let marker = 0; marker < 12; marker += 1) {
        const angle = degToRad(marker * 30 - 90);
        const halfLength = 0.085;
        const inner = radius * Math.max(0.1, markerRadius - halfLength);
        const outer = radius * Math.min(0.98, markerRadius + halfLength);
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

        const angle = degToRad(marker * 6 - 90);
        const isHour = marker % 5 === 0;
    const halfLength = isHour ? 0.075 : 0.04;
    const inner = radius * Math.max(0.1, markerRadius - halfLength);
    const outer = radius * Math.min(0.98, markerRadius + halfLength);
    context.lineWidth = radius * (isHour ? 0.034 : 0.012) * markerWeight;
        context.beginPath();
        context.moveTo(center + Math.cos(angle) * inner, center + Math.sin(angle) * inner);
        context.lineTo(center + Math.cos(angle) * outer, center + Math.sin(angle) * outer);
        context.stroke();
      }

      const triangleRadius = radius * Math.min(0.98, markerRadius + 0.065);
      const triangleBaseRadius = radius * Math.min(0.98, markerRadius + 0.035);
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
        const angle = degToRad(marker * 30 - 90);
        const dotRadius = radius * (marker === 0 ? 0.05 : 0.036) * markerWeight;
        const orbit = radius * markerRadius;
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
            Stack image layers, mix marker styles with numeral layouts, upload your own numeral font, and
            export a production-sized PNG sized for your dial.
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
              <canvas ref={previewCanvasRef} className="preview-canvas" />
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
                    {displayPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>

                {displayPresetId !== 'custom' ? (
                  <div className="preset-note preset-note--inline">
                    {displayPresets.find((preset) => preset.id === displayPresetId)?.note}
                  </div>
                ) : null}

                <div className="toggle-field">
                  <span>Marker Style</span>
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

                <div className="toggle-field">
                  <span>Numerals</span>
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

                <div className="color-row">
                  <label>
                    Marker Color
                    <input type="color" value={markerColor} onChange={(event) => setMarkerColor(event.target.value)} />
                  </label>

                  <label>
                    Numeral Color
                    <input type="color" value={numeralColor} onChange={(event) => setNumeralColor(event.target.value)} />
                  </label>

                  <label>
                    Background Color
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(event) => setBackgroundColor(event.target.value)}
                      disabled={transparentBackground}
                    />
                  </label>
                </div>

                <label>
                  Numbers Font
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

                <label className="checkbox-row boxed">
                  <input
                    type="checkbox"
                    checked={transparentBackground}
                    onChange={(event) => setTransparentBackground(event.target.checked)}
                  />
                  Transparent Background
                </label>
              </div>

              <div className="control-grid compact">
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
                  Marker Radius
                  <input
                    type="range"
                    min="0.45"
                    max="0.92"
                    step="0.01"
                    value={markerRadius}
                    onChange={(event) => setMarkerRadius(Number(event.target.value))}
                  />
                </label>
                <label>
                  Marker Weight
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.01"
                    value={markerWeight}
                    onChange={(event) => setMarkerWeight(Number(event.target.value))}
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

                {cutouts.length === 0 ? (
                  <div className="empty-state">
                    <p>Select a display preset to load pinion and complication cutouts.</p>
                  </div>
                ) : (
                  <div className="cutout-list">
                    {cutouts.map((cutout) => (
                      <article className="cutout-card" key={cutout.id}>
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={cutout.enabled}
                            onChange={(event) => updateCutout(cutout.id, { enabled: event.target.checked })}
                          />
                          {cutout.name}
                        </label>

                        <div className="control-grid compact">
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
