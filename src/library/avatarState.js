/**
 * AvatarState — Centralized state serialization for VRM avatar customization.
 *
 * Manages save/load/reset of all avatar parameters:
 * - Body slider values (height, armLength, etc.)
 * - Face type, face params, face param strength
 * - Hair style, bangs, color, opacity
 * - Clothing outfit, character variant
 * - Texture variant selections (iris, brow, etc.)
 * - Expression morph targets
 *
 * Immutable design: all setters return void but create new internal copies.
 */

const STATE_VERSION = 1;

/**
 * Default empty state snapshot.
 * @returns {Object}
 */
function createDefaultState() {
  return {
    version: STATE_VERSION,
    body: {},
    face: {
      faceType: null,
      faceParams: {},
      faceParamStrength: 0.5,
    },
    hair: {
      mainStyle: "none",
      bangsStyle: "none",
      color: null,
      opacity: 1.0,
      outlineWidth: 0,
    },
    clothing: {
      outfit: null,
      characterVariant: null,
      pieces: { tops: false, bottoms: false, shoes: false },
    },
    textures: {},
    expressions: {},
  };
}

export class AvatarState {
  constructor() {
    /** @private */
    this._state = createDefaultState();
  }

  // ── Getters ────────────────────────────────────────────────────────

  /**
   * Get a deep copy of the current state snapshot.
   * @returns {Object}
   */
  getSnapshot() {
    return JSON.parse(JSON.stringify(this._state));
  }

  // ── Body ───────────────────────────────────────────────────────────

  /**
   * Set body slider values.
   * @param {Object<string, number>} values
   */
  setBody(values) {
    this._state = {
      ...this._state,
      body: { ...values },
    };
  }

  /**
   * Reset body sliders to empty.
   */
  resetBody() {
    this._state = {
      ...this._state,
      body: {},
    };
  }

  // ── Face ───────────────────────────────────────────────────────────

  /**
   * Set active face type.
   * @param {string|null} typeId
   */
  setFaceType(typeId) {
    this._state = {
      ...this._state,
      face: { ...this._state.face, faceType: typeId },
    };
  }

  /**
   * Set face parameter values.
   * @param {Object<string, number>} params
   */
  setFaceParams(params) {
    this._state = {
      ...this._state,
      face: { ...this._state.face, faceParams: { ...params } },
    };
  }

  /**
   * Set face parameter strength multiplier.
   * @param {number} strength
   */
  setFaceParamStrength(strength) {
    this._state = {
      ...this._state,
      face: { ...this._state.face, faceParamStrength: strength },
    };
  }

  // ── Hair ───────────────────────────────────────────────────────────

  /**
   * Set hair style and bangs.
   * @param {{ mainStyle?: string, bangsStyle?: string }} hairData
   */
  setHair(hairData) {
    this._state = {
      ...this._state,
      hair: { ...this._state.hair, ...hairData },
    };
  }

  /**
   * Set hair color channels.
   * @param {{ base: string, shade: string, outline: string }|null} color
   */
  setHairColor(color) {
    this._state = {
      ...this._state,
      hair: { ...this._state.hair, color: color ? { ...color } : null },
    };
  }

  /**
   * Set hair opacity.
   * @param {number} opacity
   */
  setHairOpacity(opacity) {
    this._state = {
      ...this._state,
      hair: { ...this._state.hair, opacity },
    };
  }

  // ── Clothing ───────────────────────────────────────────────────────

  /**
   * Set active outfit.
   * @param {string|null} outfitId
   */
  setOutfit(outfitId) {
    this._state = {
      ...this._state,
      clothing: { ...this._state.clothing, outfit: outfitId },
    };
  }

  /**
   * Set character variant.
   * @param {string|null} variantId
   */
  setCharacterVariant(variantId) {
    this._state = {
      ...this._state,
      clothing: { ...this._state.clothing, characterVariant: variantId },
    };
  }

  // ── Textures ───────────────────────────────────────────────────────

  /**
   * Set a texture variant for a category.
   * @param {string} category - e.g. "iris", "brow"
   * @param {string|null} variantId
   */
  setTextureVariant(category, variantId) {
    this._state = {
      ...this._state,
      textures: { ...this._state.textures, [category]: variantId },
    };
  }

  // ── Expressions ────────────────────────────────────────────────────

  /**
   * Set expression morph values.
   * @param {Object<string, number>} values
   */
  setExpressions(values) {
    this._state = {
      ...this._state,
      expressions: { ...values },
    };
  }

  // ── Reset ──────────────────────────────────────────────────────────

  /**
   * Reset all state to defaults.
   */
  resetAll() {
    this._state = createDefaultState();
  }

  // ── Serialization ──────────────────────────────────────────────────

  /**
   * Serialize state to JSON string.
   * @returns {string}
   */
  toJSON() {
    return JSON.stringify(this._state, null, 2);
  }

  /**
   * Deserialize state from JSON string.
   * Returns a new AvatarState instance.
   * @param {string} json
   * @returns {AvatarState}
   */
  static fromJSON(json) {
    const instance = new AvatarState();
    try {
      const parsed = JSON.parse(json);
      if (parsed && typeof parsed === "object") {
        const defaults = createDefaultState();
        instance._state = {
          version: parsed.version || STATE_VERSION,
          body: parsed.body || defaults.body,
          face: {
            ...defaults.face,
            ...(parsed.face || {}),
            faceParams: parsed.face?.faceParams || {},
          },
          hair: {
            ...defaults.hair,
            ...(parsed.hair || {}),
          },
          clothing: {
            ...defaults.clothing,
            ...(parsed.clothing || {}),
          },
          textures: parsed.textures || defaults.textures,
          expressions: parsed.expressions || defaults.expressions,
        };
      }
    } catch {
      // Return default state on parse error
    }
    return instance;
  }
}
