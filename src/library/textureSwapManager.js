/**
 * TextureSwapManager — Manages individual texture category swapping for VRM avatars.
 *
 * Supports swapping textures by category (iris, brow, eyelash, eyeline, mouth,
 * eye_white, highlight, face_skin, clothing) using pre-extracted texture variants
 * from the textures/index.json manifest.
 *
 * Architecture:
 * - Lazy loads the texture index on first use
 * - Caches base textures per material slot for restoration
 * - Each category can be swapped independently
 * - Clothing swaps target Body mesh materials, face categories target Face mesh materials
 */
import * as THREE from "three";

/**
 * Swappable texture categories with their target mesh and material info.
 * Each entry maps a category key to the mesh type it targets.
 */
const CATEGORY_MESH_MAP = {
  iris: "Face",
  highlight: "Face",
  face_skin: "Face",
  mouth: "Face",
  eye_white: "Face",
  brow: "Face",
  eyelash: "Face",
  eyeline: "Face",
  // Clothing targets Body mesh
  body_skin_clothed: "Body",
  body_normal_clothed: "Body",
  bottoms: "Body",
  shoes: "Body",
  tops: "Body",
};

/**
 * Display names for UI presentation.
 */
export const TEXTURE_CATEGORY_DISPLAY = {
  iris: "Iris",
  highlight: "Highlight",
  face_skin: "Face Skin",
  mouth: "Mouth",
  eye_white: "Eye White",
  brow: "Eyebrows",
  eyelash: "Eyelash",
  eyeline: "Eye Line",
};

/**
 * Clothing piece display names.
 */
export const CLOTHING_DISPLAY = {
  tops: "Tops",
  bottoms: "Bottoms",
  shoes: "Shoes",
};

/**
 * Available outfit sets (populated from index.json at runtime).
 * @type {Array<{id: string, name: string}>}
 */
export let OUTFIT_LIST = [];

/**
 * Character variant display names and descriptions.
 */
export const CHARACTER_VARIANTS = [
  { id: "E", name: "Type E", description: "Character variant E" },
  { id: "G", name: "Type G", description: "Character variant G" },
  { id: "I", name: "Type I", description: "Character variant I" },
];

export class TextureSwapManager {
  constructor() {
    /** @type {Object|null} Full texture index from index.json */
    this._index = null;
    /** @type {boolean} */
    this.loaded = false;

    /** @type {Map<string, THREE.Texture>} category:slotKey → base texture */
    this._baseTextures = new Map();
    /** @type {boolean} */
    this._baseCached = false;

    /** @type {Object<string, string|null>} category → current variant ID (null = base) */
    this.activeVariants = {};

    /** @type {THREE.TextureLoader} */
    this._loader = new THREE.TextureLoader();

    /** @type {Map<string, THREE.Texture>} URL → cached loaded texture */
    this._textureCache = new Map();
  }

  /**
   * Load the texture index manifest.
   * @param {string} url - Path to textures/index.json
   */
  async loadIndex(url) {
    if (this._index) return;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to load texture index: ${resp.status}`);
    this._index = await resp.json();
    this.loaded = true;

    // Initialize active variants
    for (const cat of Object.keys(this._index.categories)) {
      if (this._index.categories[cat].swappable) {
        this.activeVariants[cat] = null; // null = base/default
      }
    }

    // Populate outfit list from clothing.outfits
    const clothing = this._index.categories.clothing;
    if (clothing?.outfits) {
      OUTFIT_LIST = clothing.outfits.map((o) => ({ id: o.id, name: o.name, footSwap: o.footSwap === true }));
    }

    console.log(
      `[TextureSwapManager] Loaded index: ${Object.keys(this._index.categories).length} categories, ` +
      `${OUTFIT_LIST.length} outfits`
    );
  }

  /**
   * Get available swappable categories.
   * @returns {string[]}
   */
  getSwappableCategories() {
    if (!this._index) return [];
    return Object.entries(this._index.categories)
      .filter(([, v]) => v.swappable)
      .map(([k]) => k);
  }

  /**
   * Get variant count for a category.
   * @param {string} category
   * @returns {number}
   */
  getVariantCount(category) {
    if (!this._index) return 0;
    const cat = this._index.categories[category];
    if (!cat || !cat.textures) return 0;
    return cat.textures.length;
  }

  /**
   * Get variant info list for a category.
   * @param {string} category
   * @returns {Array<{id: string, name: string, file: string}>}
   */
  getVariants(category) {
    if (!this._index) return [];
    const cat = this._index.categories[category];
    if (!cat || !cat.textures) return [];
    return cat.textures.map((t, i) => ({
      id: String(i + 1),
      name: t.name || `Variant ${i + 1}`,
      file: t.file,
    }));
  }

  /**
   * Get the clothing texture entries from the index.
   * @returns {Array<{name: string, file: string, material: string}>}
   */
  getClothingTextures() {
    if (!this._index) return [];
    const clothing = this._index.categories.clothing;
    if (!clothing) return [];
    return clothing.textures || [];
  }

  /**
   * Cache base textures from the current VRM scene for later restoration.
   * Must be called once after VRM loads.
   * @param {THREE.Object3D} vrmScene
   */
  cacheBaseTextures(vrmScene) {
    if (this._baseCached) return;

    const materials = this._collectAllMaterials(vrmScene);

    for (const [matName, mat] of materials.entries()) {
      // Cache baseColor map
      if (mat.map) {
        const key = `${matName}:map`;
        this._baseTextures.set(
          key,
          typeof mat.map.clone === "function" ? mat.map.clone() : mat.map
        );
      }
      // Cache normal map
      if (mat.normalMap) {
        const key = `${matName}:normalMap`;
        this._baseTextures.set(
          key,
          typeof mat.normalMap.clone === "function" ? mat.normalMap.clone() : mat.normalMap
        );
      }
      // Cache shadeMultiplyTexture (MToon)
      if (mat.userData?.shadeMultiplyTexture) {
        const key = `${matName}:shadeMultiplyTexture`;
        const shadeTex = mat.userData.shadeMultiplyTexture;
        this._baseTextures.set(
          key,
          typeof shadeTex.clone === "function" ? shadeTex.clone() : shadeTex
        );
      }
    }

    this._baseCached = true;
    console.log(`[TextureSwapManager] Cached ${this._baseTextures.size} base textures`);
  }

  /**
   * Swap a texture category to a specific variant.
   * @param {string} category - e.g. "iris", "brow", "tops"
   * @param {string|null} variantId - variant number (1-based string), or null to reset to base
   * @param {THREE.Object3D} vrmScene
   */
  async swapTexture(category, variantId, vrmScene) {
    if (!this._index) return;

    // Ensure base textures are cached
    if (!this._baseCached) {
      this.cacheBaseTextures(vrmScene);
    }

    const catData = this._index.categories[category];
    if (!catData) {
      console.warn(`[TextureSwapManager] Unknown category: ${category}`);
      return;
    }

    this.activeVariants[category] = variantId;

    if (!variantId) {
      // Reset to base
      await this._restoreCategoryBase(category, catData, vrmScene);
      return;
    }

    // Find the variant texture entry
    const variantIndex = parseInt(variantId, 10) - 1;
    const texEntry = catData.textures?.[variantIndex];
    if (!texEntry) {
      console.warn(`[TextureSwapManager] Variant ${variantId} not found in ${category}`);
      return;
    }

    const materials = this._collectAllMaterials(vrmScene);
    const targetMat = texEntry.material;
    const mat = this._findMaterial(materials, targetMat);
    if (!mat) {
      console.warn(`[TextureSwapManager] Material not found: ${targetMat}`);
      return;
    }

    // Determine texture path
    const url = `./vrm-data/textures/${texEntry.file}`;

    // Determine which slot to apply to
    const texSlotInfo = this._getTextureSlot(category, catData);

    await this._loadAndApplyTexture(url, mat, texSlotInfo);
    console.log(`[TextureSwapManager] Swapped ${category} to variant ${variantId}`);
  }

  /**
   * Swap clothing texture (tops, bottoms, shoes).
   * Clothing is special: it applies to Body mesh materials.
   * @param {string} piece - "tops", "bottoms", "shoes"
   * @param {boolean} enable - true to apply clothing texture, false to reset to base skin
   * @param {THREE.Object3D} vrmScene
   */
  async swapClothing(piece, enable, vrmScene) {
    if (!this._index) return;
    if (!this._baseCached) this.cacheBaseTextures(vrmScene);

    const clothing = this._index.categories.clothing;
    if (!clothing) return;

    const texEntry = clothing.textures.find((t) => t.name === piece);
    if (!texEntry) return;

    const materials = this._collectAllMaterials(vrmScene);

    if (!enable) {
      // Restore base for this material
      const mat = this._findMaterial(materials, texEntry.material);
      if (mat) {
        const baseKey = `${texEntry.material}:map`;
        const baseTex = this._baseTextures.get(baseKey);
        if (baseTex) {
          mat.map = typeof baseTex.clone === "function" ? baseTex.clone() : baseTex;
          mat.needsUpdate = true;
        }
      }
      this.activeVariants[`clothing_${piece}`] = null;
      return;
    }

    const mat = this._findMaterial(materials, texEntry.material);
    if (!mat) return;

    const url = `./vrm-data/textures/${texEntry.file}`;
    await this._loadAndApplyTexture(url, mat, { slot: "map" });
    this.activeVariants[`clothing_${piece}`] = "1";
    console.log(`[TextureSwapManager] Applied clothing: ${piece}`);
  }

  /**
   * Apply full clothing set (body skin + normal + all clothing pieces).
   * @param {boolean} enable
   * @param {THREE.Object3D} vrmScene
   * @param {import('./morphDataManager').MorphDataManager} [morphDataManager] - For syncing morphs with swapped geometry
   */
  async applyFullClothing(enable, vrmScene, morphDataManager) {
    if (!this._index) return;
    if (!this._baseCached) this.cacheBaseTextures(vrmScene);

    const clothing = this._index.categories.clothing;
    if (!clothing) return;

    const materials = this._collectAllMaterials(vrmScene);

    for (const texEntry of clothing.textures) {
      const mat = this._findMaterial(materials, texEntry.material);
      if (!mat) continue;

      if (!enable) {
        // Restore base
        const isNormal = texEntry.name.includes("normal");
        const slotType = isNormal ? "normalMap" : "map";
        const baseKey = `${texEntry.material}:${slotType}`;
        const baseTex = this._baseTextures.get(baseKey);
        if (baseTex) {
          mat[slotType] = typeof baseTex.clone === "function" ? baseTex.clone() : baseTex;
          mat.needsUpdate = true;
        }
      } else {
        const url = `./vrm-data/textures/${texEntry.file}`;
        const isNormal = texEntry.name.includes("normal");
        await this._loadAndApplyTexture(url, mat, {
          slot: isNormal ? "normalMap" : "map",
          isNormal,
        });
      }
    }

    // Toggle toenail visibility with clothing
    await this._toggleNailTriangles(vrmScene, enable, morphDataManager);

    this.activeVariants.clothing = enable ? "1" : null;
    console.log(`[TextureSwapManager] ${enable ? "Applied" : "Removed"} full clothing set`);
  }

  /**
   * Apply a specific outfit set (A, B, C) from the index.
   * Swaps body skin + normal + all clothing piece textures for the selected outfit.
   * @param {string} outfitId - "A", "B", "C", etc.
   * @param {THREE.Object3D} vrmScene
   * @param {import('./morphDataManager').MorphDataManager} [morphDataManager]
   */
  async applyOutfit(outfitId, vrmScene, morphDataManager) {
    if (!this._index) return;
    if (!this._baseCached) this.cacheBaseTextures(vrmScene);

    const clothing = this._index.categories.clothing;
    if (!clothing?.outfits) return;

    const outfit = clothing.outfits.find((o) => o.id === outfitId);
    if (!outfit) {
      console.warn(`[TextureSwapManager] Outfit not found: ${outfitId}`);
      return;
    }

    const materials = this._collectAllMaterials(vrmScene);

    for (const texEntry of outfit.textures) {
      const mat = this._findMaterial(materials, texEntry.material);
      if (!mat) continue;

      const url = `./vrm-data/textures/${texEntry.file}`;
      const isNormal = texEntry.name.includes("normal");
      await this._loadAndApplyTexture(url, mat, {
        slot: isNormal ? "normalMap" : "map",
        isNormal,
      });
    }

    // Only swap foot geometry if outfit covers feet (socks/stockings)
    const needsFootSwap = outfit.footSwap === true;
    await this._toggleNailTriangles(vrmScene, needsFootSwap, morphDataManager);

    this.activeVariants.clothing = outfitId;
    console.log(`[TextureSwapManager] Applied outfit: ${outfit.name} (${outfit.textures.length} textures, footSwap=${needsFootSwap})`);
  }

  /**
   * Apply a full character variant (E, G, I) — swaps all face + body textures at once.
   * Each variant provides a complete texture set (mouth, iris, highlight, face_skin,
   * face_normal, eye_white, brow, eyeline, body_skin, body_normal).
   * @param {string|null} variantId - "E", "G", "I", or null to restore base
   * @param {THREE.Object3D} vrmScene
   */
  async applyCharacterVariant(variantId, vrmScene) {
    if (!this._index) return;
    if (!this._baseCached) this.cacheBaseTextures(vrmScene);

    const variants = this._index.categories.variants;
    if (!variants) return;

    const materials = this._collectAllMaterials(vrmScene);

    if (!variantId) {
      // Restore all variant-affected materials to base
      const variantSlots = [
        "mouth", "iris", "highlight", "face_skin", "face_normal",
        "eye_white", "brow", "eyeline", "body_skin", "body_normal",
      ];
      for (const texEntry of variants.textures) {
        const mat = this._findMaterial(materials, texEntry.material);
        if (!mat) continue;
        const isNormal = texEntry.name.includes("normal");
        const slotType = isNormal ? "normalMap" : "map";
        const baseKey = `${texEntry.material}:${slotType}`;
        const baseTex = this._baseTextures.get(baseKey);
        if (baseTex) {
          mat[slotType] = typeof baseTex.clone === "function" ? baseTex.clone() : baseTex;
          mat.needsUpdate = true;
        }
      }
      this.activeVariants.characterVariant = null;
      console.log("[TextureSwapManager] Restored to base character");
      return;
    }

    // Find all textures for this variant (prefix match: "E_", "G_", "I_")
    const prefix = `${variantId}_`;
    const variantTextures = variants.textures.filter((t) => t.name.startsWith(prefix));

    if (variantTextures.length === 0) {
      console.warn(`[TextureSwapManager] No variant textures found for: ${variantId}`);
      return;
    }

    for (const texEntry of variantTextures) {
      const mat = this._findMaterial(materials, texEntry.material);
      if (!mat) continue;

      const url = `./vrm-data/textures/${texEntry.file}`;
      const isNormal = texEntry.name.includes("normal");
      await this._loadAndApplyTexture(url, mat, {
        slot: isNormal ? "normalMap" : "map",
        isNormal,
      });
    }

    this.activeVariants.characterVariant = variantId;
    console.log(`[TextureSwapManager] Applied character variant: ${variantId} (${variantTextures.length} textures)`);
  }

  /**
   * Build a nearest-neighbor vertex correspondence map from no_nail Body_2
   * vertices to original girl.vrm Body vertices.
   * @private
   * @param {Float32Array} origBodyArr - Original Body shared position array
   * @param {number} origBodyCount - Number of vertices in original Body
   * @param {Float32Array} noNailArr - no_nail Body_2 position array
   * @param {number} noNailCount - Number of vertices in no_nail Body_2
   * @returns {Int32Array} Map: noNailIdx → origBodyIdx
   */
  _buildVertexMap(origBodyArr, origBodyCount, noNailArr, noNailCount) {
    const map = new Int32Array(noNailCount);

    for (let i = 0; i < noNailCount; i++) {
      const nx = noNailArr[i * 3];
      const ny = noNailArr[i * 3 + 1];
      const nz = noNailArr[i * 3 + 2];
      let bestDist = Infinity;
      let bestIdx = 0;

      for (let j = 0; j < origBodyCount; j++) {
        const dx = origBodyArr[j * 3] - nx;
        const dy = origBodyArr[j * 3 + 1] - ny;
        const dz = origBodyArr[j * 3 + 2] - nz;
        const dist = dx * dx + dy * dy + dz * dz;
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = j;
        }
      }
      map[i] = bestIdx;
    }

    console.log(`[TextureSwapManager] Built vertex map: ${noNailCount} → ${origBodyCount} vertices`);
    return map;
  }

  /**
   * Swap Body_2 between girl.vrm (bare feet) and no_nail.vrm (sock-ready feet).
   * Loads no_nail.vrm via GLTFLoader to get properly skinned Body_2, then
   * rebinds it to girl.vrm's skeleton for correct animation.
   * Also builds a vertex correspondence map so morph deltas can be applied
   * to the swapped geometry.
   * @private
   * @param {THREE.Object3D} vrmScene
   * @param {boolean} clothingEnabled
   * @param {import('./morphDataManager').MorphDataManager} [morphDataManager]
   */
  async _toggleNailTriangles(vrmScene, clothingEnabled, morphDataManager) {
    // Find Body_2 in girl scene
    let footMesh = null;
    vrmScene.traverse((child) => {
      if (child.isMesh && child.name === "Body_2") {
        footMesh = child;
      }
    });
    if (!footMesh) return;

    if (clothingEnabled) {
      // Cache original geometry + bind state once
      if (!this._originalFootGeo) {
        this._originalFootGeo = footMesh.geometry;
        this._originalFootBindMatrix = footMesh.bindMatrix.clone();
        this._originalFootBindMatrixInverse = footMesh.bindMatrixInverse.clone();
      }

      // Load no_nail Body_2 geometry via GLTFLoader once
      if (!this._noNailGeo) {
        try {
          const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
          const { VRMLoaderPlugin } = await import("@pixiv/three-vrm");
          const loader = new GLTFLoader();
          loader.register((parser) => new VRMLoaderPlugin(parser));

          const gltf = await loader.loadAsync("./vrm-data/no_nail.vrm");
          const nnScene = gltf.userData?.vrm?.scene || gltf.scene;

          // Find Body_2 in no_nail scene
          let nnBody2 = null;
          nnScene.traverse((child) => {
            if (child.isMesh && child.name === "Body_2") {
              nnBody2 = child;
            }
          });

          if (!nnBody2) {
            console.warn("[TextureSwapManager] Body_2 not found in no_nail.vrm");
            return;
          }

          this._noNailGeo = nnBody2.geometry;
          this._noNailBindMatrix = nnBody2.bindMatrix.clone();
          this._noNailBindMatrixInverse = nnBody2.bindMatrixInverse.clone();
          console.log(`[TextureSwapManager] Loaded no_nail Body_2: ${nnBody2.geometry.index.count / 3} tris`);
        } catch (err) {
          console.warn("[TextureSwapManager] Could not load no_nail.vrm:", err);
          return;
        }
      }

      // Swap geometry + rebind to girl's skeleton
      footMesh.geometry = this._noNailGeo;
      footMesh.bind(footMesh.skeleton, this._noNailBindMatrix);
      console.log("[TextureSwapManager] Swapped to sock-ready feet");

      // Build vertex map and register with MorphDataManager so morphs apply to swapped feet
      if (morphDataManager && !this._noNailVertexMap) {
        const origBodyAttr = morphDataManager._meshAttrMap?.get("Body");
        if (origBodyAttr) {
          const origBase = morphDataManager._basePositions?.get("Body");
          const noNailPosAttr = this._noNailGeo.getAttribute("position");
          // Use BASE positions (not current morphed positions) for mapping
          this._noNailVertexMap = this._buildVertexMap(
            origBase || origBodyAttr.array,
            origBodyAttr.count,
            noNailPosAttr.array,
            noNailPosAttr.count
          );
          this._noNailBasePositions = new Float32Array(noNailPosAttr.array);
        }
      }
      if (morphDataManager && this._noNailVertexMap) {
        const noNailPosAttr = this._noNailGeo.getAttribute("position");
        morphDataManager.registerSwappedBody2(
          noNailPosAttr,
          this._noNailBasePositions,
          this._noNailVertexMap
        );
      }
    } else {
      // Restore original
      if (this._originalFootGeo) {
        footMesh.geometry = this._originalFootGeo;
        footMesh.bind(footMesh.skeleton, this._originalFootBindMatrix);
        console.log("[TextureSwapManager] Restored bare feet");
      }
      // Unregister swapped geometry from morph system
      if (morphDataManager) {
        morphDataManager.unregisterSwappedBody2();
      }
    }
  }

  // ── Internal methods ─────────────────────────────────────────────────

  /**
   * Determine texture slot info based on category.
   * @private
   */
  _getTextureSlot(category, catData) {
    const slotStr = catData.texture_slot || "baseColor";
    // MToon textures: baseColor goes to .map, shadeMultiply goes to .userData.shadeMultiplyTexture
    if (slotStr.includes("shadeMultiplyTexture")) {
      return { slot: "map", alsoShade: true };
    }
    if (category === "face_skin") {
      // Face skin has both baseColor and normal
      return { slot: "map" };
    }
    return { slot: "map" };
  }

  /**
   * Restore a category to its base texture.
   * @private
   */
  async _restoreCategoryBase(category, catData, vrmScene) {
    const materials = this._collectAllMaterials(vrmScene);

    // Use the first texture entry to find the target material
    if (!catData.textures || catData.textures.length === 0) return;
    const targetMat = catData.material_target || catData.textures[0].material;
    const mat = this._findMaterial(materials, targetMat);
    if (!mat) return;

    const baseKey = `${targetMat}:map`;
    const baseTex = this._baseTextures.get(baseKey);
    if (baseTex) {
      mat.map = typeof baseTex.clone === "function" ? baseTex.clone() : baseTex;
      mat.needsUpdate = true;
    }

    // Also restore shade texture if applicable
    const shadeKey = `${targetMat}:shadeMultiplyTexture`;
    const shadeBase = this._baseTextures.get(shadeKey);
    if (shadeBase && mat.userData?.shadeMultiplyTexture) {
      mat.userData.shadeMultiplyTexture =
        typeof shadeBase.clone === "function" ? shadeBase.clone() : shadeBase;
      mat.needsUpdate = true;
    }

    console.log(`[TextureSwapManager] Restored ${category} to base`);
  }

  /**
   * Load a texture URL and apply to the material slot.
   * @private
   */
  async _loadAndApplyTexture(url, mat, slotInfo) {
    return new Promise((resolve) => {
      // Check cache
      if (this._textureCache.has(url)) {
        const cached = this._textureCache.get(url);
        const tex = typeof cached.clone === "function" ? cached.clone() : cached;
        this._applyTextureToSlot(mat, tex, slotInfo);
        resolve();
        return;
      }

      this._loader.load(
        url,
        (texture) => {
          texture.flipY = false; // VRM textures are not flipped
          texture.colorSpace = slotInfo.isNormal
            ? THREE.LinearSRGBColorSpace
            : mat.map?.colorSpace || THREE.SRGBColorSpace;
          texture.wrapS = mat.map?.wrapS || THREE.RepeatWrapping;
          texture.wrapT = mat.map?.wrapT || THREE.RepeatWrapping;
          texture.minFilter = mat.map?.minFilter || THREE.LinearMipmapLinearFilter;
          texture.magFilter = mat.map?.magFilter || THREE.LinearFilter;

          // Cache it
          this._textureCache.set(url, texture);

          this._applyTextureToSlot(mat, texture, slotInfo);
          resolve();
        },
        undefined,
        (err) => {
          console.warn(`[TextureSwapManager] Failed to load: ${url}`, err);
          resolve();
        }
      );
    });
  }

  /**
   * Apply a texture to the appropriate material slot.
   * @private
   */
  _applyTextureToSlot(mat, texture, slotInfo) {
    const slot = slotInfo.slot || "map";

    if (slot === "normalMap") {
      mat.normalMap = texture;
      // MToon: also update uniform
      if (mat.uniforms?.normalMap) {
        mat.uniforms.normalMap.value = texture;
      }
    } else {
      mat.map = texture;
      // MToon: also update uniform
      if (mat.uniforms?.map) {
        mat.uniforms.map.value = texture;
      }
    }

    // MToon: also apply to shade multiply texture if applicable
    if (slotInfo.alsoShade) {
      if (mat.uniforms?.shadeMultiplyTexture) {
        mat.uniforms.shadeMultiplyTexture.value = texture;
      }
      if (mat.userData) {
        mat.userData.shadeMultiplyTexture = texture;
      }
    }

    mat.needsUpdate = true;
  }

  /**
   * Collect all materials from the VRM scene.
   * @private
   * @param {THREE.Object3D} vrmScene
   * @returns {Map<string, THREE.Material>}
   */
  _collectAllMaterials(vrmScene) {
    const materials = new Map();
    vrmScene.traverse((child) => {
      if (!child.isMesh) return;
      const matList = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of matList) {
        if (!mat) continue;
        if (mat.name) {
          materials.set(mat.name, mat);
        } else {
          // Fallback: use mesh name as key
          const key = `__mesh_${child.name}_${child.uuid.slice(0, 6)}`;
          materials.set(key, mat);
        }
      }
    });
    if (!this._matsLogged) {
      this._matsLogged = true;
      console.log("[TextureSwapManager] All materials:", Array.from(materials.keys()));
    }
    return materials;
  }

  /**
   * Find a material by name with fuzzy matching.
   * VRM material names may have prefixes.
   * @private
   */
  _findMaterial(materials, targetName) {
    // Direct match
    if (materials.has(targetName)) return materials.get(targetName);

    // Suffix match (VRM names may have prefixes like "N00_000_00_")
    for (const [name, mat] of materials.entries()) {
      if (name.endsWith(targetName) || targetName.endsWith(name)) {
        return mat;
      }
      // Partial match — extract core name
      const coreTarget = targetName.replace(/^N\d+_\d+_\d+_/, "");
      const coreName = name.replace(/^N\d+_\d+_\d+_/, "");
      if (coreTarget === coreName) return mat;
    }
    return null;
  }

  /**
   * Dispose all cached textures.
   */
  dispose() {
    for (const tex of this._textureCache.values()) {
      if (typeof tex.dispose === "function") tex.dispose();
    }
    this._textureCache.clear();
    for (const tex of this._baseTextures.values()) {
      if (typeof tex.dispose === "function") tex.dispose();
    }
    this._baseTextures.clear();
    this._baseCached = false;
    this._index = null;
    this.loaded = false;
  }

  /**
   * Export current texture/clothing state for serialization.
   * @returns {{ activeVariants: Object }}
   */
  getState() {
    return { activeVariants: { ...this.activeVariants } };
  }
}
