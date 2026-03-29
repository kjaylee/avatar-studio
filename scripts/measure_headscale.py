#!/usr/bin/env python3
"""
Measure face width from VRM (GLB) files to compute headScale.
headScale = baseFaceWidth / hairFaceWidth
baseFaceWidth = 0.2176 (from base model)

Parses GLB binary format, finds Face mesh, extracts X extent of vertices.
"""

import struct
import json
import sys
import os
import glob

BASE_FACE_WIDTH = 0.2176

def parse_glb(filepath):
    """Parse GLB file and return JSON chunk + binary chunk."""
    with open(filepath, 'rb') as f:
        # GLB header: magic(4) + version(4) + length(4)
        magic, version, length = struct.unpack('<III', f.read(12))
        assert magic == 0x46546C67, f"Not a GLB file: {filepath}"

        # Chunk 0: JSON
        chunk0_len, chunk0_type = struct.unpack('<II', f.read(8))
        assert chunk0_type == 0x4E4F534A, "First chunk must be JSON"
        json_data = json.loads(f.read(chunk0_len))

        # Chunk 1: Binary
        chunk1_len, chunk1_type = struct.unpack('<II', f.read(8))
        assert chunk1_type == 0x004E4942, "Second chunk must be BIN"
        bin_data = f.read(chunk1_len)

    return json_data, bin_data

def get_accessor_data(gltf, bin_data, accessor_idx):
    """Extract float32 array from accessor."""
    accessor = gltf['accessors'][accessor_idx]
    buffer_view = gltf['bufferViews'][accessor['bufferView']]

    offset = buffer_view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    count = accessor['count']

    component_type = accessor['componentType']  # 5126 = FLOAT
    acc_type = accessor['type']  # VEC3, SCALAR, etc.

    components = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
    n_components = components.get(acc_type, 1)

    if component_type != 5126:  # Only handle FLOAT
        return None

    stride = buffer_view.get('byteStride', n_components * 4)

    values = []
    for i in range(count):
        pos = offset + i * stride
        row = struct.unpack_from(f'<{n_components}f', bin_data, pos)
        values.append(row)

    return values

def find_face_mesh_width(gltf, bin_data):
    """Find face mesh and measure X extent (width)."""
    meshes = gltf.get('meshes', [])
    nodes = gltf.get('nodes', [])

    # Find face mesh node
    face_mesh_idx = None
    for i, node in enumerate(nodes):
        name = node.get('name', '').lower()
        if 'face' in name and 'mesh' not in name.lower().replace('face', ''):
            # Prefer exact "Face" node
            if 'mesh' in node:
                face_mesh_idx = node['mesh']
                break

    # Fallback: search mesh names
    if face_mesh_idx is None:
        for i, mesh in enumerate(meshes):
            name = mesh.get('name', '').lower()
            if 'face' in name:
                face_mesh_idx = i
                break

    # Another fallback: search node names more broadly
    if face_mesh_idx is None:
        for i, node in enumerate(nodes):
            name = node.get('name', '').lower()
            if 'face' in name and 'mesh' in node:
                face_mesh_idx = node['mesh']
                break

    if face_mesh_idx is None:
        return None

    mesh = meshes[face_mesh_idx]

    # Get position accessor from first primitive
    primitives = mesh.get('primitives', [])
    if not primitives:
        return None

    pos_accessor_idx = primitives[0]['attributes'].get('POSITION')
    if pos_accessor_idx is None:
        return None

    positions = get_accessor_data(gltf, bin_data, pos_accessor_idx)
    if not positions:
        return None

    # Measure X extent (max_x - min_x)
    x_values = [p[0] for p in positions]
    x_extent = max(x_values) - min(x_values)

    return x_extent

def measure_file(filepath):
    """Measure headScale for a single VRM file."""
    try:
        gltf, bin_data = parse_glb(filepath)
        face_width = find_face_mesh_width(gltf, bin_data)
        if face_width is None:
            return None, "No face mesh found"
        head_scale = BASE_FACE_WIDTH / face_width
        return head_scale, face_width
    except Exception as e:
        return None, str(e)

def main():
    hair_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                            'public', 'vrm-data', 'hairs')

    # Collect all VRM files
    vrm_files = sorted(glob.glob(os.path.join(hair_dir, '*.vrm')))
    vrm_files += sorted(glob.glob(os.path.join(hair_dir, 'front', '*.vrm')))

    print(f"{'File':<35} {'Face Width':>12} {'headScale':>12}")
    print("-" * 62)

    results = {}
    for filepath in vrm_files:
        rel_path = os.path.relpath(filepath, hair_dir)
        head_scale, info = measure_file(filepath)
        if head_scale is not None:
            print(f"{rel_path:<35} {info:>12.4f} {head_scale:>12.3f}")
            results[rel_path] = round(head_scale, 3)
        else:
            print(f"{rel_path:<35} {'ERROR':>12} {info}")

    # Output as JSON for easy consumption
    print("\n\n// HAIR_PRESETS headScale values:")
    print(json.dumps(results, indent=2))

if __name__ == '__main__':
    main()
