import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ManifestDataManager } from '../../src/library/manifestDataManager'

// Valid manifest matching our custom format
const VALID_MANIFEST = {
  assetsLocation: './vrm-assets/',
  format: 'vrm',
  traitsDirectory: '/vrm-assets/',
  thumbnailsDirectory: './vrm-assets/thumbnails/',
  exportScale: 1,
  defaultCullingLayer: -1,
  defaultCullingDistance: [0.1, 0.01],
  requiredTraits: ['Body'],
  initialTraits: ['Body', 'Hair', 'Outfit'],
  randomTraits: ['Hair', 'Outfit'],
  colliderTraits: ['Body'],
  offset: [0.0, 0.43, 0.0],
  traits: [
    {
      trait: 'Body',
      name: 'Body',
      type: 'mesh',
      cullingLayer: 0,
      cameraTarget: { distance: 3.0, height: 0.8 },
      cullingDistance: [0.1, 0.01],
      collection: [
        { id: 'female', directory: 'Body/female.vrm', name: 'Default Female', thumbnail: '' }
      ]
    },
    {
      trait: 'Hair',
      name: 'Hair',
      type: 'mesh',
      cullingLayer: 1,
      cameraTarget: { distance: 2.0, height: 1.2 },
      cullingDistance: [0.1, 0.01],
      collection: [
        { id: 'default_hair', directory: 'Hair/default.vrm', name: 'Default', thumbnail: '' },
        { id: 'long_hair', directory: 'Hair/long.vrm', name: 'Long', thumbnail: '' },
        { id: 'short_hair', directory: 'Hair/short.vrm', name: 'Short', thumbnail: '' }
      ]
    },
    {
      trait: 'Outfit',
      name: 'Outfit',
      type: 'mesh',
      cullingLayer: 2,
      cameraTarget: { distance: 3.0, height: 0.5 },
      cullingDistance: [0.1, 0.01],
      collection: [
        { id: 'bikini', directory: 'Outfit/bikini.vrm', name: 'Bikini', thumbnail: '' },
        { id: 'casual', directory: 'Outfit/casual.vrm', name: 'Casual', thumbnail: '' }
      ]
    }
  ],
  textureCollections: [],
  colorCollections: []
}

describe('F1: Custom Manifest Loading', () => {
  let manager

  beforeEach(() => {
    manager = new ManifestDataManager()
  })

  describe('Manifest structure validation', () => {
    it('should accept a valid manifest with Body/Hair/Outfit traits', async () => {
      await manager.setManifest(VALID_MANIFEST, 'test')
      expect(manager.hasExistingManifest()).toBe(true)
    })

    it('should reject null/undefined manifest', async () => {
      await expect(manager.setManifest(null, 'test')).rejects.toThrow()
    })

    it('should reject duplicate identifier loading', async () => {
      await manager.setManifest(VALID_MANIFEST, 'dup')
      await expect(manager.setManifest(VALID_MANIFEST, 'dup')).rejects.toThrow()
    })

    it('should set main manifest on first load', async () => {
      await manager.setManifest(VALID_MANIFEST, 'main')
      expect(manager.mainManifestData).not.toBeNull()
    })

    it('should correctly parse trait categories', async () => {
      await manager.setManifest(VALID_MANIFEST, 'test')
      const groups = manager.getGroupModelTraits()
      const traitNames = groups.map(g => g.trait)
      expect(traitNames).toContain('Body')
      expect(traitNames).toContain('Hair')
      expect(traitNames).toContain('Outfit')
    })

    it('should report correct number of options per trait', async () => {
      await manager.setManifest(VALID_MANIFEST, 'test')
      const hairOptions = manager.getTraitOptionsByType('Hair')
      expect(hairOptions.length).toBe(3) // default, long, short
      
      const outfitOptions = manager.getTraitOptionsByType('Outfit')
      expect(outfitOptions.length).toBe(2) // bikini, casual
    })
  })

  describe('Trait retrieval', () => {
    beforeEach(async () => {
      await manager.setManifest(VALID_MANIFEST, 'main')
    })

    it('should find a trait option by group and id', () => {
      const option = manager.getTraitOption('Hair', 'long_hair')
      expect(option).not.toBeNull()
    })

    it('should return null for non-existent trait', () => {
      const option = manager.getTraitOption('Hair', 'nonexistent')
      expect(option).toBeNull()
    })

    it('should return null for non-existent group', () => {
      const option = manager.getTraitOption('Wings', 'angel')
      expect(option).toBeNull()
    })

    it('should return random trait from available options', () => {
      const random = manager.getRandomTrait('Hair')
      expect(random).not.toBeNull()
    })

    it('should identify Body as required trait', () => {
      const isRequired = manager.isTraitGroupRequired('Body')
      expect(isRequired).toBe(true)
    })
  })

  describe('Manifest clearing', () => {
    it('should clear all loaded manifests', async () => {
      await manager.setManifest(VALID_MANIFEST, 'test')
      manager.clearManifests()
      expect(manager.hasExistingManifest()).toBe(false)
      expect(manager.getLoadedManifests().length).toBe(0)
    })
  })

  describe('Display scale and defaults', () => {
    it('should return display scale of 1 when no manifest loaded', () => {
      expect(manager.getDisplayScale()).toBe(1)
    })

    it('should parse default culling values from manifest', async () => {
      await manager.setManifest(VALID_MANIFEST, 'test')
      const defaults = manager.getDefaultValues()
      expect(defaults.defaultCullingLayer).toBe(-1)
    })
  })
})
