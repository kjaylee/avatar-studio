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

    // Cached base positions for reset
    this._basePositions = new Map(); // meshName → Float32Array (copy of original)
    this._baseBoneData = new Map(); // boneName → {position, scale, quaternion}
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

    const seenBuffers = new Set();

    vrmScene.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const posAttr = child.geometry.getAttribute("position");
        if (posAttr) {
          // Deduplicate: multiple primitives share the same ArrayBuffer
          const buf = posAttr.array.buffer;
          if (!seenBuffers.has(buf)) {
            seenBuffers.add(buf);
            const meshName = this._matchMeshName(child.name);
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

  // ── Internal methods ─────────────────────────────────────────────────

  /**
   * Restore meshes and bones to their cached base state.
   * Uses deduplicated mesh map to avoid redundant operations on shared buffers.
   * @private
   */
  _restoreBase(vrmScene) {
    // Restore mesh positions via deduplicated map
    for (const [meshName, basePos] of this._basePositions.entries()) {
      const posAttr = this._meshAttrMap.get(meshName);
      if (posAttr) {
        posAttr.array.set(basePos);
        posAttr.needsUpdate = true;
      }
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
