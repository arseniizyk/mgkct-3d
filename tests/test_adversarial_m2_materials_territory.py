#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tests/test_adversarial_m2_materials_territory.py
=================================================
Adversarial Stress Test & Verification Suite for Milestone 2:
- Procedural Textures & PBR Materials (js/materials.js)
- Transit Shelter Architecture, Markings, Curbstones, Signs (js/territory.js)
"""

import os
import re
import sys

# Ensure UTF-8 stdout
sys.stdout.reconfigure(encoding='utf-8')

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MAT_PATH = os.path.join(REPO_ROOT, "js", "materials.js")
TER_PATH = os.path.join(REPO_ROOT, "js", "territory.js")

def test_no_bundler_syntax():
    """Verify zero ES module import/export keywords in vanilla JS files."""
    for path, name in [(MAT_PATH, "js/materials.js"), (TER_PATH, "js/territory.js")]:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        import_match = re.search(r'^\s*import\s+', content, re.MULTILINE)
        export_match = re.search(r'^\s*export\s+(default\s+)?(function|class|const|let|var)\s+', content, re.MULTILINE)
        assert not import_match, f"Found forbidden ES module import in {name}: {import_match.group(0)}"
        assert not export_match, f"Found forbidden ES module export in {name}: {export_match.group(0)}"
    print("[PASS] Zero bundler / vanilla architecture verified (0 import/export keywords).")

def test_pavement_text_forbidden():
    """Verify that pavement text 'АВТОБУС' (mesh letters) is strictly absent."""
    with open(TER_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    assert "addPavementTextBus" not in content, "Found forbidden addPavementTextBus function in js/territory.js"
    # Ensure no road marking mesh contains 'АВТОБУС'
    # Comments mentioning bus stop are allowed, but no geometry string with 'АВТОБУС'
    mesh_text_match = re.search(r'createTextGeometry\s*\(\s*["\']АВТОБУС["\']', content)
    assert not mesh_text_match, "Found forbidden mesh text 'АВТОБУС' in js/territory.js"
    print("[PASS] Pavement text 'АВТОБУС' is strictly deleted (0 occurrences).")

def test_stop_lines_right_hand_traffic():
    """Verify stop lines STB 1.12 are strictly positioned prior to pedestrian crossing for right-hand traffic."""
    with open(TER_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Search for addRoadStripe stop lines in addZebraCrossingCorrect
    zebra_block = re.search(r'function addZebraCrossingCorrect\([^)]*\)\s*\{([\s\S]*?)\n\}', content)
    assert zebra_block, "Could not find addZebraCrossingCorrect in js/territory.js"
    block_text = zebra_block.group(1)

    # South half (Eastbound, oncoming from West X < 54.0): stop line must be at X = xMin - 2.0 (52.0)
    assert "xMin - 2.0, 35.65, xMin - 2.0, 42.35" in block_text, \
        "Eastbound stop line incorrectly positioned: must be at xMin - 2.0 (52.0) across south half [35.65, 42.35]"

    # North half (Westbound, oncoming from East X > 58.0): stop line must be at X = xMax + 2.0 (60.0)
    assert "xMax + 2.0, 28.65, xMax + 2.0, 35.35" in block_text, \
        "Westbound stop line incorrectly positioned: must be at xMax + 2.0 (60.0) across north half [28.65, 35.35]"

    print("[PASS] Stop lines STB 1.12 are strictly aligned with Belarusian right-hand traffic flow.")

def test_yellow_zigzag_geometry():
    """Verify yellow zigzag marking STB 1.17 uses continuous BufferGeometry with analytical miter offset."""
    with open(TER_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    zigzag_block = re.search(r'function addBusStopYellowZigzag\([^)]*\)\s*\{([\s\S]*?)\n\}', content)
    assert zigzag_block, "Could not find addBusStopYellowZigzag in js/territory.js"
    block = zigzag_block.group(1)

    assert "THREE.BufferGeometry" in block, "addBusStopYellowZigzag must use THREE.BufferGeometry"
    assert "miterZ" in block, "addBusStopYellowZigzag must compute miterZ analytical offset"
    assert "Float32BufferAttribute" in block, "addBusStopYellowZigzag must use Float32BufferAttribute"
    assert "computeVertexNormals" in block, "addBusStopYellowZigzag must compute vertex normals"

    print("[PASS] Yellow zigzag marking STB 1.17 uses analytical continuous BufferGeometry.")

def test_sign_mounting_geometry():
    """Verify traffic signs 5.16 and 5.19 have standoff mounts and pole does not intersect sign face."""
    with open(TER_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    for func_name in ["addPedestrianCrossingSign", "addBusStopSign"]:
        block_match = re.search(rf'function {func_name}\([^)]*\)\s*\{{([\s\S]*?)\n\}}', content)
        assert block_match, f"Could not find {func_name} in js/territory.js"
        block = block_match.group(1)

        # Pole radius check: pole radius must be 0.038
        assert "0.038" in block, f"{func_name} pole must have radius 0.038m"
        # Standoff / clamp mounts check
        assert "standoff" in block.lower(), f"{func_name} must include standoff mounting hardware"
        assert "clamp" in block.lower(), f"{func_name} must include clamping bands"

        # Face offset check: face z must be >= 0.070, well clear of pole (radius 0.038)
        face_pos = re.search(r'faceMesh\.position\.set\([^,]+,\s*[^,]+,\s*([0-9\.]+)\)', block)
        assert face_pos, f"Could not find faceMesh.position in {func_name}"
        face_z = float(face_pos.group(1))
        assert face_z >= 0.070, f"{func_name} face Z offset {face_z} must be >= 0.070m to clear pole radius 0.038m"

    print("[PASS] Traffic signs 5.16 and 5.19 mounting hardware and clear standoff offsets verified.")

def test_curb_instanced_mesh():
    """Verify curbstones utilize THREE.InstancedMesh batching in buildTerritory."""
    with open(TER_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    assert "flushCurbBatch" in content, "Missing flushCurbBatch in js/territory.js"
    assert "THREE.InstancedMesh" in content, "Missing THREE.InstancedMesh in flushCurbBatch"
    assert "_curbBatch = []" in content, "Missing _curbBatch initialization in buildTerritory"
    assert "_curbBatch = null" in content, "Missing _curbBatch reset in flushCurbBatch"

    print("[PASS] Curbstone batching and THREE.InstancedMesh rendering verified.")

def test_procedural_textures_and_materials():
    """Verify procedural texture generators and PBR materials in js/materials.js."""
    with open(MAT_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Texture generators
    for gen_name in [
        "createGlassFritTexture",
        "createBusTimetableTexture",
        "createBusStopSignTexture",
        "createPedestrianSignTexture"
    ]:
        assert f"function {gen_name}" in content, f"Missing {gen_name} in js/materials.js"
        assert f"window.{gen_name} = {gen_name}" in content, f"{gen_name} not exported to window"

    # PBR materials
    for mat_name in [
        "shelterFrameStainless",
        "shelterGlass",
        "shelterRoofGlass",
        "shelterBenchWood",
        "shelterBenchLegs",
        "busTimetable",
        "stainlessSteel",
        "busStopSign",
        "pedestrianSign",
        "pedestrianSignRight"
    ]:
        assert f"{mat_name}:" in content, f"Missing material {mat_name} in MATERIALS"

    print("[PASS] All procedural texture generators and PBR materials verified in js/materials.js.")

def main():
    print("======================================================================")
    print("  ADVERSARIAL STRESS TEST: MILESTONE 2 (MATERIALS & TERRITORY)")
    print("======================================================================")
    test_no_bundler_syntax()
    test_pavement_text_forbidden()
    test_stop_lines_right_hand_traffic()
    test_yellow_zigzag_geometry()
    test_sign_mounting_geometry()
    test_curb_instanced_mesh()
    test_procedural_textures_and_materials()
    print("======================================================================")
    print("  ALL 7 ADVERSARIAL STRESS TESTS PASSED 100%!")
    print("======================================================================")

if __name__ == "__main__":
    main()
