import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock THREE and GLTFLoader/VRM dependencies before importing HairManager
vi.mock('three', () => {
  const Matrix4 = class {
    constructor() { this.elements = new Float64Array(16) }
    clone() { return new Matrix4() }
  }
  return {
    default: {},
    Vector3: class { constructor(x=0,y=0,z=0) { this.x=x; this.y=y; this.z=z } },
    Matrix4,
    Quaternion: class { constructor() { this.x=0; this.y=0; this.z=0; this.w=1 } },
    Euler: class { constructor() { this.x=0; this.y=0; this.z=0 } },
    TextureLoader: class { load() {} },
    Color: class { constructor() { this.r=0; this.g=0; this.b=0 } },
    MeshStandardMaterial: class { constructor() {} },
    Group: class {
      constructor() { this.children = [] }
      add(c) { this.children.push(c) }
      traverse(fn) { fn(this); this.children.forEach(c => fn(c)) }
    },
    SRGBColorSpace: 'srgb',
    LinearSRGBColorSpace: 'srgb-linear',
    RepeatWrapping: 1000,
    LinearMipmapLinearFilter: 1008,
    LinearFilter: 1006,
  }
})

vi.mock('three/examples/jsm/loaders/GLTFLoader', () => ({
  GLTFLoader: class {
    register() {}
    load() {}
    loadAsync() { return Promise.resolve({ scene: { traverse() {} }, userData: {} }) }
  }
}))

vi.mock('@pixiv/three-vrm', () => ({
  VRMLoaderPlugin: class { constructor() {} }
}))

let HairManager

beforeEach(async () => {
  const mod = await import('../../src/library/hairManager.js')
  HairManager = mod.HairManager
})

describe('HairManager', () => {
  describe('getState()', () => {
    it('should return mainStyle, bangsStyle, color, opacity, outlineWidth', () => {
      const mgr = new HairManager()
      const state = mgr.getState()
      expect(state).toHaveProperty('mainStyle')
      expect(state).toHaveProperty('bangsStyle')
      expect(state).toHaveProperty('color')
      expect(state).toHaveProperty('opacity')
      expect(state).toHaveProperty('outlineWidth')
    })

    it('default mainStyle should be "none"', () => {
      const mgr = new HairManager()
      expect(mgr.getState().mainStyle).toBe('none')
    })

    it('default bangsStyle should be "none"', () => {
      const mgr = new HairManager()
      expect(mgr.getState().bangsStyle).toBe('none')
    })

    it('default opacity should be 1.0', () => {
      const mgr = new HairManager()
      expect(mgr.getState().opacity).toBe(1.0)
    })

    it('default outlineWidth should be null', () => {
      const mgr = new HairManager()
      expect(mgr.getState().outlineWidth).toBeNull()
    })

    it('color should be null by default', () => {
      const mgr = new HairManager()
      expect(mgr.getState().color).toBeNull()
    })

    it('after setHairOpacity, getState reflects new opacity', () => {
      const mgr = new HairManager()
      mgr.setHairOpacity(0.6)
      expect(mgr.getState().opacity).toBe(0.6)
    })

    it('setHairOpacity should clamp values to [0, 1]', () => {
      const mgr = new HairManager()
      mgr.setHairOpacity(1.5)
      expect(mgr.getState().opacity).toBe(1.0)

      mgr.setHairOpacity(-0.5)
      expect(mgr.getState().opacity).toBe(0)
    })

    it('color should be a copy when it is an object', () => {
      const mgr = new HairManager()
      const colorObj = { base: '#FF0000', shade: '#990000', outline: '#330000' }
      mgr._hairColor = colorObj

      const state = mgr.getState()
      expect(state.color).toEqual(colorObj)

      // Mutating returned color should not affect internal state
      state.color.base = '#000000'
      expect(mgr._hairColor.base).toBe('#FF0000')
    })

    it('should return correct state after multiple property changes', () => {
      const mgr = new HairManager()
      mgr._hairColor = { base: '#AABBCC', shade: '#112233', outline: '#445566' }
      mgr.setHairOpacity(0.75)
      mgr._outlineWidth = 2.5

      const state = mgr.getState()
      expect(state.mainStyle).toBe('none')
      expect(state.bangsStyle).toBe('none')
      expect(state.color).toEqual({ base: '#AABBCC', shade: '#112233', outline: '#445566' })
      expect(state.opacity).toBe(0.75)
      expect(state.outlineWidth).toBe(2.5)
    })
  })
})
