/**
 * MorphDataManager - Core parametric deformation engine for VRM Studio
 *
 * Loads morph_deltas.json (vertex deltas) and vroid_bone_factors.json (bone transforms)
 * and applies them based on slider values to deform a VRM character in real-time.
 *
 * Data sources (from vrm-avatar project):
 *   - morph_deltas.json: 23 body params, Face (4709 verts) + Body (6578 verts)
 *   - vroid_bone_factors.json: 7 params, up to 98 bones per param
 */

import * as THREE from "three";

// VRM humanoid bone name → Three.js bone name mapping
const HUMANOID_BONE_MAP = {
  hips: "J_Bip_C_Hips",
  spine: "J_Bip_C_Spine",
  chest: "J_Bip_C_Chest",
  upperChest: "J_Bip_C_UpperChest",
  neck: "J_Bip_C_Neck",
  head: "J_Bip_C_Head",
  leftEye: "J_Adj_L_FaceEye",
  rightEye: "J_Adj_R_FaceEye",
  leftUpperArm: "J_Bip_L_UpperArm",
  rightUpperArm: "J_Bip_R_UpperArm",
  leftLowerArm: "J_Bip_L_LowerArm",
  rightLowerArm: "J_Bip_R_LowerArm",
  leftHand: "J_Bip_L_Hand",
  rightHand: "J_Bip_R_Hand",
  leftUpperLeg: "J_Bip_L_UpperLeg",
  rightUpperLeg: "J_Bip_R_UpperLeg",
  leftLowerLeg: "J_Bip_L_LowerLeg",
  rightLowerLeg: "J_Bip_R_LowerLeg",
  leftFoot: "J_Bip_L_Foot",
  rightFoot: "J_Bip_R_Foot",
  leftToes: "J_Bip_L_ToeBase",
  rightToes: "J_Bip_R_ToeBase",
  leftShoulder: "J_Bip_L_Shoulder",
  rightShoulder: "J_Bip_R_Shoulder",
  // Finger bones
  leftThumbMetacarpal: "J_Bip_L_Thumb1",
  leftThumbProximal: "J_Bip_L_Thumb2",
  leftThumbDistal: "J_Bip_L_Thumb3",
  leftIndexProximal: "J_Bip_L_Index1",
  leftIndexIntermediate: "J_Bip_L_Index2",
  leftIndexDistal: "J_Bip_L_Index3",
  leftMiddleProximal: "J_Bip_L_Middle1",
  leftMiddleIntermediate: "J_Bip_L_Middle2",
  leftMiddleDistal: "J_Bip_L_Middle3",
  leftRingProximal: "J_Bip_L_Ring1",
  leftRingIntermediate: "J_Bip_L_Ring2",
  leftRingDistal: "J_Bip_L_Ring3",
  leftLittleProximal: "J_Bip_L_Little1",
  leftLittleIntermediate: "J_Bip_L_Little2",
  leftLittleDistal: "J_Bip_L_Little3",
  rightThumbMetacarpal: "J_Bip_R_Thumb1",
  rightThumbProximal: "J_Bip_R_Thumb2",
  rightThumbDistal: "J_Bip_R_Thumb3",
  rightIndexProximal: "J_Bip_R_Index1",
  rightIndexIntermediate: "J_Bip_R_Index2",
  rightIndexDistal: "J_Bip_R_Index3",
  rightMiddleProximal: "J_Bip_R_Middle1",
  rightMiddleIntermediate: "J_Bip_R_Middle2",
  rightMiddleDistal: "J_Bip_R_Middle3",
  rightRingProximal: "J_Bip_R_Ring1",
  rightRingIntermediate: "J_Bip_R_Ring2",
  rightRingDistal: "J_Bip_R_Ring3",
  rightLittleProximal: "J_Bip_R_Little1",
  rightLittleIntermediate: "J_Bip_R_Little2",
  rightLittleDistal: "J_Bip_R_Little3",
};

// Slider parameter categories for UI grouping
export const PARAM_CATEGORIES = {
  "Body Size": [
    "heightFemale",
    "heightMale",
    "bodySize",
    "torsoLength",
  ],
  Head: [
    "headSize",
    "headWidth",
    "crownHeight",
  ],
  Neck: [
    "neckLength",
    "neckWidth",
    "neckFrontWidth",
    "neckEmphasis",
  ],
  Shoulder: [
    "shoulderWidth",
    "clavicleLowering",
  ],
  Chest: [
    "chestSize",
    "chestDepth",
    "chestVerticalDirection",
    "chestSpread",
  ],
  Arms: [
    "armLength",
    "handSize",
    "fingerThickness",
  ],
  Lower: [
    "waistSize",
    "legLength",
    "footSize",
  ],
  Eyes: [
    "eyeHeight",
    "eyeWidth",
    "eyeSpacing",
    "eyeRotation",
    "eyePositionY",
    "eyeInnerCornerHeight",
  ],
};

// Face parameter categories (from VRoid face_param_deltas)
export const FACE_PARAM_CATEGORIES = {
  "Eye Shape": [
    "eyeWidth", "eyeHeight", "eyePositionY", "eyeSpacing", "eyeRotation",
    "eyeInnerCornerHeight", "eyeInnerCornerCurve", "eyeOuterCornerHeight",
    "eyeShapeFemale", "eyeShapeMale",
  ],
  Eyelids: [
    "upperEyelidStraight", "lowerEyelidStraight",
    "upperEyelidLower", "lowerEyelidRaise",
    "halfClosedEyes", "droopyEyes", "lowerLashDirection",
  ],
  Pupils: [
    "pupilWidth", "pupilHeight", "gazeVertical", "gazeDistance",
  ],
  Eyebrows: [
    "browTilt", "browHeight", "browSpacing", "browDepth",
    "browRotation", "browHeightScale", "browWidthScale",
    "browShapeFemale", "browShapeMale",
  ],
  Nose: [
    "noseHeight", "noseWidth", "noseTipUp", "noseBridgeWidth",
    "noseStartLower", "nostrilWidth", "nostrilCurve",
    "noseOverallHeight", "noseTipHeight", "noseDepth",
    "noseShapeFemale", "noseShapeMale",
  ],
  Mouth: [
    "mouthWidth", "lipHeight", "mouthCornerHeight", "mouthDepth",
    "lipThickness",
    "upperLipThicknessFemale", "lowerLipThicknessFemale",
    "upperLipThicknessMale", "lowerLipThicknessMale",
    "mouthShapeFemale", "mouthShapeMale",
  ],
  Cheeks: [
    "cheekHeight", "cheekDepth", "lowerCheekFullness",
    "cheekFullness", "cheekFullnessRight", "cheekFullnessLeft",
  ],
  "Jaw & Chin": [
    "chinRoundness", "chinLower", "chinHeight", "chinDepth",
    "chinWidth", "chinSize",
    "contourShapeFemale", "contourShapeMale",
  ],
  Ears: [
    "earSize", "earVerticalPosition", "earWidthExpand",
    "earRotation", "earRoundness", "hideEars",
  ],
  Teeth: [
    "hideTeeth", "hideLowerTeeth", "hideUpperTeeth",
    "shortTeeth", "shortLowerTeeth", "shortUpperTeeth",
    "dimple1", "dimple1Lower", "dimple1Upper",
    "dimple2", "dimple2Lower", "dimple2Upper",
    "dimple3", "dimple3Lower", "dimple3Upper",
  ],
  "Head Shape": [
    "headShapeFemale", "headShapeMale",
  ],
};

// Display names for face parameters
export const FACE_PARAM_DISPLAY_NAMES = {
  // Eye Shape
  eyeWidth: "Eye Width", eyeHeight: "Eye Height", eyePositionY: "Eye Position Y",
  eyeSpacing: "Eye Spacing", eyeRotation: "Eye Rotation",
  eyeInnerCornerHeight: "Inner Corner Height", eyeInnerCornerCurve: "Inner Corner Curve",
  eyeOuterCornerHeight: "Outer Corner Height",
  eyeShapeFemale: "Eye Shape (F)", eyeShapeMale: "Eye Shape (M)",
  // Eyelids
  upperEyelidStraight: "Upper Lid Straight", lowerEyelidStraight: "Lower Lid Straight",
  upperEyelidLower: "Upper Lid Lower", lowerEyelidRaise: "Lower Lid Raise",
  halfClosedEyes: "Half Closed", droopyEyes: "Droopy Eyes",
  lowerLashDirection: "Lower Lash Dir",
  // Pupils
  pupilWidth: "Pupil Width", pupilHeight: "Pupil Height",
  gazeVertical: "Gaze Vertical", gazeDistance: "Gaze Distance",
  // Eyebrows
  browTilt: "Brow Tilt", browHeight: "Brow Height", browSpacing: "Brow Spacing",
  browDepth: "Brow Depth", browRotation: "Brow Rotation",
  browHeightScale: "Brow Height Scale", browWidthScale: "Brow Width Scale",
  browShapeFemale: "Brow Shape (F)", browShapeMale: "Brow Shape (M)",
  // Nose
  noseHeight: "Nose Height", noseWidth: "Nose Width", noseTipUp: "Nose Tip Up",
  noseBridgeWidth: "Bridge Width", noseStartLower: "Bridge Start Lower",
  nostrilWidth: "Nostril Width", nostrilCurve: "Nostril Curve",
  noseOverallHeight: "Overall Height", noseTipHeight: "Tip Height",
  noseDepth: "Nose Depth",
  noseShapeFemale: "Nose Shape (F)", noseShapeMale: "Nose Shape (M)",
  // Mouth
  mouthWidth: "Mouth Width", lipHeight: "Lip Height",
  mouthCornerHeight: "Corner Height", mouthDepth: "Mouth Depth",
  lipThickness: "Lip Thickness",
  upperLipThicknessFemale: "Upper Lip (F)", lowerLipThicknessFemale: "Lower Lip (F)",
  upperLipThicknessMale: "Upper Lip (M)", lowerLipThicknessMale: "Lower Lip (M)",
  mouthShapeFemale: "Mouth Shape (F)", mouthShapeMale: "Mouth Shape (M)",
  // Cheeks
  cheekHeight: "Cheek Height", cheekDepth: "Cheek Depth",
  lowerCheekFullness: "Lower Fullness",
  cheekFullness: "Cheek Fullness", cheekFullnessRight: "Fullness (R)", cheekFullnessLeft: "Fullness (L)",
  // Jaw & Chin
  chinRoundness: "Chin Roundness", chinLower: "Chin Lower",
  chinHeight: "Chin Height", chinDepth: "Chin Depth",
  chinWidth: "Chin Width", chinSize: "Chin Size",
  contourShapeFemale: "Contour (F)", contourShapeMale: "Contour (M)",
  // Ears
  earSize: "Ear Size", earVerticalPosition: "Ear Position",
  earWidthExpand: "Ear Width", earRotation: "Ear Rotation",
  earRoundness: "Ear Roundness", hideEars: "Hide Ears",
  // Teeth
  hideTeeth: "Hide Teeth", hideLowerTeeth: "Hide Lower Teeth", hideUpperTeeth: "Hide Upper Teeth",
  shortTeeth: "Short Teeth", shortLowerTeeth: "Short Lower", shortUpperTeeth: "Short Upper",
  dimple1: "Dimple 1", dimple1Lower: "Dimple 1 Lower", dimple1Upper: "Dimple 1 Upper",
  dimple2: "Dimple 2", dimple2Lower: "Dimple 2 Lower", dimple2Upper: "Dimple 2 Upper",
  dimple3: "Dimple 3", dimple3Lower: "Dimple 3 Lower", dimple3Upper: "Dimple 3 Upper",
  // Head
  headShapeFemale: "Head Shape (F)", headShapeMale: "Head Shape (M)",
};

// Human-readable display names
export const PARAM_DISPLAY_NAMES = {
  heightFemale: "Height (Female)",
  heightMale: "Height (Male)",
  bodySize: "Body Size",
  headSize: "Head Size",
  headWidth: "Head Width",
  crownHeight: "Crown Height",
  neckLength: "Neck Length",
  neckWidth: "Neck Width",
  neckFrontWidth: "Neck Front Width",
  neckEmphasis: "Neck Emphasis",
  clavicleLowering: "Clavicle Lowering",
  shoulderWidth: "Shoulder Width",
  chestSize: "Chest Size",
  chestDepth: "Chest Depth",
  chestVerticalDirection: "Chest Direction",
  chestSpread: "Chest Spread",
  armLength: "Arm Length",
  fingerThickness: "Finger Thickness",
  handSize: "Hand Size",
  torsoLength: "Torso Length",
  waistSize: "Waist Size",
  legLength: "Leg Length",
  footSize: "Foot Size",
  eyeHeight: "Eye Height",
  eyeWidth: "Eye Width",
  eyeSpacing: "Eye Spacing",
  eyeRotation: "Eye Rotation",
  eyePositionY: "Eye Position Y",
  eyeInnerCornerHeight: "Inner Corner Height",
};

export class MorphDataManager {
  constructor() {
    /** @type {Object<string, Object>} param → {meshName: {vertCount, plus, minus}} */
    this.paramDeltas = {};

    /** @type {Object<string, Object>} param → {boneName: {tX,tY,tZ,...: {plus,minus}}} */
    this.boneFactors = {};

    /** @type {Object<string, number>} Current slider values */
    this.sliderValues = {};

    /** @type {boolean} */
    this.loaded = false;

    // Face type system (texture swap)
    /** @type {Object|null} Face texture index */
    this._faceTextureIndex = null;
    /** @type {Map|null} Cached base face textures */
    this._baseTextures = null;
    /** @type {string|null} Currently active face type ID */
    this.activeFaceType = null;

    // Face parameter system (vertex morphs for facial features)
    /** @type {Object|null} face_param_deltas.json data */
    this._faceParamData = null;
    /** @type {Object<string, number>} Face param slider values */
    this.faceParamValues = {};
    /** @type {number} Global strength multiplier for face param deltas (0.0–1.0) */
    this.faceParamStrength = 0.5;
    /** @type {boolean} */
    this.faceParamsLoaded = false;

    // Cached base positions for reset
    this._basePositions = new Map(); // meshName → Float32Array (copy of original)
    this._baseBoneData = new Map(); // boneName → {position, scale, quaternion}

    // Face primitives for face param deltas (all primitives, not just deduplicated)
    // [{posAttr, basePositions, globalOffset}] — maps global vertex index to primitive
    this._facePrimitives = [];

    // Swapped Body_2 geometry (when clothing replaces foot mesh with no_nail.vrm)
    // {posAttr, basePositions: Float32Array, vertexMap: Int32Array}
    this._swappedBody2 = null;
  }

  /**
   * Load morph delta and bone factor data from JSON files.
   * @param {string} morphDeltasUrl - URL to morph_deltas.json
   * @param {string} boneFactorsUrl - URL to vroid_bone_factors.json
   */
  async load(morphDeltasUrl, boneFactorsUrl) {
    const [morphResp, boneResp] = await Promise.all([
      fetch(morphDeltasUrl),
      fetch(boneFactorsUrl),
    ]);

    if (!morphResp.ok) throw new Error(`Failed to load morph deltas: ${morphResp.status}`);
    if (!boneResp.ok) throw new Error(`Failed to load bone factors: ${boneResp.status}`);

    this.paramDeltas = await morphResp.json();
    this.boneFactors = await boneResp.json();

    // Initialize all slider values to 0
    const allParams = new Set([
      ...Object.keys(this.paramDeltas),
      ...Object.keys(this.boneFactors),
    ]);
    for (const param of allParams) {
      this.sliderValues[param] = 0;
    }

    this.loaded = true;
    console.log(
      `[MorphDataManager] Loaded: ${Object.keys(this.paramDeltas).length} morph params, ` +
      `${Object.keys(this.boneFactors).length} bone params`
    );
  }

  /**
   * Get list of all available parameters
   * @returns {string[]}
   */
  getParameters() {
    return Object.keys(this.sliderValues);
  }

  /**
   * Cache the base (undeformed) state of a VRM model.
   * Must be called after loading the base VRM but before applying any morphs.
   *
   * IMPORTANT: VRM meshes have multiple primitives sharing the same position buffer.
   * We deduplicate by tracking the underlying ArrayBuffer to avoid applying deltas
   * multiple times to the same vertex data.
   *
   * @param {THREE.Object3D} vrmScene - The VRM scene root
   */
  cacheBaseState(vrmScene) {
    this._basePositions.clear();
    this._baseBoneData.clear();
    // Maps mesh category ("Face"/"Body") → {posAttr, baseData}
    this._meshAttrMap = new Map();
    this._facePrimitives = [];

    const seenBuffers = new Set();
    let faceGlobalOffset = 0;

    vrmScene.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const posAttr = child.geometry.getAttribute("position");
        if (posAttr) {
          const meshName = this._matchMeshName(child.name);

          // Collect ALL Face primitives for face param deltas
          if (meshName === "Face") {
            this._facePrimitives.push({
              posAttr,
              basePositions: new Float32Array(posAttr.array),
              globalOffset: faceGlobalOffset,
            });
            faceGlobalOffset += posAttr.count;
          }

          // Deduplicate: multiple primitives share the same ArrayBuffer
          const buf = posAttr.array.buffer;
          if (!seenBuffers.has(buf)) {
            seenBuffers.add(buf);
            this._basePositions.set(meshName, new Float32Array(posAttr.array));
            this._meshAttrMap.set(meshName, posAttr);
            console.log(
              `[MorphDataManager] Cached mesh "${meshName}" (from "${child.name}"): ${posAttr.count} verts`
            );
          }
        }
      }
      if (child.isBone) {
        this._baseBoneData.set(child.name, {
          position: child.position.clone(),
          scale: child.scale.clone(),
          quaternion: child.quaternion.clone(),
        });
      }
    });

    if (this._facePrimitives.length > 0) {
      console.log(
        `[MorphDataManager] Cached ${this._facePrimitives.length} face primitives, ` +
        `total ${faceGlobalOffset} vertices for face params`
      );
    }

    console.log(
      `[MorphDataManager] Cached base state: ${this._basePositions.size} meshes, ` +
      `${this._baseBoneData.size} bones`
    );
  }

  /**
   * Set a single slider value and re-apply all morphs.
   * @param {string} paramName
   * @param {number} value - Range: -1.0 to 1.0
   * @param {THREE.Object3D} vrmScene
   */
  setSlider(paramName, value, vrmScene) {
    this.sliderValues[paramName] = Math.max(-1, Math.min(1, value));
    this._applyAll(vrmScene);
  }

  /**
   * Set multiple slider values at once and re-apply.
   * @param {Object<string, number>} values - {paramName: value}
   * @param {THREE.Object3D} vrmScene
   */
  setSliders(values, vrmScene) {
    for (const [param, value] of Object.entries(values)) {
      this.sliderValues[param] = Math.max(-1, Math.min(1, value));
    }
    this._applyAll(vrmScene);
  }

  /**
   * Reset all sliders to 0 and restore base geometry.
   * @param {THREE.Object3D} vrmScene
   */
  reset(vrmScene) {
    for (const param of Object.keys(this.sliderValues)) {
      this.sliderValues[param] = 0;
    }
    this._restoreBase(vrmScene);
  }

  /**
   * Get current slider values as a serializable object.
   * @returns {Object<string, number>}
   */
  exportSliderValues() {
    return { ...this.sliderValues };
  }

  /**
   * Import slider values from a preset.
   * @param {Object<string, number>} preset
   * @param {THREE.Object3D} vrmScene
   */
  importSliderValues(preset, vrmScene) {
    this.setSliders(preset, vrmScene);
  }

  /**
   * Export full state for serialization (body + face).
   * @returns {{ body: Object, face: { faceType: string|null, faceParams: Object, faceParamStrength: number } }}
   */
  getFullState() {
    return {
      body: { ...this.sliderValues },
      face: {
        faceType: this.activeFaceType,
        faceParams: { ...this.faceParamValues },
        faceParamStrength: this.faceParamStrength,
      },
    };
  }

  // ── Swapped Body_2 (clothing foot geometry) ─────────────────────────

  /**
   * Register a swapped Body_2 geometry so morph deltas can be applied to it.
   * Called by TextureSwapManager when clothing replaces foot mesh with no_nail.vrm.
   * @param {THREE.BufferAttribute} posAttr - Position attribute of the swapped geometry
   * @param {Float32Array} basePositions - Copy of the swapped geometry's base positions
   * @param {Int32Array} vertexMap - Maps each swapped vertex index → original Body vertex index
   */
  registerSwappedBody2(posAttr, basePositions, vertexMap) {
    this._swappedBody2 = { posAttr, basePositions, vertexMap };
    console.log(`[MorphDataManager] Registered swapped Body_2: ${posAttr.count} verts`);
    // Re-apply current morphs to include the new geometry
    // (caller should have a vrmScene reference if needed)
  }

  /**
   * Unregister swapped Body_2 geometry (when clothing is removed).
   */
  unregisterSwappedBody2() {
    this._swappedBody2 = null;
    console.log("[MorphDataManager] Unregistered swapped Body_2");
  }

  /**
   * Re-apply all current morphs. Call after registering/unregistering swapped geometry.
   * @param {THREE.Object3D} vrmScene
   */
  reapplyMorphs(vrmScene) {
    if (!this.loaded) return;
    this._applyAll(vrmScene);
  }

  // ── Face Type (Texture Swap) methods ─────────────────────────────────

  /**
   * Load face texture index (lazy, on first use).
   * @param {string} url - URL to face_textures/index.json
   */
  async loadFaceTextureIndex(url) {
    if (this._faceTextureIndex) return;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to load face texture index: ${resp.status}`);
    this._faceTextureIndex = await resp.json();
    console.log(`[MorphDataManager] Face texture index loaded: ${this._faceTextureIndex.faceTypes.length} types`);
  }

  /**
   * Apply a face type by swapping Face mesh textures.
   * Loads 8 PNG textures for the selected face type and replaces material maps.
   * @param {string|null} faceTypeId - e.g. "1" to "52", or null to reset to base
   * @param {THREE.Object3D} vrmScene
   */
  async applyFaceType(faceTypeId, vrmScene) {
    const prevType = this.activeFaceType;
    this.activeFaceType = faceTypeId;

    if (!faceTypeId) {
      // Reset to base textures
      this._restoreBaseTextures(vrmScene);
      return;
    }

    const index = this._faceTextureIndex;
    if (!index) return;

    const basePath = index.basePath || "./vrm-data/face_textures/";
    const slots = index.textureSlots;
    const loader = new THREE.TextureLoader();

    // Collect all Face mesh materials
    const faceMaterials = this._collectFaceMaterials(vrmScene);

    // Cache base textures on first use
    if (!this._baseTextures) {
      this._baseTextures = new Map();
      for (const [slotName, slotInfo] of Object.entries(slots)) {
        const mat = this._findMaterialBySlot(faceMaterials, slotInfo.materialName, slotInfo.materialIndex);
        if (mat?.map && typeof mat.map.clone === "function") {
          this._baseTextures.set(slotName, mat.map.clone());
        } else if (mat?.map) {
          this._baseTextures.set(slotName, mat.map);
        }
      }
      console.log(`[MorphDataManager] Cached ${this._baseTextures.size} base face textures`);
    }

    // Load and apply textures for this face type
    const loadPromises = [];
    for (const [slotName, slotInfo] of Object.entries(slots)) {
      const mat = this._findMaterialBySlot(faceMaterials, slotInfo.materialName, slotInfo.materialIndex);
      if (!mat) continue;

      const url = `${basePath}${faceTypeId}/${slotName}.png`;
      const promise = new Promise((resolve) => {
        loader.load(
          url,
          (texture) => {
            texture.flipY = false; // VRM textures are not flipped
            texture.colorSpace = mat.map?.colorSpace || THREE.SRGBColorSpace;
            texture.wrapS = mat.map?.wrapS || THREE.RepeatWrapping;
            texture.wrapT = mat.map?.wrapT || THREE.RepeatWrapping;
            texture.minFilter = mat.map?.minFilter || THREE.LinearMipmapLinearFilter;
            texture.magFilter = mat.map?.magFilter || THREE.LinearFilter;
            mat.map = texture;
            mat.needsUpdate = true;
            resolve();
          },
          undefined,
          (err) => {
            console.warn(`[MorphDataManager] Failed to load texture: ${url}`, err);
            resolve();
          }
        );
      });
      loadPromises.push(promise);
    }

    await Promise.all(loadPromises);
    console.log(`[MorphDataManager] Face type ${faceTypeId} textures applied`);
  }

  /**
   * Get available face type IDs.
   * @returns {string[]}
   */
  getFaceTypeIds() {
    if (!this._faceTextureIndex) return [];
    return this._faceTextureIndex.faceTypes;
  }

  /**
   * Collect Face mesh materials by name.
   * @private
   * @returns {Map<string, THREE.Material>}
   */
  _collectFaceMaterials(vrmScene) {
    const materials = new Map();
    let primIndex = 0;
    vrmScene.traverse((child) => {
      if (child.isMesh && this._matchMeshName(child.name) === "Face") {
        const mat = child.material;
        if (mat) {
          // Store by material name AND by primitive index
          const name = mat.name || "";
          if (name) materials.set(name, mat);
          materials.set(`__prim_${primIndex}`, mat);
          primIndex++;
        }
      }
    });
    if (materials.size > 0 && !this._faceMatsLogged) {
      this._faceMatsLogged = true;
      const named = Array.from(materials.entries())
        .filter(([k]) => !k.startsWith("__prim_"))
        .map(([k]) => k);
      console.log("[MorphDataManager] Face materials found:", named, `(${primIndex} primitives)`);
    }
    return materials;
  }

  /**
   * Restore base face textures.
   * @private
   */
  _restoreBaseTextures(vrmScene) {
    if (!this._baseTextures || !this._faceTextureIndex) return;
    const faceMaterials = this._collectFaceMaterials(vrmScene);
    const slots = this._faceTextureIndex.textureSlots;

    for (const [slotName, slotInfo] of Object.entries(slots)) {
      const mat = this._findMaterialBySlot(faceMaterials, slotInfo.materialName, slotInfo.materialIndex);
      const baseTex = this._baseTextures.get(slotName);
      if (mat && baseTex) {
        mat.map = typeof baseTex.clone === "function" ? baseTex.clone() : baseTex;
        mat.needsUpdate = true;
      }
    }
    console.log("[MorphDataManager] Restored base face textures");
  }

  /**
   * Find a material by slot info with fuzzy matching.
   * VRM material names may have prefixes like "N00_000_00_".
   * Falls back to primitive index when name matching fails.
   * @private
   * @param {Map} faceMaterials - collected face materials
   * @param {string} slotMaterialName - material name from index.json
   * @param {number} [primIndex] - primitive index fallback
   */
  _findMaterialBySlot(faceMaterials, slotMaterialName, primIndex) {
    // Direct match
    if (faceMaterials.has(slotMaterialName)) {
      return faceMaterials.get(slotMaterialName);
    }
    // Fuzzy: actual name contains the slot name
    for (const [name, mat] of faceMaterials.entries()) {
      if (name.startsWith("__prim_")) continue;
      if (name.includes(slotMaterialName)) {
        return mat;
      }
    }
    // Reverse fuzzy: slot name contains part of actual name
    for (const [name, mat] of faceMaterials.entries()) {
      if (name.startsWith("__prim_")) continue;
      if (slotMaterialName.includes(name)) {
        return mat;
      }
    }
    // Fallback: match by primitive index
    if (primIndex != null) {
      const key = `__prim_${primIndex}`;
      if (faceMaterials.has(key)) {
        return faceMaterials.get(key);
      }
    }
    return null;
  }

  // ── Face Parameter (Vertex Morph) methods ────────────────────────────

  /**
   * Load face parameter deltas (lazy, on first use).
   * @param {string} url - URL to face_param_deltas.json
   */
  async loadFaceParamDeltas(url) {
    if (this._faceParamData) return;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to load face param deltas: ${resp.status}`);
    this._faceParamData = await resp.json();

    // Initialize all face param slider values to 0
    for (const paramName of Object.keys(this._faceParamData.parameters)) {
      this.faceParamValues[paramName] = 0;
    }
    this.faceParamsLoaded = true;
    console.log(
      `[MorphDataManager] Face params loaded: ${Object.keys(this._faceParamData.parameters).length} parameters, ` +
      `${this._faceParamData.vertexCount} vertices`
    );
  }

  /**
   * Get all face parameter names.
   * @returns {string[]}
   */
  getFaceParamNames() {
    if (!this._faceParamData) return [];
    return Object.keys(this._faceParamData.parameters);
  }

  /**
   * Get face parameter metadata (range, prefix).
   * @param {string} paramName
   * @returns {Object|null} { range: [min, max], prefix }
   */
  getFaceParamInfo(paramName) {
    if (!this._faceParamData) return null;
    const p = this._faceParamData.parameters[paramName];
    if (!p) return null;
    return { range: p.range, prefix: p.prefix };
  }

  /**
   * Set a single face parameter slider value and re-apply all morphs.
   * @param {string} paramName
   * @param {number} value - Value within the parameter's range
   * @param {THREE.Object3D} vrmScene
   */
  setFaceParam(paramName, value, vrmScene) {
    const info = this.getFaceParamInfo(paramName);
    if (!info) return;
    this.faceParamValues[paramName] = Math.max(info.range[0], Math.min(info.range[1], value));
    this._applyAll(vrmScene);
  }

  /**
   * Set multiple face parameter values at once.
   * @param {Object<string, number>} values
   * @param {THREE.Object3D} vrmScene
   */
  setFaceParams(values, vrmScene) {
    for (const [param, value] of Object.entries(values)) {
      const info = this.getFaceParamInfo(param);
      if (info) {
        this.faceParamValues[param] = Math.max(info.range[0], Math.min(info.range[1], value));
      }
    }
    this._applyAll(vrmScene);
  }

  /**
   * Reset all face parameter sliders to 0.
   * @param {THREE.Object3D} vrmScene
   */
  resetFaceParams(vrmScene) {
    for (const param of Object.keys(this.faceParamValues)) {
      this.faceParamValues[param] = 0;
    }
    this._applyAll(vrmScene);
  }

  // ── Internal methods ─────────────────────────────────────────────────

  /**
   * Restore meshes and bones to their cached base state.
   * Uses deduplicated mesh map to avoid redundant operations on shared buffers.
   * @private
   */
  _restoreBase(vrmScene) {
    // Restore mesh positions via deduplicated map
    for (const [meshName, basePos] of this._basePositions.entries()) {
      // Skip "Face" — handled separately via _facePrimitives
      if (meshName === "Face" && this._facePrimitives.length > 0) continue;
      const posAttr = this._meshAttrMap.get(meshName);
      if (posAttr) {
        posAttr.array.set(basePos);
        posAttr.needsUpdate = true;
      }
    }

    // Restore ALL face primitives (9 separate buffers, not deduplicated)
    for (const prim of this._facePrimitives) {
      prim.posAttr.array.set(prim.basePositions);
      prim.posAttr.needsUpdate = true;
    }

    // Restore swapped Body_2 base positions (clothing foot geometry)
    if (this._swappedBody2) {
      this._swappedBody2.posAttr.array.set(this._swappedBody2.basePositions);
      this._swappedBody2.posAttr.needsUpdate = true;
    }

    // Restore bones
    vrmScene.traverse((child) => {
      if (child.isBone) {
        const baseData = this._baseBoneData.get(child.name);
        if (baseData) {
          child.position.copy(baseData.position);
          child.scale.copy(baseData.scale);
          child.quaternion.copy(baseData.quaternion);
        }
      }
    });
  }

  /**
   * Apply all current slider values to the VRM model.
   * Strategy: reset to base, then accumulate all active sliders.
   * @private
   */
  _applyAll(vrmScene) {
    // 1. Reset to base state
    this._restoreBase(vrmScene);

    // 2. Accumulate vertex deltas from all active sliders
    this._applyAllVertexMorphs(vrmScene);

    // 3. Accumulate bone transforms from all active sliders
    this._applyAllBoneTransforms(vrmScene);
  }

  /**
   * Apply vertex morphs for all active sliders.
   * Uses deduplicated mesh map — applies once per unique position buffer.
   * @private
   */
  _applyAllVertexMorphs(_vrmScene) {
    // Build a map of mesh → accumulated deltas
    const meshDeltas = new Map(); // meshName → Float32Array of accumulated deltas

    // 1. Accumulate slider deltas
    for (const [param, value] of Object.entries(this.sliderValues)) {
      if (Math.abs(value) < 0.001) continue;
      const paramData = this.paramDeltas[param];
      if (!paramData) continue;

      const direction = value >= 0 ? "plus" : "minus";
      const t = Math.abs(value);

      for (const [meshName, meshData] of Object.entries(paramData)) {
        const indices = meshData[direction]?.indices;
        const deltas = meshData[direction]?.deltas;
        if (!indices || !deltas || indices.length === 0) continue;

        if (!meshDeltas.has(meshName)) {
          meshDeltas.set(meshName, new Float32Array(meshData.vertCount * 3));
        }
        const accumulated = meshDeltas.get(meshName);

        for (let i = 0; i < indices.length; i++) {
          const idx = indices[i];
          const delta = deltas[i];
          accumulated[idx * 3 + 0] += delta[0] * t;
          accumulated[idx * 3 + 1] += delta[1] * t;
          accumulated[idx * 3 + 2] += delta[2] * t;
        }
      }
    }

    // 2. Accumulate face parameter deltas (applied across all Face primitives)
    //    Strength factor compensates for scale difference between extraction base
    //    (Female_default.vrm) and runtime model (girl.vrm).
    if (this._faceParamData && this._facePrimitives.length > 0) {
      const strength = this.faceParamStrength;
      // Build a global accumulator for all face vertices
      const totalFaceVerts = this._faceParamData.vertexCount;
      const faceGlobalAccum = new Float32Array(totalFaceVerts * 3);
      let hasAnyFaceDelta = false;

      for (const [param, value] of Object.entries(this.faceParamValues)) {
        if (Math.abs(value) < 0.001) continue;
        const pdata = this._faceParamData.parameters[param];
        if (!pdata) continue;

        const range = pdata.range;
        let deltaData, t;

        if (value >= 0) {
          deltaData = pdata.max;
          t = range[1] !== 0 ? value / range[1] : 0;
        } else {
          deltaData = pdata.min;
          t = range[0] !== 0 ? value / range[0] : 0;
        }

        if (!deltaData) continue;
        const indices = deltaData.i;
        const vals = deltaData.v;
        hasAnyFaceDelta = true;

        const st = t * strength;
        for (let j = 0; j < indices.length; j++) {
          const idx = indices[j];
          faceGlobalAccum[idx * 3 + 0] += vals[j * 3 + 0] * st;
          faceGlobalAccum[idx * 3 + 1] += vals[j * 3 + 1] * st;
          faceGlobalAccum[idx * 3 + 2] += vals[j * 3 + 2] * st;
        }
      }

      // Distribute global deltas to each face primitive
      if (hasAnyFaceDelta) {
        for (const prim of this._facePrimitives) {
          const { posAttr, globalOffset } = prim;
          for (let i = 0; i < posAttr.count; i++) {
            const gi = globalOffset + i;
            posAttr.array[i * 3 + 0] += faceGlobalAccum[gi * 3 + 0];
            posAttr.array[i * 3 + 1] += faceGlobalAccum[gi * 3 + 1];
            posAttr.array[i * 3 + 2] += faceGlobalAccum[gi * 3 + 2];
          }
          posAttr.needsUpdate = true;
        }
      }
    }

    // Apply accumulated deltas directly via deduplicated posAttr references
    for (const [meshName, deltas] of meshDeltas.entries()) {
      const posAttr = this._meshAttrMap.get(meshName);
      if (!posAttr) continue;

      for (let i = 0; i < posAttr.count; i++) {
        posAttr.array[i * 3 + 0] += deltas[i * 3 + 0];
        posAttr.array[i * 3 + 1] += deltas[i * 3 + 1];
        posAttr.array[i * 3 + 2] += deltas[i * 3 + 2];
      }
      posAttr.needsUpdate = true;
    }

    // Apply mapped deltas to swapped Body_2 geometry (clothing foot mesh)
    if (this._swappedBody2 && meshDeltas.has("Body")) {
      const bodyDeltas = meshDeltas.get("Body");
      const { posAttr, vertexMap } = this._swappedBody2;

      for (let i = 0; i < posAttr.count; i++) {
        const origIdx = vertexMap[i];
        if (origIdx < 0) continue; // unmapped vertex
        posAttr.array[i * 3 + 0] += bodyDeltas[origIdx * 3 + 0];
        posAttr.array[i * 3 + 1] += bodyDeltas[origIdx * 3 + 1];
        posAttr.array[i * 3 + 2] += bodyDeltas[origIdx * 3 + 2];
      }
      posAttr.needsUpdate = true;
    }
  }

  /**
   * Apply bone transforms for all active sliders.
   * @private
   */
  _applyAllBoneTransforms(vrmScene) {
    // Build accumulated bone transforms
    const boneAccum = new Map(); // boneName → {tX,tY,tZ,sX,sY,sZ}

    for (const [param, value] of Object.entries(this.sliderValues)) {
      if (Math.abs(value) < 0.001) continue;
      const paramFactors = this.boneFactors[param];
      if (!paramFactors) continue;

      const direction = value >= 0 ? "plus" : "minus";
      const t = Math.abs(value);

      for (const [boneName, transforms] of Object.entries(paramFactors)) {
        if (!boneAccum.has(boneName)) {
          boneAccum.set(boneName, { tX: 0, tY: 0, tZ: 0, sX: 0, sY: 0, sZ: 0 });
        }
        const accum = boneAccum.get(boneName);

        for (const axis of ["tX", "tY", "tZ"]) {
          if (transforms[axis]?.[direction] != null) {
            accum[axis] += transforms[axis][direction] * t;
          }
        }
        for (const axis of ["sX", "sY", "sZ"]) {
          if (transforms[axis]?.[direction] != null) {
            accum[axis] += transforms[axis][direction] * t;
          }
        }
      }
    }

    // Apply accumulated transforms to bones
    vrmScene.traverse((child) => {
      if (!child.isBone) return;

      // Try both raw name and humanoid mapping
      const accum = boneAccum.get(child.name) ||
                    boneAccum.get(this._reverseMapBone(child.name));
      if (!accum) return;

      child.position.x += accum.tX;
      child.position.y += accum.tY;
      child.position.z += accum.tZ;

      if (accum.sX !== 0) child.scale.x *= 1 + accum.sX;
      if (accum.sY !== 0) child.scale.y *= 1 + accum.sY;
      if (accum.sZ !== 0) child.scale.z *= 1 + accum.sZ;
    });

    // Recompute inverse bind matrices after bone changes.
    // Without this, skinning uses old bone positions → double-applies movement
    // to vertices that already have vertex deltas applied.
    this._updateInverseBindMatrices(vrmScene);
  }

  /**
   * Recompute inverse bind matrices for all skinned meshes.
   * Must be called after modifying bone positions/scales to keep
   * skinning consistent with the new skeleton pose.
   * @private
   */
  _updateInverseBindMatrices(vrmScene) {
    // Force world matrix update from root down
    vrmScene.updateMatrixWorld(true);

    vrmScene.traverse((child) => {
      if (child.isSkinnedMesh && child.skeleton) {
        // Skip hair meshes — they use original inverse bind matrices from hair VRM
        // and must NOT be overwritten by base model bone transforms
        if (child.userData?.isHair) return;
        let parent = child.parent;
        while (parent) {
          if (parent.userData?.isHair) return;
          parent = parent.parent;
        }

        const skeleton = child.skeleton;
        for (let i = 0; i < skeleton.bones.length; i++) {
          skeleton.boneInverses[i].copy(skeleton.bones[i].matrixWorld).invert();
        }
        // Force skeleton to recalculate bone matrices on next render
        skeleton.computeBoneTexture?.();
        skeleton.update?.();
      }
    });
  }

  /**
   * Match VRM mesh name to morph_deltas key.
   * morph_deltas uses "Face" and "Body" as mesh names.
   * @private
   */
  _matchMeshName(threejsName) {
    const lower = threejsName.toLowerCase();
    if (lower.includes("face") || lower.includes("head")) return "Face";
    if (lower.includes("body") || lower.includes("skin")) return "Body";
    // Exact match fallback
    return threejsName;
  }

  /**
   * Reverse map Three.js bone name to humanoid bone name used in bone_factors.
   * @private
   */
  _reverseMapBone(threejsName) {
    for (const [humanoid, vrm] of Object.entries(HUMANOID_BONE_MAP)) {
      if (vrm === threejsName) return humanoid;
    }
    // Handle hair/spring bones (prefixed with __)
    if (threejsName.startsWith("J_Sec_")) {
      return `__${threejsName}`;
    }
    return threejsName;
  }
}
