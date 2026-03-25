# Avatar Studio — Feature Definition

## F1: Custom Manifest Loading
- Load our manifest from `public/vrm-assets/manifest.json`
- Parse trait categories: Body, Hair, Outfit
- Each category has multiple VRM options with id, name, directory
- Validate manifest structure on load
- Fallback to empty state on invalid manifest

## F2: Asset Manager
- Manage VRM asset files (Body, Hair, Outfit)
- Resolve asset paths relative to manifest `assetsLocation`
- Track currently selected traits per category
- Support swapping traits (select new hair → remove old → load new)
- Handle missing/corrupt asset files gracefully

## F3: Color Customization
- Change hair color (apply to hair material)
- Change skin tone (apply to body material)
- Change outfit color (apply to outfit material)
- Color changes stored as state, applied on material load
- Support hex color input and preset palette

## F4: VRM Export
- Export assembled character as valid VRM file
- Include MToon materials with color customizations
- Include VRM metadata (title, author, version)
- File size validation (warn if >25MB)

## F5: UI Cleanup (non-testable via unit tests)
- Remove NFT/blockchain UI elements
- Remove wallet connection
- Add color pickers for each trait category
- Mobile responsive layout
- Rebrand to "Avatar Studio"

## F6: Character Presets
- Load pre-built complete characters from manifest
- Switch between presets (full character swap)
- Each preset is a complete VRM with all traits
