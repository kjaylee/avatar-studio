/**
 * FaceTab — Face type, face parameters, expressions, and face textures.
 *
 * Extracted from SliderPanel for tab-based layout.
 */

import React, { useState, useCallback, useMemo } from "react";
import { FACE_PARAM_CATEGORIES, FACE_PARAM_DISPLAY_NAMES } from "../../library/morphDataManager";
import styles from "../SliderPanel.module.css";

// Expression morph target categories
const EXPRESSION_CATEGORIES = {
  "Preset Expressions": [
    "Fcl_ALL_Neutral", "Fcl_ALL_Angry", "Fcl_ALL_Fun", "Fcl_ALL_Joy",
    "Fcl_ALL_Sorrow", "Fcl_ALL_Surprised",
  ],
  Brows: [
    "Fcl_BRW_Angry", "Fcl_BRW_Fun", "Fcl_BRW_Joy",
    "Fcl_BRW_Sorrow", "Fcl_BRW_Surprised",
  ],
  Eyes: [
    "Fcl_EYE_Natural", "Fcl_EYE_Angry", "Fcl_EYE_Close",
    "Fcl_EYE_Close_R", "Fcl_EYE_Close_L",
    "Fcl_EYE_Fun", "Fcl_EYE_Joy", "Fcl_EYE_Joy_R", "Fcl_EYE_Joy_L",
    "Fcl_EYE_Sorrow", "Fcl_EYE_Surprised", "Fcl_EYE_Spread",
    "Fcl_EYE_Iris_Hide", "Fcl_EYE_Highlight_Hide",
  ],
  Mouth: [
    "Fcl_MTH_Close", "Fcl_MTH_Up", "Fcl_MTH_Down",
    "Fcl_MTH_Angry", "Fcl_MTH_Small", "Fcl_MTH_Large",
    "Fcl_MTH_Neutral", "Fcl_MTH_Fun", "Fcl_MTH_Joy",
    "Fcl_MTH_Sorrow", "Fcl_MTH_Surprised",
    "Fcl_MTH_SkinFung", "Fcl_MTH_SkinFung_R", "Fcl_MTH_SkinFung_L",
    "Fcl_MTH_A", "Fcl_MTH_I", "Fcl_MTH_U", "Fcl_MTH_E", "Fcl_MTH_O",
  ],
  Teeth: [
    "Fcl_HA_Hide", "Fcl_HA_Fung1", "Fcl_HA_Fung1_Low", "Fcl_HA_Fung1_Up",
    "Fcl_HA_Fung2", "Fcl_HA_Fung2_Low", "Fcl_HA_Fung2_Up",
    "Fcl_HA_Fung3", "Fcl_HA_Fung3_Up", "Fcl_HA_Fung3_Low",
    "Fcl_HA_Short", "Fcl_HA_Short_Up", "Fcl_HA_Short_Low",
  ],
};

const EXPRESSION_DISPLAY_NAMES = {
  Fcl_ALL_Neutral: "Neutral", Fcl_ALL_Angry: "Angry", Fcl_ALL_Fun: "Fun",
  Fcl_ALL_Joy: "Joy", Fcl_ALL_Sorrow: "Sorrow", Fcl_ALL_Surprised: "Surprised",
  Fcl_BRW_Angry: "Angry", Fcl_BRW_Fun: "Fun", Fcl_BRW_Joy: "Joy",
  Fcl_BRW_Sorrow: "Sorrow", Fcl_BRW_Surprised: "Surprised",
  Fcl_EYE_Natural: "Natural", Fcl_EYE_Angry: "Angry", Fcl_EYE_Close: "Close",
  Fcl_EYE_Close_R: "Close R", Fcl_EYE_Close_L: "Close L",
  Fcl_EYE_Fun: "Fun", Fcl_EYE_Joy: "Joy", Fcl_EYE_Joy_R: "Joy R",
  Fcl_EYE_Joy_L: "Joy L", Fcl_EYE_Sorrow: "Sorrow",
  Fcl_EYE_Surprised: "Surprised", Fcl_EYE_Spread: "Spread",
  Fcl_EYE_Iris_Hide: "Iris Hide", Fcl_EYE_Highlight_Hide: "Highlight Hide",
  Fcl_MTH_Close: "Close", Fcl_MTH_Up: "Up", Fcl_MTH_Down: "Down",
  Fcl_MTH_Angry: "Angry", Fcl_MTH_Small: "Small", Fcl_MTH_Large: "Large",
  Fcl_MTH_Neutral: "Neutral", Fcl_MTH_Fun: "Fun", Fcl_MTH_Joy: "Joy",
  Fcl_MTH_Sorrow: "Sorrow", Fcl_MTH_Surprised: "Surprised",
  Fcl_MTH_SkinFung: "Skin Fang", Fcl_MTH_SkinFung_R: "Skin Fang R",
  Fcl_MTH_SkinFung_L: "Skin Fang L",
  Fcl_MTH_A: "A", Fcl_MTH_I: "I", Fcl_MTH_U: "U",
  Fcl_MTH_E: "E", Fcl_MTH_O: "O",
  Fcl_HA_Hide: "Hide", Fcl_HA_Fung1: "Fang 1", Fcl_HA_Fung1_Low: "Fang 1 Low",
  Fcl_HA_Fung1_Up: "Fang 1 Up", Fcl_HA_Fung2: "Fang 2",
  Fcl_HA_Fung2_Low: "Fang 2 Low", Fcl_HA_Fung2_Up: "Fang 2 Up",
  Fcl_HA_Fung3: "Fang 3", Fcl_HA_Fung3_Up: "Fang 3 Up",
  Fcl_HA_Fung3_Low: "Fang 3 Low",
  Fcl_HA_Short: "Short", Fcl_HA_Short_Up: "Short Up", Fcl_HA_Short_Low: "Short Low",
};

const FACE_TEXTURE_CATEGORIES = ["iris", "highlight", "face_skin", "mouth", "eye_white", "brow", "eyelash", "eyeline"];
const FACE_TEXTURE_DISPLAY = {
  iris: "Iris", highlight: "Highlight", face_skin: "Face Skin",
  mouth: "Mouth", eye_white: "Eye White", brow: "Eyebrows",
  eyelash: "Eyelash", eyeline: "Eye Line",
};

function ExpressionSliderRow({ name, value, onChange }) {
  const displayName = EXPRESSION_DISPLAY_NAMES[name] || name;
  return (
    <div className={styles.sliderRow}>
      <label className={styles.sliderLabel}>{displayName}</label>
      <input
        type="range"
        className={styles.slider}
        min={0} max={1} step={0.01}
        value={value}
        onChange={(e) => onChange(name, parseFloat(e.target.value))}
      />
      <span
        className={styles.sliderValue}
        onClick={() => onChange(name, 0)}
        title="Click to reset"
      >
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function ExpressionCategorySection({ category, morphNames, values, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.category}>
      <button className={styles.categoryHeader} onClick={() => setOpen(!open)}>
        <span className={styles.categoryArrow}>{open ? "\u25BC" : "\u25B6"}</span>
        <span className={styles.categoryName}>{category}</span>
        <span className={styles.categoryCount}>{morphNames.length}</span>
      </button>
      {open && (
        <div className={styles.categoryBody}>
          {morphNames.map((name) => (
            <ExpressionSliderRow
              key={name}
              name={name}
              value={values[name] ?? 0}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FaceTab({ morphDataManager, textureSwapManager, vrmScene, vrmObj, onSliderChange }) {
  // Initialize state from morphDataManager (sync UI with current runtime state)
  const initFace = morphDataManager?.getFullState?.()?.face || {};
  const initTexVariants = textureSwapManager?.getState?.()?.activeVariants || {};
  const [activeFaceType, setActiveFaceType] = useState(initFace.faceType || null);
  const [faceTypesLoaded, setFaceTypesLoaded] = useState(false);
  const [faceTypeLoading, setFaceTypeLoading] = useState(false);
  const [faceParamValues, setFaceParamValues] = useState(initFace.faceParams || {});
  const [faceParamsLoaded, setFaceParamsLoaded] = useState(false);
  const [faceParamOpenSections, setFaceParamOpenSections] = useState({});
  const [faceParamStrength, setFaceParamStrength] = useState(initFace.faceParamStrength ?? 0.5);
  const [expressionValues, setExpressionValues] = useState({});
  const [expressionOpen, setExpressionOpen] = useState(false);
  const [textureVariants, setTextureVariants] = useState(initTexVariants);
  const [textureOpen, setTextureOpen] = useState(false);

  // Find Face mesh morph target dictionary from VRM scene
  const faceMorphData = useMemo(() => {
    if (!vrmScene) return null;
    const meshes = [];
    vrmScene.traverse((child) => {
      if (child.isMesh && child.morphTargetDictionary && Object.keys(child.morphTargetDictionary).length > 0) {
        const name = child.name?.toLowerCase() || "";
        if (name.includes("face") || name.includes("head") || Object.keys(child.morphTargetDictionary).some(k => k.startsWith("Fcl_"))) {
          meshes.push(child);
        }
      }
    });
    return meshes.length > 0 ? meshes : null;
  }, [vrmScene]);

  // Face type handler
  const handleFaceTypeChange = useCallback(
    async (typeId) => {
      if (!morphDataManager || !vrmScene) return;
      setFaceTypeLoading(true);
      try {
        if (!faceTypesLoaded) {
          await morphDataManager.loadFaceTextureIndex("./vrm-data/face_textures/index.json");
          setFaceTypesLoaded(true);
        }
        const newType = typeId === activeFaceType ? null : typeId;
        await morphDataManager.applyFaceType(newType, vrmScene);
        setActiveFaceType(newType);
        onSliderChange?.();
      } catch (err) {
        console.error("Face type error:", err);
      } finally {
        setFaceTypeLoading(false);
      }
    },
    [morphDataManager, vrmScene, faceTypesLoaded, activeFaceType, onSliderChange]
  );

  // Face parameter handler
  const handleFaceParamChange = useCallback(
    async (paramName, value) => {
      if (!morphDataManager || !vrmScene) return;
      try {
        if (!faceParamsLoaded) {
          await morphDataManager.loadFaceParamDeltas("./vrm-data/face_param_deltas.json");
          setFaceParamsLoaded(true);
        }
        morphDataManager.setFaceParam(paramName, value, vrmScene);
        setFaceParamValues((prev) => ({ ...prev, [paramName]: value }));
        onSliderChange?.();
      } catch (err) {
        console.error("Face param error:", err);
      }
    },
    [morphDataManager, vrmScene, faceParamsLoaded, onSliderChange]
  );

  const handleFaceParamStrength = useCallback(
    (val) => {
      if (!morphDataManager) return;
      setFaceParamStrength(val);
      morphDataManager.faceParamStrength = val;
      if (vrmScene) morphDataManager._applyAll(vrmScene);
      onSliderChange?.();
    },
    [morphDataManager, vrmScene, onSliderChange]
  );

  const toggleFaceParamSection = useCallback((section) => {
    setFaceParamOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  // Expression handler
  const handleExpressionChange = useCallback(
    (morphName, value) => {
      setExpressionValues((prev) => ({ ...prev, [morphName]: value }));
      if (!faceMorphData) return;
      for (const mesh of faceMorphData) {
        const idx = mesh.morphTargetDictionary[morphName];
        if (idx !== undefined) {
          mesh.morphTargetInfluences[idx] = value;
        }
      }
    },
    [faceMorphData]
  );

  const handleResetExpressions = useCallback(() => {
    setExpressionValues({});
    if (!faceMorphData) return;
    for (const mesh of faceMorphData) {
      if (mesh.morphTargetInfluences) {
        mesh.morphTargetInfluences.fill(0);
      }
    }
  }, [faceMorphData]);

  // Texture swap handler
  const handleTextureSwap = useCallback(
    async (category, variantId) => {
      if (!textureSwapManager || !vrmScene) return;
      try {
        await textureSwapManager.swapTexture(category, variantId, vrmScene);
        setTextureVariants((prev) => ({ ...prev, [category]: variantId }));
        onSliderChange?.();
      } catch (err) {
        console.error("Texture swap error:", err);
      }
    },
    [textureSwapManager, vrmScene, onSliderChange]
  );

  return (
    <div className={styles.tabContent}>
      {/* Face Type */}
      <div className={styles.category}>
        <div className={styles.hairSubLabel}>Face Type</div>
        <div className={styles.hairSelectorFull}>
          {Array.from({ length: 52 }, (_, i) => {
            const id = String(i + 1);
            return (
              <button
                key={id}
                data-facetype={id}
                className={`${styles.hairButton} ${activeFaceType === id ? styles.hairButtonActive : ""}`}
                onClick={() => handleFaceTypeChange(id)}
                disabled={faceTypeLoading}
              >
                {id}
              </button>
            );
          })}
        </div>
        {faceTypeLoading && <div className={styles.hairLoading}>Loading face data...</div>}
      </div>

      {/* Face Strength */}
      <div className={styles.sliderRow} style={{ padding: "4px 8px" }}>
        <label className={styles.sliderLabel}>Face Strength</label>
        <input
          type="range"
          className={styles.slider}
          min={0.1} max={1.0} step={0.05}
          value={faceParamStrength}
          onChange={(e) => handleFaceParamStrength(parseFloat(e.target.value))}
        />
        <span className={styles.sliderValue}>{faceParamStrength.toFixed(2)}</span>
      </div>

      {/* Face Parameter Categories */}
      {Object.entries(FACE_PARAM_CATEGORIES).map(([section, params]) => {
        const isOpen = !!faceParamOpenSections[section];
        return (
          <div key={`fp_${section}`} className={styles.category}>
            <button className={styles.categoryHeader} onClick={() => toggleFaceParamSection(section)}>
              <span className={styles.categoryArrow}>{isOpen ? "\u25BC" : "\u25B6"}</span>
              <span className={styles.categoryName}>{section}</span>
              <span className={styles.categoryCount}>{params.length}</span>
            </button>
            {isOpen && (
              <div className={styles.categoryBody}>
                {params.map((paramName) => {
                  const info = morphDataManager?.getFaceParamInfo?.(paramName);
                  const range = info?.range || [-1, 1];
                  const value = faceParamValues[paramName] || 0;
                  const displayName = FACE_PARAM_DISPLAY_NAMES[paramName] || paramName;
                  return (
                    <div key={paramName} className={styles.sliderRow}>
                      <label className={styles.sliderLabel}>{displayName}</label>
                      <input
                        type="range"
                        className={styles.slider}
                        min={range[0]} max={range[1]}
                        step={range[1] > 1 ? 1 : 0.01}
                        value={value}
                        onChange={(e) => handleFaceParamChange(paramName, parseFloat(e.target.value))}
                      />
                      <span
                        className={styles.sliderValue}
                        onClick={() => handleFaceParamChange(paramName, 0)}
                        title="Click to reset"
                      >
                        {range[1] > 1 ? Math.round(value) : value.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Expressions */}
      {faceMorphData && (
        <div className={styles.category}>
          <button className={styles.categoryHeader} onClick={() => setExpressionOpen(!expressionOpen)}>
            <span className={styles.categoryArrow}>{expressionOpen ? "\u25BC" : "\u25B6"}</span>
            <span className={styles.categoryName}>Expressions</span>
            <span
              className={styles.resetButton}
              role="button"
              onClick={(e) => { e.stopPropagation(); handleResetExpressions(); }}
              title="Reset all expressions"
              style={{ marginLeft: "auto", marginRight: 8, cursor: "pointer" }}
            >
              Reset
            </span>
          </button>
          {expressionOpen && (
            <div className={styles.categoryBody}>
              {Object.entries(EXPRESSION_CATEGORIES).map(([cat, morphNames]) => (
                <ExpressionCategorySection
                  key={cat}
                  category={cat}
                  morphNames={morphNames}
                  values={expressionValues}
                  onChange={handleExpressionChange}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Face Texture Variants */}
      {textureSwapManager?.loaded && (
        <div className={styles.category}>
          <button className={styles.categoryHeader} onClick={() => setTextureOpen(!textureOpen)}>
            <span className={styles.categoryArrow}>{textureOpen ? "\u25BC" : "\u25B6"}</span>
            <span className={styles.categoryName}>Face Textures</span>
            <span className={styles.categoryCount}>{FACE_TEXTURE_CATEGORIES.length}</span>
          </button>
          {textureOpen && (
            <div className={styles.categoryBody}>
              {FACE_TEXTURE_CATEGORIES.map((cat) => {
                const variants = textureSwapManager.getVariants(cat);
                if (variants.length === 0) return null;
                const activeVar = textureVariants[cat] || null;
                const displayName = FACE_TEXTURE_DISPLAY[cat] || cat;
                return (
                  <div key={cat} className={styles.hairSubSection}>
                    <div className={styles.hairSubLabel}>{displayName} ({variants.length})</div>
                    <div className={styles.hairSelector}>
                      <button
                        className={`${styles.hairButton} ${!activeVar ? styles.hairButtonActive : ""}`}
                        onClick={() => handleTextureSwap(cat, null)}
                      >
                        Base
                      </button>
                      {variants.map((v) => (
                        <button
                          key={v.id}
                          className={`${styles.hairButton} ${activeVar === v.id ? styles.hairButtonActive : ""}`}
                          onClick={() => handleTextureSwap(cat, v.id)}
                        >
                          {v.id}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
