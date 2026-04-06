import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock THREE before importing TextureSwapManager
vi.mock('three', () => ({
  default: {},
  TextureLoader: class {
    load() {}
  },
  SRGBColorSpace: 'srgb',
  LinearSRGBColorSpace: 'srgb-linear',
  RepeatWrapping: 1000,
  LinearMipmapLinearFilter: 1008,
  LinearFilter: 1006,
}))

let TextureSwapManager

beforeEach(async () => {
  const mod = await import('../../src/library/textureSwapManager.js')
  TextureSwapManager = mod.TextureSwapManager
})

describe('TextureSwapManager', () => {
  describe('getState()', () => {
    it('should return an object with activeVariants key', () => {
      const mgr = new TextureSwapManager()
      const state = mgr.getState()
      expect(state).toHaveProperty('activeVariants')
    })

    it('activeVariants should be a copy (not a reference)', () => {
      const mgr = new TextureSwapManager()
      mgr.activeVariants = { iris: '2', brow: '1' }

      const state = mgr.getState()
      expect(state.activeVariants).toEqual({ iris: '2', brow: '1' })

      // Mutating the returned copy should not affect internal state
      state.activeVariants.iris = '999'
      expect(mgr.activeVariants.iris).toBe('2')
    })

    it('default should have empty activeVariants', () => {
      const mgr = new TextureSwapManager()
      const state = mgr.getState()
      expect(state.activeVariants).toEqual({})
    })

    it('should reflect variants set on the instance', () => {
      const mgr = new TextureSwapManager()
      mgr.activeVariants = {
        iris: '3',
        brow: '2',
        mouth: null,
        clothing: 'A',
      }

      const state = mgr.getState()
      expect(state.activeVariants.iris).toBe('3')
      expect(state.activeVariants.brow).toBe('2')
      expect(state.activeVariants.mouth).toBeNull()
      expect(state.activeVariants.clothing).toBe('A')
    })

    it('should preserve null variant values', () => {
      const mgr = new TextureSwapManager()
      mgr.activeVariants = { iris: null, highlight: null }

      const state = mgr.getState()
      expect(state.activeVariants.iris).toBeNull()
      expect(state.activeVariants.highlight).toBeNull()
    })

    it('constructor should initialize with expected defaults', () => {
      const mgr = new TextureSwapManager()
      expect(mgr.loaded).toBe(false)
      expect(mgr.activeVariants).toEqual({})
    })
  })
})
