# Avatar Studio — Phase 1 Task

## Goal
CharacterStudio fork를 anime-style VRM 캐릭터 에디터로 변환.
우리 에셋(girl.vrm 기반)으로 교체하고, UI를 정리하여 즉시 사용 가능한 웹 에디터 완성.

## Source Materials
- Base body: `/Volumes/workspace/vrm-avatar/models/girl.vrm` (VRoid girl)
- Best complete character: `/Volumes/workspace/vrm-avatar/output/bikini_girl_v11.vrm`
- Hair variants: `bikini_Hair001_0.vrm`, `bikini_Hair001_3.vrm`, `blue_hair.vrm`
- Generated chars: `/Volumes/workspace/vrm-avatar/output/chars/char_00{0-4}.vrm`
- VRoid asset catalog: `/Volumes/workspace/vrm-avatar/assets/catalog.json`
- 52 Blendshapes ref: `/Volumes/workspace/vrm-avatar/blendshapes-ref/`
- CharacterStudio manifest format example: `public/loot-assets/anata/female/manifest.json`

## Tasks

### 1. Create Custom Asset Directory
```
public/vrm-assets/
├── animations/     (copy from loot-assets)
├── Body/female.vrm  (girl.vrm)
├── Hair/
│   ├── default.vrm
│   ├── long.vrm
│   └── short.vrm
├── Outfit/
│   ├── bikini.vrm
│   ├── casual.vrm
│   └── default.vrm
├── icons/
└── thumbnails/
```

### 2. Create manifest.json
- Follow anata/female/manifest.json format
- Traits: Body, Hair, Outfit (3 categories minimum)
- assetsLocation: relative path to vrm-assets
- Include camera targets and culling settings

### 3. Update App Configuration
- `src/library/constants.js` — change default manifest path
- Remove or hide NFT/blockchain UI elements
- Remove Solana wallet integration
- Update title/branding to "Avatar Studio"
- Keep: color picker, VRM export, animations, screenshot

### 4. UI Cleanup
- Remove: NFT minting, wallet connect, batch export for NFTs
- Keep: character creation, color customization, animation preview, VRM/GLB export
- Add: color pickers for hair, skin, outfit
- Ensure mobile responsive

### 5. Build & Verify
- `npm run dev` must work with new assets
- `npm run build` produces deployable output
- VRM export works with MToon materials
- Color changes reflect in real-time

## Verification Commands
```bash
npm run dev  # Should start without errors on port 5173
curl -s http://localhost:5173 | head -5  # Should return HTML
npm run build  # Should complete without errors
```

## Important Notes
- CharacterStudio recently removed React dependency — logic is in CharacterManager class
- three-vrm is already a dependency (pixiv's library)
- The manifest system supports VRM files with culling layers
- DO NOT modify loot-assets — create new vrm-assets directory
- girl.vrm is a full VRoid model with body, face, hair, clothing
- We need to SPLIT her into parts (body-only, hair-only, outfit-only) OR
  use her as base body and load additional parts on top
