const WARN_SIZE = 25 * 1024 * 1024 // 25MB

export class VrmMetadataBuilder {
  constructor() {
    this._title = 'Avatar Studio Character'
    this._author = 'Avatar Studio'
    this._version = '1.0'
    this._license = null
    this._allowedUsage = null
  }

  setTitle(title) {
    this._title = title
    return this
  }

  setAuthor(author) {
    this._author = author
    return this
  }

  setVersion(version) {
    this._version = version
    return this
  }

  setLicense(license) {
    this._license = license
    return this
  }

  setAllowedUsage(usage) {
    this._allowedUsage = usage
    return this
  }

  build() {
    const meta = {
      title: this._title,
      author: this._author,
      version: this._version,
    }
    if (this._license !== null) meta.licenseName = this._license
    if (this._allowedUsage !== null) meta.allowedUsage = this._allowedUsage
    return meta
  }

  estimateFileSize({ bodySize = 0, hairSize = 0, outfitSize = 0 } = {}) {
    return bodySize + hairSize + outfitSize
  }

  checkExportSize(bytes) {
    if (bytes > WARN_SIZE) {
      return { warning: true, message: 'Export size exceeds 25MB limit. Consider optimizing textures.' }
    }
    return { warning: false, message: 'Export size is within acceptable limits.' }
  }
}
