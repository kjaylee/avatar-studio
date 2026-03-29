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
import { downloadVRMWithAvatar } from "../library/download-utils";
import SliderPanel from "../components/SliderPanel";
import styles from "./Studio.module.css";

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
          controls.enablePan = false; // Keep model centered during rotation
        }

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

  const handleExportVRM = useCallback(async () => {
    if (!vrmModel) return;
    try {
      // Simple GLB export via Three.js
      const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter");
      const exporter = new GLTFExporter();
      exporter.parse(
        vrmModel,
        (result) => {
          const blob = new Blob([result], { type: "application/octet-stream" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "vrm-studio-export.glb";
          a.click();
          URL.revokeObjectURL(url);
        },
        (err) => console.error("Export error:", err),
        { binary: true }
      );
    } catch (err) {
      console.error("Export error:", err);
    }
  }, [vrmModel]);

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
      <SliderPanel morphDataManager={morphManager} hairManager={hairManager} vrmScene={vrmModel} threeScene={scene} onSliderChange={() => updateOrbitTarget(vrmModel, controls)} />

      {/* Right: Top bar with controls */}
      <div className={styles.topBar}>
        <button className={styles.topButton} onClick={handleBack}>
          Back
        </button>
        <span className={styles.statusText}>
          {status !== "Ready" ? status : "VRM Studio"}
        </span>
        <button
          className={styles.exportButton}
          onClick={handleExportVRM}
          disabled={status !== "Ready"}
        >
          Export VRM
        </button>
      </div>
    </div>
  );
}
