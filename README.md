# Avatar Studio

Web-based VRM avatar editor — a VRoid Studio alternative that runs in your browser.

🔗 **[Live Demo → kjaylee.github.io/avatar-studio](https://kjaylee.github.io/avatar-studio/)**

## Features

- **VRM Character Loading** — Load and preview VRM models in real-time 3D
- **Character Presets** — Switch between pre-built anime characters instantly
- **Color Customization** — Change hair, skin, and outfit colors with live preview
- **VRM Export** — Export your customized character as a standard VRM file
- **Mobile Responsive** — Works on desktop and mobile browsers
- **No Installation** — Runs entirely in the browser via Three.js + WebGL

## Tech Stack

- [Three.js](https://threejs.org/) + [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) — 3D rendering
- [Vite](https://vitejs.dev/) — Build tool
- [Vitest](https://vitest.dev/) — Test framework (149+ tests)
- Impeccable design system — OKLCH colors, Plus Jakarta Sans, 4pt spacing

## Development

```bash
npm install
npm run dev        # Start dev server
npm run test       # Run all tests
npm run build      # Production build
```

## Architecture

```
src/library/
├── appController.js       # Orchestration layer
├── assetManager.js        # Asset path resolution + trait state
├── colorManager.js        # Color customization (OKLCH-ready)
├── presetManager.js       # Character preset registry
├── vrmMetadataBuilder.js  # VRM export metadata
├── manifestDataManager.js # Manifest loading (upstream)
└── CharacterManifestData.js # Trait parsing (upstream)

src/components/
├── ColorPicker.jsx        # Color selection UI
├── CharacterSelector.jsx  # Character grid UI
├── ExportPanel.jsx        # VRM export UI
└── AvatarStudio.css       # Impeccable-compliant styles
```

## Credits

Built on [M3-org/CharacterStudio](https://github.com/M3-org/CharacterStudio) (MIT License).
Uses [pixiv/three-vrm](https://github.com/pixiv/three-vrm) for VRM rendering.
Design system informed by [Impeccable](https://impeccable.style).

## License

MIT
