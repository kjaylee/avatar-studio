#!/usr/bin/env python3
"""Detailed inspection of hair mesh structure in VRM files - check if meshes are SkinnedMesh or Mesh."""

import struct
import json
import os
import sys

def parse_glb(filepath):
    with open(filepath, 'rb') as f:
        magic, version, length = struct.unpack('<III', f.read(12))
        chunk0_len, chunk0_type = struct.unpack('<II', f.read(8))
        json_data = json.loads(f.read(chunk0_len))
        chunk1_len, chunk1_type = struct.unpack('<II', f.read(8))
        bin_data = f.read(chunk1_len)
    return json_data, bin_data

def get_accessor_data(gltf, bin_data, accessor_idx):
    accessor = gltf['accessors'][accessor_idx]
    bv = gltf['bufferViews'][accessor['bufferView']]
    offset = bv.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    count = accessor['count']
    components = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
    n = components.get(accessor['type'], 1)
    stride = bv.get('byteStride', n * 4)
    values = []
    for i in range(count):
        pos = offset + i * stride
        values.append(struct.unpack_from(f'<{n}f', bin_data, pos))
    return values

def inspect(filepath):
    gltf, bin_data = parse_glb(filepath)

    # Build node tree
    nodes = gltf.get('nodes', [])
    meshes = gltf.get('meshes', [])
    skins = gltf.get('skins', [])

    print(f"\n=== {os.path.basename(filepath)} ===")
    print(f"Nodes: {len(nodes)}, Meshes: {len(meshes)}, Skins: {len(skins)}")

    # Find all nodes with meshes that have "hair" in name
    for i, node in enumerate(nodes):
        name = node.get('name', '')
        if 'mesh' in node:
            mesh_idx = node['mesh']
            mesh = meshes[mesh_idx]
            mesh_name = mesh.get('name', f'mesh_{mesh_idx}')

            if 'hair' not in mesh_name.lower() and 'hair' not in name.lower():
                continue

            skin_idx = node.get('skin')
            is_skinned = skin_idx is not None

            # Get vertex count and bounding box
            prims = mesh.get('primitives', [])
            for pi, prim in enumerate(prims):
                pos_idx = prim['attributes'].get('POSITION')
                if pos_idx is None:
                    continue
                accessor = gltf['accessors'][pos_idx]
                vtx_count = accessor['count']

                # Get bounding box from accessor
                bbox_min = accessor.get('min', [0,0,0])
                bbox_max = accessor.get('max', [0,0,0])

                mat_idx = prim.get('material')
                mat_name = gltf['materials'][mat_idx]['name'] if mat_idx is not None else 'none'

                print(f"  Node[{i}] '{name}' -> Mesh '{mesh_name}' prim[{pi}]")
                print(f"    skinned={is_skinned} skin={skin_idx} verts={vtx_count}")
                print(f"    bbox X: [{bbox_min[0]:.3f}, {bbox_max[0]:.3f}]")
                print(f"    bbox Y: [{bbox_min[1]:.3f}, {bbox_max[1]:.3f}]")
                print(f"    bbox Z: [{bbox_min[2]:.3f}, {bbox_max[2]:.3f}]")
                print(f"    material: {mat_name}")

hair_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        'public', 'vrm-data', 'hairs')

# Compare old style_shorthair with new A.vrm
for f in ['style_shorthair.vrm', 'A.vrm', 'J.vrm']:
    inspect(os.path.join(hair_dir, f))
