import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * TDD tests for AvatarState — centralized state serialization for
 * save/load/reset of all avatar customization (body, face, hair, clothing, textures).
 */

// Will be implemented in src/library/avatarState.js
let AvatarState

beforeEach(async () => {
  const mod = await import('../../src/library/avatarState.js')
  AvatarState = mod.AvatarState
})

describe('AvatarState', () => {
  describe('constructor', () => {
    it('should create an instance with default empty state', () => {
      const state = new AvatarState()
      expect(state).toBeDefined()
      const snapshot = state.getSnapshot()
      expect(snapshot).toHaveProperty('body')
      expect(snapshot).toHaveProperty('face')
      expect(snapshot).toHaveProperty('hair')
      expect(snapshot).toHaveProperty('clothing')
      expect(snapshot).toHaveProperty('textures')
      expect(snapshot).toHaveProperty('expressions')
    })
  })

  describe('body sliders', () => {
    it('should store body slider values', () => {
      const state = new AvatarState()
      state.setBody({ height: 0.5, armLength: -0.3 })
      const snap = state.getSnapshot()
      expect(snap.body).toEqual({ height: 0.5, armLength: -0.3 })
    })

    it('should reset body to empty', () => {
      const state = new AvatarState()
      state.setBody({ height: 0.5 })
      state.resetBody()
      expect(state.getSnapshot().body).toEqual({})
    })
  })

  describe('face state', () => {
    it('should store face type', () => {
      const state = new AvatarState()
      state.setFaceType('12')
      expect(state.getSnapshot().face.faceType).toBe('12')
    })

    it('should store face param values', () => {
      const state = new AvatarState()
      state.setFaceParams({ eyeSize: 0.5, noseHeight: -0.2 })
      expect(state.getSnapshot().face.faceParams).toEqual({ eyeSize: 0.5, noseHeight: -0.2 })
    })

    it('should store face param strength', () => {
      const state = new AvatarState()
      state.setFaceParamStrength(0.7)
      expect(state.getSnapshot().face.faceParamStrength).toBe(0.7)
    })
  })

  describe('hair state', () => {
    it('should store hair style and bangs', () => {
      const state = new AvatarState()
      state.setHair({ mainStyle: 'A', bangsStyle: 'FA' })
      const snap = state.getSnapshot()
      expect(snap.hair.mainStyle).toBe('A')
      expect(snap.hair.bangsStyle).toBe('FA')
    })

    it('should store hair color channels', () => {
      const state = new AvatarState()
      state.setHairColor({ base: '#FF0000', shade: '#990000', outline: '#330000' })
      expect(state.getSnapshot().hair.color).toEqual({
        base: '#FF0000', shade: '#990000', outline: '#330000'
      })
    })

    it('should store hair opacity', () => {
      const state = new AvatarState()
      state.setHairOpacity(0.8)
      expect(state.getSnapshot().hair.opacity).toBe(0.8)
    })
  })

  describe('clothing state', () => {
    it('should store active outfit', () => {
      const state = new AvatarState()
      state.setOutfit('B')
      expect(state.getSnapshot().clothing.outfit).toBe('B')
    })

    it('should store character variant', () => {
      const state = new AvatarState()
      state.setCharacterVariant('E')
      expect(state.getSnapshot().clothing.characterVariant).toBe('E')
    })
  })

  describe('texture state', () => {
    it('should store texture variant selections', () => {
      const state = new AvatarState()
      state.setTextureVariant('iris', '3')
      state.setTextureVariant('brow', '2')
      const snap = state.getSnapshot()
      expect(snap.textures.iris).toBe('3')
      expect(snap.textures.brow).toBe('2')
    })
  })

  describe('expression state', () => {
    it('should store expression morph values', () => {
      const state = new AvatarState()
      state.setExpressions({ Fcl_ALL_Joy: 0.8, Fcl_EYE_Close: 0.5 })
      expect(state.getSnapshot().expressions).toEqual({
        Fcl_ALL_Joy: 0.8, Fcl_EYE_Close: 0.5
      })
    })
  })

  describe('serialization', () => {
    it('should serialize to JSON string', () => {
      const state = new AvatarState()
      state.setBody({ height: 0.5 })
      state.setHair({ mainStyle: 'B', bangsStyle: 'none' })
      const json = state.toJSON()
      expect(typeof json).toBe('string')
      const parsed = JSON.parse(json)
      expect(parsed.body.height).toBe(0.5)
      expect(parsed.hair.mainStyle).toBe('B')
    })

    it('should deserialize from JSON string', () => {
      const original = new AvatarState()
      original.setBody({ height: 0.5 })
      original.setFaceType('7')
      original.setOutfit('A')
      const json = original.toJSON()

      const restored = AvatarState.fromJSON(json)
      const snap = restored.getSnapshot()
      expect(snap.body.height).toBe(0.5)
      expect(snap.face.faceType).toBe('7')
      expect(snap.clothing.outfit).toBe('A')
    })

    it('should handle invalid JSON gracefully', () => {
      expect(() => AvatarState.fromJSON('not json')).not.toThrow()
      const state = AvatarState.fromJSON('not json')
      expect(state).toBeInstanceOf(AvatarState)
    })

    it('should include version in serialized output', () => {
      const state = new AvatarState()
      const parsed = JSON.parse(state.toJSON())
      expect(parsed).toHaveProperty('version')
    })
  })

  describe('full reset', () => {
    it('should reset all state to defaults', () => {
      const state = new AvatarState()
      state.setBody({ height: 0.5 })
      state.setFaceType('12')
      state.setHair({ mainStyle: 'C', bangsStyle: 'FB' })
      state.setOutfit('B')
      state.setTextureVariant('iris', '2')
      state.setExpressions({ Fcl_ALL_Joy: 1 })

      state.resetAll()

      const snap = state.getSnapshot()
      expect(snap.body).toEqual({})
      expect(snap.face.faceType).toBeNull()
      expect(snap.face.faceParams).toEqual({})
      expect(snap.hair.mainStyle).toBe('none')
      expect(snap.hair.bangsStyle).toBe('none')
      expect(snap.hair.color).toBeNull()
      expect(snap.clothing.outfit).toBeNull()
      expect(snap.textures).toEqual({})
      expect(snap.expressions).toEqual({})
    })
  })
})
