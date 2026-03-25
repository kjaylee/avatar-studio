export class PresetManager {
  constructor() {
    this._presets = []
    this._presetsMap = {}
    this._activePresetId = null
  }

  registerPresets(array) {
    for (const preset of array) {
      this._presets.push(preset)
      this._presetsMap[preset.id] = preset
    }
  }

  getPresetCount() {
    return this._presets.length
  }

  listPresets() {
    return [...this._presets]
  }

  getPreset(id) {
    return this._presetsMap[id] ?? null
  }

  setActivePreset(id) {
    if (!this._presetsMap[id]) {
      throw new Error(`Preset not found: ${id}`)
    }
    this._activePresetId = id
  }

  getActivePresetId() {
    return this._activePresetId
  }

  clearAll() {
    this._presets = []
    this._presetsMap = {}
    this._activePresetId = null
  }
}
