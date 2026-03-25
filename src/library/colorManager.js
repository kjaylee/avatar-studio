const HEX_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/

const DEFAULTS = {
  hair: '#2C1810',
  skin: '#FFDAB9',
  outfit: '#1A1A2E',
}

const PRESETS = {
  hair: [
    { name: 'Dark Brown', color: '#2C1810' },
    { name: 'Black', color: '#0D0D0D' },
    { name: 'Blonde', color: '#F5DEB3' },
    { name: 'Auburn', color: '#7B3F00' },
    { name: 'Silver', color: '#C0C0C0' },
  ],
  skin: [
    { name: 'Peach', color: '#FFDAB9' },
    { name: 'Light', color: '#FFE4C4' },
    { name: 'Medium', color: '#D2B48C' },
    { name: 'Tan', color: '#C19A6B' },
    { name: 'Dark', color: '#8B6347' },
  ],
  outfit: [
    { name: 'Navy', color: '#1A1A2E' },
    { name: 'White', color: '#FFFFFF' },
    { name: 'Black', color: '#000000' },
    { name: 'Red', color: '#CC0000' },
  ],
}

function normalize(hex) {
  if (!HEX_REGEX.test(hex)) {
    throw new Error(`Invalid hex color: ${hex}`)
  }
  const h = hex.toUpperCase()
  if (h.length === 4) {
    // #RGB → #RRGGBB
    return '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]
  }
  return h
}

export class ColorManager {
  constructor() {
    this._colors = {}
  }

  setColor(category, hexColor) {
    this._colors[category] = normalize(hexColor)
  }

  getColor(category) {
    return this._colors[category] ?? DEFAULTS[category] ?? '#000000'
  }

  getPresets(category) {
    return PRESETS[category] ?? []
  }

  hexToRgb(hex) {
    const n = normalize(hex)
    return {
      r: parseInt(n.slice(1, 3), 16),
      g: parseInt(n.slice(3, 5), 16),
      b: parseInt(n.slice(5, 7), 16),
    }
  }

  hexToNormalizedRgb(hex) {
    const { r, g, b } = this.hexToRgb(hex)
    return { r: r / 255, g: g / 255, b: b / 255 }
  }

  exportState() {
    return { ...this._colors }
  }

  importState(obj) {
    for (const [key, value] of Object.entries(obj)) {
      this._colors[key] = normalize(value)
    }
  }
}
