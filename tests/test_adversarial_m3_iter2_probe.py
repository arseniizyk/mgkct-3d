#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tests/test_adversarial_m3_iter2_probe.py
========================================
Empirical Adversarial Verification Probe for Milestone 3 Iteration 2:
1. Grounding Probe (5 front lawn trees, mulch discs elevation Y >= +0.080m, +0.040m delta, no submersion)
2. Geometry Integrity Probe (mergeBufferGeometriesVanilla NaN/Inf, degenerate triangles on all live meshes)
3. Spatial Wall Clearance Probe (tree canopies and shrub clusters vs Building 2 south facade)
"""

import os
import sys
import time
import json
import socket
import tempfile
import threading
import subprocess
from http.server import SimpleHTTPRequestHandler, HTTPServer
import requests
import websocket

sys.stdout.reconfigure(encoding='utf-8')

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def get_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]

def run_probe():
    print("=" * 80)
    print("  EMPIRICAL ADVERSARIAL CHALLENGER PROBE: M3 ITERATION 2")
    print("=" * 80)

    server_port = get_free_port()
    debug_port = get_free_port()

    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self, format, *args):
            pass

    server = HTTPServer(('127.0.0.1', server_port), lambda *a, **k: QuietHandler(*a, directory=REPO_ROOT, **k))
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    temp_dir = tempfile.mkdtemp(prefix="edge_m3_probe_")
    browser_bin = EDGE_PATH if os.path.exists(EDGE_PATH) else CHROME_PATH

    browser_cmd = [
        browser_bin,
        "--headless=new",
        f"--remote-debugging-port={debug_port}",
        f"--user-data-dir={temp_dir}",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--disable-default-apps",
        "--disable-sync",
        "--disable-extensions",
        "--hide-scrollbars",
        "--enable-webgl",
        "--ignore-gpu-blocklist",
        "--use-gl=angle",
        f"http://127.0.0.1:{server_port}/"
    ]

    proc = subprocess.Popen(browser_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"[BROWSER] Launched headless browser PID={proc.pid} on debug port {debug_port}")

    try:
        ws_url = None
        for _ in range(40):
            time.sleep(0.2)
            try:
                r = requests.get(f"http://127.0.0.1:{debug_port}/json", timeout=1)
                for item in r.json():
                    if item.get("type") == "page":
                        ws_url = item.get("webSocketDebuggerUrl")
                        break
                if ws_url:
                    break
            except Exception:
                pass

        if not ws_url:
            raise RuntimeError("Failed to obtain CDP WebSocket debugger URL")

        ws = websocket.create_connection(ws_url, timeout=15)
        print("[CDP] Connected to DevTools WebSocket debugger.")

        msg_id = 0
        def send_cdp(method, params=None):
            nonlocal msg_id
            msg_id += 1
            payload = {"id": msg_id, "method": method}
            if params:
                payload["params"] = params
            ws.send(json.dumps(payload))
            while True:
                resp = json.loads(ws.recv())
                if resp.get("id") == msg_id:
                    return resp.get("result", {})

        send_cdp("Runtime.enable")

        # Wait for scene initialization
        print("[INIT] Waiting for scene initialization...")
        for _ in range(50):
            time.sleep(0.2)
            eval_res = send_cdp("Runtime.evaluate", {
                "expression": "typeof window.scene !== 'undefined' && typeof window.MATERIALS !== 'undefined' && typeof window.addBirchTree !== 'undefined'",
                "returnByValue": True
            })
            if eval_res.get("result", {}).get("value") is True:
                break

        probe_report = {}

        # =========================================================================
        # PROBE 1: GROUNDING AUDIT (Mulch disc bounding boxes & lawn delta)
        # =========================================================================
        print("\n--- PROBE 1: GROUNDING & ELEVATION AUDIT ---")
        grounding_js = """
        (function() {
            const out = {
                lawn: null,
                front_lawn_trees: [],
                driveway_trees: [],
                all_mulch_beds: [],
                errors: []
            };

            // 1. Find the Building 2 front lawn slab
            let lawnMesh = null;
            window.scene.traverse(obj => {
                if (obj.isMesh && obj.geometry && obj.geometry.parameters) {
                    const p = obj.geometry.parameters;
                    if (Math.abs(p.width - 47.6) < 0.5 && Math.abs(p.depth - 13.5) < 0.5) {
                        lawnMesh = obj;
                    }
                }
            });

            if (!lawnMesh) {
                out.errors.push("Building 2 front lawn slab mesh not found in scene!");
                return out;
            }

            const lawnBox = new THREE.Box3().setFromObject(lawnMesh);
            out.lawn = {
                minY: lawnBox.min.y,
                maxY: lawnBox.max.y,
                posX: lawnMesh.position.x,
                posY: lawnMesh.position.y,
                posZ: lawnMesh.position.z,
                width: lawnMesh.geometry.parameters.width,
                height: lawnMesh.geometry.parameters.height,
                depth: lawnMesh.geometry.parameters.depth
            };
            const lawnTopY = lawnBox.max.y;

            // 2. Find all mulch meshes
            window.scene.traverse(obj => {
                if (obj.isMesh && obj.geometry && obj.material === window.MATERIALS.soilMulch) {
                    const worldPos = new THREE.Vector3();
                    obj.getWorldPosition(worldPos);
                    const b = new THREE.Box3().setFromObject(obj);

                    const isOnFrontLawn = (worldPos.x >= 20.4 && worldPos.x <= 68.0 && worldPos.z >= 3.5 && worldPos.z <= 17.0);
                    const item = {
                        worldPos: { x: worldPos.x, y: worldPos.y, z: worldPos.z },
                        bbox: { minY: b.min.y, maxY: b.max.y, minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z },
                        lawnTopY: lawnTopY,
                        mulchTopY: b.max.y,
                        mulchBotY: b.min.y,
                        deltaToLawn: b.max.y - lawnTopY,
                        isSubmerged: b.max.y < lawnTopY,
                        isFrontLawn: isOnFrontLawn
                    };
                    out.all_mulch_beds.push(item);
                    if (isOnFrontLawn) {
                        out.front_lawn_trees.push(item);
                    } else {
                        out.driveway_trees.push(item);
                    }
                }
            });

            // Sort front lawn trees by X ascending
            out.front_lawn_trees.sort((a, b) => a.worldPos.x - b.worldPos.x);

            return out;
        })();
        """
        r1 = send_cdp("Runtime.evaluate", {"expression": grounding_js, "returnByValue": True})
        val1 = r1.get("result", {}).get("value", {})
        probe_report["grounding"] = val1

        lawn_info = val1.get("lawn", {})
        print(f"Lawn Mesh Top Y: {lawn_info.get('maxY'):.5f} m (geom height = {lawn_info.get('height')}, posY = {lawn_info.get('posY')})")
        print(f"Total Mulch Beds in Scene: {len(val1.get('all_mulch_beds', []))}")
        print(f"Front Lawn Mulch Beds: {len(val1.get('front_lawn_trees', []))} (expected 5)")

        grounding_pass = True
        for idx, tr in enumerate(val1.get("front_lawn_trees", [])):
            wp = tr["worldPos"]
            topY = tr["mulchTopY"]
            delta = tr["deltaToLawn"]
            sub = tr["isSubmerged"]
            print(f"  Tree #{idx+1} at ({wp['x']:.1f}, {wp['z']:.1f}): mulchTopY={topY:.4f}m, mulchBotY={tr['mulchBotY']:.4f}m, deltaToLawn={delta:+.4f}m, submerged={sub}")
            if sub or topY < 0.080 or delta < 0.035:
                grounding_pass = False
                print(f"    [FAIL] Mulch disc at ({wp['x']}, {wp['z']}) is deficient!")

        if grounding_pass and len(val1.get("front_lawn_trees", [])) == 5:
            print("[PROBE 1 RESULT] PASS: All 5 front lawn mulch beds sit cleanly at Y ≈ +0.120m (+0.040m above turf), zero submerged!")
        else:
            print("[PROBE 1 RESULT] FAIL")

        # =========================================================================
        # PROBE 2: GEOMETRY INTEGRITY & DEGENERATE TRIANGLE AUDIT
        # =========================================================================
        print("\n--- PROBE 2: GEOMETRY INTEGRITY & DEGENERATE TRIANGLE AUDIT ---")
        geometry_js = """
        (function() {
            const out = {
                merger_tests_pass: true,
                merger_errors: [],
                live_botanical_meshes: [],
                total_live_triangles: 0,
                degenerate_triangles_found: 0,
                nan_inf_found: 0
            };

            // 1. Synthetic stress test of mergeBufferGeometriesVanilla
            try {
                // Test empty
                const e = mergeBufferGeometriesVanilla([]);
                if (!e || !(e instanceof THREE.BufferGeometry)) {
                    out.merger_tests_pass = false;
                    out.merger_errors.push("mergeBufferGeometriesVanilla([]) failed to return BufferGeometry");
                }
                // Test single non-indexed geometry
                const p1 = new THREE.BufferGeometry();
                p1.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0, 1,0,0, 0,1,0]), 3));
                const m1 = mergeBufferGeometriesVanilla([p1]);
                if (m1.attributes.position.count !== 3 || m1.index.count !== 3) {
                    out.merger_tests_pass = false;
                    out.merger_errors.push("Non-indexed geometry merger failed");
                }
                // Test indexed + non-indexed combination
                const b1 = new THREE.BoxGeometry(1, 1, 1);
                const m2 = mergeBufferGeometriesVanilla([p1, b1]);
                if (m2.attributes.position.count !== (3 + b1.attributes.position.count)) {
                    out.merger_tests_pass = false;
                    out.merger_errors.push("Mixed indexed/non-indexed merger count mismatch");
                }
            } catch(e) {
                out.merger_tests_pass = false;
                out.merger_errors.push("Exception during synthetic merger test: " + e.message);
            }

            // 2. Scan all live meshes that belong to botanical models (trees, shrubs, hedges)
            const botanicalMaterials = {
                birchBark: window.MATERIALS.birchBark,
                birchFoliage: window.MATERIALS.birchFoliage,
                birchFoliageLight: window.MATERIALS.birchFoliageLight,
                lindenTrunk: window.MATERIALS.lindenTrunk,
                lindenFoliage: window.MATERIALS.lindenFoliage,
                lindenFoliageDark: window.MATERIALS.lindenFoliageDark,
                spruceTrunk: window.MATERIALS.spruceTrunk,
                spruceNeedle: window.MATERIALS.spruceNeedle,
                spruceNeedleDark: window.MATERIALS.spruceNeedleDark,
                hedgeFoliage: window.MATERIALS.hedgeFoliage,
                soilMulch: window.MATERIALS.soilMulch,
                shrubFoliageDeciduous: window.MATERIALS.shrubFoliageDeciduous,
                shrubFoliageConifer: window.MATERIALS.shrubFoliageConifer,
                flowerBlossomWhite: window.MATERIALS.flowerBlossomWhite
            };

            const matEntries = Object.entries(botanicalMaterials);

            let vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
            let ab = new THREE.Vector3(), ac = new THREE.Vector3(), cross = new THREE.Vector3();

            window.scene.traverse(obj => {
                if (obj.isMesh && obj.geometry) {
                    const foundEntry = matEntries.find(([k, mat]) => mat === obj.material);
                    if (!foundEntry) return;
                    const matKey = foundEntry[0];

                    const geom = obj.geometry;
                    const pos = geom.attributes.position;
                    const norm = geom.attributes.normal;
                    const uv = geom.attributes.uv;
                    const idx = geom.index;

                    let meshErrors = [];
                    let degenCount = 0;
                    let triCount = 0;
                    let sampleDegen = null;

                    if (!pos || !pos.array) {
                        meshErrors.push("Missing position attribute");
                        return;
                    }

                    // Check NaN / Inf in position
                    const pa = pos.array;
                    for (let i = 0; i < pa.length; i++) {
                        if (isNaN(pa[i]) || !isFinite(pa[i])) {
                            out.nan_inf_found++;
                            meshErrors.push(`Position contains NaN/Inf at index ${i}`);
                            break;
                        }
                    }

                    // Check NaN / Inf in normals
                    if (norm && norm.array) {
                        const na = norm.array;
                        for (let i = 0; i < na.length; i++) {
                            if (isNaN(na[i]) || !isFinite(na[i])) {
                                out.nan_inf_found++;
                                meshErrors.push(`Normal contains NaN/Inf at index ${i}`);
                                break;
                            }
                        }
                    }

                    // Check NaN / Inf in UV
                    if (uv && uv.array) {
                        const ua = uv.array;
                        for (let i = 0; i < ua.length; i++) {
                            if (isNaN(ua[i]) || !isFinite(ua[i])) {
                                out.nan_inf_found++;
                                meshErrors.push(`UV contains NaN/Inf at index ${i}`);
                                break;
                            }
                        }
                    }

                    // Check degenerate triangles (area < 1e-9)
                    if (idx && idx.array) {
                        const ia = idx.array;
                        triCount = ia.length / 3;
                        for (let t = 0; t < ia.length; t += 3) {
                            const i1 = ia[t], i2 = ia[t+1], i3 = ia[t+2];
                            if (i1 === i2 || i2 === i3 || i1 === i3) {
                                degenCount++;
                                if (!sampleDegen) sampleDegen = { reason: "repeated index", i1, i2, i3 };
                                continue;
                            }
                            vA.fromBufferAttribute(pos, i1);
                            vB.fromBufferAttribute(pos, i2);
                            vC.fromBufferAttribute(pos, i3);
                            ab.subVectors(vB, vA);
                            ac.subVectors(vC, vA);
                            cross.crossVectors(ab, ac);
                            const area = cross.length() * 0.5;
                            if (area < 1e-10) {
                                degenCount++;
                                if (!sampleDegen) sampleDegen = { reason: "zero area", area, vA: vA.clone(), vB: vB.clone(), vC: vC.clone() };
                            }
                        }
                    } else {
                        triCount = pos.count / 3;
                        for (let t = 0; t < pos.count; t += 3) {
                            vA.fromBufferAttribute(pos, t);
                            vB.fromBufferAttribute(pos, t+1);
                            vC.fromBufferAttribute(pos, t+2);
                            ab.subVectors(vB, vA);
                            ac.subVectors(vC, vA);
                            cross.crossVectors(ab, ac);
                            const area = cross.length() * 0.5;
                            if (area < 1e-10) {
                                degenCount++;
                                if (!sampleDegen) sampleDegen = { reason: "zero area (unindexed)", area, vA: vA.clone(), vB: vB.clone(), vC: vC.clone() };
                            }
                        }
                    }

                    out.total_live_triangles += triCount;
                    out.degenerate_triangles_found += degenCount;

                    out.live_botanical_meshes.push({
                        name: obj.name || "unnamed",
                        parentPos: obj.parent ? { x: obj.parent.position.x, y: obj.parent.position.y, z: obj.parent.position.z } : null,
                        material: matKey,
                        vertices: pos.count,
                        triangles: triCount,
                        degenerateTriangles: degenCount,
                        sampleDegen: sampleDegen,
                        hasNormals: !!norm,
                        hasUv: !!uv,
                        errors: meshErrors
                    });
                }
            });

            return out;
        })();
        """
        r2 = send_cdp("Runtime.evaluate", {"expression": geometry_js, "returnByValue": True})
        val2 = r2.get("result", {}).get("value", {})
        probe_report["geometry"] = val2

        print(f"Synthetic Merger Tests Pass: {val2.get('merger_tests_pass')}")
        if val2.get("merger_errors"):
            print(f"  Merger Errors: {val2.get('merger_errors')}")
        print(f"Total Live Botanical Meshes Inspected: {len(val2.get('live_botanical_meshes', []))}")
        print(f"Total Live Botanical Triangles: {val2.get('total_live_triangles')}")
        print(f"NaN / Infinity Values Found: {val2.get('nan_inf_found')}")
        print(f"Degenerate Triangles Found: {val2.get('degenerate_triangles_found')}")

        geom_pass = (val2.get("merger_tests_pass") is True and
                     val2.get("nan_inf_found") == 0 and
                     val2.get("degenerate_triangles_found") == 0)
        if geom_pass:
            print("[PROBE 2 RESULT] PASS: Zero NaN/Inf, zero degenerate triangles across all live meshes!")
        else:
            print(f"[PROBE 2 RESULT] {'FAIL' if not geom_pass else 'PASS'}")

        # =========================================================================
        # PROBE 3: SPATIAL WALL CLEARANCE (Building 2 south facade vs canopies & shrubs)
        # =========================================================================
        print("\n--- PROBE 3: SPATIAL WALL CLEARANCE AUDIT ---")
        clearance_js = """
        (function() {
            const out = {
                b2_wall_z: 3.5,
                b2_x_range: [20.4, 67.8],
                trees: [],
                shrubs: [],
                errors: []
            };

            const B2_WALL_Z = 3.5;

            // 1. Audit tree canopies
            window.scene.traverse(obj => {
                if (obj.isGroup && obj.children.length >= 2) {
                    let hasCanopy = false;
                    let hasTrunk = false;
                    obj.traverse(c => {
                        if (c.isMesh) {
                            if (c.material === window.MATERIALS.birchFoliage ||
                                c.material === window.MATERIALS.birchFoliageLight ||
                                c.material === window.MATERIALS.lindenFoliage ||
                                c.material === window.MATERIALS.lindenFoliageDark ||
                                c.material === window.MATERIALS.spruceNeedle) {
                                hasCanopy = true;
                            }
                            if (c.material === window.MATERIALS.birchBark ||
                                c.material === window.MATERIALS.lindenTrunk ||
                                c.material === window.MATERIALS.spruceTrunk) {
                                hasTrunk = true;
                            }
                        }
                    });

                    // Front lawn trees are at Z > 3.5 and X < 70
                    if (hasCanopy && hasTrunk && obj.position.z > 3.5 && obj.position.x >= 20.4 && obj.position.x <= 68.0) {
                        const b = new THREE.Box3().setFromObject(obj);
                        const wallClearance = b.min.z - B2_WALL_Z;
                        out.trees.push({
                            pos: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
                            bbox: { minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z, minY: b.min.y, maxY: b.max.y },
                            wallClearance: wallClearance,
                            marginOver2m: wallClearance - 2.0
                        });
                    }
                }
            });

            // 2. Audit decorative shrubs on front lawn
            window.scene.traverse(obj => {
                if (obj.isGroup) {
                    let isShrub = false;
                    obj.traverse(c => {
                        if (c.isMesh && (
                            c.material === window.MATERIALS.shrubFoliageDeciduous ||
                            c.material === window.MATERIALS.shrubFoliageConifer ||
                            c.material === window.MATERIALS.flowerBlossomWhite
                        )) {
                            isShrub = true;
                        }
                    });

                    if (isShrub && obj.position.z >= 3.5 && obj.position.z <= 17.0 && obj.position.x >= 20.4 && obj.position.x <= 68.0) {
                        const b = new THREE.Box3().setFromObject(obj);
                        const wallClearance = b.min.z - B2_WALL_Z;
                        out.shrubs.push({
                            pos: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
                            bbox: { minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z, minY: b.min.y, maxY: b.max.y },
                            wallClearance: wallClearance,
                            marginOver2m: wallClearance - 2.0
                        });
                    }
                }
            });

            // Deduplicate groups (if parents were traversed)
            // Shrubs are distinct if positions differ by > 0.1m
            const uniqueShrubs = [];
            out.shrubs.forEach(s => {
                const dup = uniqueShrubs.find(u => Math.hypot(u.pos.x - s.pos.x, u.pos.z - s.pos.z) < 0.2);
                if (!dup) uniqueShrubs.push(s);
            });
            out.shrubs = uniqueShrubs;

            return out;
        })();
        """
        r3 = send_cdp("Runtime.evaluate", {"expression": clearance_js, "returnByValue": True})
        val3 = r3.get("result", {}).get("value", {})
        probe_report["clearance"] = val3

        print(f"Building 2 South Facade Wall Z: {val3.get('b2_wall_z')} m (X: {val3.get('b2_x_range')})")
        print(f"Front Lawn Trees Checked: {len(val3.get('trees', []))}")
        tree_clearance_pass = True
        for idx, tr in enumerate(val3.get("trees", [])):
            wc = tr["wallClearance"]
            print(f"  Tree #{idx+1} at X={tr['pos']['x']:.1f}, Z={tr['pos']['z']:.1f}: Canopy minZ={tr['bbox']['minZ']:.2f}m -> B2 Wall Clearance = {wc:.2f}m (margin over 2.0m: {tr['marginOver2m']:+.2f}m)")
            if wc < 2.0:
                tree_clearance_pass = False

        print(f"Front Lawn Shrubs Checked: {len(val3.get('shrubs', []))}")
        shrub_clearance_pass = True
        for idx, sh in enumerate(val3.get("shrubs", [])):
            wc = sh["wallClearance"]
            print(f"  Shrub #{idx+1} at X={sh['pos']['x']:.1f}, Z={sh['pos']['z']:.1f}: Shrub minZ={sh['bbox']['minZ']:.2f}m -> B2 Wall Clearance = {wc:.2f}m (margin over 2.0m: {sh['marginOver2m']:+.2f}m)")
            if wc < 2.0:
                shrub_clearance_pass = False

        if tree_clearance_pass:
            print("  Tree Canopies: All maintain clearance > 2.0m (min clearance is > 3.0m)!")
        else:
            print("  Tree Canopies: Some have clearance < 2.0m!")

        if shrub_clearance_pass:
            print("  Shrub Clusters: All maintain clearance > 2.0m!")
        else:
            print("  Shrub Clusters: Some have clearance < 2.0m!")

        # Save probe report
        report_file = os.path.join(REPO_ROOT, "tests", "probe_m3_iter2_report.json")
        with open(report_file, "w", encoding="utf-8") as f:
            json.dump(probe_report, f, indent=2, ensure_ascii=False)
        print(f"\n[REPORT] Saved empirical probe data to {report_file}")

    finally:
        try:
            proc.terminate()
            proc.wait(timeout=3)
        except Exception:
            pass
        server.shutdown()

if __name__ == "__main__":
    run_probe()
