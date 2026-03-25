import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('F3: Color Customization Manager', () => {
  describe('Color state management', () => {
    it('should store hair color', async () => {
      const { ColorManager } = await import('../../src/library/colorManager.js')
      const cm = new ColorManager()
      
      cm.setColor('hair', '#FF5733')
      expect(cm.getColor('hair')).toBe('#FF5733')
    })

    it('should store skin color', async () => {
      const { ColorManager } = await import('../../src/library/colorManager.js')
      const cm = new ColorManager()
      
      cm.setColor('skin', '#FFDAB9')
      expect(cm.getColor('skin')).toBe('#FFDAB9')
    })

    it('should store outfit color', async () => {
      const { ColorManager } = await import('../../src/library/colorManager.js')
      const cm = new ColorManager()
      
      cm.setColor('outfit', '#000000')
      expect(cm.getColor('outfit')).toBe('#000000')
    })

    it('should return default color when none set', async () => {
      const { ColorManager } = await import('../../src/library/colorManager.js')
      const cm = new ColorManager()
      
      // Should return a default, not null
      const defaultColor = cm.getColor('hair')
      expect(defaultColor).toBeTruthy()
      expect(defaultColor).toMatch(/^#[0-9A-Fa-f]{6}$/)
    })

    it('should validate hex color format', async () => {
      const { ColorManager } = await import('../../src/library/colorManager.js')
      const cm = new ColorManager()
      
      expect(() => cm.setColor('hair', 'not-a-color')).toThrow()
      expect(() => cm.setColor('hair', '#GGG')).toThrow()
      expect(() => cm.setColor('hair', '')).toThrow()
    })

    it('should accept 3-digit hex and normalize to 6-digit', async () => {
      const { ColorManager } = await import('../../src/library/colorManager.js')
      const cm = new ColorManager()
      
      cm.setColor('hair', '#F00')
      expect(cm.getColor('hair')).toBe('#FF0000')
    })

    it('should be case-insensitive for hex colors', async () => {
      const { ColorManager } = await import('../../src/library/colorManager.js')
      const cm = new ColorManager()
      
      cm.setColor('hair', '#ff5733')
      expect(cm.getColor('hair')).toBe('#FF5733')
    })
  })

  describe('Color presets', () => {
    it('should provide hair color presets', async () => {
      const { ColorManager } = await import('../../src/library/colorManager.js')
      const cm = new ColorManager()
      
      const presets = cm.getPresets('hair')
      expect(presets).toBeInstanceOf(Array)
      expect(presets.length).toBeGreaterThan(0)
      presets.forEach(p => {
        expect(p).toHaveProperty('name')
        expect(p).toHaveProperty('color')
        expect(p.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      })
    })

    it('should provide skin tone presets', async () => {
      const { ColorManager } = await import('../../src/library/colorManager.js')
      const cm = new ColorManager()
      
      const presets = cm.getPresets('skin')
      expect(presets).toBeInstanceOf(Array)
      expect(presets.length).toBeGreaterThan(0)
    })

    it('should return empty array for unknown category', async () => {
      const { ColorManager } = await import('../../src/library/colorManager.js')
      const cm = new ColorManager()
      
      const presets = cm.getPresets('wings')
      expect(presets).toEqual([])
    })
  })

  describe('Color conversion utilities', () => {
    it('should convert hex to RGB object', async () => {
      const { ColorManager } = await import('../../src/library/colorManager.js')
      const cm = new ColorManager()
      
      const rgb = cm.hexToRgb('#FF0000')
      expect(rgb).toEqual({ r: 255, g: 0, b: 0 })
    })

    it('should convert hex to normalized RGB (0-1 range for Three.js)', async () => {
      const { ColorManager } = await import('../../src/library/colorManager.js')
      const cm = new ColorManager()
      
      const rgb = cm.hexToNormalizedRgb('#FF0000')
      expect(rgb.r).toBeCloseTo(1.0)
      expect(rgb.g).toBeCloseTo(0.0)
      expect(rgb.b).toBeCloseTo(0.0)
    })

    it('should handle black and white correctly', async () => {
      const { ColorManager } = await import('../../src/library/colorManager.js')
      const cm = new ColorManager()
      
      expect(cm.hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 })
      expect(cm.hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 })
    })
  })

  describe('State serialization', () => {
    it('should export all colors as serializable object', async () => {
      const { ColorManager } = await import('../../src/library/colorManager.js')
      const cm = new ColorManager()
      
      cm.setColor('hair', '#FF5733')
      cm.setColor('skin', '#FFDAB9')
      
      const state = cm.exportState()
      expect(state).toHaveProperty('hair', '#FF5733')
      expect(state).toHaveProperty('skin', '#FFDAB9')
    })

    it('should restore colors from serialized state', async () => {
      const { ColorManager } = await import('../../src/library/colorManager.js')
      const cm = new ColorManager()
      
      cm.importState({ hair: '#FF5733', skin: '#FFDAB9', outfit: '#000000' })
      expect(cm.getColor('hair')).toBe('#FF5733')
      expect(cm.getColor('skin')).toBe('#FFDAB9')
      expect(cm.getColor('outfit')).toBe('#000000')
    })
  })
})
