#!/usr/bin/env python3
"""Compare hair mesh count and total vertex count across VRM files to see if back hair differs."""

import struct
import json
import os
import glob

def parse_glb_json(filepath):
    with open(filepath, 'rb') as f:
        struct.unpack('<III', f.read(12))
        chunk0_len, _ = struct.unpack('<II', f.read(8))
        return json.loads(f.read(chunk0_len))

def count_hair_info(filepath):
    gltf = parse_glb_json(filepath)
    nodes = gltf.get('nodes', [])
    meshes = gltf.get('meshes', [])

    total_verts = 0
    mesh_count = 0
    front_verts = 0  # Z > 0
    back_verts = 0   # Z < 0

    for node in nodes:
        if 'mesh' not in node:
            continue
        mesh = meshes[node['mesh']]
        name = mesh.get('name', '')
        if 'hair' not in name.lower():
            continue

        for prim in mesh.get('primitives', []):
            pos_idx = prim['attributes'].get('POSITION')
            if pos_idx is None:
                continue
            acc = gltf['accessors'][pos_idx]
            verts = acc['count']
            total_verts += verts
            mesh_count += 1

            # Check Z extent to classify front vs back
            z_min = acc.get('min', [0,0,0])[2]
            z_max = acc.get('max', [0,0,0])[2]
            z_center = (z_min + z_max) / 2
            if z_center < 0:
                back_verts += verts
            else:
                front_verts += verts

    return mesh_count, total_verts, front_verts, back_verts

hair_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        'public', 'vrm-data', 'hairs')

print(f"{'File':<25} {'Meshes':>7} {'Total V':>8} {'Front V':>8} {'Back V':>8}")
print("-" * 62)

for f in sorted(glob.glob(os.path.join(hair_dir, '*.vrm'))):
    name = os.path.basename(f)
    mc, tv, fv, bv = count_hair_info(f)
    print(f"{name:<25} {mc:>7} {tv:>8} {fv:>8} {bv:>8}")

print()
for f in sorted(glob.glob(os.path.join(hair_dir, 'front', '*.vrm'))):
    name = 'front/' + os.path.basename(f)
    mc, tv, fv, bv = count_hair_info(f)
    print(f"{name:<25} {mc:>7} {tv:>8} {fv:>8} {bv:>8}")
