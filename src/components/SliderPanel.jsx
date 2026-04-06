/**
 * SliderPanel — Tab-based VRM Studio editor panel.
 *
 * Tabs: Hair | Face | Body | Clothing
 * Action bar: Back, Reset, Save, Load, Export VRM
 */

import React, { useState, useCallback } from "react";
import { AvatarState } from "../library/avatarState";
import HairTab from "./tabs/HairTab";
import FaceTab from "./tabs/FaceTab";
import BodyTab from "./tabs/BodyTab";
import ClothingTab from "./tabs/ClothingTab";
import ClothingMeshTab from "./tabs/ClothingMeshTab";
import styles from "./SliderPanel.module.css";

const TABS = [
  { id: "hair", label: "Hair" },
  { id: "face", label: "Face" },
  { id: "body", label: "Body" },
  { id: "clothing", label: "Clothing" },
  { id: "clothingMesh", label: "3D Outfit" },
];

export default function SliderPanel({
  morphDataManager,
  hairManager,
  textureSwapManager,
  clothingMeshManager,
  vrmScene,
  vrmObj,
  threeScene,
  onSliderChange,
  onBack,
  onExportVRM,
  onLoadVRM,
}) {
  const [activeTab, setActiveTab] = useState("body");
  const [resetKey, setResetKey] = useState(0); // increment to force tab re-mount

  // ── Action Handlers ────────────────────────────────────────────────

  const handleResetAll = useCallback(async () => {
    if (!morphDataManager || !vrmScene) return;

    // 1. Reset body sliders
    morphDataManager.reset(vrmScene);

    // 2. Reset face type + face params
    if (morphDataManager.applyFaceType) {
      await morphDataManager.applyFaceType(null, vrmScene);
    }
    if (morphDataManager.resetFaceParams) {
      morphDataManager.resetFaceParams(vrmScene);
    }
    morphDataManager.faceParamStrength = 0.5;

    // 3. Reset hair
    if (hairManager) {
      hairManager.removeAllHair(vrmScene);
    }

    // 4. Reset clothing (restore base textures)
    if (textureSwapManager) {
      await textureSwapManager.applyFullClothing(false, vrmScene, morphDataManager);
    }

    // 5. Reset clothing mesh overlays
    if (clothingMeshManager) {
      clothingMeshManager.removeAll(vrmScene);
    }

    // 6. Reset expressions
    if (vrmObj?.expressionManager) {
      const names = vrmObj.expressionManager.expressions?.map((e) => e.expressionName) || [];
      for (const name of names) {
        vrmObj.expressionManager.setValue(name, 0);
      }
    }

    // 7. Force UI re-render by incrementing resetKey
    setResetKey((k) => k + 1);
    onSliderChange?.();
  }, [morphDataManager, vrmScene, vrmObj, hairManager, textureSwapManager, clothingMeshManager, onSliderChange]);

  /**
   * Save ALL avatar state (body + face + hair + clothing + textures) to JSON.
   */
  const handleSave = useCallback(() => {
    if (!morphDataManager) return;
    const state = new AvatarState();

    // Body + Face from morphDataManager
    const fullState = morphDataManager.getFullState();
    state.setBody(fullState.body);
    state.setFaceType(fullState.face.faceType);
    state.setFaceParams(fullState.face.faceParams);
    state.setFaceParamStrength(fullState.face.faceParamStrength);

    // Hair from hairManager
    if (hairManager) {
      const hairState = hairManager.getState();
      state.setHair({ mainStyle: hairState.mainStyle, bangsStyle: hairState.bangsStyle });
      state.setHairColor(hairState.color);
      state.setHairOpacity(hairState.opacity);
    }

    // Clothing + textures from textureSwapManager
    if (textureSwapManager) {
      const texState = textureSwapManager.getState();
      const av = texState.activeVariants || {};
      state.setOutfit(av.clothing || null);
      state.setCharacterVariant(av.characterVariant || null);
      // Save individual texture variants
      for (const [key, val] of Object.entries(av)) {
        if (key !== "clothing" && key !== "characterVariant" && !key.startsWith("clothing_")) {
          state.setTextureVariant(key, val);
        }
      }
    }

    // Clothing mesh overlays
    if (clothingMeshManager) {
      const cmState = clothingMeshManager.getState();
      if (Object.keys(cmState.slots).length > 0) {
        state.data.clothingMesh = cmState;
      }
    }

    // Expression morphs from VRM
    if (vrmObj?.expressionManager) {
      const expValues = {};
      const names = vrmObj.expressionManager.expressions?.map((e) => e.expressionName) || [];
      for (const name of names) {
        const val = vrmObj.expressionManager.getValue(name);
        if (val && val !== 0) expValues[name] = val;
      }
      if (Object.keys(expValues).length > 0) state.setExpressions(expValues);
    }

    const json = state.toJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vrm-studio-preset.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [morphDataManager, hairManager, textureSwapManager, clothingMeshManager, vrmObj]);

  /**
   * Load preset JSON and restore ALL state to managers.
   */
  const handleLoadPreset = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const restored = AvatarState.fromJSON(text);
        const snap = restored.getSnapshot();

        // 1. Restore body sliders
        if (morphDataManager && vrmScene) {
          morphDataManager.importSliderValues(snap.body, vrmScene);
        }

        // 2. Restore face type
        if (morphDataManager && vrmScene && snap.face?.faceType) {
          await morphDataManager.applyFaceType(snap.face.faceType, vrmScene);
        }

        // 3. Restore face params + strength
        if (morphDataManager && snap.face) {
          if (typeof snap.face.faceParamStrength === "number") {
            morphDataManager.faceParamStrength = snap.face.faceParamStrength;
          }
          if (snap.face.faceParams && Object.keys(snap.face.faceParams).length > 0) {
            for (const [param, value] of Object.entries(snap.face.faceParams)) {
              morphDataManager.setFaceParamValue?.(param, value);
            }
            morphDataManager.applyFaceParams?.(vrmScene);
          }
        }

        // 4. Restore hair
        if (hairManager && vrmScene && threeScene) {
          const hs = snap.hair || {};
          if (hs.mainStyle && hs.mainStyle !== "none") {
            await hairManager.applyMainPreset(hs.mainStyle, vrmScene, threeScene, morphDataManager, morphDataManager?.sliderValues);
          }
          if (hs.bangsStyle && hs.bangsStyle !== "none") {
            await hairManager.applyBangsPreset(hs.bangsStyle, vrmScene, threeScene, morphDataManager, morphDataManager?.sliderValues);
          }
          if (hs.color) hairManager.setHairColor(hs.color);
          if (typeof hs.opacity === "number") hairManager.setHairOpacity(hs.opacity);
        }

        // 5. Restore outfit
        if (textureSwapManager && vrmScene && snap.clothing?.outfit) {
          await textureSwapManager.applyOutfit(snap.clothing.outfit, vrmScene, morphDataManager);
        }

        // 6. Restore character variant
        if (textureSwapManager && vrmScene && snap.clothing?.characterVariant) {
          await textureSwapManager.applyCharacterVariant(snap.clothing.characterVariant, vrmScene);
        }

        // 7. Restore texture variants
        if (textureSwapManager && vrmScene && snap.textures) {
          for (const [cat, varId] of Object.entries(snap.textures)) {
            if (varId) await textureSwapManager.applyVariant(cat, varId, vrmScene);
          }
        }

        // 8. Restore expressions
        if (vrmObj?.expressionManager && snap.expressions) {
          for (const [name, val] of Object.entries(snap.expressions)) {
            vrmObj.expressionManager.setValue(name, val);
          }
        }

        // Sync bones and trigger re-render
        if (hairManager && morphDataManager && vrmScene) {
          hairManager.syncBones(vrmScene, morphDataManager.sliderValues);
        }
        if (clothingMeshManager && morphDataManager && vrmScene) {
          clothingMeshManager.syncBones(vrmScene, morphDataManager.sliderValues);
        }

        // Restore clothing mesh state
        if (snap.clothingMesh && clothingMeshManager) {
          await clothingMeshManager.restoreState(snap.clothingMesh, vrmScene, morphDataManager, morphDataManager.sliderValues);
        }

        setResetKey((k) => k + 1); // force UI re-mount to reflect loaded state
        onSliderChange?.();
        console.log("[SliderPanel] Preset loaded successfully");
      } catch (err) {
        console.error("Failed to import preset:", err);
      }
    };
    input.click();
  }, [morphDataManager, vrmScene, vrmObj, threeScene, hairManager, textureSwapManager, clothingMeshManager, onSliderChange]);

  /**
   * Load a VRM file into the scene.
   */
  const handleLoadVRM = useCallback(() => {
    if (!onLoadVRM) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".vrm";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      onLoadVRM(file);
    };
    input.click();
  }, [onLoadVRM]);

  const handleExport = useCallback(() => {
    if (onExportVRM) {
      onExportVRM();
    }
  }, [onExportVRM]);

  // ── Loading state ──────────────────────────────────────────────────

  if (!morphDataManager?.loaded) {
    return (
      <div className={styles.panel}>
        <div className={styles.loading}>Loading morph data...</div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className={styles.panel}>
      {/* Action Bar */}
      <div className={styles.actionBar}>
        <button className={styles.actionButton} onClick={onBack} title="Back to landing">
          Back
        </button>
        <div className={styles.actionSpacer} />
        <button className={styles.actionButton} onClick={handleResetAll} title="Reset All">
          Reset
        </button>
        <button className={styles.actionButton} onClick={handleSave} title="Save Preset JSON">
          Save
        </button>
        <button className={styles.actionButton} onClick={handleLoadPreset} title="Load Preset JSON">
          Load
        </button>
        <button className={styles.actionButton} onClick={handleLoadVRM} title="Load VRM File">
          VRM
        </button>
        <button className={styles.actionButtonPrimary} onClick={handleExport} title="Export VRM">
          Export
        </button>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tabButton} ${activeTab === tab.id ? styles.tabButtonActive : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content — resetKey forces re-mount on Reset All */}
      <div className={styles.scrollArea} key={resetKey}>
        {activeTab === "hair" && (
          <HairTab
            hairManager={hairManager}
            vrmScene={vrmScene}
            threeScene={threeScene}
            morphDataManager={morphDataManager}
            sliderValues={morphDataManager?.sliderValues || {}}
            onSliderChange={onSliderChange}
          />
        )}
        {activeTab === "face" && (
          <FaceTab
            morphDataManager={morphDataManager}
            textureSwapManager={textureSwapManager}
            vrmScene={vrmScene}
            vrmObj={vrmObj}
            onSliderChange={onSliderChange}
          />
        )}
        {activeTab === "body" && (
          <BodyTab
            morphDataManager={morphDataManager}
            hairManager={hairManager}
            clothingMeshManager={clothingMeshManager}
            vrmScene={vrmScene}
            onSliderChange={onSliderChange}
          />
        )}
        {activeTab === "clothing" && (
          <ClothingTab
            textureSwapManager={textureSwapManager}
            morphDataManager={morphDataManager}
            vrmScene={vrmScene}
            onSliderChange={onSliderChange}
          />
        )}
        {activeTab === "clothingMesh" && (
          <ClothingMeshTab
            clothingMeshManager={clothingMeshManager}
            morphDataManager={morphDataManager}
            vrmScene={vrmScene}
            sliderValues={morphDataManager?.sliderValues || {}}
            onSliderChange={onSliderChange}
          />
        )}
      </div>
    </div>
  );
}
