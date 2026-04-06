/**
 * Studio page - VRM Studio main editor view
 *
 * Loads girl.vrm base model via GLTFLoader + VRMLoaderPlugin,
 * initializes MorphDataManager, and renders SliderPanel alongside the 3D viewport.
 */

import React, { useContext, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { SceneContext } from "../context/SceneContext";
import { ViewContext, ViewMode } from "../context/ViewContext";
import { MorphDataManager } from "../library/morphDataManager";
import { HairManager } from "../library/hairManager";
import { ClothingMeshManager } from "../library/clothingMeshManager";
import { TextureSwapManager } from "../library/textureSwapManager";
import { downloadVRMWithAvatar } from "../library/download-utils";
import SliderPanel from "../components/SliderPanel";
import styles from "./Studio.module.css";

/**
 * Inject VRM 1.0 extension into a GLB ArrayBuffer so VRM viewers recognize it.
 * Reads the GLB JSON chunk, adds VRMC_vrm extension, and rewrites the GLB.
 */
function injectVRMExtension(glbBuffer, vrmObj) {
  try {
    const view = new DataView(glbBuffer);
    // GLB header: magic(4) version(4) length(4) + chunk0: length(4) type(4) data(...)
    const jsonChunkLen = view.getUint32(12, true);
    const jsonBytes = new Uint8Array(glbBuffer, 20, jsonChunkLen);
    const jsonStr = new TextDecoder().decode(jsonBytes);
    const gltf = JSON.parse(jsonStr);

    // Add VRM extension
    if (!gltf.extensionsUsed) gltf.extensionsUsed = [];
    if (!gltf.extensionsUsed.includes("VRMC_vrm")) gltf.extensionsUsed.push("VRMC_vrm");

    if (!gltf.extensions) gltf.extensions = {};
    gltf.extensions.VRMC_vrm = {
      specVersion: "1.0",
      meta: {
        name: "Avatar Studio Export",
        version: "1.0",
        authors: ["Avatar Studio"],
        licenseUrl: "https://vrm.dev/licenses/1.0/",
        allowExcessivelyViolentUsage: false,
        allowExcessivelySexualUsage: false,
        allowPoliticalOrReligiousUsage: false,
        allowAntisocialOrHateUsage: false,
        creditNotation: "required",
        allowRedistribution: false,
        modification: "prohibited",
      },
    };

    // Rebuild GLB with new JSON
    const newJsonStr = JSON.stringify(gltf);
    const encoder = new TextEncoder();
    const newJsonBytes = encoder.encode(newJsonStr);
    // Pad to 4-byte alignment
    const paddedLen = (newJsonBytes.length + 3) & ~3;
    const paddedJson = new Uint8Array(paddedLen);
    paddedJson.set(newJsonBytes);
    for (let i = newJsonBytes.length; i < paddedLen; i++) paddedJson[i] = 0x20; // space padding

    // Binary chunk (everything after JSON chunk)
    const binChunkStart = 20 + jsonChunkLen;
    const binChunk = new Uint8Array(glbBuffer, binChunkStart);

    // Assemble new GLB
    const totalLen = 12 + 8 + paddedLen + binChunk.length;
    const out = new ArrayBuffer(totalLen);
    const outView = new DataView(out);
    const outBytes = new Uint8Array(out);

    // Header
    outView.setUint32(0, 0x46546C67, true); // glTF magic
    outView.setUint32(4, 2, true);           // version 2
    outView.setUint32(8, totalLen, true);    // total length

    // JSON chunk header
    outView.setUint32(12, paddedLen, true);
    outView.setUint32(16, 0x4E4F534A, true); // "JSON"
    outBytes.set(paddedJson, 20);

    // Binary chunk (copy as-is)
    outBytes.set(binChunk, 20 + paddedLen);

    return out;
  } catch (err) {
    console.warn("[Studio] VRM extension injection failed, exporting as plain GLB:", err);
    return glbBuffer;
  }
}

const BASE_MODEL_URL = "./vrm-data/girl.vrm";
const MORPH_DELTAS_URL = "./vrm-data/morph_deltas.json";
const BONE_FACTORS_URL = "./vrm-data/bone_factors.json";

function updateOrbitTarget(vrmScene, controls) {
  if (!vrmScene || !controls) return;
  const box = new THREE.Box3().setFromObject(vrmScene);
  const center = new THREE.Vector3();
  box.getCenter(center);
  controls.target.set(0, center.y, 0);
}

export default function Studio() {
  const { scene, moveCamera, controls } = useContext(SceneContext);
  const { setViewMode } = useContext(ViewContext);

  const [morphManager, setMorphManager] = useState(null);
  const [hairManager] = useState(() => new HairManager());
  const [textureSwapManager] = useState(() => new TextureSwapManager());
  const [clothingMeshManager] = useState(() => new ClothingMeshManager());
  const [vrmObj, setVrmObj] = useState(null); // VRM object (for expressions)
  const [vrmModel, setVrmModel] = useState(null);
  const [status, setStatus] = useState("Initializing...");
  const [error, setError] = useState(null);

  // Initialize: load base model + morph data
  useEffect(() => {
    if (!scene) return;

    let cancelled = false;

    async function init() {
      try {
        // 1. Load morph data in parallel with model
        setStatus("Loading data...");

        const mdm = new MorphDataManager();
        const morphPromise = mdm.load(MORPH_DELTAS_URL, BONE_FACTORS_URL);

        // 2. Load VRM model
        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser, { autoUpdateHumanBones: true }));

        const modelPromise = loader.loadAsync(BASE_MODEL_URL);

        const [, gltf] = await Promise.all([morphPromise, modelPromise]);

        if (cancelled) return;

        const vrm = gltf.userData.vrm;
        const vrmScene = vrm?.scene || gltf.scene;

        // 3. Add to Three.js scene
        // Remove any existing models first
        const toRemove = [];
        scene.traverse((child) => {
          if (child.userData?.isStudioModel) toRemove.push(child);
        });
        toRemove.forEach((obj) => scene.remove(obj));

        vrmScene.userData.isStudioModel = true;
        scene.add(vrmScene);

        // 4. Cache base state for morph reset
        setStatus("Preparing morphs...");
        mdm.cacheBaseState(vrmScene);

        // 4b. Initialize texture swap manager
        textureSwapManager.cacheBaseTextures(vrmScene);
        textureSwapManager.loadIndex("./vrm-data/textures/index.json").catch((err) =>
          console.warn("[Studio] Texture index load:", err)
        );

        // 5. Position camera — orbit around model center
        if (moveCamera) {
          moveCamera({
            targetX: 0,
            targetY: 0.85,
            targetZ: 0,
            distance: 3.5,
          });
        }
        if (controls) {
          controls.enabled = true;
          controls.enablePan = true;
        }

        setVrmObj(vrm);
        setVrmModel(vrmScene);
        setMorphManager(mdm);
        setStatus("Ready");

        console.log("[Studio] VRM loaded, morph system ready");
      } catch (err) {
        console.error("[Studio] Init error:", err);
        if (!cancelled) {
          setError(err.message);
          setStatus("Error");
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [scene]);

  const handleBack = useCallback(() => {
    // Clean up model from scene
    if (vrmModel && scene) {
      scene.remove(vrmModel);
    }
    setViewMode(ViewMode.LANDING);
  }, [setViewMode, vrmModel, scene]);

  /**
   * Load a VRM file from user's filesystem into the scene.
   * Replaces the current model with the loaded VRM.
   */
  const handleLoadVRM = useCallback(async (file) => {
    if (!scene) return;
    try {
      setStatus("Loading VRM...");
      const url = URL.createObjectURL(file);

      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser, { autoUpdateHumanBones: true }));
      const gltf = await loader.loadAsync(url);
      URL.revokeObjectURL(url);

      const vrm = gltf.userData.vrm;
      const newVrmScene = vrm?.scene || gltf.scene;

      // Remove existing model
      const toRemove = [];
      scene.traverse((child) => {
        if (child.userData?.isStudioModel) toRemove.push(child);
      });
      toRemove.forEach((obj) => scene.remove(obj));

      // Add new model
      newVrmScene.userData.isStudioModel = true;
      scene.add(newVrmScene);

      // Re-initialize morph data manager
      const mdm = new MorphDataManager();
      await mdm.load(MORPH_DELTAS_URL, BONE_FACTORS_URL);
      mdm.cacheBaseState(newVrmScene);

      // Re-initialize texture swap manager
      textureSwapManager.cacheBaseTextures(newVrmScene);
      textureSwapManager.loadIndex("./vrm-data/textures/index.json").catch((err) =>
        console.warn("[Studio] Texture index load:", err)
      );

      // Position camera
      if (moveCamera) {
        moveCamera({ targetX: 0, targetY: 0.85, targetZ: 0, distance: 3.5 });
      }

      setVrmObj(vrm);
      setVrmModel(newVrmScene);
      setMorphManager(mdm);
      setStatus("Ready");
      console.log("[Studio] External VRM loaded:", file.name);
    } catch (err) {
      console.error("[Studio] Load VRM error:", err);
      setStatus("Ready");
    }
  }, [scene, moveCamera, textureSwapManager]);

  const handleExportVRM = useCallback(async () => {
    if (!vrmModel || !vrmObj) return;
    try {
      const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter");
      const exporter = new GLTFExporter();

      // Convert MToon/ShaderMaterials to StandardMaterial for export
      // Phase 1: Build replacement map (uuid → standard material)
      const replacementMap = new Map(); // uuid → { original, standard }
      const meshEntries = [];           // { mesh, index, origMat }
      vrmModel.traverse((child) => {
        if (!child.isMesh) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat, i) => {
          if (!mat) return;
          meshEntries.push({ mesh: child, index: i, origMat: mat });
          if (!replacementMap.has(mat.uuid)) {
            const std = new THREE.MeshStandardMaterial();
            std.name = mat.name;
            if (mat.map) std.map = mat.map;
            if (mat.normalMap) std.normalMap = mat.normalMap;
            std.color = mat.color ? mat.color.clone() : new THREE.Color(1, 1, 1);
            std.transparent = mat.transparent || false;
            std.opacity = mat.opacity ?? 1;
            std.side = mat.side ?? THREE.FrontSide;
            std.alphaTest = mat.alphaTest ?? 0;
            replacementMap.set(mat.uuid, { original: mat, standard: std });
          }
        });
      });

      // Phase 2: Replace ALL material references on ALL meshes
      meshEntries.forEach(({ mesh, index, origMat }) => {
        const entry = replacementMap.get(origMat.uuid);
        if (!entry) return;
        if (Array.isArray(mesh.material)) {
          mesh.material[index] = entry.standard;
        } else {
          mesh.material = entry.standard;
        }
      });

      const result = await exporter.parseAsync(vrmModel, { binary: true });

      // Phase 3: Restore ALL original materials
      meshEntries.forEach(({ mesh, index, origMat }) => {
        if (Array.isArray(mesh.material)) {
          mesh.material[index] = origMat;
        } else {
          mesh.material = origMat;
        }
      });

      // Inject VRM extension into GLB JSON chunk
      const vrm = injectVRMExtension(result, vrmObj);

      const blob = new Blob([vrm], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "avatar-studio-export.vrm";
      a.click();
      URL.revokeObjectURL(url);
      console.log("[Studio] VRM exported successfully");
    } catch (err) {
      console.error("Export error:", err);
    }
  }, [vrmModel, vrmObj]);

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorPanel}>
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={handleBack}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Left: Slider Panel */}
      <SliderPanel morphDataManager={morphManager} hairManager={hairManager} textureSwapManager={textureSwapManager} clothingMeshManager={clothingMeshManager} vrmScene={vrmModel} vrmObj={vrmObj} threeScene={scene} onSliderChange={() => {}} onBack={handleBack} onExportVRM={handleExportVRM} onLoadVRM={handleLoadVRM} />

      {/* Status overlay */}
      {status !== "Ready" && (
        <div className={styles.topBar}>
          <span className={styles.statusText}>{status}</span>
        </div>
      )}
    </div>
  );
}
