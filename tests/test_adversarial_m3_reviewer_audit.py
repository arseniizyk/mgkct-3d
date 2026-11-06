#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tests/test_adversarial_m3_reviewer_audit.py
============================================
Comprehensive Adversarial & Integrity Audit Suite for Milestone 3:
- Botanical Landscaping & Tree Species (js/materials.js, js/territory.js)
- Vanilla JS Three.js r128 Architecture & Window Exports
- Botanical PBR Materials (15) and Procedural Textures (10)
- Vanilla BufferGeometry Merger Mathematical & Edge-Case Soundness
- Integrity Audit (Zero Facades, Zero Building Alterations, Zero Fake Files)
- Multi-Angle Visual Capture Integrity & Image Header Verification
- Headless Browser CDP In-Engine Stress & Draw-Call Audit
"""

import http.server
import json
import os
import re
import socketserver
import struct
import subprocess
import sys
import threading
import time
import urllib.request

# Ensure UTF-8 stdout
sys.stdout.reconfigure(encoding='utf-8')

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MAT_PATH = os.path.join(REPO_ROOT, "js", "materials.js")
TER_PATH = os.path.join(REPO_ROOT, "js", "territory.js")
CAPTURES_DIR = os.path.join(REPO_ROOT, ".agents", "teamwork", "worker_m3", "captures")

class ReviewerAuditTest:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.findings = []

    def assert_test(self, condition, name, details=""):
        if condition:
            self.passed += 1
            print(f"  [PASS] {name}")
        else:
            self.failed += 1
            msg = f"  [FAIL] {name}: {details}"
            print(msg)
            self.findings.append(msg)

    def test_vanilla_architecture(self):
        print("\n--- 1. AUDITING ZERO-BUNDLER / VANILLA ARCHITECTURE ---")
        for path, fname in [(MAT_PATH, "js/materials.js"), (TER_PATH, "js/territory.js")]:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            import_m = re.search(r'^\s*import\s+', content, re.MULTILINE)
            export_m = re.search(r'^\s*export\s+(default\s+)?(function|class|const|let|var)\s+', content, re.MULTILINE)
            self.assert_test(not import_m, f"{fname}: Zero ES module imports", f"Found import: {import_m.group(0) if import_m else ''}")
            self.assert_test(not export_m, f"{fname}: Zero ES module exports", f"Found export: {export_m.group(0) if export_m else ''}")

    def test_procedural_textures_and_materials(self):
        print("\n--- 2. AUDITING PROCEDURAL TEXTURES (10) & BOTANICAL MATERIALS (15) ---")
        with open(MAT_PATH, "r", encoding="utf-8") as f:
            mat_content = f.read()

        textures = [
            "createBirchBarkTexture",
            "createBirchBarkBumpMap",
            "createLindenBarkTexture",
            "createLindenFoliageTexture",
            "createSpruceBarkTexture",
            "createSpruceNeedleTexture",
            "createHedgeFoliageTexture",
            "createHedgeBumpTexture",
            "createSoilMulchTexture",
            "createLawnTexture"
        ]
        for tex in textures:
            has_func = f"function {tex}" in mat_content
            has_win = f"window.{tex} = {tex}" in mat_content
            self.assert_test(has_func and has_win, f"Texture Generator '{tex}': declared & exported to window")

        materials = [
            "birchBark",
            "birchFoliage",
            "birchFoliageLight",
            "lindenTrunk",
            "lindenFoliage",
            "lindenFoliageDark",
            "spruceTrunk",
            "spruceNeedle",
            "spruceNeedleDark",
            "hedgeFoliage",
            "soilMulch",
            "lawn",
            "shrubFoliageDeciduous",
            "shrubFoliageConifer",
            "flowerBlossomWhite",
            "flowerBlossomGold"
        ]
        for mat in materials:
            has_mat = re.search(rf'\b{mat}\s*:\s*new\s+THREE\.MeshStandardMaterial', mat_content)
            self.assert_test(bool(has_mat), f"PBR Material '{mat}': registered in MATERIALS")

    def test_botanical_generators(self):
        print("\n--- 3. AUDITING BOTANICAL 3D GENERATORS IN js/territory.js ---")
        with open(TER_PATH, "r", encoding="utf-8") as f:
            ter_content = f.read()

        generators = [
            "mergeBufferGeometriesVanilla",
            "createWhiteBirchTree",
            "addBirchTree",
            "addLindenTree",
            "addSpruceTree",
            "addBotanicalHedgeSegment",
            "addTreeRing",
            "addDecorativeShrub"
        ]
        for gen in generators:
            has_func = f"function {gen}" in ter_content
            has_win = f"window.{gen} = {gen}" in ter_content
            self.assert_test(has_func and has_win, f"Botanical Generator '{gen}': declared & exported to window")

        # Test backward compatibility dispatcher
        has_compat = "function addArchitecturalTree" in ter_content
        dispatches_linden = "addLindenTree" in ter_content[ter_content.find("function addArchitecturalTree"):ter_content.find("function addArchitecturalTree") + 300]
        dispatches_spruce = "addSpruceTree" in ter_content[ter_content.find("function addArchitecturalTree"):ter_content.find("function addArchitecturalTree") + 300]
        self.assert_test(has_compat and dispatches_linden and dispatches_spruce, "addArchitecturalTree dispatches to Linden & Spruce")

    def test_integrity_and_constraints(self):
        print("\n--- 4. AUDITING FORENSIC INTEGRITY & CLIENT CONSTRAINTS ---")
        # 1. Zero road marking text 'АВТОБУС'
        with open(TER_PATH, "r", encoding="utf-8") as f:
            ter_content = f.read()
        mesh_text_bus = re.search(r'createTextGeometry\s*\(\s*["\']АВТОБУС["\']', ter_content)
        self.assert_test(not mesh_text_bus, "Zero road marking text 'АВТОБУС'")

        # 2. Building files untouched during Milestone 3 (check timestamp vs worker_m3 start)
        bldg_files = [
            "js/buildings/building1.js",
            "js/buildings/building2.js",
            "js/buildings/building3.js",
            "js/buildings/building4.js"
        ]
        worker_m3_mtime = os.path.getmtime(TER_PATH)
        for bf in bldg_files:
            bf_path = os.path.join(REPO_ROOT, bf)
            bf_mtime = os.path.getmtime(bf_path)
            # Building files must be older than worker_m3's territory.js
            self.assert_test(bf_mtime < worker_m3_mtime, f"Building file {bf} untouched by worker_m3")

        # 3. Check for fake / facade return stubs in geometry merger
        merger_code = ter_content[ter_content.find("function mergeBufferGeometriesVanilla"):ter_content.find("function createWhiteBirchTree")]
        has_pos_buffer = "new THREE.BufferAttribute(posArr, 3)" in merger_code
        has_norm_buffer = "new THREE.BufferAttribute(normArr, 3)" in merger_code
        has_idx_buffer = "merged.setIndex" in merger_code
        has_offset_logic = "vertexOffset += g.attributes.position.count" in merger_code
        self.assert_test(has_pos_buffer and has_norm_buffer and has_idx_buffer and has_offset_logic,
                         "mergeBufferGeometriesVanilla: Genuine buffer arithmetic & indexing (No facade)")

    def test_capture_images_integrity(self):
        print("\n--- 5. AUDITING MULTI-ANGLE VISUAL CAPTURE ARTIFACTS ---")
        targets = ["tree_birch", "tree_linden", "tree_spruce"]
        angles = ["angle1_front_eye.png", "angle2_iso45.png", "angle3_top_down.png", "angle4_detail_zoom.png"]
        all_hashes = set()

        for t in targets:
            tdir = os.path.join(CAPTURES_DIR, t)
            self.assert_test(os.path.isdir(tdir), f"Capture target directory '{t}' exists")
            for a in angles:
                fpath = os.path.join(tdir, a)
                self.assert_test(os.path.isfile(fpath), f"Capture file '{t}/{a}' exists")
                if os.path.isfile(fpath):
                    size = os.path.getsize(fpath)
                    self.assert_test(size > 50000, f"Capture file '{t}/{a}' size is realistic ({size} bytes > 50KB)")
                    # Verify PNG magic number and dimensions
                    with open(fpath, "rb") as pf:
                        header = pf.read(24)
                        is_png = header.startswith(b"\x89PNG\r\n\x1a\n")
                        w, h = struct.unpack(">II", header[16:24]) if is_png else (0, 0)
                        self.assert_test(is_png and w >= 1280 and h >= 720,
                                         f"Capture '{t}/{a}' is valid high-res PNG ({w}x{h})")
                        pf.seek(0)
                        file_data = pf.read()
                        fhash = hash(file_data)
                        self.assert_test(fhash not in all_hashes, f"Capture '{t}/{a}' is visually unique (not a duplicated dummy)")
                        all_hashes.add(fhash)

    def test_browser_cdp_runtime(self):
        print("\n--- 6. EXECUTING IN-ENGINE CDP BROWSER RUNTIME STRESS ---")
        port = 50880
        cdp_port = 50881

        # Start HTTP server
        handler = http.server.SimpleHTTPRequestHandler
        httpd = socketserver.TCPServer(("", port), handler)
        http_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        http_thread.start()

        # Launch Edge in headless mode with remote debugging
        edge_paths = [
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            r"C:\Windows\System32\msedge.exe"
        ]
        edge_bin = next((p for p in edge_paths if os.path.exists(p)), None)
        if not edge_bin:
            print("  [SKIP] Edge browser binary not found in standard paths.")
            httpd.shutdown()
            return

        cmd = [
            edge_bin,
            "--headless=new",
            f"--remote-debugging-port={cdp_port}",
            "--disable-gpu",
            "--no-first-run",
            "--no-default-browser-check",
            f"http://127.0.0.1:{port}/index.html"
        ]
        proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(2.5)

        try:
            # Connect to CDP
            url = f"http://127.0.0.1:{cdp_port}/json"
            with urllib.request.urlopen(url, timeout=5) as resp:
                tabs = json.loads(resp.read().decode())
            tab = next((t for t in tabs if t.get("type") == "page"), tabs[0])
            ws_url = tab["webSocketDebuggerUrl"]

            import websocket
            ws = websocket.create_connection(ws_url, timeout=10)

            msg_id = 1
            def cdp_eval(expr):
                nonlocal msg_id
                req = {
                    "id": msg_id,
                    "method": "Runtime.evaluate",
                    "params": {"expression": expr, "returnByValue": True, "awaitPromise": True}
                }
                msg_id += 1
                ws.send(json.dumps(req))
                res = json.loads(ws.recv())
                return res.get("result", {}).get("result", {}).get("value")

            # 1. Verify mergeBufferGeometriesVanilla in browser engine
            unit_test_script = """
            (() => {
                const results = {};
                // Test 1: Empty
                const g0 = mergeBufferGeometriesVanilla([]);
                results.emptyPass = (g0 instanceof THREE.BufferGeometry);

                // Test 2: Two box geometries with positions, normals, UVs
                const b1 = new THREE.BoxGeometry(1, 1, 1);
                const b2 = new THREE.BoxGeometry(2, 2, 2);
                b2.translate(5, 0, 0);
                const gm = mergeBufferGeometriesVanilla([b1, b2]);
                results.boxCount = gm.attributes.position.count;
                results.expectedCount = b1.attributes.position.count + b2.attributes.position.count;
                results.hasPos = !!gm.attributes.position;
                results.hasNorm = !!gm.attributes.normal;
                results.hasUv = !!gm.attributes.uv;
                results.hasIndex = !!gm.index;
                results.indexCount = gm.index.count;
                results.expectedIndexCount = b1.index.count + b2.index.count;

                // Test 3: Non-indexed geometries
                const ni1 = new THREE.BufferGeometry();
                ni1.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0, 1,0,0, 0,1,0]), 3));
                ni1.computeVertexNormals();
                const ni2 = new THREE.BufferGeometry();
                ni2.setAttribute('position', new THREE.BufferAttribute(new Float32Array([1,1,0, 2,1,0, 1,2,0]), 3));
                ni2.computeVertexNormals();
                const gmni = mergeBufferGeometriesVanilla([ni1, ni2]);
                results.nonIndexCount = gmni.attributes.position.count; // 6
                results.nonIndexIdxCount = gmni.index.count; // 6
                results.nonIndexIndices = Array.from(gmni.index.array); // [0,1,2, 3,4,5]

                return results;
            })()
            """
            merger_res = cdp_eval(unit_test_script)
            self.assert_test(merger_res.get("emptyPass") is True, "In-Engine: mergeBufferGeometriesVanilla handles empty array")
            self.assert_test(merger_res.get("boxCount") == merger_res.get("expectedCount"),
                             f"In-Engine: mergeBufferGeometriesVanilla merged vertex count matches ({merger_res.get('boxCount')})")
            self.assert_test(merger_res.get("indexCount") == merger_res.get("expectedIndexCount"),
                             f"In-Engine: mergeBufferGeometriesVanilla merged index count matches ({merger_res.get('indexCount')})")
            self.assert_test(merger_res.get("nonIndexIndices") == [0, 1, 2, 3, 4, 5],
                             f"In-Engine: Non-indexed geometries indexed with correct offsets: {merger_res.get('nonIndexIndices')}")

            # 2. Check scene botanical objects and draw call budget
            scene_metrics_script = """
            (() => {
                let campusMeshes = 0;
                let territoryMeshes = 0;
                let instancedCurbCount = 0;

                window.scene.traverse(obj => {
                    if (obj.isMesh) campusMeshes++;
                });

                const tGrp = (typeof territoryGroup !== 'undefined' && territoryGroup) ? territoryGroup : window.scene.children.find(c => c.children && c.children.some(ch => ch.userData && ch.userData.isExterior));
                if (tGrp) {
                    tGrp.traverse(obj => {
                        if (obj.isMesh && !obj.isInstancedMesh) territoryMeshes++;
                        if (obj.isInstancedMesh) instancedCurbCount += obj.count;
                    });
                }

                return {
                    campusMeshes: campusMeshes,
                    territoryMeshes: territoryMeshes,
                    instancedCurbCount: instancedCurbCount
                };
            })()
            """
            scene_metrics = cdp_eval(scene_metrics_script)
            print(f"  [INFO] Scene WebGL Metrics: Campus Meshes={scene_metrics.get('campusMeshes')}, Territory Meshes={scene_metrics.get('territoryMeshes')}, Instanced Curbstones={scene_metrics.get('instancedCurbCount')}")
            self.assert_test(scene_metrics.get("territoryMeshes") > 0, f"Territory contains populated 3D meshes ({scene_metrics.get('territoryMeshes')})")
            self.assert_test(scene_metrics.get("instancedCurbCount") > 50, f"Territory curbstones batched via InstancedMesh ({scene_metrics.get('instancedCurbCount')} instances)")

            # 3. Check for WebGL errors and exceptions
            gl_err = cdp_eval("window.renderer.getContext().getError()")
            self.assert_test(gl_err == 0, f"WebGL context error state is NO_ERROR ({gl_err} == 0)")

            ws.close()
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except Exception:
                proc.kill()
            httpd.shutdown()

    def run_all(self):
        print("======================================================================")
        print("  ADVERSARIAL REVIEWER AUDIT SUITE: MILESTONE 3 (BOTANICAL TREES)")
        print("======================================================================")
        self.test_vanilla_architecture()
        self.test_procedural_textures_and_materials()
        self.test_botanical_generators()
        self.test_integrity_and_constraints()
        self.test_capture_images_integrity()
        self.test_browser_cdp_runtime()
        print("\n======================================================================")
        print(f"  REVIEW SUMMARY: {self.passed} PASSED, {self.failed} FAILED")
        print("======================================================================")
        return self.failed == 0

if __name__ == "__main__":
    test = ReviewerAuditTest()
    success = test.run_all()
    sys.exit(0 if success else 1)
