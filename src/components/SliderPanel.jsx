/**
 * SliderPanel - Body parameter slider UI for VRM Studio
 *
 * Hair section: Main style (Short/Medium/Long/A-Z/1-11) + optional Bangs overlay (FA-FH).
 */

import React, { useState, useCallback, useEffect } from "react";
import { PARAM_CATEGORIES, PARAM_DISPLAY_NAMES } from "../library/morphDataManager";
import { MAIN_HAIR_PRESETS, BANGS_OVERLAY_PRESETS } from "../library/hairManager";
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

function HairPresetGrid({ presets, activeId, onSelect, disabled }) {
  return (
    <div className={styles.hairSelector}>
      {presets.map((preset) => (
        <button
          key={preset.id}
          className={`${styles.hairButton} ${activeId === preset.id ? styles.hairButtonActive : ""}`}
          onClick={() => onSelect(preset.id)}
          disabled={disabled}
        >
          {preset.name}
        </button>
      ))}
    </div>
  );
}

export default function SliderPanel({ morphDataManager, hairManager, vrmScene, threeScene, onSliderChange }) {
  const [sliderValues, setSliderValues] = useState(() =>
    morphDataManager?.sliderValues ? { ...morphDataManager.sliderValues } : {}
  );
  const [currentMain, setCurrentMain] = useState("none");
  const [currentBangs, setCurrentBangs] = useState("none");
  const [hairLoading, setHairLoading] = useState(false);
  const [hairColor, setHairColor] = useState(null);
  const [hairOpen, setHairOpen] = useState(true);

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
          if (hairManager) hairManager.syncBones(vrmScene, newValues);
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

  // Main hair style
  const handleMainChange = useCallback(
    async (presetId) => {
      if (!hairManager || !vrmScene || !threeScene || hairLoading) return;
      setHairLoading(true);
      try {
        await hairManager.applyMainPreset(presetId, vrmScene, threeScene, morphDataManager, sliderValues);
        setCurrentMain(presetId);
      } catch (err) {
        console.error("Main hair error:", err);
      } finally {
        setHairLoading(false);
      }
    },
    [hairManager, vrmScene, threeScene, hairLoading, morphDataManager, sliderValues]
  );

  // Bangs overlay
  const handleBangsChange = useCallback(
    async (presetId) => {
      if (!hairManager || !vrmScene || !threeScene || hairLoading) return;
      setHairLoading(true);
      try {
        await hairManager.applyBangsPreset(presetId, vrmScene, threeScene, morphDataManager, sliderValues);
        setCurrentBangs(presetId);
      } catch (err) {
        console.error("Bangs error:", err);
      } finally {
        setHairLoading(false);
      }
    },
    [hairManager, vrmScene, threeScene, hairLoading, morphDataManager, sliderValues]
  );

  const handleHairColorChange = useCallback(
    (color) => {
      setHairColor(color);
      if (hairManager) hairManager.setHairColor(color);
    },
    [hairManager]
  );

  const hasAnyHair = currentMain !== "none" || currentBangs !== "none";

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
          <button className={styles.actionButton} onClick={handleRandomize} title="Randomize">Rand</button>
          <button className={styles.actionButton} onClick={handleResetAll} title="Reset All">Reset</button>
          <button className={styles.actionButton} onClick={handleExportPreset} title="Export Preset">Save</button>
          <button className={styles.actionButton} onClick={handleImportPreset} title="Import Preset">Load</button>
        </div>
      </div>
      <div className={styles.scrollArea}>
        {/* Hair Section */}
        <div className={styles.category}>
          <button className={styles.categoryHeader} onClick={() => setHairOpen(!hairOpen)}>
            <span className={styles.categoryArrow}>{hairOpen ? "\u25BC" : "\u25B6"}</span>
            <span className={styles.categoryName}>Hair Style</span>
          </button>
          {hairOpen && (
            <div className={styles.categoryBody}>
              {/* Main hair style */}
              <div className={styles.hairSubSection}>
                <div className={styles.hairSubLabel}>Style</div>
                <HairPresetGrid
                  presets={MAIN_HAIR_PRESETS}
                  activeId={currentMain}
                  onSelect={handleMainChange}
                  disabled={hairLoading}
                />
              </div>

              {/* Bangs overlay */}
              <div className={styles.hairSubSection}>
                <div className={styles.hairSubLabel}>Bangs</div>
                <HairPresetGrid
                  presets={BANGS_OVERLAY_PRESETS}
                  activeId={currentBangs}
                  onSelect={handleBangsChange}
                  disabled={hairLoading}
                />
              </div>

              {hairLoading && (
                <div className={styles.hairLoading}>Loading hair...</div>
              )}

              {/* Color swatches */}
              {hasAnyHair && (
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
          )}
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
