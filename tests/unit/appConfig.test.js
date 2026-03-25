import { describe, it, expect, vi } from 'vitest'
import { AssetManager } from '../../src/library/assetManager.js'
import { ColorManager } from '../../src/library/colorManager.js'
import { PresetManager } from '../../src/library/presetManager.js'
import { VrmMetadataBuilder } from '../../src/library/vrmMetadataBuilder.js'
import { ManifestDataManager } from '../../src/library/manifestDataManager.js'

/**
 * AppController — the orchestration layer that wires everything together.
 * This is the next module to implement: src/library/appController.js
 */

// Our production manifest
const PRODUCTION_MANIFEST = {
  assetsLocation: './vrm-assets/',
  format: 'vrm',
  traitsDirectory: '',
  thumbnailsDirectory: 'thumbnails/',
  exportScale: 1,
  defaultCullingLayer: -1,
  defaultCullingDistance: [0.1, 0.01],
  requiredTraits: ['Body'],
  initialTraits: ['Body'],
  randomTraits: ['Body'],
  colliderTraits: ['Body'],
  offset: [0.0, 0.9, 0.0],
  traits: [
    {
      trait: 'Body',
      name: 'Character',
      type: 'mesh',
      cullingLayer: 0,
      cameraTarget: { distance: 3.2, height: 0.9 },
      cullingDistance: [0.1, 0.01],
      collection: [
        { id: 'girl', name: 'Base Girl', directory: 'Body/girl.vrm' },
        { id: 'char_000', name: 'Character 1', directory: 'Body/char_000.vrm' },
        { id: 'char_001', name: 'Character 2', directory: 'Body/char_001.vrm' },
        { id: 'char_002', name: 'Character 3', directory: 'Body/char_002.vrm' },
        { id: 'char_003', name: 'Character 4', directory: 'Body/char_003.vrm' },
        { id: 'char_004', name: 'Character 5', directory: 'Body/char_004.vrm' },
      ]
    }
  ],
  textureCollections: [],
  colorCollections: [],
  // Character presets (full VRM swaps)
  characterPresets: [
    { id: 'girl', name: 'Base Girl', file: 'Body/girl.vrm', thumbnail: '' },
    { id: 'char_000', name: 'Character 1', file: 'Body/char_000.vrm', thumbnail: '' },
    { id: 'char_001', name: 'Character 2', file: 'Body/char_001.vrm', thumbnail: '' },
    { id: 'char_002', name: 'Character 3', file: 'Body/char_002.vrm', thumbnail: '' },
    { id: 'char_003', name: 'Character 4', file: 'Body/char_003.vrm', thumbnail: '' },
    { id: 'char_004', name: 'Character 5', file: 'Body/char_004.vrm', thumbnail: '' },
  ]
}

describe('AppController — Integration', () => {
  describe('Initialization', () => {
    it('should create AppController with all sub-managers', async () => {
      const { AppController } = await import('../../src/library/appController.js')
      const app = new AppController()

      expect(app.assetManager).toBeInstanceOf(AssetManager)
      expect(app.colorManager).toBeInstanceOf(ColorManager)
      expect(app.presetManager).toBeInstanceOf(PresetManager)
      expect(app.metadataBuilder).toBeInstanceOf(VrmMetadataBuilder)
      expect(app.manifestManager).toBeInstanceOf(ManifestDataManager)
    })

    it('should initialize from manifest object', async () => {
      const { AppController } = await import('../../src/library/appController.js')
      const app = new AppController()

      await app.initFromManifest(PRODUCTION_MANIFEST)

      expect(app.manifestManager.hasExistingManifest()).toBe(true)
      expect(app.isInitialized()).toBe(true)
    })

    it('should register character presets from manifest', async () => {
      const { AppController } = await import('../../src/library/appController.js')
      const app = new AppController()

      await app.initFromManifest(PRODUCTION_MANIFEST)

      expect(app.presetManager.getPresetCount()).toBe(6)
    })

    it('should set asset location from manifest', async () => {
      const { AppController } = await import('../../src/library/appController.js')
      const app = new AppController()

      await app.initFromManifest(PRODUCTION_MANIFEST)

      const resolved = app.assetManager.resolveAssetPath('Body/girl.vrm')
      expect(resolved).toBe('./vrm-assets/Body/girl.vrm')
    })
  })

  describe('Character selection flow', () => {
    it('should select a character preset and update asset manager', async () => {
      const { AppController } = await import('../../src/library/appController.js')
      const app = new AppController()
      await app.initFromManifest(PRODUCTION_MANIFEST)

      app.selectCharacter('char_001')

      expect(app.presetManager.getActivePresetId()).toBe('char_001')
      expect(app.assetManager.getSelectedTrait('Body')).toBe('char_001')
    })

    it('should throw when selecting non-existent character', async () => {
      const { AppController } = await import('../../src/library/appController.js')
      const app = new AppController()
      await app.initFromManifest(PRODUCTION_MANIFEST)

      expect(() => app.selectCharacter('nonexistent')).toThrow()
    })

    it('should get the VRM file path for selected character', async () => {
      const { AppController } = await import('../../src/library/appController.js')
      const app = new AppController()
      await app.initFromManifest(PRODUCTION_MANIFEST)

      app.selectCharacter('girl')
      const path = app.getSelectedCharacterPath()
      expect(path).toBe('./vrm-assets/Body/girl.vrm')
    })
  })

  describe('Color customization flow', () => {
    it('should apply color changes through app controller', async () => {
      const { AppController } = await import('../../src/library/appController.js')
      const app = new AppController()
      await app.initFromManifest(PRODUCTION_MANIFEST)

      app.setCharacterColor('hair', '#FF0000')
      expect(app.colorManager.getColor('hair')).toBe('#FF0000')
    })

    it('should get current color state for all categories', async () => {
      const { AppController } = await import('../../src/library/appController.js')
      const app = new AppController()
      await app.initFromManifest(PRODUCTION_MANIFEST)

      app.setCharacterColor('hair', '#FF0000')
      app.setCharacterColor('skin', '#FFDAB9')

      const colors = app.getColorState()
      expect(colors.hair).toBe('#FF0000')
      expect(colors.skin).toBe('#FFDAB9')
    })
  })

  describe('Export metadata flow', () => {
    it('should generate export metadata with character name', async () => {
      const { AppController } = await import('../../src/library/appController.js')
      const app = new AppController()
      await app.initFromManifest(PRODUCTION_MANIFEST)

      app.selectCharacter('girl')
      const meta = app.buildExportMetadata({ title: 'My Avatar' })

      expect(meta.title).toBe('My Avatar')
      expect(meta.author).toBe('Avatar Studio')
    })

    it('should use defaults when no title provided', async () => {
      const { AppController } = await import('../../src/library/appController.js')
      const app = new AppController()
      await app.initFromManifest(PRODUCTION_MANIFEST)

      const meta = app.buildExportMetadata()
      expect(meta.title).toBe('Avatar Studio Character')
    })
  })

  describe('State serialization', () => {
    it('should export full app state', async () => {
      const { AppController } = await import('../../src/library/appController.js')
      const app = new AppController()
      await app.initFromManifest(PRODUCTION_MANIFEST)

      app.selectCharacter('char_002')
      app.setCharacterColor('hair', '#FF5733')

      const state = app.exportState()
      expect(state.activePreset).toBe('char_002')
      expect(state.colors.hair).toBe('#FF5733')
      expect(state.selectedTraits).toHaveProperty('Body', 'char_002')
    })

    it('should restore app state', async () => {
      const { AppController } = await import('../../src/library/appController.js')
      const app = new AppController()
      await app.initFromManifest(PRODUCTION_MANIFEST)

      app.importState({
        activePreset: 'char_003',
        colors: { hair: '#00FF00', skin: '#FFDAB9', outfit: '#1A1A2E' },
        selectedTraits: { Body: 'char_003' }
      })

      expect(app.presetManager.getActivePresetId()).toBe('char_003')
      expect(app.colorManager.getColor('hair')).toBe('#00FF00')
      expect(app.assetManager.getSelectedTrait('Body')).toBe('char_003')
    })
  })

  describe('App info', () => {
    it('should expose app name and version', async () => {
      const { AppController } = await import('../../src/library/appController.js')
      const app = new AppController()

      expect(app.getAppName()).toBe('Avatar Studio')
      expect(app.getAppVersion()).toMatch(/^\d+\.\d+/)
    })
  })
})
