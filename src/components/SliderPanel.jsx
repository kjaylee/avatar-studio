/**
 * SliderPanel - Body parameter slider UI for VRM Studio
 *
 * Renders 23 body shape sliders grouped by category.
 * Each slider controls a vertex morph + bone transform parameter.
 */

import React, { useState, useCallback, useEffect } from "react";
import { PARAM_CATEGORIES, PARAM_DISPLAY_NAMES } from "../library/morphDataManager";
import { HAIR_PRESETS } from "../library/hairManager";
import styles from "./SliderPanel.module.css";

const HAIR_COLORS = [
  { name: "Default", color: null },
  { name: "Black", color: "#0D0D0D" },
  { name: "Dark Brown", color: "#2C1810" },
  { name: "Brown", color: "#6B4226" },
  { name: "Auburn", color: "#7B3F00" },
  { name: "Red", color: "#8B1A1A" },
  { name: "Blonde", color: "#D4A76A" },
  { name: "Platinum", color: "#E8E0D0" },
  { name: "Silver", color: "#C0C0C0" },
  { name: "Pink", color: "#E8A0BF" },
  { name: "Blue", color: "#4A6FA5" },
  { name: "Purple", color: "#6B3FA0" },
  { name: "Green", color: "#4A7A5A" },
  { name: "White", color: "#F5F5F5" },
];

function SliderRow({ paramName, value, onChange }) {
  const displayName = PARAM_DISPLAY_NAMES[paramName] || paramName;
  const handleChange = useCallback(
    (e) => onChange(paramName, parseFloat(e.target.value)),
    [paramName, onChange]
  );
  const handleReset = useCallback(
    () => onChange(paramName, 0),
    [paramName, onChange]
  );

  return (
    <div className={styles.sliderRow}>
      <label className={styles.sliderLabel} title={paramName}>
        {displayName}
      </label>
      <input
        type="range"
        className={styles.slider}
        min="-1"
        max="1"
        step="0.01"
        value={value}
        onChange={handleChange}
      />
      <span className={styles.sliderValue}>{value.toFixed(2)}</span>
      <button
        className={styles.resetButton}
        onClick={handleReset}
        title="Reset to 0"
      >
        R
      </button>
    </div>
  );
}

function CategorySection({ category, params, values, onChange, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen ?? true);

  return (
    <div className={styles.category}>
      <button
        className={styles.categoryHeader}
        onClick={() => setOpen(!open)}
      >
        <span className={styles.categoryArrow}>{open ? "\u25BC" : "\u25B6"}</span>
        <span className={styles.categoryName}>{category}</span>
        <span className={styles.categoryCount}>{params.length}</span>
      </button>
      {open && (
        <div className={styles.categoryBody}>
          {params.map((param) => (
            <SliderRow
              key={param}
              paramName={param}
              value={values[param] ?? 0}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SliderPanel({ morphDataManager, hairManager, vrmScene, threeScene, onSliderChange }) {
  const [sliderValues, setSliderValues] = useState(() =>
    morphDataManager?.sliderValues ? { ...morphDataManager.sliderValues } : {}
  );
  const [currentHair, setCurrentHair] = useState("none");
  const [hairLoading, setHairLoading] = useState(false);
  const [hairColor, setHairColor] = useState(null);

  // Sync state when morphDataManager becomes available
  useEffect(() => {
    if (morphDataManager?.loaded) {
      setSliderValues({ ...morphDataManager.sliderValues });
    }
  }, [morphDataManager?.loaded]);

  const handleSliderChange = useCallback(
    (paramName, value) => {
      setSliderValues((prev) => {
        const newValues = { ...prev, [paramName]: value };
        if (morphDataManager && vrmScene) {
          morphDataManager.setSlider(paramName, value, vrmScene);
          if (hairManager) {
            hairManager.syncBones(vrmScene, newValues);
          }
          onSliderChange?.();
        }
        return newValues;
      });
    },
    [morphDataManager, vrmScene, hairManager, onSliderChange]
  );

  const handleResetAll = useCallback(() => {
    if (morphDataManager && vrmScene) {
      morphDataManager.reset(vrmScene);
      const newValues = { ...morphDataManager.sliderValues };
      setSliderValues(newValues);
      if (hairManager) hairManager.syncBones(vrmScene, newValues);
    }
  }, [morphDataManager, vrmScene, hairManager]);

  const handleRandomize = useCallback(() => {
    const newValues = {};
    const params = morphDataManager?.getParameters() || [];
    for (const param of params) {
      newValues[param] = Math.round((Math.random() - 0.5) * 100) / 100;
    }
    setSliderValues(newValues);
    if (morphDataManager && vrmScene) {
      morphDataManager.setSliders(newValues, vrmScene);
      if (hairManager) hairManager.syncBones(vrmScene, newValues);
    }
  }, [morphDataManager, vrmScene, hairManager]);

  const handleExportPreset = useCallback(() => {
    if (!morphDataManager) return;
    const data = JSON.stringify(morphDataManager.exportSliderValues(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vrm-studio-preset.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [morphDataManager]);

  const handleHairChange = useCallback(
    async (presetId) => {
      if (!hairManager || !vrmScene || !threeScene || hairLoading) return;
      setHairLoading(true);
      try {
        await hairManager.applyPreset(presetId, vrmScene, threeScene, morphDataManager, sliderValues);
        setCurrentHair(presetId);
      } catch (err) {
        console.error("Hair change error:", err);
      } finally {
        setHairLoading(false);
      }
    },
    [hairManager, vrmScene, threeScene, hairLoading, morphDataManager, sliderValues]
  );

  const handleHairColorChange = useCallback(
    (color) => {
      setHairColor(color);
      if (hairManager) {
        hairManager.setHairColor(color); // null restores original colors
      }
    },
    [hairManager, currentHair]
  );

  const handleImportPreset = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const preset = JSON.parse(text);
        if (morphDataManager && vrmScene) {
          morphDataManager.importSliderValues(preset, vrmScene);
          const imported = { ...morphDataManager.sliderValues };
          setSliderValues(imported);
          if (hairManager) hairManager.syncBones(vrmScene, imported);
        }
      } catch (err) {
        console.error("Failed to import preset:", err);
      }
    };
    input.click();
  }, [morphDataManager, vrmScene]);

  if (!morphDataManager?.loaded) {
    return (
      <div className={styles.panel}>
        <div className={styles.loading}>Loading morph data...</div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>Body Shape</h3>
        <div className={styles.headerButtons}>
          <button className={styles.actionButton} onClick={handleRandomize} title="Randomize">
            Rand
          </button>
          <button className={styles.actionButton} onClick={handleResetAll} title="Reset All">
            Reset
          </button>
          <button className={styles.actionButton} onClick={handleExportPreset} title="Export Preset">
            Save
          </button>
          <button className={styles.actionButton} onClick={handleImportPreset} title="Import Preset">
            Load
          </button>
        </div>
      </div>
      <div className={styles.scrollArea}>
        {/* Hair Style Selector */}
        <div className={styles.category}>
          <div className={styles.categoryHeader} style={{ cursor: "default" }}>
            <span className={styles.categoryName}>Hair Style</span>
          </div>
          <div className={styles.categoryBody}>
            <div className={styles.hairSelector}>
              {HAIR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className={`${styles.hairButton} ${
                    currentHair === preset.id ? styles.hairButtonActive : ""
                  }`}
                  onClick={() => handleHairChange(preset.id)}
                  disabled={hairLoading}
                >
                  {preset.name}
                </button>
              ))}
            </div>
            {hairLoading && (
              <div className={styles.hairLoading}>Loading hair...</div>
            )}
            {currentHair !== "none" && (
              <div className={styles.hairColorSection}>
                <div className={styles.hairColorLabel}>Color</div>
                <div className={styles.hairColorSwatches}>
                  {HAIR_COLORS.map((preset) => (
                    <button
                      key={preset.name}
                      className={`${styles.colorSwatch} ${
                        hairColor === preset.color ? styles.colorSwatchActive : ""
                      }`}
                      style={{
                        backgroundColor: preset.color || "#FFFFFF",
                        backgroundImage: !preset.color
                          ? "linear-gradient(135deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(135deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)"
                          : "none",
                        backgroundSize: !preset.color ? "6px 6px" : "auto",
                        backgroundPosition: !preset.color ? "0 0, 3px 3px" : "auto",
                      }}
                      onClick={() => handleHairColorChange(preset.color)}
                      title={preset.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {Object.entries(PARAM_CATEGORIES).map(([category, params]) => (
          <CategorySection
            key={category}
            category={category}
            params={params}
            values={sliderValues}
            onChange={handleSliderChange}
            defaultOpen={category === "Body Size"}
          />
        ))}
      </div>
    </div>
  );
}
