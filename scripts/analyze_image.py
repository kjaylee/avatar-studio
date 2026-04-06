#!/usr/bin/env python3
"""
Analyze a photo using MLX + Gemma 4 vision model and output
AvatarState-compatible JSON for VRM avatar generation.

Usage:
    python3 scripts/analyze_image.py <image_path> [--model MODEL] [--output FILE]

Requires: mlx-vlm >= 0.3.0 with gemma4 support
"""

import argparse
import json
import sys
import os
import base64

# ─── Avatar Studio parameter schema ─────────────────────────────────

BODY_PARAMS = [
    "heightFemale", "heightMale", "bodySize", "torsoLength",
    "headSize", "headWidth", "crownHeight",
    "neckLength", "neckWidth", "neckFrontWidth", "neckEmphasis",
    "shoulderWidth", "clavicleLowering",
    "chestSize", "chestDepth", "chestVerticalDirection", "chestSpread",
    "armLength", "handSize", "fingerThickness",
    "waistSize", "legLength", "footSize",
    "eyeHeight", "eyeWidth", "eyeSpacing", "eyeRotation",
    "eyePositionY", "eyeInnerCornerHeight",
]

HAIR_STYLES = [
    "none", "shorthair", "medium", "longhair",
    *[chr(65 + i) for i in range(26)],  # A-Z
    *[str(i) for i in range(1, 12)],     # 1-11
]

BANGS_STYLES = ["none", "FA", "FB", "FC", "FD", "FE", "FF", "FG", "FH"]

FACE_TYPES = [str(i) for i in range(1, 53)]  # 1-52

OUTFITS = ["skin", "outfit_a", "outfit_b", "outfit_c"]

CHARACTER_VARIANTS = ["base", "E", "G", "I"]

# ─── Analysis prompt ────────────────────────────────────────────────

ANALYSIS_PROMPT = """Analyze this person's appearance and output a JSON object with these exact fields.
All numeric values must be between -1.0 and 1.0 unless otherwise noted.

{
  "hair": {
    "length": "short" | "medium" | "long",
    "color": "#hexcolor",
    "has_bangs": true | false,
    "bangs_style": "straight" | "side" | "wispy" | "none",
    "volume": -1.0 to 1.0 (thin to thick),
    "style_description": "brief description"
  },
  "face": {
    "shape": "round" | "oval" | "square" | "heart" | "oblong",
    "eye_size": -1.0 to 1.0 (small to large),
    "eye_spacing": -1.0 to 1.0 (close to wide),
    "eye_rotation": -1.0 to 1.0 (downward to upward slant),
    "nose_size": -1.0 to 1.0 (small to large),
    "nose_height": -1.0 to 1.0 (flat to prominent),
    "mouth_size": -1.0 to 1.0 (small to large),
    "jaw_width": -1.0 to 1.0 (narrow to wide),
    "chin_length": -1.0 to 1.0 (short to long),
    "cheek_fullness": -1.0 to 1.0 (thin to full),
    "forehead_height": -1.0 to 1.0 (short to tall)
  },
  "body": {
    "height": -1.0 to 1.0 (short to tall),
    "build": "slim" | "average" | "athletic" | "curvy" | "large",
    "shoulder_width": -1.0 to 1.0 (narrow to wide),
    "chest_size": -1.0 to 1.0 (small to large),
    "waist_size": -1.0 to 1.0 (thin to wide)
  },
  "clothing": {
    "type": "none" | "casual" | "formal" | "dress",
    "color_primary": "#hexcolor"
  },
  "expression": "neutral" | "happy" | "angry" | "sad" | "surprised",
  "skin_tone": "#hexcolor"
}

Return ONLY valid JSON, no explanation."""


def build_avatar_state(analysis: dict) -> dict:
    """Map vision model analysis to AvatarState JSON format."""
    hair = analysis.get("hair", {})
    face = analysis.get("face", {})
    body = analysis.get("body", {})
    clothing = analysis.get("clothing", {})
    expression = analysis.get("expression", "neutral")

    # ── Hair style mapping ──────────────────────────────────────────
    length = hair.get("length", "medium")
    hair_map = {"short": "shorthair", "medium": "medium", "long": "longhair"}
    main_style = hair_map.get(length, "medium")

    has_bangs = hair.get("has_bangs", False)
    bangs_map = {"straight": "FA", "side": "FB", "wispy": "FC", "none": "none"}
    bangs_style = bangs_map.get(hair.get("bangs_style", "none"), "none") if has_bangs else "none"

    hair_color = hair.get("color", None)

    # ── Face type mapping ───────────────────────────────────────────
    shape = face.get("shape", "oval")
    face_type_map = {
        "round": "5",  "oval": "1",  "square": "15",
        "heart": "10", "oblong": "20",
    }
    face_type = face_type_map.get(shape, "1")

    # ── Body slider mapping ─────────────────────────────────────────
    build = body.get("build", "average")
    build_body_size = {
        "slim": -0.4, "average": 0.0, "athletic": 0.2,
        "curvy": 0.3, "large": 0.6,
    }

    body_sliders = {}
    body_sliders["heightFemale"] = _clamp(body.get("height", 0.0))
    body_sliders["bodySize"] = _clamp(build_body_size.get(build, 0.0))
    body_sliders["shoulderWidth"] = _clamp(body.get("shoulder_width", 0.0))
    body_sliders["chestSize"] = _clamp(body.get("chest_size", 0.0))
    body_sliders["waistSize"] = _clamp(body.get("waist_size", 0.0))

    # Face → body eye params
    body_sliders["eyeHeight"] = _clamp(face.get("eye_size", 0.0))
    body_sliders["eyeWidth"] = _clamp(face.get("eye_size", 0.0) * 0.8)
    body_sliders["eyeSpacing"] = _clamp(face.get("eye_spacing", 0.0))
    body_sliders["eyeRotation"] = _clamp(face.get("eye_rotation", 0.0))
    body_sliders["headSize"] = _clamp(face.get("forehead_height", 0.0) * 0.5)
    body_sliders["headWidth"] = _clamp(face.get("jaw_width", 0.0) * 0.6)

    # ── Face params ─────────────────────────────────────────────────
    face_params = {}
    face_params["eyeWidth"] = _clamp(face.get("eye_size", 0.0))
    face_params["eyeHeight"] = _clamp(face.get("eye_size", 0.0))
    face_params["eyeSpacing"] = _clamp(face.get("eye_spacing", 0.0))
    face_params["eyeRotation"] = _clamp(face.get("eye_rotation", 0.0))
    face_params["noseHeight"] = _clamp(face.get("nose_height", 0.0))
    face_params["noseSize"] = _clamp(face.get("nose_size", 0.0))
    face_params["mouthWidth"] = _clamp(face.get("mouth_size", 0.0))
    face_params["jawWidth"] = _clamp(face.get("jaw_width", 0.0))
    face_params["chinLength"] = _clamp(face.get("chin_length", 0.0))
    face_params["cheekFullness"] = _clamp(face.get("cheek_fullness", 0.0))

    # ── Outfit mapping ──────────────────────────────────────────────
    clothing_type = clothing.get("type", "none")
    outfit_map = {
        "none": None, "casual": "outfit_a",
        "formal": "outfit_b", "dress": "outfit_c",
    }
    outfit = outfit_map.get(clothing_type, None)

    # ── Expression mapping ──────────────────────────────────────────
    expressions = {}
    expr_map = {
        "neutral": "Fcl_ALL_Neutral",
        "happy": "Fcl_ALL_Joy",
        "angry": "Fcl_ALL_Angry",
        "sad": "Fcl_ALL_Sorrow",
        "surprised": "Fcl_ALL_Surprised",
    }
    expr_name = expr_map.get(expression, "Fcl_ALL_Neutral")
    if expr_name != "Fcl_ALL_Neutral":
        expressions[expr_name] = 0.8

    # ── Assemble AvatarState ────────────────────────────────────────
    avatar_state = {
        "version": 1,
        "body": body_sliders,
        "face": {
            "faceType": face_type,
            "faceParams": face_params,
            "faceParamStrength": 0.5,
        },
        "hair": {
            "mainStyle": main_style,
            "bangsStyle": bangs_style,
            "color": _derive_hair_channels(hair_color) if hair_color else None,
            "opacity": 1.0,
            "outlineWidth": 0,
        },
        "clothing": {
            "outfit": outfit,
            "characterVariant": None,
            "pieces": {"tops": False, "bottoms": False, "shoes": False},
        },
        "textures": {},
        "expressions": expressions,
    }

    return avatar_state


def _clamp(v, lo=-1.0, hi=1.0):
    """Clamp a value to [lo, hi]."""
    return max(lo, min(hi, float(v)))


def _derive_hair_channels(base_hex):
    """Derive MToon 3-channel colors from a base hex."""
    if not base_hex or not base_hex.startswith("#"):
        return None
    r = int(base_hex[1:3], 16)
    g = int(base_hex[3:5], 16)
    b = int(base_hex[5:7], 16)
    to_hex = lambda v: hex(max(0, min(255, round(v))))[2:].zfill(2)
    return {
        "base": base_hex,
        "shade": f"#{to_hex(r*0.65)}{to_hex(g*0.65)}{to_hex(b*0.65)}",
        "outline": f"#{to_hex(r*0.25)}{to_hex(g*0.25)}{to_hex(b*0.25)}",
    }


def analyze_with_mlx(image_path: str, model_path: str) -> dict:
    """Run MLX vision model on image and parse JSON response."""
    from mlx_vlm import load, generate
    from mlx_vlm.prompt_utils import apply_chat_template
    from mlx_vlm.utils import load_config

    print(f"[analyze] Loading model: {model_path}", file=sys.stderr)
    model, processor = load(model_path)

    config = load_config(model_path)
    prompt = apply_chat_template(processor, config, ANALYSIS_PROMPT, num_images=1)

    print(f"[analyze] Analyzing image: {image_path}", file=sys.stderr)
    output = generate(
        model, processor, prompt,
        image=[image_path],
        max_tokens=1024,
        temperature=0.1,
        verbose=False,
    )

    # Extract JSON from response (GenerationResult has .text field)
    text = (output.text if hasattr(output, "text") else str(output)).strip()
    # Handle markdown code blocks
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        print(f"[analyze] JSON parse error: {e}", file=sys.stderr)
        print(f"[analyze] Raw output:\n{text}", file=sys.stderr)
        # Return minimal defaults
        return {
            "hair": {"length": "medium", "color": "#4a3728"},
            "face": {"shape": "oval"},
            "body": {"height": 0.0, "build": "average"},
            "clothing": {"type": "none"},
            "expression": "neutral",
        }


def main():
    parser = argparse.ArgumentParser(description="Analyze image → AvatarState JSON")
    parser.add_argument("image", help="Path to input image")
    parser.add_argument("--model", default="mlx-community/gemma-4-E4B-it-4bit",
                        help="MLX vision model path (default: gemma-4-E4B-it-4bit)")
    parser.add_argument("--output", "-o", default=None,
                        help="Output JSON file (default: stdout)")
    parser.add_argument("--raw", action="store_true",
                        help="Output raw analysis JSON (skip AvatarState mapping)")
    args = parser.parse_args()

    if not os.path.exists(args.image):
        print(f"Error: Image not found: {args.image}", file=sys.stderr)
        sys.exit(1)

    # Analyze image
    analysis = analyze_with_mlx(args.image, args.model)

    if args.raw:
        result = analysis
    else:
        result = build_avatar_state(analysis)

    # Output
    output_json = json.dumps(result, indent=2, ensure_ascii=False)
    if args.output:
        with open(args.output, "w") as f:
            f.write(output_json)
        print(f"[analyze] Saved to {args.output}", file=sys.stderr)
    else:
        print(output_json)


if __name__ == "__main__":
    main()
