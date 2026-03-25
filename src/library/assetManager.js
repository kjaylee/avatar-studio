export class AssetManager {
  constructor() {
    this._assetsLocation = ''
    this._selectedTraits = {}
  }

  setAssetsLocation(location) {
    this._assetsLocation = location
  }

  resolveAssetPath(relativePath) {
    const base = this._assetsLocation.endsWith('/')
      ? this._assetsLocation
      : this._assetsLocation + '/'
    return base + relativePath
  }

  selectTrait(category, traitId) {
    this._selectedTraits[category] = traitId
  }

  getSelectedTrait(category) {
    return this._selectedTraits[category] ?? null
  }

  clearTrait(category) {
    delete this._selectedTraits[category]
  }

  getAllSelectedTraits() {
    return { ...this._selectedTraits }
  }

  resetAllTraits() {
    this._selectedTraits = {}
  }
}
