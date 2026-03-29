#!/usr/bin/env python3
"""Inspect mesh/material names in hair VRM files to identify hair type."""

import struct
import json
import os
import glob

def parse_glb_json(filepath):
    with open(filepath, 'rb') as f:
        magic, version, length = struct.unpack('<III', f.read(12))
        chunk0_len, chunk0_type = struct.unpack('<II', f.read(8))
        return json.loads(f.read(chunk0_len))

def inspect_file(filepath):
    gltf = parse_glb_json(filepath)

    hair_meshes = []
    hair_materials = set()

    for mesh in gltf.get('meshes', []):
        name = mesh.get('name', '')
        if 'hair' in name.lower():
            hair_meshes.append(name)
            for prim in mesh.get('primitives', []):
                mat_idx = prim.get('material')
                if mat_idx is not None:
                    mat_name = gltf['materials'][mat_idx].get('name', f'mat_{mat_idx}')
                    hair_materials.add(mat_name)

    # Also check node names for hair
    for node in gltf.get('nodes', []):
        name = node.get('name', '')
        if 'hair' in name.lower() and name not in hair_meshes:
            hair_meshes.append(f"node:{name}")

    return hair_meshes, sorted(hair_materials)

def main():
    hair_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                            'public', 'vrm-data', 'hairs')

    vrm_files = sorted(glob.glob(os.path.join(hair_dir, '*.vrm')))
    vrm_files += sorted(glob.glob(os.path.join(hair_dir, 'front', '*.vrm')))

    for filepath in vrm_files:
        rel = os.path.relpath(filepath, hair_dir)
        meshes, mats = inspect_file(filepath)
        mesh_str = ', '.join(meshes[:5])
        mat_str = ', '.join(mats[:5])
        print(f"{rel:<25} meshes: {mesh_str}")
        if mats:
            print(f"{'':25} mats:   {mat_str}")
        print()

if __name__ == '__main__':
    main()
