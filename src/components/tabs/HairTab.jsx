/**
 * HairTab — Hair style, bangs, color, opacity, and outline controls.
 *
 * Extracted from SliderPanel for tab-based layout.
 */

import React, { useState, useCallback } from "react";
import { MAIN_HAIR_PRESETS, BANGS_OVERLAY_PRESETS } from "../../library/hairManager";
import styles from "../SliderPanel.module.css";

/**
 * Derive shade and outline hex colors from a base hex color.
 * MToon 3-channel: shade = 65% of base, outline = 25% of base.
 */
function deriveHairChannels(baseHex) {
  const r = parseInt(baseHex.slice(1, 3), 16);
  const g = parseInt(baseHex.slice(3, 5), 16);
  const b = parseInt(baseHex.slice(5, 7), 16);
  const toHex = (v) => Math.round(v).toString(16).padStart(2, "0");
  return {
    base: baseHex,
    shade: `#${toHex(r * 0.65)}${toHex(g * 0.65)}${toHex(b * 0.65)}`,
    outline: `#${toHex(r * 0.25)}${toHex(g * 0.25)}${toHex(b * 0.25)}`,
  };
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

export default function HairTab({ hairManager, vrmScene, threeScene, morphDataManager, sliderValues, onSliderChange }) {
  // Initialize state from hairManager (sync UI with current runtime state)
  const initState = hairManager?.getState?.() || {};
  const [currentMain, setCurrentMain] = useState(initState.mainStyle || "none");
  const [currentBangs, setCurrentBangs] = useState(initState.bangsStyle || "none");
  const [hairLoading, setHairLoading] = useState(false);
  const [hairColor, setHairColor] = useState(initState.color || null);
  const [hairOpacity, setHairOpacity] = useState(initState.opacity ?? 1.0);
  const [hairAdvanced, setHairAdvanced] = useState(false);
  const [outlineWidth, setOutlineWidth] = useState(initState.outlineWidth ?? 0);

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
    (baseHex) => {
      if (!baseHex) {
        setHairColor(null);
        if (hairManager) hairManager.setHairColor(null);
        return;
      }
      const channels = deriveHairChannels(baseHex);
      setHairColor(channels);
      if (hairManager) hairManager.setHairColor(channels);
    },
    [hairManager]
  );

  const handleHairChannelChange = useCallback(
    (channel, hexValue) => {
      setHairColor((prev) => {
        const next = { ...(prev || { base: "#FFFFFF", shade: "#A6A6A6", outline: "#404040" }), [channel]: hexValue };
        if (hairManager) hairManager.setHairColor(next);
        return next;
      });
    },
    [hairManager]
  );

  const handleHairOpacityChange = useCallback(
    (e) => {
      const val = parseFloat(e.target.value);
      setHairOpacity(val);
      if (hairManager) hairManager.setHairOpacity(val);
    },
    [hairManager]
  );

  const handleOutlineWidthChange = useCallback(
    (e) => {
      const val = parseFloat(e.target.value);
      setOutlineWidth(val);
      if (hairManager) hairManager.setOutlineWidth(val);
    },
    [hairManager]
  );

  const hasAnyHair = currentMain !== "none" || currentBangs !== "none";

  return (
    <div className={styles.tabContent}>
      {/* Style */}
      <div className={styles.hairSubSection}>
        <div className={styles.hairSubLabel}>Style</div>
        <HairPresetGrid
          presets={MAIN_HAIR_PRESETS}
          activeId={currentMain}
          onSelect={handleMainChange}
          disabled={hairLoading}
        />
      </div>

      {/* Bangs */}
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

      {/* Color + Opacity */}
      {hasAnyHair && (
        <div className={styles.hairColorSection}>
          <div className={styles.hairColorRow}>
            <label className={styles.hairColorLabel}>Color</label>
            <input
              type="color"
              className={styles.hairColorPicker}
              value={hairColor?.base || "#FFFFFF"}
              onChange={(e) => handleHairColorChange(e.target.value)}
            />
            <button
              className={`${styles.hairColorDefault} ${!hairColor ? styles.hairColorDefaultActive : ""}`}
              onClick={() => handleHairColorChange(null)}
              title="Reset to default"
            >
              Default
            </button>
            <button
              className={`${styles.hairAdvancedToggle} ${hairAdvanced ? styles.hairAdvancedToggleActive : ""}`}
              onClick={() => {
                const next = !hairAdvanced;
                setHairAdvanced(next);
                if (next && !hairColor) {
                  handleHairColorChange("#FFFFFF");
                }
              }}
              title="Independent channel control"
            >
              3ch
            </button>
          </div>
          {hairAdvanced && hairColor && (
            <div className={styles.hairChannelGroup}>
              {["base", "shade", "outline"].map((ch) => (
                <div key={ch} className={styles.hairChannelRow}>
                  <span className={styles.hairChannelName}>{ch.charAt(0).toUpperCase() + ch.slice(1)}</span>
                  <input
                    type="color"
                    className={styles.hairColorPicker}
                    value={hairColor[ch]}
                    onChange={(e) => handleHairChannelChange(ch, e.target.value)}
                  />
                  <span className={styles.hairChannelHex}>{hairColor[ch]}</span>
                </div>
              ))}
            </div>
          )}
          <div className={styles.hairOpacityRow}>
            <span className={styles.hairChannelName}>Opacity</span>
            <input
              type="range"
              className={styles.hairOpacitySlider}
              min="0" max="1" step="0.01"
              value={hairOpacity}
              onChange={handleHairOpacityChange}
            />
            <span className={styles.hairChannelHex}>{hairOpacity.toFixed(2)}</span>
          </div>
          <div className={styles.hairOpacityRow}>
            <span className={styles.hairChannelName}>Outline</span>
            <input
              type="range"
              className={styles.hairOpacitySlider}
              min="0" max="0.01" step="0.0005"
              value={outlineWidth}
              onChange={handleOutlineWidthChange}
            />
            <span className={styles.hairChannelHex}>{outlineWidth > 0 ? outlineWidth.toFixed(4) : "Off"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
