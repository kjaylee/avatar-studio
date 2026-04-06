/**
 * ClothingTab — Outfit selection, individual clothing pieces, and character variants.
 *
 * Extracted from SliderPanel for tab-based layout.
 */

import React, { useState, useCallback } from "react";
import { CLOTHING_DISPLAY, CHARACTER_VARIANTS, OUTFIT_LIST } from "../../library/textureSwapManager";
import styles from "../SliderPanel.module.css";

export default function ClothingTab({ textureSwapManager, morphDataManager, vrmScene, onSliderChange }) {
  // Initialize state from textureSwapManager (sync UI with current runtime state)
  const initVariants = textureSwapManager?.getState?.()?.activeVariants || {};
  const [clothingEnabled, setClothingEnabled] = useState(!!initVariants.clothing);
  const [clothingPieces, setClothingPieces] = useState({
    tops: !!initVariants.clothing_tops,
    bottoms: !!initVariants.clothing_bottoms,
    shoes: !!initVariants.clothing_shoes,
  });
  const [activeCharVariant, setActiveCharVariant] = useState(initVariants.characterVariant || null);
  const [activeOutfit, setActiveOutfit] = useState(initVariants.clothing || null);

  const handleClothingToggle = useCallback(
    async (enable) => {
      if (!textureSwapManager || !vrmScene) return;
      try {
        await textureSwapManager.applyFullClothing(enable, vrmScene, morphDataManager);
        if (morphDataManager) morphDataManager.reapplyMorphs(vrmScene);
        setClothingEnabled(enable);
        if (!enable) setActiveOutfit(null);
        onSliderChange?.();
      } catch (err) {
        console.error("Clothing toggle error:", err);
      }
    },
    [textureSwapManager, vrmScene, morphDataManager, onSliderChange]
  );

  const handleClothingPieceToggle = useCallback(
    async (piece, enable) => {
      if (!textureSwapManager || !vrmScene) return;
      try {
        await textureSwapManager.swapClothing(piece, enable, vrmScene);
        setClothingPieces((prev) => ({ ...prev, [piece]: enable }));
        onSliderChange?.();
      } catch (err) {
        console.error("Clothing piece error:", err);
      }
    },
    [textureSwapManager, vrmScene, onSliderChange]
  );

  const handleCharVariantChange = useCallback(
    async (variantId) => {
      if (!textureSwapManager || !vrmScene) return;
      try {
        const newId = variantId === activeCharVariant ? null : variantId;
        await textureSwapManager.applyCharacterVariant(newId, vrmScene);
        setActiveCharVariant(newId);
        onSliderChange?.();
      } catch (err) {
        console.error("Character variant error:", err);
      }
    },
    [textureSwapManager, vrmScene, activeCharVariant, onSliderChange]
  );

  const handleOutfitChange = useCallback(
    async (outfitId) => {
      if (!textureSwapManager || !vrmScene) return;
      try {
        if (outfitId === activeOutfit) {
          // Toggle off
          await textureSwapManager.applyFullClothing(false, vrmScene, morphDataManager);
          if (morphDataManager) morphDataManager.reapplyMorphs(vrmScene);
          setActiveOutfit(null);
          setClothingEnabled(false);
        } else {
          await textureSwapManager.applyOutfit(outfitId, vrmScene, morphDataManager);
          if (morphDataManager) morphDataManager.reapplyMorphs(vrmScene);
          setActiveOutfit(outfitId);
          setClothingEnabled(true);
        }
        onSliderChange?.();
      } catch (err) {
        console.error("Outfit change error:", err);
      }
    },
    [textureSwapManager, vrmScene, morphDataManager, activeOutfit, onSliderChange]
  );

  if (!textureSwapManager?.loaded) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.hairLoading}>Loading clothing data...</div>
      </div>
    );
  }

  return (
    <div className={styles.tabContent}>
      {/* Outfit selector */}
      <div className={styles.hairSubSection}>
        <div className={styles.hairSubLabel}>Outfit</div>
        <div className={styles.hairSelector}>
          <button
            className={`${styles.hairButton} ${!clothingEnabled ? styles.hairButtonActive : ""}`}
            onClick={() => handleClothingToggle(false)}
          >
            Skin
          </button>
          {OUTFIT_LIST.length > 0 ? (
            OUTFIT_LIST.map((outfit) => (
              <button
                key={outfit.id}
                className={`${styles.hairButton} ${activeOutfit === outfit.id ? styles.hairButtonActive : ""}`}
                onClick={() => handleOutfitChange(outfit.id)}
              >
                {outfit.name}
              </button>
            ))
          ) : (
            <button
              className={`${styles.hairButton} ${clothingEnabled ? styles.hairButtonActive : ""}`}
              onClick={() => handleClothingToggle(true)}
            >
              Clothed
            </button>
          )}
        </div>
      </div>

      {/* Individual pieces */}
      <div className={styles.hairSubSection}>
        <div className={styles.hairSubLabel}>Individual Pieces</div>
        <div className={styles.hairSelector}>
          {Object.entries(CLOTHING_DISPLAY).map(([piece, label]) => (
            <button
              key={piece}
              className={`${styles.hairButton} ${clothingPieces[piece] ? styles.hairButtonActive : ""}`}
              onClick={() => handleClothingPieceToggle(piece, !clothingPieces[piece])}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Character Variants */}
      <div className={styles.hairSubSection}>
        <div className={styles.hairSubLabel}>Character Variant</div>
        <div className={styles.hairSelector}>
          <button
            className={`${styles.hairButton} ${!activeCharVariant ? styles.hairButtonActive : ""}`}
            onClick={() => handleCharVariantChange(null)}
          >
            Base
          </button>
          {CHARACTER_VARIANTS.map((v) => (
            <button
              key={v.id}
              className={`${styles.hairButton} ${activeCharVariant === v.id ? styles.hairButtonActive : ""}`}
              onClick={() => handleCharVariantChange(v.id)}
            >
              {v.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
