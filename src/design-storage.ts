// IndexedDB-backed design persistence.
// All storage is fully client-side — no server, no network calls.

const DB_NAME = 'watch-dial-designs';
const DB_VERSION = 1;
const STORE_NAME = 'designs';

// ─── Shared domain types (imported by App.tsx) ───────────────────────────────

export type MarkerStyle = 'none' | 'baton' | 'bauhaus' | 'diver' | 'dots' | 'dagger' | 'custom';

export type CustomMarkerOrientation = 'fixed' | 'toward-center';

export type NumeralStyle = 'none' | 'arabic' | 'roman';

export type NumeralLayout = 'quarters' | 'full';

export type BlendMode =
  | 'source-over'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'soft-light';

export type LayerPlacement = 'below-overlays' | 'above-indices' | 'above-numerals';

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

export type DisplayPreset = {
  id: string;
  label: string;
  note: string;
  cutouts: Cutout[];
  dialDiameterMm?: number;
};

// ─── Serialization types ─────────────────────────────────────────────────────

/** A Layer with the HTMLImageElement replaced by a base64 data URL. */
export type SerializedLayer = {
  id: string;
  name: string;
  creationIndex: number;
  imageSrc: string;
  visible: boolean;
  opacity: number;
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  blendMode: BlendMode;
  placement: LayerPlacement;
};

/** Full serialized snapshot of all saveable design state. */
export type SerializedDesign = {
  version: 1;
  savedAt: number;
  layers: SerializedLayer[];
  markerStyle: MarkerStyle;
  customMarkerImageSrc: string | null;
  customMarkerName: string;
  customMarkerOrientation: CustomMarkerOrientation;
  customMarkerRotationDeg: number;
  numeralStyle: NumeralStyle;
  numeralLayout: NumeralLayout;
  selectedFont: string;
  fontSize: number;
  fontWeight: number;
  markerColor: string;
  markerSecondaryColor: string;
  indicesOpacity: number;
  numeralColor: string;
  numeralsOpacity: number;
  backgroundColor: string;
  transparentBackground: boolean;
  innerEdgeEnabled: boolean;
  innerEdgeColor: string;
  innerEdgeOpacity: number;
  innerEdgeWeight: number;
  dialDiameterMm: number;
  exportDpi: number;
  markerInnerRadius: number;
  markerOuterRadius: number;
  markerWeight: number;
  numberRadius: number;
  numeralOffsetX: number;
  numeralOffsetY: number;
  hideQuarterIndices: boolean;
  displayPresetId: string;
  savedDisplayPresets: DisplayPreset[];
  cutouts: Cutout[];
};

export type SavedDesignMeta = {
  id: string;
  name: string;
  savedAt: number;
};

type DesignRecord = SavedDesignMeta & { design: SerializedDesign };

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDesign(record: DesignRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function loadDesign(id: string): Promise<SerializedDesign | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      const record = req.result as DesignRecord | undefined;
      resolve(record?.design ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function listSavedDesigns(): Promise<SavedDesignMeta[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const records = req.result as DesignRecord[];
      resolve(records.map(({ id, name, savedAt }) => ({ id, name, savedAt })));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDesign(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Lightweight validation guard for imported .json files. */
export function isSerializedDesign(value: unknown): value is SerializedDesign {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).version === 1 &&
    Array.isArray((value as Record<string, unknown>).layers)
  );
}
