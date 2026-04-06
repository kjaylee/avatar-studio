/**
 * ClothingMeshManager — Manages 3D clothing mesh overlays for VRM avatars.
 *
 * Loads separate VRM/GLB clothing assets and attaches them to the body skeleton,
 * similar to how HairManager loads hair VRM files. Supports:
 *   - Multiple clothing slots (outerwear, skirt, accessory, etc.)
 *   - Bone weight matching to base body skeleton
 *   - Spring Bone support (skirts, capes, coats)
 *   - Body slider sync via vertex rescaling (3-phase compensation)
 *   - Color tinting (MToon 3-channel)
 *
 * Architecture mirrors HairManager:
 *   1. Load VRM → extract skinned meshes
 *   2. Clone geometry + material
 *   3. Map bones to base skeleton
 *   4. Create spring bones for physics
 *   5. Sync with body sliders via bone drift compensation + vertex rescaling
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";

/**
 * Built-in clothing mesh presets.
 * Each entry: { id, name, url, category, springBone }
 * category: "outerwear" | "bottom_overlay" | "accessory" | "full"
 */
export const CLOTHING_MESH_PRESETS = [
  { id: "none", name: "None", url: null, category: "none" },
  // Presets loaded dynamically from index.json
];

/**
 * Clothing mesh slot categories.
 * Multiple categories can be worn simultaneously (layering).
 */
export const CLOTHING_MESH_CATEGORIES = {
  outerwear: { name: "Outerwear", description: "Jackets, coats, capes" },
  bottom_overlay: { name: "Bottom Overlay", description: "Skirts, loose pants" },
  accessory: { name: "Accessories", description: "Hats, bags, belts" },
  full: { name: "Full Outfit", description: "Complete mesh outfit" },
};

/**
 * Data for one clothing mesh slot.
 */
class ClothingSlot {
  constructor(category) {
    this.category = category;
    this.group = null;
    this.presetId = "none";
    this.meshData = []; // [{posAttr, origPositions}]
    this.skeletonDataList = []; // [{skeleton, baseBoneWorlds, origInverses}]
    this.springBones = []; // Spring bones owned by this slot
    this.bodyCenter = null;
  }

  clear() {
    this.group = null;
    this.presetId = "none";
    this.meshData = [];
    this.skeletonDataList = [];
    this.springBones = [];
    this.bodyCenter = null;
  }
}

export class ClothingMeshManager {
  constructor() {
    /** @type {Map<string, ClothingSlot>} category -> slot */
    this._slots = new Map();
    for (const cat of Object.keys(CLOTHING_MESH_CATEGORIES)) {
      this._slots.set(cat, new ClothingSlot(cat));
    }

    this._cache = new Map(); // url -> { meshDataList, bodyCenter }
    this._presets = [...CLOTHING_MESH_PRESETS]; // mutable copy
    this._presetsLoaded = false;
    this.loading = false;

    this._baseBodyCenterY = null;
    this._baseBodyExtent = null;
    this._tempMatrix = new THREE.Matrix4();
    this._loader = new GLTFLoader();
    this._loader.register((parser) => new VRMLoaderPlugin(parser, { autoUpdateHumanBones: true }));
  }

  /**
   * Load preset index from clothing/index.json.
   * Called lazily on first apply or explicitly.
   */
  async loadPresets(basePath = "./vrm-data/clothing") {
    if (this._presetsLoaded) return;
    try {
      const resp = await fetch(`${basePath}/index.json`);
      if (!resp.ok) {
        console.warn("[ClothingMeshManager] No clothing index.json found, using built-in presets only");
        this._presetsLoaded = true;
        return;
      }
      const data = await resp.json();
      if (Array.isArray(data.presets)) {
        for (const p of data.presets) {
          if (!p.id || !p.url) continue;
          const existing = this._presets.find((e) => e.id === p.id);
          if (!existing) {
            this._presets.push({
              id: p.id,
              name: p.name || p.id,
              url: p.url.startsWith("./") ? p.url : `${basePath}/${p.url}`,
              category: p.category || "full",
            });
          }
        }
      }
      this._presetsLoaded = true;
      console.log(`[ClothingMeshManager] Loaded ${this._presets.length - 1} clothing presets`);
    } catch (err) {
      console.warn("[ClothingMeshManager] Failed to load index.json:", err.message);
      this._presetsLoaded = true;
    }
  }

  /**
   * Get all available presets (including dynamically loaded).
   */
  getPresets() {
    return [...this._presets];
  }

  /**
   * Get presets filtered by category.
   */
  getPresetsByCategory(category) {
    return this._presets.filter((p) => p.category === category || p.id === "none");
  }

  /**
   * Apply a clothing mesh preset by ID.
   * @param {string} presetId - Preset ID from CLOTHING_MESH_PRESETS
   * @param {THREE.Object3D} baseScene - Base VRM scene (body)
   * @param {THREE.Scene} threeScene - Three.js scene (unused, kept for API parity)
   * @param {object} [morphDataManager] - For body slider sync
   * @param {object} [sliderValues] - Current body slider values
   */
  async applyPreset(presetId, baseScene, threeScene, morphDataManager = null, sliderValues = null) {
    await this.loadPresets();
    const preset = this._presets.find((p) => p.id === presetId);
    if (!preset) {
      console.warn(`[ClothingMeshManager] Preset not found: ${presetId}`);
      return;
    }

    const category = preset.category || "full";
    const slot = this._slots.get(category);
    if (!slot) {
      console.warn(`[ClothingMeshManager] Unknown category: ${category}`);
      return;
    }

    await this._applyToSlot(slot, preset, baseScene, morphDataManager, sliderValues);
  }

  /**
   * Load a custom VRM/GLB file as clothing mesh.
   * @param {File|string} fileOrUrl - File object or URL
   * @param {string} category - Target category slot
   * @param {THREE.Object3D} baseScene - Base VRM scene
   * @param {object} [morphDataManager]
   * @param {object} [sliderValues]
   */
  async loadCustom(fileOrUrl, category, baseScene, morphDataManager = null, sliderValues = null) {
    const slot = this._slots.get(category);
    if (!slot) {
      console.warn(`[ClothingMeshManager] Unknown category: ${category}`);
      return;
    }

    const url = fileOrUrl instanceof File ? URL.createObjectURL(fileOrUrl) : fileOrUrl;
    const customPreset = {
      id: `custom_${category}_${Date.now()}`,
      name: fileOrUrl instanceof File ? fileOrUrl.name : "Custom",
      url,
      category,
    };

    await this._applyToSlot(slot, customPreset, baseScene, morphDataManager, sliderValues);

    // Revoke object URL after loading
    if (fileOrUrl instanceof File) {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Remove clothing from a specific category slot.
   */
  removeByCategory(category, baseScene) {
    const slot = this._slots.get(category);
    if (slot) {
      this._removeSlot(slot, baseScene);
    }
  }

  /**
   * Remove all clothing meshes from all slots.
   */
  removeAll(baseScene) {
    for (const slot of this._slots.values()) {
      this._removeSlot(slot, baseScene);
    }
  }

  /**
   * Sync all clothing meshes with body parameter changes (three-phase compensation).
   * Should be called alongside hairManager.syncBones().
   */
  syncBones(vrmScene, sliderValues) {
    if (!sliderValues) return;

    let hasAnyMesh = false;
    for (const slot of this._slots.values()) {
      if (slot.group) { hasAnyMesh = true; break; }
    }
    if (!hasAnyMesh) return;

    // Phase 1: Bone drift compensation
    for (const slot of this._slots.values()) {
      this._compensateBoneDrift(slot);
    }
    vrmScene.updateMatrixWorld(true);

    // Phase 1b: Visual body tracking
    const visualOffsetY = this._getVisualBodyOffsetY(vrmScene);

    // Phase 2: Vertex rescaling
    const bodyExtent = this._computeBodyExtent(vrmScene);

    for (const slot of this._slots.values()) {
      this._rescaleSlot(slot, bodyExtent, visualOffsetY);
    }
  }

  /**
   * Get serializable state for Save/Load.
   */
  getState() {
    const slots = {};
    for (const [category, slot] of this._slots) {
      if (slot.presetId !== "none") {
        slots[category] = slot.presetId;
      }
    }
    return { slots };
  }

  /**
   * Restore state from saved data.
   */
  async restoreState(state, baseScene, morphDataManager = null, sliderValues = null) {
    if (!state?.slots) return;
    // Remove all first
    this.removeAll(baseScene);

    for (const [category, presetId] of Object.entries(state.slots)) {
      if (presetId && presetId !== "none") {
        await this.applyPreset(presetId, baseScene, null, morphDataManager, sliderValues);
      }
    }
  }

  // ─── Private ───────────────────────────────────────────────────────

  /**
   * Core: load VRM, extract meshes, bind to slot.
   * @private
   */
  async _applyToSlot(slot, preset, baseScene, morphDataManager, sliderValues) {
    if (this.loading) return;
    if (preset.id === slot.presetId) return;

    // Remove old slot content
    this._removeSlot(slot, baseScene);

    if (!preset.url) {
      slot.presetId = "none";
      return;
    }

    this.loading = true;

    try {
      await this._ensureCached(preset.url);
      const cached = this._cache.get(preset.url);
      const { meshDataList, bodyCenter } = cached;

      if (!meshDataList || meshDataList.length === 0) {
        console.warn(`[ClothingMeshManager] No meshes found in ${preset.url}`);
        this.loading = false;
        return;
      }

      slot.bodyCenter = bodyCenter;
      slot.meshData = [];
      slot.skeletonDataList = [];
      slot.springBones = [];

      const slotBoneMap = new Map();

      // Build baseBoneMap excluding spring bones from other slots
      const otherSlotBones = new Set();
      for (const [cat, otherSlot] of this._slots) {
        if (cat === slot.category) continue;
        for (const b of otherSlot.springBones) otherSlotBones.add(b.name);
      }

      const baseBoneMap = new Map();
      baseScene.traverse((child) => {
        if (child.isBone && !otherSlotBones.has(child.name)) baseBoneMap.set(child.name, child);
      });

      const clothingGroup = new THREE.Group();
      clothingGroup.name = `Clothing_${slot.category}_${preset.id}`;
      clothingGroup.userData.isClothingMesh = true;
      clothingGroup.userData.clothingCategory = slot.category;

      const cx = bodyCenter?.x || 0;
      const cy = bodyCenter?.y || 0;
      const cz = bodyCenter?.z || 0;

      for (const data of meshDataList) {
        const geometry = data.geometry.clone();
        const material = Array.isArray(data.material)
          ? data.material.map((m) => m.clone())
          : data.material.clone();

        const posAttr = geometry.getAttribute("position");
        const origPositions = new Float32Array(posAttr.array);

        // Build bone array from base model
        const bones = [];
        for (let i = 0; i < data.boneNames.length; i++) {
          const boneName = data.boneNames[i];
          let baseBone = baseBoneMap.get(boneName) || slotBoneMap.get(boneName);
          if (!baseBone) {
            baseBone = this._ensureSpringBone(boneName, data.boneLocalTransforms, baseBoneMap, slotBoneMap, slot);
          }
          bones.push(baseBone);
        }

        const inverses = data.boneInverses.map((inv) => inv.clone());
        const skinnedMesh = new THREE.SkinnedMesh(geometry, material);
        skinnedMesh.name = data.name;
        skinnedMesh.frustumCulled = false;
        skinnedMesh.userData.isClothingMesh = true;
        skinnedMesh.userData.clothingCategory = slot.category;

        const mats = Array.isArray(material) ? material : [material];
        mats.forEach((m) => { if (m) m.side = THREE.DoubleSide; });

        const skeleton = new THREE.Skeleton(bones, inverses);
        skinnedMesh.bind(skeleton, new THREE.Matrix4());
        clothingGroup.add(skinnedMesh);

        baseScene.updateMatrixWorld(true);
        const baseBoneWorlds = bones.map((b) => b.matrixWorld.clone());
        const origInversesCopy = inverses.map((m) => m.clone());
        slot.skeletonDataList.push({ skeleton, baseBoneWorlds, origInverses: origInversesCopy });
        slot.meshData.push({ posAttr, origPositions });
      }

      baseScene.add(clothingGroup);
      slot.group = clothingGroup;
      slot.presetId = preset.id;

      // Capture base state at default pose
      if (morphDataManager && sliderValues) {
        const savedValues = { ...morphDataManager.sliderValues };
        morphDataManager.reset(baseScene);
        baseScene.updateMatrixWorld(true);

        for (const skData of slot.skeletonDataList) {
          for (let i = 0; i < skData.skeleton.bones.length; i++) {
            skData.baseBoneWorlds[i].copy(skData.skeleton.bones[i].matrixWorld);
          }
        }
        this._baseBodyCenterY = this._computeBodyCenterY(baseScene);
        this._baseBodyExtent = this._computeBodyExtent(baseScene);

        morphDataManager.setSliders(savedValues, baseScene);
        this.syncBones(baseScene, savedValues);
      } else {
        this._baseBodyCenterY = this._computeBodyCenterY(baseScene);
        this._baseBodyExtent = this._computeBodyExtent(baseScene);
      }

      console.log(`[ClothingMeshManager] Applied ${slot.category}: ${preset.name} (${meshDataList.length} meshes)`);
    } catch (err) {
      console.error(`[ClothingMeshManager] Error loading ${slot.category}:`, err);
    } finally {
      this.loading = false;
    }
  }

  /**
   * Load and cache VRM clothing data.
   * @private
   */
  async _ensureCached(url) {
    if (this._cache.has(url)) return;

    const gltf = await this._loader.loadAsync(url);
    const scene = gltf.userData.vrm?.scene || gltf.scene;
    scene.updateMatrixWorld(true);

    // Find body center bone (Hips or Spine)
    let bodyCenter = null;
    scene.traverse((child) => {
      if (child.isBone && (child.name === "J_Bip_C_Hips" || child.name === "J_Bip_C_Spine")) {
        if (!bodyCenter) {
          bodyCenter = new THREE.Vector3();
          child.getWorldPosition(bodyCenter);
        }
      }
    });

    const meshDataList = [];
    scene.traverse((child) => {
      if (!child.isMesh) return;
      if (!child.isSkinnedMesh || !child.skeleton) return;
      // Skip body/face meshes — only take clothing meshes
      if (this._isBodyMesh(child)) return;

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

      meshDataList.push({
        geometry: child.geometry,
        material: child.material,
        name: child.name,
        boneNames,
        boneInverses,
        boneLocalTransforms,
      });
    });

    console.log(`[ClothingMeshManager] Cached ${url}: ${meshDataList.length} clothing meshes`);
    this._cache.set(url, { meshDataList, bodyCenter });
  }

  /**
   * Check if a mesh is a body/face mesh (to skip during clothing extraction).
   * @private
   */
  _isBodyMesh(mesh) {
    const name = (mesh.name || "").toLowerCase();
    // Skip known body primitives
    if (name.includes("body_") || name === "body") return true;
    if (name.includes("face_") || name === "face") return true;
    if (name.includes("hair")) return true;
    return false;
  }

  /**
   * Create or retrieve a spring bone for physics (skirt, cape sway).
   * @private
   */
  _ensureSpringBone(boneName, localTransforms, baseBoneMap, slotBoneMap, slot) {
    if (baseBoneMap.has(boneName)) return baseBoneMap.get(boneName);
    if (slotBoneMap.has(boneName)) return slotBoneMap.get(boneName);

    const boneData = localTransforms.get(boneName);
    if (!boneData) {
      return baseBoneMap.get("J_Bip_C_Hips") || [...baseBoneMap.values()][0];
    }

    let parentBone;
    if (boneData.parentName && localTransforms.has(boneData.parentName)) {
      parentBone = this._ensureSpringBone(boneData.parentName, localTransforms, baseBoneMap, slotBoneMap, slot);
    } else if (boneData.parentName && (baseBoneMap.has(boneData.parentName) || slotBoneMap.has(boneData.parentName))) {
      parentBone = baseBoneMap.get(boneData.parentName) || slotBoneMap.get(boneData.parentName);
    } else {
      parentBone = baseBoneMap.get("J_Bip_C_Hips") || [...baseBoneMap.values()][0];
    }

    const newBone = new THREE.Bone();
    newBone.name = boneName;
    newBone.position.copy(boneData.position);
    newBone.quaternion.copy(boneData.quaternion);
    newBone.scale.copy(boneData.scale);

    parentBone.add(newBone);
    newBone.updateMatrixWorld(true);

    slotBoneMap.set(boneName, newBone);
    slot.springBones.push(newBone);
    return newBone;
  }

  /** @private */
  _removeSlot(slot, baseScene) {
    if (slot.group) {
      slot.group.parent?.remove(slot.group);
      slot.group.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose();
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => m?.dispose());
        }
      });
    }
    for (const bone of slot.springBones) {
      bone.parent?.remove(bone);
    }
    slot.clear();
  }

  /** @private — Bone drift compensation (Phase 1) */
  _compensateBoneDrift(slot) {
    if (slot.skeletonDataList.length === 0) return;

    for (const { skeleton, baseBoneWorlds, origInverses } of slot.skeletonDataList) {
      for (let i = 0; i < skeleton.bones.length; i++) {
        this._tempMatrix.copy(skeleton.bones[i].matrixWorld).invert();
        skeleton.boneInverses[i]
          .copy(this._tempMatrix)
          .multiply(baseBoneWorlds[i])
          .multiply(origInverses[i]);
      }
      skeleton.computeBoneTexture?.();
      skeleton.update?.();
    }
  }

  /** @private — Vertex rescaling (Phase 2) */
  _rescaleSlot(slot, bodyExtent, visualOffsetY) {
    if (slot.meshData.length === 0) return;

    let scaleXZ = 1.0;
    let scaleY = 1.0;
    if (this._baseBodyExtent && bodyExtent) {
      if (this._baseBodyExtent.width > 0) scaleXZ = bodyExtent.width / this._baseBodyExtent.width;
      if (this._baseBodyExtent.height > 0) scaleY = bodyExtent.height / this._baseBodyExtent.height;
    }

    const cx = slot.bodyCenter?.x || 0;
    const cy = slot.bodyCenter?.y || 0;
    const cz = slot.bodyCenter?.z || 0;

    // Clothing uses wider falloff than hair (covers more of the body)
    const maxDist = 0.4;
    const fadeRange = 0.5;
    const minFalloff = 0.2;

    for (const { posAttr, origPositions } of slot.meshData) {
      const positions = posAttr.array;
      for (let i = 0; i < positions.length; i += 3) {
        const dx = origPositions[i] - cx;
        const dy = origPositions[i + 1] - cy;
        const dz = origPositions[i + 2] - cz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        let falloff = 1.0;
        if (dist > maxDist) {
          falloff = Math.max(minFalloff, 1.0 - (dist - maxDist) / fadeRange);
        }
        const effectiveScaleXZ = 1.0 + (scaleXZ - 1.0) * falloff;
        const effectiveScaleY = 1.0 + (scaleY - 1.0) * falloff;

        positions[i] = cx + dx * effectiveScaleXZ;
        positions[i + 1] = cy + dy * effectiveScaleY + visualOffsetY;
        positions[i + 2] = cz + dz * effectiveScaleXZ;
      }
      posAttr.needsUpdate = true;
    }
  }

  /** @private */
  _getVisualBodyOffsetY(vrmScene) {
    if (this._baseBodyCenterY == null) return 0;
    const currentY = this._computeBodyCenterY(vrmScene);
    if (currentY == null) return 0;
    return currentY - this._baseBodyCenterY;
  }

  /** @private */
  _computeBodyCenterY(scene) {
    let result = null;
    scene.traverse((child) => {
      if (result !== null) return;
      if (!child.isMesh || !child.geometry) return;
      const name = (child.name || "").toLowerCase();
      if (!name.includes("body")) return;
      if (child.userData?.isClothingMesh) return;
      if (child.userData?.isHair) return;

      const posAttr = child.geometry.getAttribute("position");
      if (!posAttr || posAttr.count === 0) return;

      let sumY = 0, count = 0;
      for (let i = 0; i < posAttr.count; i += 10) {
        sumY += posAttr.array[i * 3 + 1];
        count++;
      }
      result = sumY / count;
    });
    return result;
  }

  /** @private */
  _computeBodyExtent(scene) {
    let result = null;
    scene.traverse((child) => {
      if (result !== null) return;
      if (!child.isMesh || !child.geometry) return;
      const name = (child.name || "").toLowerCase();
      if (!name.includes("body")) return;
      if (child.userData?.isClothingMesh) return;
      if (child.userData?.isHair) return;

      const posAttr = child.geometry.getAttribute("position");
      if (!posAttr || posAttr.count === 0) return;

      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.array[i * 3];
        const y = posAttr.array[i * 3 + 1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      result = { width: maxX - minX, height: maxY - minY };
    });
    return result;
  }

  /**
   * Set color tint on all clothing meshes in a specific category.
   * @param {string} category - Category to tint
   * @param {string|null} hexColor - Hex color string or null to reset
   */
  setColor(category, hexColor) {
    const slot = this._slots.get(category);
    if (!slot?.group) return;

    slot.group.traverse((child) => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        if (!mat) continue;
        if (hexColor) {
          const c = this._parseHex(hexColor);
          if (mat.color) mat.color.setRGB(c.r, c.g, c.b);
          if (mat.uniforms?.litFactor?.value) {
            mat.uniforms.litFactor.value.setRGB(c.r, c.g, c.b);
          }
          // Shade color (darker)
          const shade = { r: c.r * 0.65, g: c.g * 0.65, b: c.b * 0.65 };
          if (mat.uniforms?.shadeColorFactor?.value) {
            mat.uniforms.shadeColorFactor.value.setRGB(shade.r, shade.g, shade.b);
          }
        } else {
          // Reset to white
          if (mat.color) mat.color.setRGB(1, 1, 1);
          if (mat.uniforms?.litFactor?.value) {
            mat.uniforms.litFactor.value.setRGB(1, 1, 1);
          }
          if (mat.uniforms?.shadeColorFactor?.value) {
            mat.uniforms.shadeColorFactor.value.setRGB(1, 1, 1);
          }
        }
        mat.needsUpdate = true;
      }
    });
  }

  /** @private */
  _parseHex(hex) {
    return {
      r: parseInt(hex.slice(1, 3), 16) / 255,
      g: parseInt(hex.slice(3, 5), 16) / 255,
      b: parseInt(hex.slice(5, 7), 16) / 255,
    };
  }
}
