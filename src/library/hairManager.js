/**
 * HairManager - Hair system for VRoid VRM avatars
 *
 * Two-slot architecture:
 *   MAIN  — Complete hair style (Classic, A-Z, 1-11). Loaded as-is, no filtering.
 *   BANGS — Optional overlay (FA-FH). Layered on top of main hair.
 *
 * Three-channel color tinting:
 *   baseColor  — Highlight / lit areas (material.color)
 *   shadeColor — Shadow / dark areas (MToon shadeColorFactor)
 *   outlineColor — Edge outline (MToon outlineColorFactor)
 *
 * Three-phase sync keeps hair aligned with the base model:
 *   1. BONE DRIFT COMPENSATION — Slider-driven bone transforms cancelled for hair
 *   2. VISUAL HEAD TRACKING — Face mesh Y displacement applied as hair vertex offset
 *   3. VERTEX RESCALING — Scale hair geometry around head center with distance falloff
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";

/**
 * MAIN presets: complete hair styles loaded as-is (all meshes).
 */
export const MAIN_HAIR_PRESETS = [
  { id: "none", name: "None", url: null, headScale: 1.0 },
  { id: "shorthair", name: "Short", url: "./vrm-data/hairs/style_shorthair.vrm", headScale: 1.286 },
  { id: "medium", name: "Medium", url: "./vrm-data/hairs/style_medium.vrm", headScale: 1.139 },
  { id: "longhair", name: "Long", url: "./vrm-data/hairs/style_longhair.vrm", headScale: 1.120 },
  ...Array.from({ length: 26 }, (_, i) => {
    const letter = String.fromCharCode(65 + i);
    return { id: letter, name: letter, url: `./vrm-data/hairs/${letter}.vrm`, headScale: 1.0 };
  }),
  ...Array.from({ length: 11 }, (_, i) => ({
    id: `${i + 1}`, name: `${i + 1}`, url: `./vrm-data/hairs/${i + 1}.vrm`, headScale: 1.0,
  })),
];

/**
 * BANGS OVERLAY presets: front-only VRMs layered on top of main hair.
 */
export const BANGS_OVERLAY_PRESETS = [
  { id: "none", name: "None", url: null, headScale: 1.0 },
  ...Array.from({ length: 8 }, (_, i) => {
    const letter = String.fromCharCode(65 + i);
    return { id: `F${letter}`, name: `F${letter}`, url: `./vrm-data/hairs/front/F${letter}.vrm`, headScale: 1.0 };
  }),
];

// Backward compatibility
export const HAIR_PRESETS = MAIN_HAIR_PRESETS;
export const CLASSIC_HAIR_PRESETS = MAIN_HAIR_PRESETS;

/**
 * Data for one hair slot (main or bangs).
 */
class HairSlot {
  constructor(name) {
    this.name = name;
    this.group = null;
    this.presetId = "none";
    this.meshData = []; // [{posAttr, origPositions}]
    this.skeletonDataList = []; // [{skeleton, baseBoneWorlds, origInverses}]
    this.springBones = []; // Spring bones owned by this slot
    this.baseHeadScale = 1.0;
    this.hairHeadCenter = null;
    this.lastScale = -1;
  }

  clear() {
    this.group = null;
    this.presetId = "none";
    this.meshData = [];
    this.skeletonDataList = [];
    this.springBones = [];
    this.baseHeadScale = 1.0;
    this.hairHeadCenter = null;
    this.lastScale = -1;
  }
}

export class HairManager {
  constructor() {
    this._main = new HairSlot("main");
    this._bangs = new HairSlot("bangs");
    this._cache = new Map(); // url -> { allHairData, hairHeadCenter }
    this.loading = false;
    this._baseFaceCenterY = null;
    this._baseFaceExtent = null;
    this._hairColor = null;
    this._hairOpacity = 1.0;
    this._outlineWidth = null; // null = use VRM default, number = override
    this._tempMatrix = new THREE.Matrix4();
    this._loader = new GLTFLoader();
    this._loader.register((parser) => new VRMLoaderPlugin(parser, { autoUpdateHumanBones: true }));
  }

  /** Backward-compatible getter */
  get currentPresetId() {
    return this._main.presetId;
  }

  /**
   * Apply a main hair preset (complete style, all meshes).
   * Does NOT touch bangs overlay.
   */
  async applyMainPreset(presetId, baseScene, threeScene, morphDataManager = null, sliderValues = null) {
    const preset = MAIN_HAIR_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    await this._applyToSlot(this._main, preset, baseScene, threeScene, morphDataManager, sliderValues);
  }

  /**
   * Apply a bangs overlay preset (FA-FH, layered on top of main).
   * Does NOT touch main hair.
   */
  async applyBangsPreset(presetId, baseScene, threeScene, morphDataManager = null, sliderValues = null) {
    const preset = BANGS_OVERLAY_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    await this._applyToSlot(this._bangs, preset, baseScene, threeScene, morphDataManager, sliderValues);
  }

  /**
   * Backward-compatible: apply preset by ID from any list.
   */
  async applyPreset(presetId, baseScene, threeScene, morphDataManager = null, sliderValues = null) {
    if (MAIN_HAIR_PRESETS.find((p) => p.id === presetId)) {
      await this.applyMainPreset(presetId, baseScene, threeScene, morphDataManager, sliderValues);
    } else if (BANGS_OVERLAY_PRESETS.find((p) => p.id === presetId)) {
      await this.applyBangsPreset(presetId, baseScene, threeScene, morphDataManager, sliderValues);
    }
  }

  /**
   * Core: load VRM, bind all meshes to slot.
   * @private
   */
  async _applyToSlot(slot, preset, baseScene, threeScene, morphDataManager, sliderValues) {
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
      const { allHairData, hairHeadCenter } = cached;

      if (!allHairData || allHairData.length === 0) {
        console.warn(`[HairManager] No hair meshes found in ${preset.url}`);
        this.loading = false;
        return;
      }

      slot.hairHeadCenter = hairHeadCenter;
      slot.baseHeadScale = preset.headScale;
      slot.meshData = [];
      slot.skeletonDataList = [];
      slot.springBones = [];
      slot.lastScale = -1;

      const slotBoneMap = new Map(); // Per-slot spring bones

      // Build baseBoneMap excluding spring bones from the other slot
      const otherSlotBones = new Set();
      const otherSlot = slot === this._main ? this._bangs : this._main;
      for (const b of otherSlot.springBones) otherSlotBones.add(b.name);

      const baseBoneMap = new Map();
      baseScene.traverse((child) => {
        if (child.isBone && !otherSlotBones.has(child.name)) baseBoneMap.set(child.name, child);
      });

      const hairGroup = new THREE.Group();
      hairGroup.name = `Hair_${slot.name}_${preset.id}`;
      hairGroup.userData.isHair = true;
      hairGroup.userData.hairSlot = slot.name;

      const cx = hairHeadCenter?.x || 0;
      const cy = hairHeadCenter?.y || 0;
      const cz = hairHeadCenter?.z || 0;

      for (const data of allHairData) {
        const geometry = data.geometry.clone();
        const material = Array.isArray(data.material)
          ? data.material.map((m) => m.clone())
          : data.material.clone();

        const posAttr = geometry.getAttribute("position");
        const origPositions = new Float32Array(posAttr.array);

        // Initial head-scale vertex adjustment
        const s = preset.headScale;
        const maxDist = 0.25;
        const fadeRange = 0.35;
        const minFalloff = 0.35;
        const positions = posAttr.array;
        for (let i = 0; i < positions.length; i += 3) {
          const dx = positions[i] - cx;
          const dy = positions[i + 1] - cy;
          const dz = positions[i + 2] - cz;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          let falloff = 1.0;
          if (dist > maxDist) {
            falloff = Math.max(minFalloff, 1.0 - (dist - maxDist) / fadeRange);
          }
          const effectiveScale = 1.0 + (s - 1.0) * falloff;
          positions[i] = cx + dx * effectiveScale;
          positions[i + 1] = cy + dy * effectiveScale;
          positions[i + 2] = cz + dz * effectiveScale;
        }
        posAttr.needsUpdate = true;
        geometry.computeBoundingSphere();

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
        skinnedMesh.userData.isHair = true;
        skinnedMesh.userData.hairSlot = slot.name;

        const mats = Array.isArray(material) ? material : [material];
        mats.forEach((m) => { if (m) m.side = THREE.DoubleSide; });

        // Apply current color if set (3-channel)
        if (this._hairColor) {
          // Ensure outline material exists for 3ch color
          if (typeof this._hairColor === "object" && this._hairColor.outline) {
            this._ensureOutlineMaterial(skinnedMesh);
            // Re-read mats after potential array change
            const updatedMats = Array.isArray(skinnedMesh.material) ? skinnedMesh.material : [skinnedMesh.material];
            this._applyColorToMaterials(updatedMats, this._hairColor);
          } else {
            this._applyColorToMaterials(mats, this._hairColor);
          }
        }
        // Apply current outline width if set
        if (this._outlineWidth != null && this._outlineWidth > 0) {
          this._ensureOutlineMaterial(skinnedMesh);
          const allMats = Array.isArray(skinnedMesh.material) ? skinnedMesh.material : [skinnedMesh.material];
          for (const m of allMats) {
            if (m?.uniforms?.outlineWidthFactor) {
              m.uniforms.outlineWidthFactor.value = this._outlineWidth;
            }
          }
        }
        // Apply current opacity if not default
        if (this._hairOpacity < 1.0) {
          const opacityMats = Array.isArray(skinnedMesh.material) ? skinnedMesh.material : [skinnedMesh.material];
          this._applyOpacityToMaterials(opacityMats, this._hairOpacity);
        }

        const skeleton = new THREE.Skeleton(bones, inverses);
        skinnedMesh.bind(skeleton, new THREE.Matrix4());
        hairGroup.add(skinnedMesh);

        baseScene.updateMatrixWorld(true);
        const baseBoneWorlds = bones.map((b) => b.matrixWorld.clone());
        const origInversesCopy = inverses.map((m) => m.clone());
        slot.skeletonDataList.push({ skeleton, baseBoneWorlds, origInverses: origInversesCopy });
        slot.meshData.push({ posAttr, origPositions });
      }

      baseScene.add(hairGroup);
      slot.group = hairGroup;
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
        this._baseFaceCenterY = this._computeFaceCenterY(baseScene);
        this._baseFaceExtent = this._computeFaceExtent(baseScene);

        morphDataManager.setSliders(savedValues, baseScene);
        this.syncBones(baseScene, savedValues);
      } else {
        this._baseFaceCenterY = this._computeFaceCenterY(baseScene);
        this._baseFaceExtent = this._computeFaceExtent(baseScene);
      }

      console.log(`[HairManager] Applied ${slot.name}: ${preset.name} (${allHairData.length} meshes)`);
    } catch (err) {
      console.error(`[HairManager] Error loading ${slot.name}:`, err);
    } finally {
      this.loading = false;
    }
  }

  /**
   * Load and cache VRM hair data.
   * @private
   */
  async _ensureCached(url) {
    if (this._cache.has(url)) return;

    const gltf = await this._loader.loadAsync(url);
    const scene = gltf.userData.vrm?.scene || gltf.scene;
    scene.updateMatrixWorld(true);

    let hairHeadCenter = null;
    scene.traverse((child) => {
      if (child.isBone && child.name === "J_Bip_C_Head") {
        hairHeadCenter = new THREE.Vector3();
        child.getWorldPosition(hairHeadCenter);
      }
    });

    const allHairData = [];
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

      allHairData.push({
        geometry: child.geometry,
        material: child.material,
        name: child.name,
        boneNames,
        boneInverses,
        boneLocalTransforms,
      });
    });

    console.log(`[HairManager] Cached ${url}: ${allHairData.length} hair meshes`);
    this._cache.set(url, { allHairData, hairHeadCenter });
  }

  /**
   * Sync both hair slots with body parameter changes (three-phase compensation).
   */
  syncBones(vrmScene, sliderValues) {
    if (!sliderValues) return;
    if (!this._main.group && !this._bangs.group) return;

    // Phase 1: Bone drift compensation for both slots
    this._compensateBoneDrift(this._main);
    this._compensateBoneDrift(this._bangs);
    vrmScene.updateMatrixWorld(true);

    // Phase 1b: Visual head tracking
    const visualOffsetY = this._getVisualHeadOffsetY(vrmScene);

    // Phase 2: Vertex rescaling + visual offset
    const faceExtent = this._computeFaceExtent(vrmScene);

    this._rescaleSlot(this._main, faceExtent, visualOffsetY);
    this._rescaleSlot(this._bangs, faceExtent, visualOffsetY);
  }

  /** @private */
  _rescaleSlot(slot, faceExtent, visualOffsetY) {
    if (slot.meshData.length === 0) return;

    let scaleXZ = 1.0;
    let scaleY = 1.0;
    if (this._baseFaceExtent && faceExtent) {
      if (this._baseFaceExtent.width > 0) scaleXZ = faceExtent.width / this._baseFaceExtent.width;
      if (this._baseFaceExtent.height > 0) scaleY = faceExtent.height / this._baseFaceExtent.height;
    }

    const combinedScale = slot.baseHeadScale * scaleXZ;
    const combinedScaleY = slot.baseHeadScale * scaleY;
    const backCoverageBoost = 1.0 + 0.15 * Math.max(0, scaleXZ - 1.0);
    const combinedScaleBack = slot.baseHeadScale * scaleXZ * backCoverageBoost;

    const cx = slot.hairHeadCenter?.x || 0;
    const cy = slot.hairHeadCenter?.y || 0;
    const cz = slot.hairHeadCenter?.z || 0;

    const maxDist = 0.25;
    const fadeRange = 0.35;
    const minFalloff = 0.35;

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
        const effectiveScale = 1.0 + (combinedScale - 1.0) * falloff;
        const effectiveScaleY = 1.0 + (combinedScaleY - 1.0) * falloff;

        positions[i] = cx + dx * effectiveScale;
        positions[i + 1] = cy + dy * effectiveScaleY + visualOffsetY;

        let effectiveScaleZ = effectiveScale;
        if (dz < 0) {
          effectiveScaleZ = 1.0 + (combinedScaleBack - 1.0) * falloff;
        }
        positions[i + 2] = cz + dz * effectiveScaleZ;
      }
      posAttr.needsUpdate = true;
    }
  }

  /** @private */
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

  /** @private */
  _getVisualHeadOffsetY(vrmScene) {
    if (this._baseFaceCenterY == null) return 0;
    const currentY = this._computeFaceCenterY(vrmScene);
    if (currentY == null) return 0;
    return currentY - this._baseFaceCenterY;
  }

  /** @private */
  _computeFaceCenterY(scene) {
    let result = null;
    scene.traverse((child) => {
      if (result !== null) return;
      if (!child.isMesh || !child.geometry) return;
      const name = (child.name || "").toLowerCase();
      if (!name.includes("face") && !name.includes("head")) return;
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
  _computeFaceExtent(scene) {
    let result = null;
    scene.traverse((child) => {
      if (result !== null) return;
      if (!child.isMesh || !child.geometry) return;
      const name = (child.name || "").toLowerCase();
      if (!name.includes("face") && !name.includes("head")) return;
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
   * Create or retrieve a spring bone for a specific slot.
   * @private
   */
  _ensureSpringBone(boneName, localTransforms, baseBoneMap, slotBoneMap, slot) {
    if (baseBoneMap.has(boneName)) return baseBoneMap.get(boneName);
    if (slotBoneMap.has(boneName)) return slotBoneMap.get(boneName);

    const boneData = localTransforms.get(boneName);
    if (!boneData) {
      return baseBoneMap.get("J_Bip_C_Head") || [...baseBoneMap.values()][0];
    }

    let parentBone;
    if (boneData.parentName && localTransforms.has(boneData.parentName)) {
      parentBone = this._ensureSpringBone(boneData.parentName, localTransforms, baseBoneMap, slotBoneMap, slot);
    } else if (boneData.parentName && (baseBoneMap.has(boneData.parentName) || slotBoneMap.has(boneData.parentName))) {
      parentBone = baseBoneMap.get(boneData.parentName) || slotBoneMap.get(boneData.parentName);
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

  /** @private */
  _removeCurrentHair(baseScene) {
    this._removeSlot(this._main, baseScene);
    this._removeSlot(this._bangs, baseScene);
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

  /**
   * Parse hex color to RGB floats.
   * @private
   */
  _parseHex(hex) {
    return {
      r: parseInt(hex.slice(1, 3), 16) / 255,
      g: parseInt(hex.slice(3, 5), 16) / 255,
      b: parseInt(hex.slice(5, 7), 16) / 255,
    };
  }

  /**
   * Apply 3-channel color tinting to material array.
   * @private
   * @param {Array} mats - Material array
   * @param {string|object} colorInput - Hex string (auto-derives shade/outline)
   *   or { base: "#hex", shade: "#hex", outline: "#hex" } for independent control
   */
  _applyColorToMaterials(mats, colorInput) {
    let base, shade, outline;
    if (typeof colorInput === "object" && colorInput.base) {
      base = this._parseHex(colorInput.base);
      shade = this._parseHex(colorInput.shade || colorInput.base);
      outline = this._parseHex(colorInput.outline || colorInput.base);
    } else {
      base = this._parseHex(colorInput);
      shade = { r: base.r * 0.65, g: base.g * 0.65, b: base.b * 0.65 };
      outline = { r: base.r * 0.25, g: base.g * 0.25, b: base.b * 0.25 };
    }

    for (const mat of mats) {
      if (!mat) continue;
      const isOutlineMat = mat.isOutline || (mat.name && mat.name.includes("(Outline)"));

      // Base color (highlight / lit areas)
      // MToon uses litFactor uniform, not material.color
      if (mat.uniforms?.litFactor?.value) {
        mat.uniforms.litFactor.value.setRGB(base.r, base.g, base.b);
      }
      if (mat.color) {
        mat.color.setRGB(base.r, base.g, base.b);
      }

      // Shade color (shadow / dark areas) - MToon property
      if (mat.uniforms?.shadeColorFactor?.value) {
        mat.uniforms.shadeColorFactor.value.setRGB(shade.r, shade.g, shade.b);
      } else if (mat.shadeColorFactor?.isColor) {
        mat.shadeColorFactor.setRGB(shade.r, shade.g, shade.b);
      }

      // Outline color - MToon property (set on ALL materials; shader only uses it in OUTLINE path)
      if (mat.uniforms?.outlineColorFactor?.value) {
        mat.uniforms.outlineColorFactor.value.setRGB(outline.r, outline.g, outline.b);
      } else if (mat.outlineColorFactor?.isColor) {
        mat.outlineColorFactor.setRGB(outline.r, outline.g, outline.b);
      }

      // For outline materials, also ensure outlineWidthFactor is non-zero
      // so the outline is actually visible
      if (isOutlineMat && mat.uniforms?.outlineWidthFactor) {
        if (mat.uniforms.outlineWidthFactor.value === 0) {
          mat.uniforms.outlineWidthFactor.value = 0.002;
        }
      }

      mat.needsUpdate = true;
    }
  }

  /**
   * Set hair color with 3-channel MToon tinting on both slots.
   * @param {string|object|null} hexColor - Hex string, { base, shade, outline } object, or null for default
   */
  setHairColor(hexColor) {
    this._hairColor = hexColor;
    const is3ch = typeof hexColor === "object" && hexColor?.base;

    const applyToGroup = (group) => {
      if (!group) return;
      group.traverse((child) => {
        if (!child.isMesh) return;

        // When 3ch color is set, ensure outline material exists
        if (is3ch && hexColor.outline) {
          this._ensureOutlineMaterial(child);
        }

        const mats = Array.isArray(child.material) ? child.material : [child.material];
        if (hexColor) {
          this._applyColorToMaterials(mats, hexColor);
        } else {
          // Restore defaults
          for (const mat of mats) {
            if (!mat) continue;
            const isOutline = mat.isOutline || (mat.name && mat.name.includes("(Outline)"));

            if (mat.uniforms?.litFactor?.value) {
              mat.uniforms.litFactor.value.setRGB(1, 1, 1);
            }
            if (mat.color) mat.color.setRGB(1, 1, 1);
            if (mat.uniforms?.shadeColorFactor?.value) {
              mat.uniforms.shadeColorFactor.value.setRGB(1, 1, 1);
            } else if (mat.shadeColorFactor?.isColor) {
              mat.shadeColorFactor.setRGB(1, 1, 1);
            }
            if (mat.uniforms?.outlineColorFactor?.value) {
              mat.uniforms.outlineColorFactor.value.setRGB(0, 0, 0);
            } else if (mat.outlineColorFactor?.isColor) {
              mat.outlineColorFactor.setRGB(0, 0, 0);
            }
            mat.needsUpdate = true;
          }
        }
      });
    };

    applyToGroup(this._main.group);
    applyToGroup(this._bangs.group);
  }

  getHairColor() {
    return this._hairColor || null;
  }

  /**
   * Apply opacity to material array.
   * @private
   */
  _applyOpacityToMaterials(mats, opacity) {
    for (const mat of mats) {
      if (!mat) continue;
      mat.opacity = opacity;
      mat.transparent = opacity < 1.0;

      // MToon: set uniform directly and handle OPAQUE define
      if (mat.uniforms?.opacity) {
        mat.uniforms.opacity.value = opacity;
      }
      if (opacity < 1.0) {
        // Remove OPAQUE define so shader respects opacity
        if (mat.defines?.OPAQUE !== undefined) {
          delete mat.defines.OPAQUE;
          mat.needsUpdate = true; // Force shader recompilation
        }
        mat.depthWrite = true; // Prevent sorting artifacts
      } else {
        // Restore OPAQUE when fully opaque
        if (mat.defines && mat.defines.OPAQUE === undefined) {
          mat.defines.OPAQUE = "";
          mat.needsUpdate = true;
        }
      }
    }
  }

  /**
   * Set hair opacity on both slots.
   * @param {number} opacity - 0.0 (invisible) to 1.0 (fully opaque)
   */
  setHairOpacity(opacity) {
    this._hairOpacity = Math.max(0, Math.min(1, opacity));

    const applyToGroup = (group) => {
      if (!group) return;
      group.traverse((child) => {
        if (!child.isMesh) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        this._applyOpacityToMaterials(mats, this._hairOpacity);
      });
    };

    applyToGroup(this._main.group);
    applyToGroup(this._bangs.group);
  }

  getHairOpacity() {
    return this._hairOpacity;
  }

  /**
   * Ensure a mesh has an outline material. If it only has a single surface material,
   * clone it to create an outline material (mimicking MToon's _generateOutline).
   * @private
   * @returns {boolean} true if outline material exists (or was just created)
   */
  _ensureOutlineMaterial(mesh) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    // Check if outline material already exists
    const hasOutline = mats.some((m) => m && (m.isOutline || (m.name && m.name.includes("(Outline)"))));
    if (hasOutline) return true;

    // Only create for MToon materials (has uniforms.outlineColorFactor)
    const surfaceMat = mats[0];
    if (!surfaceMat || !surfaceMat.uniforms?.outlineColorFactor) return false;

    // Create outline material clone
    const outlineMat = surfaceMat.clone();
    outlineMat.name += " (Outline)";
    outlineMat.isOutline = true;
    outlineMat.side = THREE.BackSide;

    // Set default outline width if not already set
    if (outlineMat.uniforms?.outlineWidthFactor) {
      if (outlineMat.uniforms.outlineWidthFactor.value === 0) {
        outlineMat.uniforms.outlineWidthFactor.value = 0.002;
      }
    }

    // Convert to array material and set up geometry groups
    mesh.material = [surfaceMat, outlineMat];
    const geometry = mesh.geometry;
    if (geometry && geometry.groups.length === 0) {
      const vertexCount = geometry.index ? geometry.index.count : geometry.attributes.position.count;
      geometry.addGroup(0, vertexCount, 0);
      geometry.addGroup(0, vertexCount, 1);
    }

    outlineMat.needsUpdate = true;
    console.log(`[HairManager] Created outline material for ${mesh.name}`);
    return true;
  }

  /**
   * Set outline width on all hair meshes.
   * @param {number} width - Outline width in world units (0 = hidden, 0.001-0.01 typical)
   */
  setOutlineWidth(width) {
    this._outlineWidth = width;

    const applyToGroup = (group) => {
      if (!group) return;
      group.traverse((child) => {
        if (!child.isMesh) return;
        // Ensure outline material exists if width > 0
        if (width > 0) this._ensureOutlineMaterial(child);

        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of mats) {
          if (!mat) continue;
          if (mat.uniforms?.outlineWidthFactor) {
            mat.uniforms.outlineWidthFactor.value = width;
          }
        }
      });
    };

    applyToGroup(this._main.group);
    applyToGroup(this._bangs.group);
  }

  getOutlineWidth() {
    return this._outlineWidth;
  }

  /** Get current main preset ID */
  getMainPresetId() {
    return this._main.presetId;
  }

  /** Get current bangs preset ID */
  getBangsPresetId() {
    return this._bangs.presetId;
  }

  /** Check if any hair is applied */
  hasHair() {
    return this._main.presetId !== "none" || this._bangs.presetId !== "none";
  }

  /**
   * Remove all hair from the scene (public API for reset).
   * @param {THREE.Object3D} baseScene
   */
  removeAllHair(baseScene) {
    this._removeCurrentHair(baseScene);
    this._hairColor = null;
    this._hairOpacity = 1.0;
    this._outlineWidth = null;
  }

  /**
   * Export current hair state for serialization.
   * @returns {{ mainStyle: string, bangsStyle: string, color: *, opacity: number, outlineWidth: number|null }}
   */
  getState() {
    return {
      mainStyle: this._main.presetId,
      bangsStyle: this._bangs.presetId,
      color: this._hairColor ? (typeof this._hairColor === "object" ? { ...this._hairColor } : this._hairColor) : null,
      opacity: this._hairOpacity,
      outlineWidth: this._outlineWidth,
    };
  }

  dispose() {
    this._cache.clear();
    this._main.clear();
    this._bangs.clear();
    this._hairColor = null;
    this._outlineWidth = null;
  }
}
