/**
 * ClothingMeshTab — 3D clothing mesh overlay management.
 *
 * Allows loading VRM/GLB clothing meshes that attach to the body skeleton.
 * Supports preset selection per category + custom file import.
 * Mirrors the HairTab pattern for consistency.
 */

import React, { useState, useCallback, useEffect } from "react";
import { CLOTHING_MESH_CATEGORIES } from "../../library/clothingMeshManager";
import styles from "../SliderPanel.module.css";

export default function ClothingMeshTab({
  clothingMeshManager,
  morphDataManager,
  vrmScene,
  sliderValues,
  onSliderChange,
}) {
  const [presets, setPresets] = useState([]);
  const [activeSlots, setActiveSlots] = useState({});
  const [loading, setLoading] = useState(false);

  // Load presets on mount
  useEffect(() => {
    if (!clothingMeshManager) return;
    clothingMeshManager.loadPresets().then(() => {
      setPresets(clothingMeshManager.getPresets());
      // Sync UI with current state
      const state = clothingMeshManager.getState();
      setActiveSlots(state.slots || {});
    });
  }, [clothingMeshManager]);

  const handlePresetChange = useCallback(
    async (presetId, category) => {
      if (!clothingMeshManager || !vrmScene || loading) return;
      setLoading(true);
      try {
        if (presetId === "none" || presetId === activeSlots[category]) {
          // Toggle off
          clothingMeshManager.removeByCategory(category, vrmScene);
          setActiveSlots((prev) => {
            const next = { ...prev };
            delete next[category];
            return next;
          });
        } else {
          await clothingMeshManager.applyPreset(
            presetId, vrmScene, null, morphDataManager, sliderValues
          );
          setActiveSlots((prev) => ({ ...prev, [category]: presetId }));
        }
        onSliderChange?.();
      } catch (err) {
        console.error("[ClothingMeshTab] Preset error:", err);
      } finally {
        setLoading(false);
      }
    },
    [clothingMeshManager, vrmScene, morphDataManager, sliderValues, activeSlots, loading, onSliderChange]
  );

  const handleCustomImport = useCallback(
    async (category) => {
      if (!clothingMeshManager || !vrmScene || loading) return;

      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".vrm,.glb,.gltf";
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLoading(true);
        try {
          await clothingMeshManager.loadCustom(
            file, category, vrmScene, morphDataManager, sliderValues
          );
          const state = clothingMeshManager.getState();
          setActiveSlots(state.slots || {});
          onSliderChange?.();
        } catch (err) {
          console.error("[ClothingMeshTab] Custom import error:", err);
        } finally {
          setLoading(false);
        }
      };
      input.click();
    },
    [clothingMeshManager, vrmScene, morphDataManager, sliderValues, loading, onSliderChange]
  );

  const handleRemoveAll = useCallback(() => {
    if (!clothingMeshManager || !vrmScene) return;
    clothingMeshManager.removeAll(vrmScene);
    setActiveSlots({});
    onSliderChange?.();
  }, [clothingMeshManager, vrmScene, onSliderChange]);

  if (!clothingMeshManager) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.hairLoading}>Loading clothing mesh system...</div>
      </div>
    );
  }

  return (
    <div className={styles.tabContent}>
      {/* Per-category sections */}
      {Object.entries(CLOTHING_MESH_CATEGORIES).map(([category, info]) => {
        const categoryPresets = presets.filter(
          (p) => p.category === category || p.id === "none"
        );
        const activePreset = activeSlots[category] || "none";

        return (
          <div key={category} className={styles.hairSubSection}>
            <div className={styles.hairSubLabel}>{info.name}</div>
            <div className={styles.hairSelector}>
              {/* None button */}
              <button
                className={`${styles.hairButton} ${activePreset === "none" ? styles.hairButtonActive : ""}`}
                onClick={() => handlePresetChange("none", category)}
                disabled={loading}
              >
                None
              </button>

              {/* Preset buttons */}
              {categoryPresets
                .filter((p) => p.id !== "none")
                .map((preset) => (
                  <button
                    key={preset.id}
                    className={`${styles.hairButton} ${activePreset === preset.id ? styles.hairButtonActive : ""}`}
                    onClick={() => handlePresetChange(preset.id, category)}
                    disabled={loading}
                  >
                    {preset.name}
                  </button>
                ))}

              {/* Custom import button */}
              <button
                className={styles.hairButton}
                onClick={() => handleCustomImport(category)}
                disabled={loading}
                title={`Import custom ${info.name.toLowerCase()} VRM/GLB`}
              >
                + Import
              </button>
            </div>
          </div>
        );
      })}

      {/* Remove All button */}
      <div className={styles.hairSubSection}>
        <button
          className={styles.hairButton}
          onClick={handleRemoveAll}
          disabled={loading}
        >
          Remove All Mesh Clothing
        </button>
      </div>

      {loading && (
        <div className={styles.hairLoading}>Loading clothing mesh...</div>
      )}
    </div>
  );
}
