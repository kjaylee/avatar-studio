import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('F6: Character Presets', () => {
  describe('Preset registry', () => {
    it('should register presets from manifest', async () => {
      const { PresetManager } = await import('../../src/library/presetManager.js')
      const pm = new PresetManager()

      pm.registerPresets([
        { id: 'char_000', name: 'Sakura', file: 'chars/char_000.vrm', thumbnail: '' },
        { id: 'char_001', name: 'Hina', file: 'chars/char_001.vrm', thumbnail: '' },
        { id: 'char_002', name: 'Yuki', file: 'chars/char_002.vrm', thumbnail: '' },
      ])

      expect(pm.getPresetCount()).toBe(3)
    })

    it('should list all available presets', async () => {
      const { PresetManager } = await import('../../src/library/presetManager.js')
      const pm = new PresetManager()

      pm.registerPresets([
        { id: 'char_000', name: 'Sakura', file: 'chars/char_000.vrm', thumbnail: '' },
        { id: 'char_001', name: 'Hina', file: 'chars/char_001.vrm', thumbnail: '' },
      ])

      const list = pm.listPresets()
      expect(list).toHaveLength(2)
      expect(list[0]).toHaveProperty('id', 'char_000')
      expect(list[0]).toHaveProperty('name', 'Sakura')
      expect(list[1]).toHaveProperty('id', 'char_001')
    })

    it('should get preset by id', async () => {
      const { PresetManager } = await import('../../src/library/presetManager.js')
      const pm = new PresetManager()

      pm.registerPresets([
        { id: 'char_000', name: 'Sakura', file: 'chars/char_000.vrm', thumbnail: '' },
      ])

      const preset = pm.getPreset('char_000')
      expect(preset).not.toBeNull()
      expect(preset.name).toBe('Sakura')
      expect(preset.file).toBe('chars/char_000.vrm')
    })

    it('should return null for non-existent preset', async () => {
      const { PresetManager } = await import('../../src/library/presetManager.js')
      const pm = new PresetManager()

      expect(pm.getPreset('nonexistent')).toBeNull()
    })
  })

  describe('Active preset tracking', () => {
    it('should track currently active preset', async () => {
      const { PresetManager } = await import('../../src/library/presetManager.js')
      const pm = new PresetManager()

      pm.registerPresets([
        { id: 'char_000', name: 'Sakura', file: 'chars/char_000.vrm', thumbnail: '' },
        { id: 'char_001', name: 'Hina', file: 'chars/char_001.vrm', thumbnail: '' },
      ])

      pm.setActivePreset('char_000')
      expect(pm.getActivePresetId()).toBe('char_000')
    })

    it('should return null when no preset is active', async () => {
      const { PresetManager } = await import('../../src/library/presetManager.js')
      const pm = new PresetManager()

      expect(pm.getActivePresetId()).toBeNull()
    })

    it('should throw when setting non-existent preset as active', async () => {
      const { PresetManager } = await import('../../src/library/presetManager.js')
      const pm = new PresetManager()

      expect(() => pm.setActivePreset('nonexistent')).toThrow()
    })

    it('should switch active preset', async () => {
      const { PresetManager } = await import('../../src/library/presetManager.js')
      const pm = new PresetManager()

      pm.registerPresets([
        { id: 'char_000', name: 'Sakura', file: 'chars/char_000.vrm', thumbnail: '' },
        { id: 'char_001', name: 'Hina', file: 'chars/char_001.vrm', thumbnail: '' },
      ])

      pm.setActivePreset('char_000')
      pm.setActivePreset('char_001')
      expect(pm.getActivePresetId()).toBe('char_001')
    })
  })

  describe('Preset clearing', () => {
    it('should clear all presets', async () => {
      const { PresetManager } = await import('../../src/library/presetManager.js')
      const pm = new PresetManager()

      pm.registerPresets([
        { id: 'char_000', name: 'Sakura', file: 'chars/char_000.vrm', thumbnail: '' },
      ])
      pm.setActivePreset('char_000')
      pm.clearAll()

      expect(pm.getPresetCount()).toBe(0)
      expect(pm.getActivePresetId()).toBeNull()
    })
  })
})
