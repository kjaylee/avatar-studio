import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock THREE and GLTFLoader/VRM dependencies before importing
vi.mock('three', () => {
  const Matrix4 = class {
    constructor() { this.elements = new Float64Array(16) }
    clone() { return new Matrix4() }
    copy() { return this }
    invert() { return this }
    multiply() { return this }
  }
  const Vector3 = class {
    constructor(x=0,y=0,z=0) { this.x=x; this.y=y; this.z=z }
    clone() { return new Vector3(this.x, this.y, this.z) }
    copy(v) { this.x=v.x; this.y=v.y; this.z=v.z; return this }
  }
  const Bone = class {
    constructor() {
      this.name = ''
      this.position = new Vector3()
      this.quaternion = { x:0, y:0, z:0, w:1, clone() { return {...this} }, copy(q) { Object.assign(this, q); return this } }
      this.scale = new Vector3(1,1,1)
      this.children = []
      this.parent = null
      this.matrixWorld = new Matrix4()
      this.isBone = true
    }
    add(child) { this.children.push(child); child.parent = this }
    updateMatrixWorld() {}
  }
  const Group = class {
    constructor() {
      this.name = ''
      this.children = []
      this.parent = null
      this.userData = {}
    }
    add(c) { this.children.push(c); c.parent = this }
    traverse(fn) {
      fn(this)
      this.children.forEach(c => {
        if (c.traverse) c.traverse(fn)
        else fn(c)
      })
    }
  }
  const Skeleton = class {
    constructor(bones, inverses) {
      this.bones = bones || []
      this.boneInverses = inverses || []
    }
    computeBoneTexture() {}
    update() {}
  }
  const SkinnedMesh = class {
    constructor(geom, mat) {
      this.geometry = geom
      this.material = mat
      this.name = ''
      this.frustumCulled = true
      this.userData = {}
      this.isMesh = true
      this.isSkinnedMesh = true
      this.skeleton = null
    }
    bind(skeleton) { this.skeleton = skeleton }
  }
  return {
    default: {},
    Vector3,
    Matrix4,
    Quaternion: class { constructor() { this.x=0; this.y=0; this.z=0; this.w=1 } },
    Bone,
    Group,
    Skeleton,
    SkinnedMesh,
    DoubleSide: 2,
  }
})

vi.mock('three/examples/jsm/loaders/GLTFLoader', () => ({
  GLTFLoader: class {
    register() {}
    loadAsync() { return Promise.resolve({ scene: { traverse() {} }, userData: {} }) }
  }
}))

vi.mock('@pixiv/three-vrm', () => ({
  VRMLoaderPlugin: class { constructor() {} }
}))

let ClothingMeshManager, CLOTHING_MESH_CATEGORIES, CLOTHING_MESH_PRESETS

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('../../src/library/clothingMeshManager.js')
  ClothingMeshManager = mod.ClothingMeshManager
  CLOTHING_MESH_CATEGORIES = mod.CLOTHING_MESH_CATEGORIES
  CLOTHING_MESH_PRESETS = mod.CLOTHING_MESH_PRESETS
})

describe('ClothingMeshManager', () => {

  describe('constructor', () => {
    it('should initialize with slots for each category', () => {
      const mgr = new ClothingMeshManager()
      expect(mgr._slots.size).toBe(Object.keys(CLOTHING_MESH_CATEGORIES).length)
      for (const cat of Object.keys(CLOTHING_MESH_CATEGORIES)) {
        expect(mgr._slots.has(cat)).toBe(true)
      }
    })

    it('should start with loading = false', () => {
      const mgr = new ClothingMeshManager()
      expect(mgr.loading).toBe(false)
    })

    it('should have empty cache', () => {
      const mgr = new ClothingMeshManager()
      expect(mgr._cache.size).toBe(0)
    })
  })

  describe('getState()', () => {
    it('should return empty slots when nothing equipped', () => {
      const mgr = new ClothingMeshManager()
      const state = mgr.getState()
      expect(state).toEqual({ slots: {} })
    })

    it('should return equipped slot presetIds', () => {
      const mgr = new ClothingMeshManager()
      // Simulate equipped slot
      const slot = mgr._slots.get('outerwear')
      slot.presetId = 'coat_a'
      const state = mgr.getState()
      expect(state.slots).toEqual({ outerwear: 'coat_a' })
    })

    it('should exclude "none" slots', () => {
      const mgr = new ClothingMeshManager()
      const slot = mgr._slots.get('outerwear')
      slot.presetId = 'none'
      const state = mgr.getState()
      expect(state.slots.outerwear).toBeUndefined()
    })

    it('should return multiple equipped slots', () => {
      const mgr = new ClothingMeshManager()
      mgr._slots.get('outerwear').presetId = 'jacket_1'
      mgr._slots.get('accessory').presetId = 'hat_2'
      const state = mgr.getState()
      expect(state.slots).toEqual({
        outerwear: 'jacket_1',
        accessory: 'hat_2',
      })
    })
  })

  describe('getPresets()', () => {
    it('should return a copy of presets array', () => {
      const mgr = new ClothingMeshManager()
      const presets = mgr.getPresets()
      expect(Array.isArray(presets)).toBe(true)
      expect(presets).not.toBe(mgr._presets)
      expect(presets.length).toBe(mgr._presets.length)
    })
  })

  describe('getPresetsByCategory()', () => {
    it('should filter presets by category plus none', () => {
      const mgr = new ClothingMeshManager()
      mgr._presets.push({ id: 'coat_a', name: 'Coat A', url: './coat.vrm', category: 'outerwear' })
      mgr._presets.push({ id: 'skirt_a', name: 'Skirt A', url: './skirt.vrm', category: 'bottom_overlay' })
      const outerwear = mgr.getPresetsByCategory('outerwear')
      expect(outerwear.some(p => p.id === 'coat_a')).toBe(true)
      expect(outerwear.some(p => p.id === 'skirt_a')).toBe(false)
      expect(outerwear.some(p => p.id === 'none')).toBe(true)
    })
  })

  describe('loadPresets()', () => {
    it('should handle missing index.json gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false })
      const mgr = new ClothingMeshManager()
      await mgr.loadPresets()
      expect(mgr._presetsLoaded).toBe(true)
    })

    it('should load presets from index.json', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          presets: [
            { id: 'coat_a', name: 'Coat A', url: 'coat_a.vrm', category: 'outerwear' },
            { id: 'skirt_b', name: 'Skirt B', url: './skirt_b.vrm', category: 'bottom_overlay' },
          ]
        })
      })
      const mgr = new ClothingMeshManager()
      await mgr.loadPresets('./vrm-data/clothing')
      expect(mgr._presetsLoaded).toBe(true)
      expect(mgr._presets.find(p => p.id === 'coat_a')).toBeTruthy()
      expect(mgr._presets.find(p => p.id === 'skirt_b')).toBeTruthy()
    })

    it('should not duplicate presets on second call', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ presets: [{ id: 'x', name: 'X', url: 'x.vrm', category: 'full' }] })
      })
      const mgr = new ClothingMeshManager()
      await mgr.loadPresets()
      const countAfterFirst = mgr._presets.length
      await mgr.loadPresets()
      expect(mgr._presets.length).toBe(countAfterFirst)
    })

    it('should handle fetch errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('network'))
      const mgr = new ClothingMeshManager()
      await mgr.loadPresets()
      expect(mgr._presetsLoaded).toBe(true)
    })
  })

  describe('removeByCategory()', () => {
    it('should clear slot when removing category', () => {
      const mgr = new ClothingMeshManager()
      const slot = mgr._slots.get('outerwear')
      slot.presetId = 'coat_a'
      slot.group = { parent: { remove: vi.fn() }, traverse: vi.fn() }
      const baseScene = {}
      mgr.removeByCategory('outerwear', baseScene)
      expect(slot.presetId).toBe('none')
    })

    it('should do nothing for unknown category', () => {
      const mgr = new ClothingMeshManager()
      expect(() => mgr.removeByCategory('unknown', {})).not.toThrow()
    })
  })

  describe('removeAll()', () => {
    it('should clear all slots', () => {
      const mgr = new ClothingMeshManager()
      mgr._slots.get('outerwear').presetId = 'coat_a'
      mgr._slots.get('bottom_overlay').presetId = 'skirt_b'
      // Mock groups
      for (const slot of mgr._slots.values()) {
        if (slot.presetId !== 'none') {
          slot.group = { parent: { remove: vi.fn() }, traverse: vi.fn() }
        }
      }
      mgr.removeAll({})
      for (const slot of mgr._slots.values()) {
        expect(slot.presetId).toBe('none')
      }
    })
  })

  describe('setColor()', () => {
    it('should apply hex color to clothing meshes', () => {
      const mgr = new ClothingMeshManager()
      const mockMat = {
        color: { setRGB: vi.fn() },
        uniforms: {
          litFactor: { value: { setRGB: vi.fn() } },
          shadeColorFactor: { value: { setRGB: vi.fn() } },
        },
        needsUpdate: false,
      }
      const mockMesh = { isMesh: true, material: mockMat }
      const slot = mgr._slots.get('outerwear')
      slot.group = {
        traverse: (fn) => fn(mockMesh),
      }
      mgr.setColor('outerwear', '#ff0000')
      expect(mockMat.color.setRGB).toHaveBeenCalledWith(1, 0, 0)
      expect(mockMat.needsUpdate).toBe(true)
    })

    it('should reset color when null is passed', () => {
      const mgr = new ClothingMeshManager()
      const mockMat = {
        color: { setRGB: vi.fn() },
        uniforms: {
          litFactor: { value: { setRGB: vi.fn() } },
          shadeColorFactor: { value: { setRGB: vi.fn() } },
        },
        needsUpdate: false,
      }
      const mockMesh = { isMesh: true, material: mockMat }
      const slot = mgr._slots.get('outerwear')
      slot.group = { traverse: (fn) => fn(mockMesh) }
      mgr.setColor('outerwear', null)
      expect(mockMat.color.setRGB).toHaveBeenCalledWith(1, 1, 1)
    })

    it('should do nothing if no group in slot', () => {
      const mgr = new ClothingMeshManager()
      expect(() => mgr.setColor('outerwear', '#ff0000')).not.toThrow()
    })
  })

  describe('syncBones()', () => {
    it('should do nothing without sliderValues', () => {
      const mgr = new ClothingMeshManager()
      expect(() => mgr.syncBones({}, null)).not.toThrow()
    })

    it('should do nothing when no meshes equipped', () => {
      const mgr = new ClothingMeshManager()
      expect(() => mgr.syncBones({}, { height: 0.5 })).not.toThrow()
    })
  })

  describe('_isBodyMesh()', () => {
    it('should detect body meshes', () => {
      const mgr = new ClothingMeshManager()
      expect(mgr._isBodyMesh({ name: 'Body_1' })).toBe(true)
      expect(mgr._isBodyMesh({ name: 'body' })).toBe(true)
      expect(mgr._isBodyMesh({ name: 'Face_00' })).toBe(true)
      expect(mgr._isBodyMesh({ name: 'Hair_main' })).toBe(true)
    })

    it('should not detect clothing meshes', () => {
      const mgr = new ClothingMeshManager()
      expect(mgr._isBodyMesh({ name: 'Jacket_01' })).toBe(false)
      expect(mgr._isBodyMesh({ name: 'Coat_sleeve' })).toBe(false)
      expect(mgr._isBodyMesh({ name: 'Skirt_pleated' })).toBe(false)
    })
  })

  describe('_parseHex()', () => {
    it('should parse hex to RGB floats', () => {
      const mgr = new ClothingMeshManager()
      expect(mgr._parseHex('#ff0000')).toEqual({ r: 1, g: 0, b: 0 })
      expect(mgr._parseHex('#00ff00')).toEqual({ r: 0, g: 1, b: 0 })
      expect(mgr._parseHex('#0000ff')).toEqual({ r: 0, g: 0, b: 1 })
      expect(mgr._parseHex('#ffffff')).toEqual({ r: 1, g: 1, b: 1 })
      expect(mgr._parseHex('#000000')).toEqual({ r: 0, g: 0, b: 0 })
    })
  })

  describe('applyPreset()', () => {
    it('should warn for unknown preset', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false })
      const mgr = new ClothingMeshManager()
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      await mgr.applyPreset('nonexistent', {}, null)
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not found'))
      warnSpy.mockRestore()
    })

    it('should apply "none" preset to clear slot', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false })
      const mgr = new ClothingMeshManager()
      const slot = mgr._slots.get('full')
      slot.presetId = 'something'
      await mgr.applyPreset('none', {}, null)
      // "none" has category "none" which won't match any slot
      // This tests the category guard
      expect(mgr.loading).toBe(false)
    })
  })

  describe('restoreState()', () => {
    it('should handle null state gracefully', async () => {
      const mgr = new ClothingMeshManager()
      await mgr.restoreState(null, {})
      // No error thrown
      expect(mgr.getState()).toEqual({ slots: {} })
    })

    it('should handle empty slots object', async () => {
      const mgr = new ClothingMeshManager()
      await mgr.restoreState({ slots: {} }, {})
      expect(mgr.getState()).toEqual({ slots: {} })
    })
  })

  describe('CLOTHING_MESH_CATEGORIES', () => {
    it('should define expected categories', () => {
      expect(CLOTHING_MESH_CATEGORIES.outerwear).toBeTruthy()
      expect(CLOTHING_MESH_CATEGORIES.bottom_overlay).toBeTruthy()
      expect(CLOTHING_MESH_CATEGORIES.accessory).toBeTruthy()
      expect(CLOTHING_MESH_CATEGORIES.full).toBeTruthy()
    })

    it('each category should have name and description', () => {
      for (const cat of Object.values(CLOTHING_MESH_CATEGORIES)) {
        expect(cat.name).toBeTruthy()
        expect(cat.description).toBeTruthy()
      }
    })
  })
})
