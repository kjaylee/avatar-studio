import { describe, it, expect, vi, beforeEach } from 'vitest'

// AssetManager — new module we need to create
// This test defines the interface BEFORE implementation

// We'll import after creation, for now define the expected interface
const createAssetManager = () => {
  // Dynamic import to handle module not yet existing
  return import('../../src/library/assetManager.js').then(m => new m.AssetManager())
}

describe('F2: Asset Manager', () => {
  describe('Asset path resolution', () => {
    it('should resolve asset paths relative to assetsLocation', async () => {
      const { AssetManager } = await import('../../src/library/assetManager.js')
      const am = new AssetManager()
      am.setAssetsLocation('./vrm-assets/')
      
      const resolved = am.resolveAssetPath('Body/female.vrm')
      expect(resolved).toBe('./vrm-assets/Body/female.vrm')
    })

    it('should handle trailing slash in assetsLocation', async () => {
      const { AssetManager } = await import('../../src/library/assetManager.js')
      const am = new AssetManager()
      
      am.setAssetsLocation('./vrm-assets')
      expect(am.resolveAssetPath('Body/female.vrm')).toBe('./vrm-assets/Body/female.vrm')
      
      am.setAssetsLocation('./vrm-assets/')
      expect(am.resolveAssetPath('Body/female.vrm')).toBe('./vrm-assets/Body/female.vrm')
    })

    it('should handle absolute URL assetsLocation', async () => {
      const { AssetManager } = await import('../../src/library/assetManager.js')
      const am = new AssetManager()
      am.setAssetsLocation('https://cdn.example.com/assets/')
      
      const resolved = am.resolveAssetPath('Hair/long.vrm')
      expect(resolved).toBe('https://cdn.example.com/assets/Hair/long.vrm')
    })
  })

  describe('Trait selection state', () => {
    it('should track selected trait per category', async () => {
      const { AssetManager } = await import('../../src/library/assetManager.js')
      const am = new AssetManager()
      
      am.selectTrait('Hair', 'long_hair')
      expect(am.getSelectedTrait('Hair')).toBe('long_hair')
    })

    it('should allow changing selected trait', async () => {
      const { AssetManager } = await import('../../src/library/assetManager.js')
      const am = new AssetManager()
      
      am.selectTrait('Hair', 'long_hair')
      am.selectTrait('Hair', 'short_hair')
      expect(am.getSelectedTrait('Hair')).toBe('short_hair')
    })

    it('should return null for unselected category', async () => {
      const { AssetManager } = await import('../../src/library/assetManager.js')
      const am = new AssetManager()
      
      expect(am.getSelectedTrait('Weapon')).toBeNull()
    })

    it('should track multiple categories independently', async () => {
      const { AssetManager } = await import('../../src/library/assetManager.js')
      const am = new AssetManager()
      
      am.selectTrait('Hair', 'long_hair')
      am.selectTrait('Outfit', 'bikini')
      am.selectTrait('Body', 'female')
      
      expect(am.getSelectedTrait('Hair')).toBe('long_hair')
      expect(am.getSelectedTrait('Outfit')).toBe('bikini')
      expect(am.getSelectedTrait('Body')).toBe('female')
    })

    it('should clear selection for a category', async () => {
      const { AssetManager } = await import('../../src/library/assetManager.js')
      const am = new AssetManager()
      
      am.selectTrait('Hair', 'long_hair')
      am.clearTrait('Hair')
      expect(am.getSelectedTrait('Hair')).toBeNull()
    })

    it('should get all selected traits as object', async () => {
      const { AssetManager } = await import('../../src/library/assetManager.js')
      const am = new AssetManager()
      
      am.selectTrait('Hair', 'long_hair')
      am.selectTrait('Body', 'female')
      
      const all = am.getAllSelectedTraits()
      expect(all).toEqual({ Hair: 'long_hair', Body: 'female' })
    })

    it('should reset all selections', async () => {
      const { AssetManager } = await import('../../src/library/assetManager.js')
      const am = new AssetManager()
      
      am.selectTrait('Hair', 'long_hair')
      am.selectTrait('Outfit', 'bikini')
      am.resetAllTraits()
      
      expect(am.getSelectedTrait('Hair')).toBeNull()
      expect(am.getSelectedTrait('Outfit')).toBeNull()
    })
  })
})
