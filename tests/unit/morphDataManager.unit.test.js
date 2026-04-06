import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock THREE and loaders before importing the module
vi.mock('three', () => ({
  default: {},
  Vector3: class { constructor(x=0,y=0,z=0) { this.x=x; this.y=y; this.z=z } },
  Matrix4: class { clone() { return this } },
  Quaternion: class { constructor() { this.x=0; this.y=0; this.z=0; this.w=1 } },
  Euler: class { constructor() { this.x=0; this.y=0; this.z=0 } },
  TextureLoader: class { load() {} },
  SRGBColorSpace: 'srgb',
  LinearSRGBColorSpace: 'srgb-linear',
}))

let MorphDataManager

beforeEach(async () => {
  const mod = await import('../../src/library/morphDataManager.js')
  MorphDataManager = mod.MorphDataManager
})

describe('MorphDataManager', () => {
  describe('getFullState()', () => {
    it('should return object with body and face keys', () => {
      const mgr = new MorphDataManager()
      const state = mgr.getFullState()
      expect(state).toHaveProperty('body')
      expect(state).toHaveProperty('face')
      expect(Object.keys(state)).toEqual(['body', 'face'])
    })

    it('body should be a copy of sliderValues (not a reference)', () => {
      const mgr = new MorphDataManager()
      mgr.sliderValues = { height: 0.5, armLength: -0.3 }

      const state = mgr.getFullState()
      expect(state.body).toEqual({ height: 0.5, armLength: -0.3 })

      // Mutating the returned body should not affect internal sliderValues
      state.body.height = 999
      expect(mgr.sliderValues.height).toBe(0.5)
    })

    it('face should have faceType, faceParams, faceParamStrength', () => {
      const mgr = new MorphDataManager()
      const state = mgr.getFullState()
      expect(state.face).toHaveProperty('faceType')
      expect(state.face).toHaveProperty('faceParams')
      expect(state.face).toHaveProperty('faceParamStrength')
    })

    it('default faceParamStrength should be 0.5', () => {
      const mgr = new MorphDataManager()
      const state = mgr.getFullState()
      expect(state.face.faceParamStrength).toBe(0.5)
    })

    it('faceParams should be a copy (not a reference)', () => {
      const mgr = new MorphDataManager()
      mgr.faceParamValues = { eyeSize: 0.7, noseHeight: -0.2 }

      const state = mgr.getFullState()
      expect(state.face.faceParams).toEqual({ eyeSize: 0.7, noseHeight: -0.2 })

      // Mutating returned faceParams should not affect internal faceParamValues
      state.face.faceParams.eyeSize = 999
      expect(mgr.faceParamValues.eyeSize).toBe(0.7)
    })

    it('default faceType should be null', () => {
      const mgr = new MorphDataManager()
      const state = mgr.getFullState()
      expect(state.face.faceType).toBeNull()
    })

    it('default body should be an empty object', () => {
      const mgr = new MorphDataManager()
      const state = mgr.getFullState()
      expect(state.body).toEqual({})
    })

    it('default faceParams should be an empty object', () => {
      const mgr = new MorphDataManager()
      const state = mgr.getFullState()
      expect(state.face.faceParams).toEqual({})
    })

    it('should reflect slider values set on the instance', () => {
      const mgr = new MorphDataManager()
      mgr.sliderValues = { headSize: 0.3, legLength: -0.5, footSize: 0.1 }
      mgr.activeFaceType = '7'
      mgr.faceParamValues = { eyeWidth: 0.4 }
      mgr.faceParamStrength = 0.8

      const state = mgr.getFullState()
      expect(state.body).toEqual({ headSize: 0.3, legLength: -0.5, footSize: 0.1 })
      expect(state.face.faceType).toBe('7')
      expect(state.face.faceParams).toEqual({ eyeWidth: 0.4 })
      expect(state.face.faceParamStrength).toBe(0.8)
    })
  })
})
