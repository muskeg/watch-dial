# Watch Dial Lab

Static React app for composing watch dial artwork in the browser and exporting high-resolution PNG files.

## Features

- Upload multiple image layers and control visibility, opacity, scale, rotation, offsets, and blend mode.
- Choose between several generated watch index overlays.
- Switch between bundled numeral fonts or upload a font file client-side.
- Crop the composition to a circular dial area with configurable fill.
- Export a PNG using a physical dial diameter in millimeters and a target DPI.
- Deploy to GitHub Pages through GitHub Actions.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The Vite base path is derived automatically from `GITHUB_REPOSITORY` during GitHub Actions builds, so project pages work without manual path changes.
