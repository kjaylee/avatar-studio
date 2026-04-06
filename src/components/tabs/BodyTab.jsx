/**
 * BodyTab — Body shape parameter sliders with randomize support.
 *
 * Extracted from SliderPanel for tab-based layout.
 */

import React, { useState, useCallback, useEffect } from "react";
import { PARAM_CATEGORIES, PARAM_DISPLAY_NAMES } from "../../library/morphDataManager";
import styles from "../SliderPanel.module.css";

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
      <label className={styles.sliderLabel}>{displayName}</label>
      <input
        type="range"
        className={styles.slider}
        min={-1} max={1} step={0.01}
        value={value ?? 0}
        onChange={handleChange}
      />
      <span
        className={styles.sliderValue}
        onClick={handleReset}
        title="Click to reset"
      >
        {(value ?? 0).toFixed(2)}
      </span>
    </div>
  );
}

function CategorySection({ category, params, values, onChange, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={styles.category}>
      <button className={styles.categoryHeader} onClick={() => setOpen(!open)}>
        <span className={styles.categoryArrow}>{open ? "\u25BC" : "\u25B6"}</span>
        <span className={styles.categoryName}>{category}</span>
        <span className={styles.categoryCount}>{params.length}</span>
      </button>
      {open && (
        <div className={styles.categoryBody}>
          {params.map((paramName) => (
            <SliderRow
              key={paramName}
              paramName={paramName}
              value={values[paramName]}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function BodyTab({ morphDataManager, hairManager, clothingMeshManager, vrmScene, onSliderChange }) {
  const [sliderValues, setSliderValues] = useState(() =>
    morphDataManager?.sliderValues ? { ...morphDataManager.sliderValues } : {}
  );

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
          if (clothingMeshManager) clothingMeshManager.syncBones(vrmScene, newValues);
          onSliderChange?.();
        }
        return newValues;
      });
    },
    [morphDataManager, vrmScene, hairManager, clothingMeshManager, onSliderChange]
  );

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
      if (clothingMeshManager) clothingMeshManager.syncBones(vrmScene, newValues);
    }
  }, [morphDataManager, vrmScene, hairManager, clothingMeshManager]);

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabActionRow}>
        <button className={styles.actionButton} onClick={handleRandomize} title="Randomize body params">
          Random
        </button>
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
  );
}
