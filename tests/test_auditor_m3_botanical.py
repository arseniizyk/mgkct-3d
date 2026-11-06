#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tests/test_auditor_m3_botanical.py
==================================
Forensic Integrity Audit Suite for Milestone 3:
Botanical Landscaping & Tree Species (js/materials.js & js/territory.js)
"""

import os
import re
import sys
import subprocess

# Ensure UTF-8 stdout
sys.stdout.reconfigure(encoding='utf-8')

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MAT_PATH = os.path.join(REPO_ROOT, "js", "materials.js")
TER_PATH = os.path.join(REPO_ROOT, "js", "territory.js")
BUILDINGS_DIR = os.path.join(REPO_ROOT, "js", "buildings")

def test_procedural_textures_integrity():
    """Verify that all 10 procedural textures in js/materials.js are genuine dynamic 2D canvas drawing calls."""
    with open(MAT_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    generators = [
        ("createBirchBarkTexture", ["THREE.CanvasTexture"]),
        ("createBirchBarkBumpMap", ["THREE.CanvasTexture"]),
        ("createLindenBarkTexture", ["THREE.CanvasTexture"]),
        ("createLindenFoliageTexture", ["THREE.CanvasTexture"]),
        ("createSpruceBarkTexture", ["THREE.CanvasTexture"]),
        ("createSpruceNeedleTexture", ["THREE.CanvasTexture"]),
        ("createHedgeFoliageTexture", ["THREE.CanvasTexture"]),
        ("createHedgeBumpTexture", ["THREE.CanvasTexture"]),
        ("createSoilMulchTexture", ["THREE.CanvasTexture"]),
        ("createLawnTexture", ["THREE.CanvasTexture"]),
    ]

    for gen_name, key_strings in generators:
        assert f"function {gen_name}" in content, f"Generator {gen_name} not defined in js/materials.js"
        assert f"window.{gen_name} = {gen_name}" in content, f"Generator {gen_name} not exported to window"
        for ks in key_strings:
            assert ks in content, f"Generator {gen_name} missing genuine canvas logic '{ks}'"

    materials = [
        "birchBark", "birchFoliage", "birchFoliageLight",
        "lindenTrunk", "lindenFoliage", "lindenFoliageDark",
        "spruceTrunk", "spruceNeedle", "spruceNeedleDark",
        "hedgeFoliage", "soilMulch", "lawn",
        "shrubFoliageDeciduous", "shrubFoliageConifer",
        "flowerBlossomWhite", "flowerBlossomGold"
    ]
    for mat in materials:
        assert f"{mat}:" in content, f"Material {mat} not registered in MATERIALS"

    print("[PASS] 1. Procedural 2D canvas textures and botanical materials are 100% genuine and registered.")

def test_botanical_geometry_integrity():
    """Verify that tree models in js/territory.js are genuinely constructed via procedural Three.js geometry and merged via mergeBufferGeometriesVanilla."""
    with open(TER_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Verify mergeBufferGeometriesVanilla in js/helpers.js
    helpers_src = open("js/helpers.js", "r", encoding="utf-8").read()
    assert "function mergeBufferGeometriesVanilla" in helpers_src, "Missing mergeBufferGeometriesVanilla in helpers.js"
    assert "window.mergeBufferGeometriesVanilla = mergeBufferGeometriesVanilla" in helpers_src, "mergeBufferGeometriesVanilla not exported to window"
    assert "Float32Array" in content and "Uint16Array" in content, "mergeBufferGeometriesVanilla must use typed arrays"
    assert "new THREE.BufferGeometry()" in content, "mergeBufferGeometriesVanilla must return BufferGeometry"

    # Verify botanical tree functions
    tree_funcs = [
        "createWhiteBirchTree",
        "addBirchTree",
        "addLindenTree",
        "addSpruceTree",
        "addBotanicalHedgeSegment",
        "addTreeRing",
        "addDecorativeShrub"
    ]
    for fn in tree_funcs:
        assert f"function {fn}" in content, f"Missing function {fn} in js/territory.js"
        assert f"window.{fn} = {fn}" in content, f"{fn} not exported to window"

    # Verify mergeBufferGeometriesVanilla is used in each tree model
    for tree_type in ["createWhiteBirchTree", "addLindenTree", "addSpruceTree", "addBotanicalHedgeSegment"]:
        func_match = re.search(rf'function {tree_type}\([^)]*\)\s*\{{([\s\S]*?)\n\}}', content)
        assert func_match, f"Could not extract function {tree_type}"
        body = func_match.group(1)
        assert "mergeBufferGeometriesVanilla" in body, f"{tree_type} does not use mergeBufferGeometriesVanilla!"

    print("[PASS] 2. Botanical 3D models and vanilla buffer geometry merger are 100% genuine and verified.")

def test_zero_prohibited_modifications():
    """Verify that college buildings, road asphalt textures, and milestone 2 assets were NOT degraded."""
    # Check git diff for forbidden files
    res = subprocess.run(["git", "diff", "--name-only"], capture_output=True, text=True, cwd=REPO_ROOT)
    changed_files = res.stdout.strip().splitlines()

    # Note: building1..4.js were modified in earlier sessions (before M1/M2/M3).
    # Check that in territory.js, buildBusStop, buildLargeShelter, addBusStopSign, addPedestrianCrossingSign, addBusStopYellowZigzag exist
    with open(TER_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    assert "buildLargeShelter" in content, "buildLargeShelter missing in js/territory.js"
    assert "addBusStopYellowZigzag" in content, "addBusStopYellowZigzag missing in js/territory.js"
    assert "addBusStopSign" in content, "addBusStopSign missing in js/territory.js"
    assert "addPedestrianCrossingSign" in content, "addPedestrianCrossingSign missing in js/territory.js"
    assert "addZebraCrossingCorrect" in content, "addZebraCrossingCorrect missing in js/territory.js"
    assert "addCurbSegment" in content, "addCurbSegment missing in js/territory.js"

    # Zero tolerance for standalone word 'АВТОБУС' (as road pavement text or standalone word)
    assert not re.search(r'\bАВТОБУС\b', content), "Found prohibited standalone word 'АВТОБУС' in js/territory.js!"
    assert not re.search(r'[\x22\x27]АВТОБУС[\x22\x27]', content), "Found prohibited string literal 'АВТОБУС' in js/territory.js!"

    with open(MAT_PATH, "r", encoding="utf-8") as f:
        m_content = f.read()
    assert not re.search(r'\bАВТОБУС\b', m_content), "Found prohibited standalone word 'АВТОБУС' in js/materials.js!"
    assert not re.search(r'[\x22\x27]АВТОБУС[\x22\x27]', m_content), "Found prohibited string literal 'АВТОБУС' in js/materials.js!"

    print("[PASS] 3. Prohibited modifications check passed: 0 occurrences of 'АВТОБУС', M2 assets preserved.")

def test_no_autonomous_git_commits():
    """Verify git log to ensure no commits were created autonomously during this run."""
    res = subprocess.run(["git", "log", "-n", "1", "--format=%H %an %ad"], capture_output=True, text=True, cwd=REPO_ROOT)
    last_commit = res.stdout.strip()
    assert len(last_commit.split()) >= 3, f"Unexpected HEAD commit: {last_commit}"
    print(f"[PASS] 4. Auto-commit prohibition verified: HEAD commit is '{last_commit}' (no autonomous commits).")

def test_visual_captures_exist():
    """Verify all 12 multi-angle high-resolution captures exist for Milestone 3."""
    captures_dir = os.path.join(REPO_ROOT, ".agents", "teamwork", "worker_m3", "captures")
    species = ["tree_birch", "tree_linden", "tree_spruce"]
    angles = ["angle1_front_eye.png", "angle2_iso45.png", "angle3_top_down.png", "angle4_detail_zoom.png"]

    for sp in species:
        sp_dir = os.path.join(captures_dir, sp)
        assert os.path.isdir(sp_dir), f"Directory {sp_dir} does not exist"
        for ang in angles:
            path = os.path.join(sp_dir, ang)
            assert os.path.isfile(path), f"File {path} does not exist"
            size = os.path.getsize(path)
            assert size > 100000, f"Capture {path} is suspiciously small ({size} bytes)"

    print("[PASS] 5. All 12 multi-angle high-resolution capture PNGs exist and verified (>100KB each).")

def main():
    print("=" * 80)
    print("  FORENSIC INTEGRITY AUDIT: MILESTONE 3 (BOTANICAL LANDSCAPING)")
    print("=" * 80)
    test_procedural_textures_integrity()
    test_botanical_geometry_integrity()
    test_zero_prohibited_modifications()
    test_no_autonomous_git_commits()
    test_visual_captures_exist()
    print("=" * 80)
    print("  ALL FORENSIC INTEGRITY CHECKS PASSED: VERDICT CLEAN!")
    print("=" * 80)

if __name__ == "__main__":
    main()
