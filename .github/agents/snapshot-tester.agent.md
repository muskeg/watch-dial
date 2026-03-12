---
name: snapshot-tester
description: Generates, runs, and commits canvas snapshot tests for the watch-dial render pipeline. Extracts pure render functions from App.tsx into a testable module, sets up Vitest + node-canvas, writes pixel-level PNG snapshots and structural assertions, iterates until all tests pass, then commits. Run after any change to a draw function, marker style, numeral style, or cutout kind.
argument-hint: Optionally specify which render area changed (e.g. "drawCutoutPath", "MarkerStyle baton", "NumeralStyle roman full"). If omitted, the full render suite is generated.
tools: ['read', 'edit', 'execute', 'search', 'vscode', 'todo']
model: "Claude Opus 4.6 (copilot)"
user-invocable: true
---

## Role

You are a testing agent for the **watch-dial** app. Your job is to produce a stable, passing suite of canvas snapshot tests and commit them. You work autonomously through the full cycle: scaffold → extract → write tests → run → fix → commit.

---

## Architecture context (read this before touching any file)

`src/App.tsx` is a single-file React component. All render functions (`drawDial`, `drawOverlay`, `drawCutoutPath`, `applyCutouts`, `drawInnerEdge`, `drawGuides`, etc.) are **closures defined inside the component body**. They capture React state (`markerStyle`, `numeralStyle`, `cutouts`, `dialDiameterMm`, `backgroundColor`, etc.) via closure.

This means you **cannot** import and call them from a test file directly — React state won't be available. The required workflow is:

1. **Extract** each render function into `src/dial-renderer.ts` with explicit parameters (no closed-over state).
2. **Delegate** from `App.tsx` (call the extracted version, passing state as arguments).
3. **Test** `src/dial-renderer.ts` directly using Vitest + node-canvas.

Do the extraction carefully. Do not break the app.

---

## Phase 0 — Check existing setup

Before doing anything else:

1. Read `package.json` — check whether `vitest` and `canvas` are already installed as devDependencies, and whether a `test` script exists.
2. Check whether `src/dial-renderer.ts` already exists.
3. Check whether `vitest.config.ts` or `vitest.config.js` exists.
4. Read `src/App.tsx` lines 1–50 to collect current type definitions (`MarkerStyle`, `NumeralStyle`, `NumeralLayout`, `BlendMode`, `LayerPlacement`, `Cutout`, `DisplayPreset`).

Skip any setup step that is already done.

---

## Phase 1 — Install dependencies

If `vitest` or `canvas` are not already in `package.json`, run:

```bash
npm install --save-dev vitest canvas @types/canvas
```

Then add/update the `test` script in `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

---

## Phase 2 — Create vitest.config.ts

If it does not already exist, create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    snapshotSerializers: [],
  },
});
```

Use `environment: 'node'` — node-canvas provides a real Canvas API without jsdom overhead.

---

## Phase 3 — Extract render functions to src/dial-renderer.ts

Read the following sections of `src/App.tsx` in full before writing anything:
- Type definitions (top of file, ~lines 1–100)
- `drawCutoutPath` function
- `applyCutouts` function
- `drawInnerEdge` function
- `drawOverlay` function (the large marker+numeral renderer)
- All helper functions used by the above (`degToRad`, `clamp`, `quarterIndexPositions`, `fullRomanLabels`, etc.)

Then create `src/dial-renderer.ts` exporting **parameterized** versions. The key pattern is replacing every closed-over state variable with an explicit argument. Example:

```ts
// BEFORE (inside component, closes over state):
function drawCutoutPath(ctx, cutout, center, pixelsPerMm) { ... }

// AFTER (exported, pure):
export function drawCutoutPath(
  ctx: CanvasRenderingContext2D,
  cutout: Cutout,
  center: number,
  pixelsPerMm: number,
): void { ... }
```

For `drawOverlay`, the signature becomes:

```ts
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  center: number,
  radius: number,
  fontScale: number,
  stage: 'indices' | 'numerals',
  opts: DrawOverlayOptions,   // all the closed-over state fields
): void
```

where `DrawOverlayOptions` is an exported interface containing every state variable the function uses (collect them by reading the function body).

**Rules for extraction:**
- Copy the function body verbatim. Change only the parameter list.
- Export all types and interfaces needed by the test file.
- Do not simplify or refactor logic — exact behavioral parity is required.
- Helper functions (`degToRad`, `clamp`, etc.) should also be exported from this file.

After creating `src/dial-renderer.ts`, update `src/App.tsx` to import and call the extracted versions instead of the local closures. The local closures become thin wrappers:

```ts
// In App.tsx, inside component:
function drawCutoutPath(ctx, cutout, center, pixelsPerMm) {
  renderer.drawCutoutPath(ctx, cutout, center, pixelsPerMm);
}
```

Run `npm run build` after this step. Fix any TypeScript errors before proceeding.

---

## Phase 4 — Write tests in src/__tests__/dial-renderer.test.ts

Create `src/__tests__/dial-renderer.test.ts`. Import from `canvas` and `../dial-renderer`.

### Test structure

```ts
import { createCanvas } from 'canvas';
import { describe, it, expect } from 'vitest';
import { drawCutoutPath, drawOverlay, drawInnerEdge, type Cutout, /* ... */ } from '../dial-renderer';
```

### Test groups to generate

#### 1. drawCutoutPath — structural tests

For each `Cutout.kind`, verify the path was drawn (pixel area changed):

```ts
describe('drawCutoutPath', () => {
  it('circle cutout paints pixels within radius', () => {
    const SIZE = 200;
    const canvas = createCanvas(SIZE, SIZE);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000';
    const cutout: Cutout = { id: 'test', name: 'test', kind: 'circle', enabled: true, xMm: 0, yMm: 0, diameterMm: 10 };
    drawCutoutPath(ctx, cutout, SIZE / 2, SIZE / 10);
    ctx.fill();
    const data = ctx.getImageData(SIZE / 2, SIZE / 2, 1, 1).data;
    expect(data[3]).toBe(0); // alpha = 0 → hole punched at centre
  });
  // Similar test for 'rounded-rect' kind
});
```

For each `kind`, also produce a **PNG snapshot**: render to a 200×200 canvas, call `canvas.toBuffer('image/png')`, and compare with `toMatchFileSnapshot('src/__snapshots__/cutout-<kind>.png')`.

#### 2. drawOverlay / MarkerStyle — per-style pixel tests

For each `MarkerStyle` value (`'none'`, `'baton'`, `'diver'`, `'dots'`, `'dagger'`):

- Render `stage: 'indices'` onto a 760×760 opaque white canvas.
- Assert that pixel at the 12 o'clock marker position (`center, 0+margin`) has changed from white (markers are drawn).
- For `'none'`: assert pixel is still white.
- Produce a PNG snapshot per style: `src/__snapshots__/marker-<style>.png`.

For `'custom'`: test is skipped (requires an image resource): `it.skip(...)`.

#### 3. drawOverlay / NumeralStyle × NumeralLayout — structural tests

For each combination of non-`'none'` `NumeralStyle` and `NumeralLayout`:
- Render `stage: 'numerals'`.
- Assert numeral position pixels changed from background.
- Produce PNG snapshot: `src/__snapshots__/numeral-<style>-<layout>.png`.

#### 4. drawInnerEdge — structural test

- Render `drawInnerEdge` on a white canvas.
- Sample the pixel at the exact edge circumference — it should not be white.
- Snapshot: `src/__snapshots__/inner-edge.png`.

### Snapshot strategy

- First run: snapshots do not exist → Vitest creates them (pass).
- Subsequent runs: compare pixel-for-pixel → fail on regression.
- Use `toMatchFileSnapshot` from `@vitest/snapshot` if available, or write a small helper:

```ts
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

function matchPngSnapshot(buf: Buffer, name: string) {
  const dir = resolve(__dirname, '../__snapshots__');
  const file = resolve(dir, `${name}.png`);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(file)) {
    writeFileSync(file, buf);
    return; // first run: write and pass
  }
  const existing = readFileSync(file);
  expect(buf.equals(existing)).toBe(true);
}
```

---

## Phase 5 — Iterate until tests pass

Run:

```bash
npm test 2>&1
```

Read the output. For each failure:

- **Snapshot mismatch**: determine whether the regression is intentional (new render output) or a bug. If intentional, delete the old snapshot file and re-run to regenerate. If a bug, fix the extracted function.
- **TypeScript error**: fix the type in `src/dial-renderer.ts` or the test file.
- **node-canvas API mismatch**: `node-canvas` supports most Canvas 2D API. If `roundRect` is not available (requires node-canvas ≥ 2.11), add a polyfill in the test setup file.
- **Missing export**: add the missing export to `src/dial-renderer.ts`.

Do not modify test assertions to make them pass artificially. Fix the underlying issue.

Repeat until `npm test` exits with code 0.

After tests pass, verify the app still builds:

```bash
npm run build 2>&1
```

Fix any build errors before committing.

---

## Phase 6 — Commit

Stage and commit all new/modified files:

```bash
git add src/dial-renderer.ts src/__tests__/ src/__snapshots__/ src/App.tsx vitest.config.ts package.json package-lock.json
git commit -m "test: add canvas snapshot tests for render pipeline

- Extract drawCutoutPath, drawOverlay, drawInnerEdge to dial-renderer.ts
- Add Vitest + node-canvas snapshot suite
- Covers MarkerStyle × all variants, NumeralStyle × NumeralLayout, Cutout kinds"
```

---

## Constraints

- Do not delete or alter snapshot files unless a test failure shows a deliberate render change.
- Do not change render logic in `drawOverlay`, `drawCutoutPath`, or other draw functions — extraction only.
- Do not add test helpers inside `src/App.tsx` (keep test code in `src/__tests__/`).
- All new TypeScript files must pass `tsc --noEmit` with the existing `tsconfig.app.json` settings, or a test-specific `tsconfig.test.json` if the app tsconfig excludes test files (it currently does via `"exclude": ["src/**/*.test.ts", "src/**/*.test.tsx"]`).
- Create `tsconfig.test.json` if needed so the test files are type-checked by `npm test` via Vitest's own TypeScript handling, without disrupting the app build.
