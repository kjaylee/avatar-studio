/**
 * HairManager - Loads and swaps hair styles from VRoid VRM files
 *
 * Fundamental principle:
 *   skinning: worldPos = boneWorld × invBind × vertex
 *
 *   Three-phase sync keeps hair aligned with the base model:
 *
 *   1. BONE DRIFT COMPENSATION — Slider-driven bone transforms (e.g. head tY: -0.031
 *      for heightFemale) are cancelled for the body mesh via invBind recalculation.
 *      Hair is skipped in that recalculation, so we apply our own adjustment:
 *        adjustedInvBind = boneWorldNew⁻¹ × boneWorldOld × origInvBind
 *      This renders hair as if bones never moved (transparent to slider bone changes).
 *
 *   2. VISUAL HEAD TRACKING — Vertex morphs move face mesh vertices (the visual head
 *      position) independently of bone transforms. We measure the face mesh center Y
 *      displacement and apply it as a Y offset to hair vertices, so hair follows the
 *      visual head rather than staying at a fixed world position.
 *
 *   3. VERTEX RESCALING — Scale hair geometry around the head center with distance
 *      falloff to match dynamic head size changes from sliders.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";

/**
 * Base model face width: 0.2176
 * headScale = baseFaceWidth / hairFaceWidth
 */
export const HAIR_PRESETS = [
  { id: "none", name: "None", url: null, headScale: 1.0 },
  { id: "shorthair", name: "Short", url: "./vrm-data/hairs/style_shorthair.vrm", headScale: 1.286 },
  { id: "medium", name: "Medium", url: "./vrm-data/hairs/style_medium.vrm", headScale: 1.139 },
  { id: "longhair", name: "Long", url: "./vrm-data/hairs/style_longhair.vrm", headScale: 1.120 },
];

export class HairManager {
  constructor() {
    this._currentHairGroup = null;
    this.currentPresetId = "none";
    this._cache = new Map();
    this._addedSpringBones = [];
    this.loading = false;
    /** @type {number} Base head scale for current preset */
    this._baseHeadScale = 1.0;
    /** @type {THREE.Vector3|null} Head center in hair model space */
    this._hairHeadCenter = null;
    /** @type {Array<{posAttr: THREE.BufferAttribute, origPositions: Float32Array}>} */
    this._meshData = [];
    /** @type {number} Last applied scale */
    this._lastScale = -1;
    /**
     * Per-skeleton data for bone drift compensation.
     * Stores base bone world matrices and original inverse bind matrices
     * so we can compute: adjustedInvBind = boneWorldNew⁻¹ × boneWorldOld × origInvBind
     * @type {Array<{skeleton: THREE.Skeleton, baseBoneWorlds: THREE.Matrix4[], origInverses: THREE.Matrix4[]}>}
     */
    this._skeletonDataList = [];
    /** @type {THREE.Matrix4} Reusable temp matrix for calculations */
    this._tempMatrix = new THREE.Matrix4();
    /** @type {number|null} Base face mesh center Y at hair load time */
    this._baseFaceCenterY = null;
    /** @type {{xz: number, y: number}|null} Base face mesh spread (XZ radial + Y vertical) */
    this._baseFaceSpread = null;

    this._loader = new GLTFLoader();
    this._loader.register((parser) => new VRMLoaderPlugin(parser, { autoUpdateHumanBones: true }));
  }

  async applyPreset(presetId, baseScene, threeScene, morphDataManager = null, sliderValues = null) {
    if (this.loading) return;
    if (presetId === this.currentPresetId) return;

    this._removeCurrentHair(baseScene);

    const preset = HAIR_PRESETS.find((p) => p.id === presetId);
    if (!preset || !preset.url) {
      this.currentPresetId = "none";
      return;
    }

    this.loading = true;

    try {
      if (!this._cache.has(presetId)) {
        const gltf = await this._loader.loadAsync(preset.url);
        const scene = gltf.userData.vrm?.scene || gltf.scene;
        scene.updateMatrixWorld(true);

        // Find head bone center in hair model
        let hairHeadCenter = null;
        scene.traverse((child) => {
          if (child.isBone && child.name === "J_Bip_C_Head") {
            hairHeadCenter = new THREE.Vector3();
            child.getWorldPosition(hairHeadCenter);
          }
        });

        const hairData = [];
        scene.traverse((child) => {
          if (!child.isMesh || !this._isHairMesh(child)) return;
          if (!child.isSkinnedMesh || !child.skeleton) return;

          const boneNames = child.skeleton.bones.map((b) => b.name);
          const boneInverses = child.skeleton.boneInverses.map((m) => m.clone());
          const boneLocalTransforms = new Map();
          child.skeleton.bones.forEach((b) => {
            boneLocalTransforms.set(b.name, {
              position: b.position.clone(),
              quaternion: b.quaternion.clone(),
              scale: b.scale.clone(),
              parentName: b.parent?.name || null,
            });
          });

          hairData.push({
            geometry: child.geometry,
            material: child.material,
            name: child.name,
            boneNames,
            boneInverses,
            boneLocalTransforms,
          });
        });

        console.log(`[HairManager] Found ${hairData.length} hair meshes in ${preset.name}`);
        this._cache.set(presetId, { hairData, hairHeadCenter });
      }

      const cached = this._cache.get(presetId);
      const { hairData, hairHeadCenter } = cached;
      this._hairHeadCenter = hairHeadCenter;

      if (!hairData || hairData.length === 0) {
        console.warn("[HairManager] No hair meshes found");
        this.loading = false;
        return;
      }

      const baseBoneMap = new Map();
      baseScene.traverse((child) => {
        if (child.isBone) baseBoneMap.set(child.name, child);
      });

      const hairGroup = new THREE.Group();
      hairGroup.name = `Hair_${presetId}`;
      hairGroup.userData.isHair = true;

      this._baseHeadScale = preset.headScale;
      this._meshData = [];
      this._skeletonDataList = [];
      this._lastScale = -1;

      const cx = hairHeadCenter?.x || 0;
      const cy = hairHeadCenter?.y || 0;
      const cz = hairHeadCenter?.z || 0;

      for (const data of hairData) {
        const geometry = data.geometry.clone();
        const material = Array.isArray(data.material)
          ? data.material.map((m) => m.clone())
          : data.material.clone();

        // Store original vertex positions BEFORE scaling
        const posAttr = geometry.getAttribute("position");
        const origPositions = new Float32Array(posAttr.array);

        // Scale geometry vertices around head center with distance falloff.
        // Vertices near the head get full scale (proportion matching).
        // Distant vertices (hanging strands) get less scaling to avoid stretching.
        const s = preset.headScale;
        const maxDist = 0.15; // ~head radius: full scale within this distance
        const fadeRange = 0.25; // scale fades to 1.0 over this distance beyond maxDist
        const positions = posAttr.array;
        for (let i = 0; i < positions.length; i += 3) {
          const dx = positions[i] - cx;
          const dy = positions[i + 1] - cy;
          const dz = positions[i + 2] - cz;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          // Falloff: 1.0 within maxDist, fades to 0.0 at maxDist+fadeRange
          let falloff = 1.0;
          if (dist > maxDist) {
            falloff = Math.max(0, 1.0 - (dist - maxDist) / fadeRange);
          }
          const effectiveScale = 1.0 + (s - 1.0) * falloff;

          positions[i] = cx + dx * effectiveScale;
          positions[i + 1] = cy + dy * effectiveScale;
          positions[i + 2] = cz + dz * effectiveScale;
        }
        posAttr.needsUpdate = true;
        geometry.computeBoundingSphere();

        // Build bone array pointing at BASE model's bones
        const bones = [];

        for (let i = 0; i < data.boneNames.length; i++) {
          const boneName = data.boneNames[i];
          let baseBone = baseBoneMap.get(boneName);

          if (!baseBone) {
            baseBone = this._ensureSpringBone(
              boneName,
              data.boneLocalTransforms,
              baseBoneMap
            );
          }

          bones.push(baseBone);
        }

        // Use ORIGINAL inverse bind matrices from hair VRM.
        // These encode the hair model's bone positions, which correctly
        // remap hair vertices to the base model's skeleton.
        const inverses = data.boneInverses.map((inv) => inv.clone());

        const skinnedMesh = new THREE.SkinnedMesh(geometry, material);
        skinnedMesh.name = data.name;
        skinnedMesh.frustumCulled = false;
        skinnedMesh.userData.isHair = true;

        const skeleton = new THREE.Skeleton(bones, inverses);
        skinnedMesh.bind(skeleton, new THREE.Matrix4());

        hairGroup.add(skinnedMesh);

        // Store base bone world matrices for drift compensation.
        // At this point bones are in default pose (no sliders applied).
        baseScene.updateMatrixWorld(true);
        const baseBoneWorlds = bones.map((b) => b.matrixWorld.clone());
        const origInversesCopy = inverses.map((m) => m.clone());
        this._skeletonDataList.push({ skeleton, baseBoneWorlds, origInverses: origInversesCopy });

        // Store for dynamic rescaling
        this._meshData.push({ posAttr, origPositions });

        console.log(`[HairManager] Bound "${data.name}": ${bones.length} bones, scale=${s.toFixed(3)}`);
      }

      baseScene.add(hairGroup);
      this._currentHairGroup = hairGroup;
      this.currentPresetId = presetId;

      // Capture base state at DEFAULT pose (zero sliders).
      // If sliders are already applied, temporarily reset → capture → restore.
      if (morphDataManager && sliderValues) {
        const savedValues = { ...morphDataManager.sliderValues };
        morphDataManager.reset(baseScene);
        baseScene.updateMatrixWorld(true);

        // Re-capture baseBoneWorlds at true default pose
        for (const skData of this._skeletonDataList) {
          for (let i = 0; i < skData.skeleton.bones.length; i++) {
            skData.baseBoneWorlds[i].copy(skData.skeleton.bones[i].matrixWorld);
          }
        }
        this._baseFaceCenterY = this._computeFaceCenterY(baseScene);
        this._baseFaceSpread = this._computeFaceSpread(baseScene);

        // Restore sliders and re-sync hair
        morphDataManager.setSliders(savedValues, baseScene);
        this.syncBones(baseScene, savedValues);
      } else {
        this._baseFaceCenterY = this._computeFaceCenterY(baseScene);
        this._baseFaceSpread = this._computeFaceSpread(baseScene);
      }

      console.log(`[HairManager] Applied: ${preset.name}`);
    } catch (err) {
      console.error(`[HairManager] Error:`, err);
    } finally {
      this.loading = false;
    }
  }

  /**
   * Sync hair with body parameter changes (three-phase compensation).
   * See file header for detailed explanation of each phase.
   */
  syncBones(vrmScene, sliderValues) {
    if (!this._currentHairGroup) return;
    if (!sliderValues) return;

    // ── Phase 1: Bone drift compensation ──────────────────────────────
    // After morphDataManager applies bone transforms (e.g. head tY: -0.031
    // for heightFemale), base mesh invBind is recalculated to cancel it.
    // Hair is skipped in that recalculation (preserving original invBind),
    // so hair would follow the raw bone movement (wrong direction).
    // Fix: adjust hair invBind so bone movement is transparent, just like
    // the base mesh. Hair visual position comes from vertex scaling only.
    this._compensateBoneDrift(vrmScene);

    // ── Phase 1b: Visual head tracking ──────────────────────────────
    // After drift compensation, hair stays at its original world position.
    // But vertex morphs move the visual head (face mesh vertices shift).
    // Compute the Y offset so we can apply it in the vertex loop.
    const visualOffsetY = this._getVisualHeadOffsetY(vrmScene);

    // ── Phase 2: Vertex rescaling + visual offset ─────────────────────
    if (this._meshData.length === 0) return;

    // Per-axis scale factors from actual face mesh measurements.
    // headSize morph is axis-asymmetric: Y grows only 76.3% as much as XZ.
    // By measuring XZ and Y independently, hair scales match actual head shape.
    let scaleXZ = 1.0;
    let scaleY = 1.0;
    if (this._baseFaceSpread != null && this._baseFaceSpread.xz > 0 && this._baseFaceSpread.y > 0) {
      const currentSpread = this._computeFaceSpread(vrmScene);
      if (currentSpread != null && currentSpread.xz > 0 && currentSpread.y > 0) {
        scaleXZ = currentSpread.xz / this._baseFaceSpread.xz;
        scaleY = currentSpread.y / this._baseFaceSpread.y;
      }
    }

    const combinedScaleXZ = this._baseHeadScale * scaleXZ;
    const combinedScaleY = this._baseHeadScale * scaleY;

    const cx = this._hairHeadCenter?.x || 0;
    const cy = this._hairHeadCenter?.y || 0;
    const cz = this._hairHeadCenter?.z || 0;

    const maxDist = 0.15;
    const fadeRange = 0.25;

    for (const { posAttr, origPositions } of this._meshData) {
      const positions = posAttr.array;
      for (let i = 0; i < positions.length; i += 3) {
        const dx = origPositions[i] - cx;
        const dy = origPositions[i + 1] - cy;
        const dz = origPositions[i + 2] - cz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        let falloff = 1.0;
        if (dist > maxDist) {
          falloff = Math.max(0, 1.0 - (dist - maxDist) / fadeRange);
        }
        const effectiveScaleXZ = 1.0 + (combinedScaleXZ - 1.0) * falloff;
        const effectiveScaleY = 1.0 + (combinedScaleY - 1.0) * falloff;

        positions[i] = cx + dx * effectiveScaleXZ;
        positions[i + 1] = cy + dy * effectiveScaleY + visualOffsetY;
        positions[i + 2] = cz + dz * effectiveScaleXZ;
      }
      posAttr.needsUpdate = true;
    }
  }

  /**
   * Adjust hair inverse bind matrices to cancel slider-driven bone drift.
   *
   * The skinning equation is: worldPos = boneWorld × invBind × vertex
   *
   * By setting: adjustedInvBind = boneWorldNew⁻¹ × boneWorldOld × origInvBind
   * we get:     worldPos = boneWorldNew × boneWorldNew⁻¹ × boneWorldOld × origInvBind × vertex
   *                      = boneWorldOld × origInvBind × vertex
   *
   * This renders hair as if bones never moved from their default pose,
   * making slider bone transforms transparent (same as the base mesh).
   * @private
   */
  _compensateBoneDrift(vrmScene) {
    if (this._skeletonDataList.length === 0) return;

    vrmScene.updateMatrixWorld(true);

    for (const { skeleton, baseBoneWorlds, origInverses } of this._skeletonDataList) {
      for (let i = 0; i < skeleton.bones.length; i++) {
        // adjustedInvBind = boneWorldNew⁻¹ × boneWorldOld × origInvBind
        this._tempMatrix.copy(skeleton.bones[i].matrixWorld).invert();
        skeleton.boneInverses[i]
          .copy(this._tempMatrix)
          .multiply(baseBoneWorlds[i])
          .multiply(origInverses[i]);
      }
      // Force skeleton update for next render
      skeleton.computeBoneTexture?.();
      skeleton.update?.();
    }
  }

  /**
   * Compute Y offset to track visual head position from face vertex morphs.
   * Returns the offset, or 0 if unavailable.
   * @private
   */
  _getVisualHeadOffsetY(vrmScene) {
    if (this._baseFaceCenterY == null) return 0;

    const currentY = this._computeFaceCenterY(vrmScene);
    if (currentY == null) return 0;

    return currentY - this._baseFaceCenterY;
  }

  /**
   * Compute the average Y position of face mesh vertices.
   * Since body mesh invBind recalculation makes worldPos = vertex + morphDelta,
   * the raw vertex positions in the face mesh reflect the visual head position.
   * @private
   * @param {THREE.Object3D} scene
   * @returns {number|null}
   */
  _computeFaceCenterY(scene) {
    let result = null;
    scene.traverse((child) => {
      if (result !== null) return;
      if (!child.isMesh || !child.geometry) return;
      const name = (child.name || "").toLowerCase();
      if (!name.includes("face") && !name.includes("head")) return;
      // Skip hair meshes
      if (child.userData?.isHair) return;

      const posAttr = child.geometry.getAttribute("position");
      if (!posAttr || posAttr.count === 0) return;

      // Sample every 10th vertex for performance (face has ~4700 verts)
      let sumY = 0;
      let count = 0;
      for (let i = 0; i < posAttr.count; i += 10) {
        sumY += posAttr.array[i * 3 + 1];
        count++;
      }
      result = sumY / count;
    });
    return result;
  }

  /**
   * Compute face mesh spread separately for XZ (radial) and Y (vertical).
   *
   * headSize morph is axis-asymmetric: Y grows only 76.3% as much as XZ.
   * By measuring both axes independently, we can apply per-axis hair scaling
   * that matches actual head shape change instead of uniform scaling.
   *
   * @private
   * @param {THREE.Object3D} scene
   * @returns {{xz: number, y: number}|null} Average XZ radial spread and Y spread
   */
  _computeFaceSpread(scene) {
    let result = null;
    scene.traverse((child) => {
      if (result !== null) return;
      if (!child.isMesh || !child.geometry) return;
      const name = (child.name || "").toLowerCase();
      if (!name.includes("face") && !name.includes("head")) return;
      if (child.userData?.isHair) return;

      const posAttr = child.geometry.getAttribute("position");
      if (!posAttr || posAttr.count === 0) return;

      // First pass: compute center X, Y, Z
      let sumX = 0, sumY = 0, sumZ = 0, count = 0;
      for (let i = 0; i < posAttr.count; i += 10) {
        sumX += posAttr.array[i * 3];
        sumY += posAttr.array[i * 3 + 1];
        sumZ += posAttr.array[i * 3 + 2];
        count++;
      }
      const centerX = sumX / count;
      const centerY = sumY / count;
      const centerZ = sumZ / count;

      // Second pass: compute average radial distance (XZ) and vertical spread (Y)
      let sumDistXZ = 0;
      let sumDistY = 0;
      let distCount = 0;
      for (let i = 0; i < posAttr.count; i += 10) {
        const dx = posAttr.array[i * 3] - centerX;
        const dy = posAttr.array[i * 3 + 1] - centerY;
        const dz = posAttr.array[i * 3 + 2] - centerZ;
        sumDistXZ += Math.sqrt(dx * dx + dz * dz);
        sumDistY += Math.abs(dy);
        distCount++;
      }
      result = {
        xz: sumDistXZ / distCount,
        y: sumDistY / distCount,
      };
    });
    return result;
  }

  /** @private */
  _ensureSpringBone(boneName, localTransforms, baseBoneMap) {
    if (baseBoneMap.has(boneName)) return baseBoneMap.get(boneName);

    const boneData = localTransforms.get(boneName);
    if (!boneData) {
      return baseBoneMap.get("J_Bip_C_Head") || [...baseBoneMap.values()][0];
    }

    let parentBone;
    if (boneData.parentName && localTransforms.has(boneData.parentName)) {
      parentBone = this._ensureSpringBone(boneData.parentName, localTransforms, baseBoneMap);
    } else if (boneData.parentName && baseBoneMap.has(boneData.parentName)) {
      parentBone = baseBoneMap.get(boneData.parentName);
    } else {
      parentBone = baseBoneMap.get("J_Bip_C_Head") || [...baseBoneMap.values()][0];
    }

    const newBone = new THREE.Bone();
    newBone.name = boneName;
    newBone.position.copy(boneData.position);
    newBone.quaternion.copy(boneData.quaternion);
    newBone.scale.copy(boneData.scale);

    parentBone.add(newBone);
    newBone.updateMatrixWorld(true);

    baseBoneMap.set(boneName, newBone);
    this._addedSpringBones.push(newBone);
    return newBone;
  }

  /** @private */
  _removeCurrentHair(baseScene) {
    if (this._currentHairGroup) {
      this._currentHairGroup.parent?.remove(this._currentHairGroup);
      this._currentHairGroup.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose();
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => m?.dispose());
        }
      });
      this._currentHairGroup = null;
    }

    for (const bone of this._addedSpringBones) {
      bone.parent?.remove(bone);
    }
    this._addedSpringBones = [];
    this._meshData = [];
    this._skeletonDataList = [];
  }

  /** @private */
  _isHairMesh(mesh) {
    const name = (mesh.name || "").toLowerCase();
    if (name.includes("hair")) return true;
    if (mesh.parent) {
      const parentName = (mesh.parent.name || "").toLowerCase();
      if (parentName.includes("hair")) return true;
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of materials) {
      if (mat && (mat.name || "").toLowerCase().includes("hair")) return true;
    }
    return false;
  }

  dispose() {
    this._cache.clear();
    this._currentHairGroup = null;
    this._addedSpringBones = [];
    this._meshData = [];
    this._skeletonDataList = [];
  }
}
