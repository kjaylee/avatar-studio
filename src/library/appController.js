import { AssetManager } from './assetManager.js'
import { ColorManager } from './colorManager.js'
import { PresetManager } from './presetManager.js'
import { VrmMetadataBuilder } from './vrmMetadataBuilder.js'
import { ManifestDataManager } from './manifestDataManager.js'

export class AppController {
  constructor() {
    this.assetManager = new AssetManager()
    this.colorManager = new ColorManager()
    this.presetManager = new PresetManager()
    this.metadataBuilder = new VrmMetadataBuilder()
    this.manifestManager = new ManifestDataManager()
    this._initialized = false
    this._activePresetId = null
  }

  async initFromManifest(manifest) {
    await this.manifestManager.setManifest(manifest)
    if (manifest.characterPresets) {
      this.presetManager.registerPresets(manifest.characterPresets)
    }
    if (manifest.assetsLocation) {
      this.assetManager.setAssetsLocation(manifest.assetsLocation)
    }
    this._initialized = true
  }

  isInitialized() {
    return this._initialized
  }

  selectCharacter(id) {
    const preset = this.presetManager.getPreset(id)
    if (!preset) throw new Error(`Preset not found: ${id}`)
    this.presetManager.setActivePreset(id)
    this._activePresetId = id
    this.assetManager.selectTrait('Body', id)
  }

  getSelectedCharacterPath() {
    const preset = this.presetManager.getPreset(this._activePresetId)
    return this.assetManager.resolveAssetPath(preset.file)
  }

  setCharacterColor(category, hex) {
    this.colorManager.setColor(category, hex)
  }

  getColorState() {
    return this.colorManager.exportState()
  }

  buildExportMetadata(opts = {}) {
    const title = opts.title || 'Avatar Studio Character'
    this.metadataBuilder.setTitle(title).setAuthor('Avatar Studio')
    return this.metadataBuilder.build()
  }

  exportState() {
    return {
      activePreset: this._activePresetId,
      colors: this.colorManager.exportState(),
      selectedTraits: this.assetManager.getAllSelectedTraits(),
    }
  }

  importState(state) {
    if (state.activePreset) {
      this.presetManager.setActivePreset(state.activePreset)
      this._activePresetId = state.activePreset
    }
    if (state.colors) {
      this.colorManager.importState(state.colors)
    }
    if (state.selectedTraits) {
      for (const [category, traitId] of Object.entries(state.selectedTraits)) {
        this.assetManager.selectTrait(category, traitId)
      }
    }
  }

  getAppName() {
    return 'Avatar Studio'
  }

  getAppVersion() {
    return '1.0.0'
  }
}
