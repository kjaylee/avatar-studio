import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Comprehensive TDD tests for all Studio features.
 * Tests file structure, function signatures, and integration points.
 */

const ROOT = path.resolve(__dirname, '../../')
const SRC = path.join(ROOT, 'src')

// Helper to read file content
const readFile = (relPath) => fs.readFileSync(path.join(SRC, relPath), 'utf-8')

// ── Studio.jsx ──────────────────────────────────────────────────────

describe('Studio.jsx — Main Page', () => {
  const content = readFile('pages/Studio.jsx')

  it('should import SliderPanel', () => {
    expect(content).toContain('SliderPanel')
  })

  it('should pass onBack to SliderPanel', () => {
    expect(content).toContain('onBack')
  })

  it('should pass onExportVRM to SliderPanel', () => {
    expect(content).toContain('onExportVRM')
  })

  it('should have handleExportVRM callback', () => {
    expect(content).toContain('handleExportVRM')
  })

  it('should use parseAsync for GLTFExporter (not old callback API)', () => {
    expect(content).toContain('parseAsync')
  })

  it('should export as .vrm (not .glb)', () => {
    expect(content).toContain('.vrm')
  })

  it('should have injectVRMExtension function', () => {
    expect(content).toContain('injectVRMExtension')
  })

  it('should handle MToon material conversion for export', () => {
    // Export should convert MToon → MeshStandardMaterial for GLTFExporter
    expect(content).toContain('MeshStandardMaterial')
  })

  it('should restore original materials after export', () => {
    // Must restore MToon materials after export so the 3D view is unchanged
    expect(content).toContain('replacementMap')
  })

  it('should have handleBack callback', () => {
    expect(content).toContain('handleBack')
  })

  it('should have handleLoadVRM handler for loading external VRM files', () => {
    expect(content).toContain('handleLoadVRM')
    expect(content).toContain('Loading VRM')
    expect(content).toContain('onLoadVRM')
  })

  it('should pass onLoadVRM to SliderPanel', () => {
    expect(content).toContain('onLoadVRM={handleLoadVRM}')
  })

  it('should have VRM loader with VRMLoaderPlugin', () => {
    expect(content).toContain('VRMLoaderPlugin')
  })

  it('should initialize MorphDataManager', () => {
    expect(content).toContain('MorphDataManager')
  })

  it('should initialize HairManager', () => {
    expect(content).toContain('HairManager')
  })

  it('should initialize TextureSwapManager', () => {
    expect(content).toContain('TextureSwapManager')
  })
})

// ── VRM Export (injectVRMExtension) ─────────────────────────────────

describe('VRM Export — injectVRMExtension', () => {
  const content = readFile('pages/Studio.jsx')

  it('should read GLB JSON chunk', () => {
    expect(content).toContain('DataView')
    expect(content).toContain('TextDecoder')
  })

  it('should add VRMC_vrm to extensionsUsed', () => {
    expect(content).toContain('VRMC_vrm')
  })

  it('should include VRM meta data', () => {
    expect(content).toContain('specVersion')
    expect(content).toContain('meta')
    expect(content).toContain('authors')
  })

  it('should pad JSON to 4-byte alignment', () => {
    expect(content).toContain('& ~3')
  })

  it('should handle errors gracefully (fallback to plain GLB)', () => {
    expect(content).toContain('catch')
    expect(content).toContain('plain GLB')
  })
})

// ── SliderPanel — Tab Structure ─────────────────────────────────────

describe('SliderPanel — Tab Container', () => {
  const content = readFile('components/SliderPanel.jsx')

  it('should import AvatarState', () => {
    expect(content).toContain('AvatarState')
  })

  it('should import all 4 tab components', () => {
    expect(content).toContain("from \"./tabs/HairTab\"")
    expect(content).toContain("from \"./tabs/FaceTab\"")
    expect(content).toContain("from \"./tabs/BodyTab\"")
    expect(content).toContain("from \"./tabs/ClothingTab\"")
  })

  it('should have activeTab state', () => {
    expect(content).toContain('activeTab')
    expect(content).toContain('setActiveTab')
  })

  it('should define 4 tabs (hair, face, body, clothing)', () => {
    expect(content).toContain('"hair"')
    expect(content).toContain('"face"')
    expect(content).toContain('"body"')
    expect(content).toContain('"clothing"')
  })

  it('should have handleResetAll', () => {
    expect(content).toContain('handleResetAll')
  })

  it('should have handleSave capturing ALL state (body + face + hair + clothing)', () => {
    expect(content).toContain('handleSave')
    expect(content).toContain('new AvatarState')
    expect(content).toContain('getFullState')
    expect(content).toContain('setFaceType')
    expect(content).toContain('setFaceParams')
    expect(content).toContain('hairManager.getState')
    expect(content).toContain('textureSwapManager.getState')
  })

  it('should have handleLoadPreset restoring ALL state from JSON', () => {
    expect(content).toContain('handleLoadPreset')
    expect(content).toContain('AvatarState.fromJSON')
    expect(content).toContain('importSliderValues')
    expect(content).toContain('applyFaceType')
    expect(content).toContain('applyMainPreset')
    expect(content).toContain('applyBangsPreset')
    expect(content).toContain('applyOutfit')
  })

  it('should have handleLoadVRM to load external VRM files', () => {
    expect(content).toContain('handleLoadVRM')
    expect(content).toContain('.vrm')
    expect(content).toContain('onLoadVRM')
  })

  it('should have handleExport that calls onExportVRM', () => {
    expect(content).toContain('handleExport')
    expect(content).toContain('onExportVRM')
  })

  it('should render action bar with Back/Reset/Save/Load/VRM/Export buttons', () => {
    expect(content).toContain('Back')
    expect(content).toContain('Reset')
    expect(content).toContain('Save')
    expect(content).toContain('Load')
    expect(content).toContain('VRM')
    expect(content).toContain('Export')
  })

  it('should conditionally render each tab based on activeTab', () => {
    expect(content).toContain('activeTab === "hair"')
    expect(content).toContain('activeTab === "face"')
    expect(content).toContain('activeTab === "body"')
    expect(content).toContain('activeTab === "clothing"')
  })

  it('should pass morphDataManager to tabs', () => {
    expect(content).toContain('morphDataManager={morphDataManager}')
  })

  it('should accept onBack prop', () => {
    expect(content).toContain('onBack')
  })

  it('should accept onExportVRM prop', () => {
    expect(content).toContain('onExportVRM')
  })
})

// ── HairTab ─────────────────────────────────────────────────────────

describe('HairTab — Features', () => {
  const content = readFile('components/tabs/HairTab.jsx')

  it('should import MAIN_HAIR_PRESETS and BANGS_OVERLAY_PRESETS', () => {
    expect(content).toContain('MAIN_HAIR_PRESETS')
    expect(content).toContain('BANGS_OVERLAY_PRESETS')
  })

  it('should have hair style selection (Style section)', () => {
    expect(content).toContain('Style')
  })

  it('should have bangs selection (Bangs section)', () => {
    expect(content).toContain('Bangs')
  })

  it('should have color picker', () => {
    expect(content).toContain('type="color"')
    expect(content).toContain('Color')
  })

  it('should have 3-channel MToon color control', () => {
    expect(content).toContain('3ch')
    expect(content).toContain('deriveHairChannels')
  })

  it('should have opacity slider', () => {
    expect(content).toContain('Opacity')
    expect(content).toContain('hairOpacity')
  })

  it('should have outline width slider', () => {
    expect(content).toContain('Outline')
    expect(content).toContain('outlineWidth')
  })

  it('should call hairManager.applyMainPreset on style change', () => {
    expect(content).toContain('hairManager.applyMainPreset')
  })

  it('should call hairManager.applyBangsPreset on bangs change', () => {
    expect(content).toContain('hairManager.applyBangsPreset')
  })

  it('should show loading state', () => {
    expect(content).toContain('hairLoading')
    expect(content).toContain('Loading hair')
  })
})

// ── FaceTab ─────────────────────────────────────────────────────────

describe('FaceTab — Features', () => {
  const content = readFile('components/tabs/FaceTab.jsx')

  it('should have Face Type selection (52 types)', () => {
    expect(content).toContain('Face Type')
    expect(content).toContain('52')
  })

  it('should call morphDataManager.loadFaceTextureIndex on first face type click', () => {
    expect(content).toContain('loadFaceTextureIndex')
    expect(content).toContain('face_textures/index.json')
  })

  it('should call morphDataManager.applyFaceType', () => {
    expect(content).toContain('applyFaceType')
  })

  it('should have face parameter sliders with FACE_PARAM_CATEGORIES', () => {
    expect(content).toContain('FACE_PARAM_CATEGORIES')
    expect(content).toContain('FACE_PARAM_DISPLAY_NAMES')
  })

  it('should have Face Strength slider', () => {
    expect(content).toContain('Face Strength')
    expect(content).toContain('faceParamStrength')
  })

  it('should call morphDataManager.loadFaceParamDeltas on first param change', () => {
    expect(content).toContain('loadFaceParamDeltas')
    expect(content).toContain('face_param_deltas.json')
  })

  it('should call morphDataManager.setFaceParam', () => {
    expect(content).toContain('setFaceParam')
  })

  it('should have expression section with all categories', () => {
    expect(content).toContain('Expression')
    expect(content).toContain('Brows')
    expect(content).toContain('Eyes')
    expect(content).toContain('Mouth')
    expect(content).toContain('Teeth')
  })

  it('should have expression reset button', () => {
    expect(content).toContain('handleResetExpressions')
    expect(content).toContain('Reset')
  })

  it('should have face texture swap section', () => {
    expect(content).toContain('Face Textures')
    expect(content).toContain('iris')
    expect(content).toContain('brow')
    expect(content).toContain('eyelash')
  })

  it('should call textureSwapManager.swapTexture', () => {
    expect(content).toContain('textureSwapManager.swapTexture')
  })

  it('should show face type loading state', () => {
    expect(content).toContain('faceTypeLoading')
    expect(content).toContain('Loading face data')
  })

  it('should toggle face type on re-click (toggle off)', () => {
    expect(content).toContain('typeId === activeFaceType ? null : typeId')
  })
})

// ── BodyTab ─────────────────────────────────────────────────────────

describe('BodyTab — Features', () => {
  const content = readFile('components/tabs/BodyTab.jsx')

  it('should import PARAM_CATEGORIES and PARAM_DISPLAY_NAMES', () => {
    expect(content).toContain('PARAM_CATEGORIES')
    expect(content).toContain('PARAM_DISPLAY_NAMES')
  })

  it('should have slider for each parameter', () => {
    expect(content).toContain('type="range"')
    expect(content).toContain('SliderRow')
  })

  it('should have randomize button', () => {
    expect(content).toContain('Random')
    expect(content).toContain('handleRandomize')
  })

  it('should call morphDataManager.setSlider on change', () => {
    expect(content).toContain('morphDataManager.setSlider')
  })

  it('should call morphDataManager.setSliders on randomize', () => {
    expect(content).toContain('morphDataManager.setSliders')
  })

  it('should sync hair bones on slider change', () => {
    expect(content).toContain('hairManager.syncBones')
  })

  it('should have click-to-reset on slider values', () => {
    expect(content).toContain('Click to reset')
  })

  it('should default open Body Size category', () => {
    expect(content).toContain('"Body Size"')
  })
})

// ── ClothingTab ─────────────────────────────────────────────────────

describe('ClothingTab — Features', () => {
  const content = readFile('components/tabs/ClothingTab.jsx')

  it('should import OUTFIT_LIST', () => {
    expect(content).toContain('OUTFIT_LIST')
  })

  it('should import CLOTHING_DISPLAY', () => {
    expect(content).toContain('CLOTHING_DISPLAY')
  })

  it('should import CHARACTER_VARIANTS', () => {
    expect(content).toContain('CHARACTER_VARIANTS')
  })

  it('should have Skin button to disable clothing', () => {
    expect(content).toContain('Skin')
    expect(content).toContain('handleClothingToggle(false)')
  })

  it('should render outfit buttons from OUTFIT_LIST', () => {
    expect(content).toContain('OUTFIT_LIST.map')
    expect(content).toContain('outfit.name')
  })

  it('should call textureSwapManager.applyOutfit', () => {
    expect(content).toContain('textureSwapManager.applyOutfit')
  })

  it('should call textureSwapManager.applyFullClothing', () => {
    expect(content).toContain('textureSwapManager.applyFullClothing')
  })

  it('should toggle outfit off when same button clicked', () => {
    expect(content).toContain('outfitId === activeOutfit')
  })

  it('should have individual pieces (Tops/Bottoms/Shoes)', () => {
    expect(content).toContain('Individual Pieces')
    expect(content).toContain('handleClothingPieceToggle')
  })

  it('should call textureSwapManager.swapClothing for pieces', () => {
    expect(content).toContain('textureSwapManager.swapClothing')
  })

  it('should have character variant selector', () => {
    expect(content).toContain('Character Variant')
    expect(content).toContain('CHARACTER_VARIANTS.map')
  })

  it('should call textureSwapManager.applyCharacterVariant', () => {
    expect(content).toContain('textureSwapManager.applyCharacterVariant')
  })

  it('should pass morphDataManager for foot swap sync', () => {
    expect(content).toContain('morphDataManager')
    expect(content).toContain('reapplyMorphs')
  })

  it('should show loading state when textures not loaded', () => {
    expect(content).toContain('Loading clothing data')
  })
})

// ── TextureSwapManager — footSwap ───────────────────────────────────

describe('TextureSwapManager — Conditional Foot Swap', () => {
  const content = readFile('library/textureSwapManager.js')

  it('should include footSwap in OUTFIT_LIST export', () => {
    expect(content).toContain('footSwap')
  })

  it('should check outfit.footSwap before toggling nail triangles', () => {
    expect(content).toContain('outfit.footSwap === true')
    expect(content).toContain('needsFootSwap')
  })

  it('should call _toggleNailTriangles with needsFootSwap (not always true)', () => {
    // Must NOT unconditionally pass true
    expect(content).toContain('_toggleNailTriangles(vrmScene, needsFootSwap')
  })
})

// ── AvatarState — Serialization ─────────────────────────────────────

describe('AvatarState — Full Coverage', () => {
  let AvatarState

  beforeAll(async () => {
    const mod = await import('../../src/library/avatarState.js')
    AvatarState = mod.AvatarState
  })

  it('should have all state sections in snapshot', () => {
    const state = new AvatarState()
    const snap = state.getSnapshot()
    expect(snap).toHaveProperty('version')
    expect(snap).toHaveProperty('body')
    expect(snap).toHaveProperty('face')
    expect(snap).toHaveProperty('hair')
    expect(snap).toHaveProperty('clothing')
    expect(snap).toHaveProperty('textures')
    expect(snap).toHaveProperty('expressions')
  })

  it('should return deep copy (not reference)', () => {
    const state = new AvatarState()
    state.setBody({ height: 1 })
    const snap1 = state.getSnapshot()
    snap1.body.height = 999
    expect(state.getSnapshot().body.height).toBe(1) // original unchanged
  })

  it('should handle fromJSON with partial data', () => {
    const state = AvatarState.fromJSON('{"body":{"height":0.5}}')
    const snap = state.getSnapshot()
    expect(snap.body.height).toBe(0.5)
    expect(snap.face.faceType).toBeNull() // default
    expect(snap.hair.mainStyle).toBe('none') // default
  })

  it('should handle fromJSON with empty object', () => {
    const state = AvatarState.fromJSON('{}')
    expect(state.getSnapshot().body).toEqual({})
  })

  it('should set and get clothing pieces', () => {
    const state = new AvatarState()
    state.setOutfit('A')
    state.setCharacterVariant('E')
    const snap = state.getSnapshot()
    expect(snap.clothing.outfit).toBe('A')
    expect(snap.clothing.characterVariant).toBe('E')
  })

  it('should set null hair color', () => {
    const state = new AvatarState()
    state.setHairColor(null)
    expect(state.getSnapshot().hair.color).toBeNull()
  })

  it('should roundtrip all state through JSON', () => {
    const state = new AvatarState()
    state.setBody({ h: 0.5, a: -0.3 })
    state.setFaceType('12')
    state.setFaceParams({ eye: 0.2 })
    state.setFaceParamStrength(0.8)
    state.setHair({ mainStyle: 'C', bangsStyle: 'FA' })
    state.setHairColor({ base: '#FF0000', shade: '#990000', outline: '#330000' })
    state.setHairOpacity(0.7)
    state.setOutfit('B')
    state.setCharacterVariant('G')
    state.setTextureVariant('iris', '3')
    state.setTextureVariant('brow', '1')
    state.setExpressions({ Fcl_ALL_Joy: 0.8 })

    const json = state.toJSON()
    const restored = AvatarState.fromJSON(json)
    const snap = restored.getSnapshot()

    expect(snap.body).toEqual({ h: 0.5, a: -0.3 })
    expect(snap.face.faceType).toBe('12')
    expect(snap.face.faceParams).toEqual({ eye: 0.2 })
    expect(snap.face.faceParamStrength).toBe(0.8)
    expect(snap.hair.mainStyle).toBe('C')
    expect(snap.hair.bangsStyle).toBe('FA')
    expect(snap.hair.color.base).toBe('#FF0000')
    expect(snap.hair.opacity).toBe(0.7)
    expect(snap.clothing.outfit).toBe('B')
    expect(snap.clothing.characterVariant).toBe('G')
    expect(snap.textures.iris).toBe('3')
    expect(snap.textures.brow).toBe('1')
    expect(snap.expressions.Fcl_ALL_Joy).toBe(0.8)
  })
})

// ── CSS Styles ──────────────────────────────────────────────────────

describe('SliderPanel CSS — Tab Styles', () => {
  const cssPath = path.join(SRC, 'components/SliderPanel.module.css')
  const css = fs.readFileSync(cssPath, 'utf-8')

  it('should have .tabBar class', () => {
    expect(css).toContain('.tabBar')
  })

  it('should have .tabButton class', () => {
    expect(css).toContain('.tabButton')
  })

  it('should have .tabButtonActive class', () => {
    expect(css).toContain('.tabButtonActive')
  })

  it('should have .tabContent class', () => {
    expect(css).toContain('.tabContent')
  })

  it('should have .actionBar class', () => {
    expect(css).toContain('.actionBar')
  })

  it('should have .actionButtonPrimary for Export', () => {
    expect(css).toContain('.actionButtonPrimary')
  })

  it('should have .tabActionRow for in-tab actions', () => {
    expect(css).toContain('.tabActionRow')
  })
})

// ── index.json — outfits footSwap ───────────────────────────────────

describe('index.json — Outfit Definitions', () => {
  const indexPath = path.join(ROOT, 'public/vrm-data/textures/index.json')
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))

  it('should have outfits array in clothing category', () => {
    expect(index.categories.clothing.outfits).toBeDefined()
    expect(Array.isArray(index.categories.clothing.outfits)).toBe(true)
  })

  it('each outfit should have id, name, and footSwap property', () => {
    for (const outfit of index.categories.clothing.outfits) {
      expect(outfit).toHaveProperty('id')
      expect(outfit).toHaveProperty('name')
      expect(outfit).toHaveProperty('footSwap')
      expect(typeof outfit.footSwap).toBe('boolean')
    }
  })

  it('Outfit A (stockings) should have footSwap=true', () => {
    const a = index.categories.clothing.outfits.find(o => o.id === 'A')
    expect(a.footSwap).toBe(true)
  })

  it('Outfit B (socks) should have footSwap=true', () => {
    const b = index.categories.clothing.outfits.find(o => o.id === 'B')
    expect(b.footSwap).toBe(true)
  })

  it('Outfit C (sandals) should have footSwap=false', () => {
    const c = index.categories.clothing.outfits.find(o => o.id === 'C')
    expect(c.footSwap).toBe(false)
  })

  it('each outfit should have textures array', () => {
    for (const outfit of index.categories.clothing.outfits) {
      expect(Array.isArray(outfit.textures)).toBe(true)
      expect(outfit.textures.length).toBeGreaterThan(0)
    }
  })
})
