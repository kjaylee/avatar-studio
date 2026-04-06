import { describe, it, expect, beforeEach } from 'vitest'

/**
 * Roundtrip tests for AvatarState — verifies that toJSON -> fromJSON -> getSnapshot
 * preserves all state fields accurately.
 */

let AvatarState

beforeEach(async () => {
  const mod = await import('../../src/library/avatarState.js')
  AvatarState = mod.AvatarState
})

describe('AvatarState roundtrip (save -> load)', () => {
  it('should roundtrip all state fields via toJSON -> fromJSON -> getSnapshot', () => {
    const original = new AvatarState()
    original.setBody({ height: 0.5, armLength: -0.3, headSize: 0.1 })
    original.setFaceType('12')
    original.setFaceParams({ eyeSize: 0.6, noseHeight: -0.4 })
    original.setFaceParamStrength(0.8)
    original.setHair({ mainStyle: 'B', bangsStyle: 'FA' })
    original.setHairColor({ base: '#FF0000', shade: '#990000', outline: '#330000' })
    original.setHairOpacity(0.7)
    original.setOutfit('A')
    original.setCharacterVariant('E')
    original.setTextureVariant('iris', '3')
    original.setTextureVariant('brow', '2')
    original.setExpressions({ Fcl_ALL_Joy: 0.8, Fcl_EYE_Close: 0.5 })

    const json = original.toJSON()
    const restored = AvatarState.fromJSON(json)
    const snap = restored.getSnapshot()
    const origSnap = original.getSnapshot()

    expect(snap).toEqual(origSnap)
  })

  describe('body roundtrip', () => {
    it('should preserve body slider values', () => {
      const state = new AvatarState()
      state.setBody({ height: 0.5, armLength: -0.3, footSize: 0.1 })

      const restored = AvatarState.fromJSON(state.toJSON())
      expect(restored.getSnapshot().body).toEqual({ height: 0.5, armLength: -0.3, footSize: 0.1 })
    })

    it('should preserve empty body', () => {
      const state = new AvatarState()
      const restored = AvatarState.fromJSON(state.toJSON())
      expect(restored.getSnapshot().body).toEqual({})
    })
  })

  describe('face roundtrip', () => {
    it('should preserve faceType', () => {
      const state = new AvatarState()
      state.setFaceType('7')

      const restored = AvatarState.fromJSON(state.toJSON())
      expect(restored.getSnapshot().face.faceType).toBe('7')
    })

    it('should preserve faceParams', () => {
      const state = new AvatarState()
      state.setFaceParams({ eyeSize: 0.5, noseHeight: -0.2 })

      const restored = AvatarState.fromJSON(state.toJSON())
      expect(restored.getSnapshot().face.faceParams).toEqual({ eyeSize: 0.5, noseHeight: -0.2 })
    })

    it('should preserve faceParamStrength', () => {
      const state = new AvatarState()
      state.setFaceParamStrength(0.3)

      const restored = AvatarState.fromJSON(state.toJSON())
      expect(restored.getSnapshot().face.faceParamStrength).toBe(0.3)
    })

    it('should preserve default faceParamStrength of 0.5', () => {
      const state = new AvatarState()
      const restored = AvatarState.fromJSON(state.toJSON())
      expect(restored.getSnapshot().face.faceParamStrength).toBe(0.5)
    })

    it('should preserve null faceType', () => {
      const state = new AvatarState()
      const restored = AvatarState.fromJSON(state.toJSON())
      expect(restored.getSnapshot().face.faceType).toBeNull()
    })
  })

  describe('hair roundtrip', () => {
    it('should preserve mainStyle and bangsStyle', () => {
      const state = new AvatarState()
      state.setHair({ mainStyle: 'C', bangsStyle: 'FB' })

      const restored = AvatarState.fromJSON(state.toJSON())
      const snap = restored.getSnapshot()
      expect(snap.hair.mainStyle).toBe('C')
      expect(snap.hair.bangsStyle).toBe('FB')
    })

    it('should preserve color object', () => {
      const state = new AvatarState()
      state.setHairColor({ base: '#00FF00', shade: '#009900', outline: '#003300' })

      const restored = AvatarState.fromJSON(state.toJSON())
      expect(restored.getSnapshot().hair.color).toEqual({
        base: '#00FF00', shade: '#009900', outline: '#003300'
      })
    })

    it('should preserve opacity', () => {
      const state = new AvatarState()
      state.setHairOpacity(0.6)

      const restored = AvatarState.fromJSON(state.toJSON())
      expect(restored.getSnapshot().hair.opacity).toBe(0.6)
    })

    it('should preserve default hair values', () => {
      const state = new AvatarState()
      const restored = AvatarState.fromJSON(state.toJSON())
      const snap = restored.getSnapshot()
      expect(snap.hair.mainStyle).toBe('none')
      expect(snap.hair.bangsStyle).toBe('none')
      expect(snap.hair.color).toBeNull()
      expect(snap.hair.opacity).toBe(1.0)
    })
  })

  describe('clothing roundtrip', () => {
    it('should preserve outfit', () => {
      const state = new AvatarState()
      state.setOutfit('B')

      const restored = AvatarState.fromJSON(state.toJSON())
      expect(restored.getSnapshot().clothing.outfit).toBe('B')
    })

    it('should preserve characterVariant', () => {
      const state = new AvatarState()
      state.setCharacterVariant('G')

      const restored = AvatarState.fromJSON(state.toJSON())
      expect(restored.getSnapshot().clothing.characterVariant).toBe('G')
    })

    it('should preserve null outfit and variant', () => {
      const state = new AvatarState()
      const restored = AvatarState.fromJSON(state.toJSON())
      const snap = restored.getSnapshot()
      expect(snap.clothing.outfit).toBeNull()
      expect(snap.clothing.characterVariant).toBeNull()
    })
  })

  describe('textures roundtrip', () => {
    it('should preserve texture variant selections', () => {
      const state = new AvatarState()
      state.setTextureVariant('iris', '3')
      state.setTextureVariant('brow', '2')
      state.setTextureVariant('mouth', '1')

      const restored = AvatarState.fromJSON(state.toJSON())
      const snap = restored.getSnapshot()
      expect(snap.textures.iris).toBe('3')
      expect(snap.textures.brow).toBe('2')
      expect(snap.textures.mouth).toBe('1')
    })

    it('should preserve empty textures', () => {
      const state = new AvatarState()
      const restored = AvatarState.fromJSON(state.toJSON())
      expect(restored.getSnapshot().textures).toEqual({})
    })
  })

  describe('expressions roundtrip', () => {
    it('should preserve expression morph values', () => {
      const state = new AvatarState()
      state.setExpressions({ Fcl_ALL_Joy: 0.8, Fcl_EYE_Close: 0.5 })

      const restored = AvatarState.fromJSON(state.toJSON())
      expect(restored.getSnapshot().expressions).toEqual({
        Fcl_ALL_Joy: 0.8, Fcl_EYE_Close: 0.5
      })
    })

    it('should preserve empty expressions', () => {
      const state = new AvatarState()
      const restored = AvatarState.fromJSON(state.toJSON())
      expect(restored.getSnapshot().expressions).toEqual({})
    })
  })

  describe('edge cases', () => {
    it('should handle empty/null values surviving roundtrip', () => {
      const state = new AvatarState()
      // Set some values to null explicitly
      state.setFaceType(null)
      state.setHairColor(null)
      state.setOutfit(null)
      state.setCharacterVariant(null)

      const restored = AvatarState.fromJSON(state.toJSON())
      const snap = restored.getSnapshot()
      expect(snap.face.faceType).toBeNull()
      expect(snap.hair.color).toBeNull()
      expect(snap.clothing.outfit).toBeNull()
      expect(snap.clothing.characterVariant).toBeNull()
    })

    it('should return defaults for malformed JSON', () => {
      const restored = AvatarState.fromJSON('this is not valid json {{{}')
      const snap = restored.getSnapshot()

      // Should get clean default state
      expect(snap.body).toEqual({})
      expect(snap.face.faceType).toBeNull()
      expect(snap.face.faceParams).toEqual({})
      expect(snap.face.faceParamStrength).toBe(0.5)
      expect(snap.hair.mainStyle).toBe('none')
      expect(snap.hair.bangsStyle).toBe('none')
      expect(snap.hair.color).toBeNull()
      expect(snap.hair.opacity).toBe(1.0)
      expect(snap.clothing.outfit).toBeNull()
      expect(snap.clothing.characterVariant).toBeNull()
      expect(snap.textures).toEqual({})
      expect(snap.expressions).toEqual({})
    })

    it('should return defaults for empty string JSON', () => {
      const restored = AvatarState.fromJSON('')
      const snap = restored.getSnapshot()
      expect(snap.body).toEqual({})
      expect(snap.face.faceParamStrength).toBe(0.5)
    })

    it('should preserve version field', () => {
      const state = new AvatarState()
      const json = state.toJSON()
      const parsed = JSON.parse(json)
      expect(parsed.version).toBeDefined()

      const restored = AvatarState.fromJSON(json)
      const snap = restored.getSnapshot()
      expect(snap.version).toBe(parsed.version)
    })

    it('should not throw for JSON with missing sections', () => {
      const partial = JSON.stringify({ version: 1, body: { height: 0.5 } })
      const restored = AvatarState.fromJSON(partial)
      const snap = restored.getSnapshot()
      expect(snap.body.height).toBe(0.5)
      // Missing sections should get defaults
      expect(snap.face.faceParamStrength).toBe(0.5)
      expect(snap.hair.mainStyle).toBe('none')
      expect(snap.clothing.outfit).toBeNull()
    })
  })
})
