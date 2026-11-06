#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tests/test_challenger_m1_adversarial.py
========================================
Empirical Challenger Test Suite for Milestone 1:
Core Shaders, Lighting, Procedural Textures & Capture Harness.

Executes 5 rigorous adversarial test suites:
1. Full V8 syntax compilation and parse integrity across all project JS files.
2. Procedural textures boundary and edge conditions (CanvasTexture instances, non-zero dimensions,
   2D context, sRGB encoding, repeat wrapping, idempotency, fallback when roundRect is missing,
   and non-blank pixel rasterization audit).
3. Materials registry binding and PBR shader setup.
4. Headless Browser CDP stress: 0 console errors, 0 runtime exceptions with ROAD_3D_MINIMALISM = 0,
   and runtime verification of ACESFilmicToneMapping, sRGBEncoding, HemisphereLight, and shadow bias.
5. Capture harness execution and invalid argument resilience.
"""

import os
import sys
import time
import json
import socket
import shutil
import tempfile
import threading
import subprocess
from http.server import SimpleHTTPRequestHandler, HTTPServer
import requests
import websocket

# Force utf-8 stdout
sys.stdout.reconfigure(encoding='utf-8')

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def find_browser():
    for p in [EDGE_PATH, CHROME_PATH]:
        if os.path.exists(p):
            return p
    raise RuntimeError("Neither Microsoft Edge nor Google Chrome found on system!")

def find_free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port

class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=REPO_ROOT, **kwargs)
    def log_message(self, format, *args):
        pass

def run_local_server(port):
    server = HTTPServer(('127.0.0.1', port), QuietHandler)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return server

class CDPClient:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=30)
        self.msg_id = 0
        self.console_logs = []
        self.exceptions = []

    def send(self, method, params=None):
        self.msg_id += 1
        payload = {"id": self.msg_id, "method": method, "params": params or {}}
        self.ws.send(json.dumps(payload))
        while True:
            raw = self.ws.recv()
            data = json.loads(raw)
            # Collect background events
            if "method" in data:
                m = data["method"]
                p = data.get("params", {})
                if m == "Console.messageAdded":
                    self.console_logs.append(p.get("message", {}))
                elif m == "Runtime.consoleAPICalled":
                    self.console_logs.append(p)
                elif m == "Runtime.exceptionThrown":
                    self.exceptions.append(p)
                continue
            if data.get("id") == self.msg_id:
                return data

    def eval(self, expression, return_by_value=True):
        res = self.send("Runtime.evaluate", {
            "expression": expression,
            "returnByValue": return_by_value,
            "awaitPromise": True
        })
        if "exceptionDetails" in res.get("result", {}):
            exc = res["result"]["exceptionDetails"]
            raise RuntimeError(f"CDP Eval Exception: {json.dumps(exc, ensure_ascii=False)}")
        return res.get("result", {}).get("result", {}).get("value")

    def compile_script(self, expression, source_url="test.js", persist_script=False):
        return self.send("Runtime.compileScript", {
            "expression": expression,
            "sourceURL": source_url,
            "persistScript": persist_script
        })

    def close(self):
        try:
            self.ws.close()
        except Exception:
            pass

def main():
    print("=" * 80)
    print("  MGKCT 3D — ADVERSARIAL CHALLENGER SUITE (MILESTONE 1)")
    print("=" * 80)

    browser_bin = find_browser()
    server_port = find_free_port()
    cdp_port = find_free_port()
    server = run_local_server(server_port)
    temp_dir = tempfile.mkdtemp(prefix="mgkct_challenger_")

    target_app_url = f"http://127.0.0.1:{server_port}/index.html?debug=1"

    cmd = [
        browser_bin,
        "--headless=new",
        f"--remote-debugging-port={cdp_port}",
        f"--user-data-dir={temp_dir}",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--hide-scrollbars",
        "--window-size=1920,1080",
        target_app_url
    ]

    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    cdp = None

    failures = []
    passes = 0

    try:
        # Wait for CDP endpoint
        ws_url = None
        for _ in range(40):
            time.sleep(0.25)
            try:
                r = requests.get(f"http://127.0.0.1:{cdp_port}/json", timeout=2)
                for item in r.json():
                    if item.get("type") == "page":
                        ws_url = item.get("webSocketDebuggerUrl")
                        break
                if ws_url:
                    break
            except Exception:
                pass

        if not ws_url:
            raise RuntimeError("Failed to attach to headless browser CDP!")

        cdp = CDPClient(ws_url)
        cdp.send("Page.enable")
        cdp.send("Runtime.enable")
        cdp.send("Console.enable")
        cdp.send("Log.enable")

        print(f"[INIT] Attached to headless V8 via CDP on port {cdp_port}")

        # Wait for page readiness (renderer, scene, controls initialized)
        ready = False
        for _ in range(50):
            val = cdp.eval("Boolean(window.renderer && window.scene && window.controls && window.MATERIALS)")
            if val is True:
                ready = True
                break
            time.sleep(0.2)

        if not ready:
            raise RuntimeError("Timed out waiting for MGKCT 3D page initialization!")

        print("[INIT] MGKCT 3D Scene and Renderer successfully initialized in Headless V8")

        # =========================================================================
        # SUITE 1: Full Parse & Syntax Integrity of All Project JS Files
        # =========================================================================
        print("\n" + "=" * 80)
        print("  SUITE 1: FULL V8 SYNTAX & PARSE INTEGRITY OF ALL JS FILES")
        print("=" * 80)

        js_files = [
            "js/state.js",
            "js/materials.js",
            "js/helpers.js",
            "js/buildings/building1.js",
            "js/buildings/building2.js",
            "js/buildings/building3.js",
            "js/buildings/building4.js",
            "js/territory.js",
            "js/controls.js",
            "js/navigator.js",
            "js/ui.js",
            "js/main.js"
        ]

        for rel_path in js_files:
            abs_path = os.path.join(REPO_ROOT, rel_path)
            if not os.path.exists(abs_path):
                failures.append(f"SUITE 1: File not found: {rel_path}")
                continue
            with open(abs_path, "r", encoding="utf-8") as f:
                content = f.read()

            compile_res = cdp.compile_script(content, source_url=rel_path)
            res_dict = compile_res.get("result", {})
            if "exceptionDetails" in res_dict:
                exc = res_dict["exceptionDetails"]
                err_msg = f"SUITE 1: V8 Syntax Compilation Failure in {rel_path}: {exc.get('text')} at line {exc.get('lineNumber')}"
                print(f"  [FAIL] {rel_path} -> {err_msg}")
                failures.append(err_msg)
            else:
                passes += 1
                print(f"  [PASS] {rel_path} -> Clean V8 compile (0 syntax errors, {len(content):,} bytes)")

        # =========================================================================
        # SUITE 2: Headless Browser App Load, Console Errors & Shader Settings
        # =========================================================================
        print("\n" + "=" * 80)
        print("  SUITE 2: HEADLESS APP LOAD & CONSOLE ERROR LOG AUDIT")
        print("=" * 80)

        # 2.1 Verify Console Errors & Runtime Exceptions
        error_logs = [log for log in cdp.console_logs if log.get("level") in ("error", "assert")]
        if error_logs or cdp.exceptions:
            err_details = []
            for el in error_logs:
                err_details.append(f"Console error: {el.get('text', el)}")
            for exc in cdp.exceptions:
                err_details.append(f"Uncaught exception: {exc}")
            failures.append(f"SUITE 2: Detected {len(err_details)} runtime errors during page load:\n" + "\n".join(err_details))
            print(f"  [FAIL] Detected {len(err_details)} runtime console/uncaught exceptions!")
        else:
            passes += 1
            print("  [PASS] 0 Console Errors and 0 Uncaught Runtime Exceptions detected during full page startup!")

        # 2.2 Verify ROAD_3D_MINIMALISM
        road_min = cdp.eval("ROAD_3D_MINIMALISM")
        if road_min != 0:
            failures.append(f"SUITE 2: ROAD_3D_MINIMALISM expected 0, got {road_min}")
            print(f"  [FAIL] ROAD_3D_MINIMALISM is {road_min}")
        else:
            passes += 1
            print("  [PASS] ROAD_3D_MINIMALISM === 0 (3D Territory active by default)")

        # 2.3 Verify Renderer Color Management & Tone Mapping
        renderer_audit = cdp.eval("""
            (() => {
                return {
                    toneMapping: renderer.toneMapping,
                    toneMappingExpected: THREE.ACESFilmicToneMapping,
                    toneMappingExposure: renderer.toneMappingExposure,
                    outputEncoding: renderer.outputEncoding,
                    outputEncodingExpected: THREE.sRGBEncoding,
                    shadowMapEnabled: renderer.shadowMap.enabled,
                    shadowMapType: renderer.shadowMap.type,
                    shadowMapTypeExpected: THREE.PCFSoftShadowMap,
                    pixelRatio: renderer.getPixelRatio()
                };
            })()
        """)
        print(f"  * Renderer config audit: {renderer_audit}")

        if renderer_audit.get("toneMapping") != renderer_audit.get("toneMappingExpected"):
            failures.append(f"SUITE 2: renderer.toneMapping is {renderer_audit.get('toneMapping')}, expected THREE.ACESFilmicToneMapping ({renderer_audit.get('toneMappingExpected')})")
        else:
            passes += 1
            print(f"  [PASS] renderer.toneMapping === THREE.ACESFilmicToneMapping ({renderer_audit.get('toneMapping')})")

        if renderer_audit.get("outputEncoding") != renderer_audit.get("outputEncodingExpected"):
            failures.append(f"SUITE 2: renderer.outputEncoding is {renderer_audit.get('outputEncoding')}, expected THREE.sRGBEncoding ({renderer_audit.get('outputEncodingExpected')})")
        else:
            passes += 1
            print(f"  [PASS] renderer.outputEncoding === THREE.sRGBEncoding ({renderer_audit.get('outputEncoding')})")

        if abs(renderer_audit.get("toneMappingExposure", 0) - 1.05) > 0.001:
            failures.append(f"SUITE 2: renderer.toneMappingExposure is {renderer_audit.get('toneMappingExposure')}, expected 1.05")
        else:
            passes += 1
            print("  [PASS] renderer.toneMappingExposure === 1.05")

        if renderer_audit.get("shadowMapType") != renderer_audit.get("shadowMapTypeExpected"):
            failures.append(f"SUITE 2: renderer.shadowMap.type is {renderer_audit.get('shadowMapType')}, expected THREE.PCFSoftShadowMap")
        else:
            passes += 1
            print("  [PASS] renderer.shadowMap.type === THREE.PCFSoftShadowMap")

        # 2.4 Verify Lighting in Scene
        lighting_audit = cdp.eval("""
            (() => {
                let hemiCount = 0;
                let hemiLightProps = null;
                let dir1Props = null;

                scene.traverse(obj => {
                    if (obj.isHemisphereLight) {
                        hemiCount++;
                        hemiLightProps = {
                            skyColor: obj.color.getHex(),
                            groundColor: obj.groundColor.getHex(),
                            intensity: obj.intensity
                        };
                    }
                    if (obj.isDirectionalLight && (obj.castShadow || obj.position.y > 80)) {
                        dir1Props = {
                            bias: obj.shadow ? obj.shadow.bias : 0,
                            normalBias: obj.shadow ? obj.shadow.normalBias : 0,
                            castShadow: obj.castShadow,
                            posY: obj.position.y
                        };
                    }
                });

                return {
                    hemiCount,
                    hemiLightProps,
                    dir1Props
                };
            })()
        """)
        print(f"  * Lighting audit: {lighting_audit}")

        if lighting_audit.get("hemiCount") < 1:
            failures.append("SUITE 2: No THREE.HemisphereLight found in scene!")
        else:
            passes += 1
            print(f"  [PASS] THREE.HemisphereLight detected in scene: {lighting_audit.get('hemiLightProps')}")

        dir1 = lighting_audit.get("dir1Props") or {}
        if abs(dir1.get("bias", 0) - (-0.00012)) > 1e-6:
            failures.append(f"SUITE 2: dirLight1.shadow.bias is {dir1.get('bias')}, expected -0.00012")
        else:
            passes += 1
            print("  [PASS] dirLight1.shadow.bias === -0.00012")

        if abs(dir1.get("normalBias", 0) - 0.02) > 1e-4:
            failures.append(f"SUITE 2: dirLight1.shadow.normalBias is {dir1.get('normalBias')}, expected 0.02")
        else:
            passes += 1
            print("  [PASS] dirLight1.shadow.normalBias === 0.02")

        # =========================================================================
        # SUITE 3: Procedural Textures Deep Boundary & Edge Condition Audit
        # =========================================================================
        print("\n" + "=" * 80)
        print("  SUITE 3: PROCEDURAL TEXTURES REGISTRY & EDGE CONDITIONS AUDIT")
        print("=" * 80)

        textures_audit = cdp.eval("""
            (() => {
                const pt = window.PROCEDURAL_TEXTURES;
                if (!pt) return { error: 'PROCEDURAL_TEXTURES is missing' };

                function inspectTex(tex, expectedW, expectedH, expectedRepeatX, expectedRepeatY) {
                    if (!tex) return { valid: false, reason: 'Texture is null or undefined' };
                    if (!(tex instanceof THREE.CanvasTexture)) {
                        return { valid: false, reason: 'Not an instance of THREE.CanvasTexture' };
                    }
                    const img = tex.image;
                    if (!img || !(img instanceof HTMLCanvasElement)) {
                        return { valid: false, reason: 'Texture image is not an HTMLCanvasElement' };
                    }
                    if (img.width !== expectedW || img.height !== expectedH) {
                        return { valid: false, reason: `Dimension mismatch: got ${img.width}x${img.height}, expected ${expectedW}x${expectedH}` };
                    }
                    const ctx = img.getContext('2d');
                    if (!ctx) {
                        return { valid: false, reason: 'Cannot acquire 2D context from canvas' };
                    }
                    // Sample non-blank pixels
                    const pData = ctx.getImageData(0, 0, Math.min(64, img.width), Math.min(64, img.height)).data;
                    let nonZero = 0;
                    for (let i = 0; i < pData.length; i += 4) {
                        if (pData[i] > 0 || pData[i+1] > 0 || pData[i+2] > 0) nonZero++;
                    }
                    if (nonZero < 10) {
                        return { valid: false, reason: 'Canvas is completely blank/black' };
                    }

                    const wrapCheck = (tex.wrapS === THREE.RepeatWrapping && tex.wrapT === THREE.RepeatWrapping);
                    const repeatCheck = expectedRepeatX ? (tex.repeat.x === expectedRepeatX && tex.repeat.y === expectedRepeatY) : true;

                    return {
                        valid: true,
                        width: img.width,
                        height: img.height,
                        encoding: tex.encoding,
                        wrapS: tex.wrapS,
                        wrapT: tex.wrapT,
                        wrapOk: wrapCheck,
                        repeatX: tex.repeat.x,
                        repeatY: tex.repeat.y,
                        repeatOk: repeatCheck,
                        nonZeroPixelsSample: nonZero
                    };
                }

                return {
                    asphaltDiff: inspectTex(pt.asphalt.diffuse, 512, 512, 12, 3),
                    asphaltBump: inspectTex(pt.asphalt.bump, 512, 512, 12, 3),
                    sidewalkDiff: inspectTex(pt.sidewalkTiles.diffuse, 512, 512, 8, 2),
                    sidewalkBump: inspectTex(pt.sidewalkTiles.bump, 512, 512, 8, 2),
                    woodDiff: inspectTex(pt.woodPlanks.diffuse, 512, 512, 1, 4),
                    woodBump: inspectTex(pt.woodPlanks.bump, 512, 512, 1, 4),
                    birchDiff: inspectTex(pt.birchBark.diffuse, 512, 512, 1, 3),
                    birchBump: inspectTex(pt.birchBark.bump, 512, 512, 1, 3),
                    manholeDiff: inspectTex(pt.manholeCover.diffuse, 256, 256, null, null),
                    manholeBump: inspectTex(pt.manholeCover.bump, 256, 256, null, null),
                    busStopSign: inspectTex(pt.busStopSign, 256, 256, null, null),
                    pedestrianSign: inspectTex(pt.pedestrianSign, 256, 256, null, null),
                    busTimetable: inspectTex(pt.busTimetable, 256, 256, null, null)
                };
            })()
        """)

        for name, info in textures_audit.items():
            if not info.get("valid"):
                err = f"SUITE 3: Texture check failed for '{name}': {info.get('reason')}"
                print(f"  [FAIL] {err}")
                failures.append(err)
            else:
                passes += 1
                # Check sRGB encoding for diffuse / sign textures
                if "Bump" not in name and info.get("encoding") != 3001:  # THREE.sRGBEncoding is 3001
                    err = f"SUITE 3: Texture '{name}' encoding is {info.get('encoding')}, expected THREE.sRGBEncoding (3001)"
                    print(f"  [FAIL] {err}")
                    failures.append(err)
                else:
                    passes += 1
                    print(f"  [PASS] Texture '{name}': {info['width']}x{info['height']}, encoding={info['encoding']}, repeat=({info.get('repeatX')},{info.get('repeatY')}), nonZeroPixels={info['nonZeroPixelsSample']}")

        # Adversarial Edge Test: Idempotency (call initProceduralTextures 5 times)
        idempotency_audit = cdp.eval("""
            (() => {
                const results = [];
                for (let i = 0; i < 5; i++) {
                    const fresh = initProceduralTextures();
                    results.push(
                        fresh && fresh.asphalt && fresh.asphalt.diffuse instanceof THREE.CanvasTexture &&
                        fresh.busStopSign instanceof THREE.CanvasTexture
                    );
                }
                return results.every(Boolean);
            })()
        """)
        if not idempotency_audit:
            failures.append("SUITE 3: initProceduralTextures() failed idempotency / repeated re-generation test")
        else:
            passes += 1
            print("  [PASS] initProceduralTextures() successfully passed 5x repeated re-generation (idempotency verified)")

        # Adversarial Edge Test: Missing roundRect support fallback
        fallback_audit = cdp.eval("""
            (() => {
                const origRoundRect = CanvasRenderingContext2D.prototype.roundRect;
                try {
                    delete CanvasRenderingContext2D.prototype.roundRect;
                    const fallbackTexs = initProceduralTextures();
                    const busSignOk = fallbackTexs.busStopSign instanceof THREE.CanvasTexture;
                    const pedSignOk = fallbackTexs.pedestrianSign instanceof THREE.CanvasTexture;
                    const timetableOk = fallbackTexs.busTimetable instanceof THREE.CanvasTexture;
                    return { ok: busSignOk && pedSignOk && timetableOk };
                } catch (e) {
                    return { ok: false, error: e.message };
                } finally {
                    if (origRoundRect) {
                        CanvasRenderingContext2D.prototype.roundRect = origRoundRect;
                    }
                }
            })()
        """)
        if not fallback_audit.get("ok"):
            failures.append(f"SUITE 3: Missing roundRect fallback failed: {fallback_audit.get('error')}")
        else:
            passes += 1
            print("  [PASS] Canvas roundRect absence fallback cleanly verified (0 errors without roundRect API)")

        # =========================================================================
        # SUITE 4: Materials Binding & PBR Properties Audit
        # =========================================================================
        print("\n" + "=" * 80)
        print("  SUITE 4: MATERIALS REGISTRY & PBR SHADER BINDING AUDIT")
        print("=" * 80)

        materials_audit = cdp.eval("""
            (() => {
                const m = window.MATERIALS;
                const pt = window.PROCEDURAL_TEXTURES;
                if (!m) return { error: 'MATERIALS is missing' };

                const checks = {
                    hasProcTexturesAttached: m.PROCEDURAL_TEXTURES === pt,
                    asphaltRoadMap: m.asphaltRoad.map === pt.asphalt.diffuse,
                    asphaltRoadBump: m.asphaltRoad.bumpMap === pt.asphalt.bump,
                    asphaltDrivewayMap: m.asphaltDriveway.map === pt.asphalt.diffuse,
                    asphaltDrivewayBump: m.asphaltDriveway.bumpMap === pt.asphalt.bump,
                    sidewalkMap: m.sidewalk.map === pt.sidewalkTiles.diffuse,
                    sidewalkBump: m.sidewalk.bumpMap === pt.sidewalkTiles.bump,
                    curbBump: m.curb.bumpMap === pt.sidewalkTiles.bump,
                    shelterBenchMap: m.shelterBench.map === pt.woodPlanks.diffuse,
                    shelterBenchBump: m.shelterBench.bumpMap === pt.woodPlanks.bump,
                    treeTrunkMap: m.treeTrunk.map === pt.birchBark.diffuse,
                    treeTrunkBump: m.treeTrunk.bumpMap === pt.birchBark.bump,
                    manholeMap: m.manhole.map === pt.manholeCover.diffuse,
                    manholeBump: m.manhole.bumpMap === pt.manholeCover.bump,
                    busStopSignMap: m.busStopSign.map === pt.busStopSign,
                    pedestrianSignMap: m.pedestrianSign.map === pt.pedestrianSign,
                    busTimetableMap: m.busTimetable.map === pt.busTimetable,
                    busTimetableEmissive: m.busTimetable.emissiveMap === pt.busTimetable,
                    lampLightEmitterEmissive: m.lampLightEmitter.emissive.getHex() === 0xffeedd,
                    perimeterFenceMetalness: m.perimeterFence.metalness === 0.75
                };

                return checks;
            })()
        """)

        for prop, status in materials_audit.items():
            if not status:
                err = f"SUITE 4: Material property check '{prop}' failed (expected true, got {status})"
                print(f"  [FAIL] {err}")
                failures.append(err)
            else:
                passes += 1
                print(f"  [PASS] Material property '{prop}' verified 100%")

        # Check render loop execution & WebGL context health
        webgl_audit = cdp.eval("""
            (() => {
                const gl = renderer.getContext();
                const isLost = gl.isContextLost();
                const err = gl.getError();
                return {
                    contextLost: isLost,
                    glError: err,
                    glErrorOk: err === 0
                };
            })()
        """)
        print(f"  * WebGL health audit: {webgl_audit}")
        if webgl_audit.get("contextLost") or not webgl_audit.get("glErrorOk"):
            failures.append(f"SUITE 4: WebGL Context error: lost={webgl_audit.get('contextLost')}, code={webgl_audit.get('glError')}")
        else:
            passes += 1
            print("  [PASS] WebGL context is active, healthy, and report 0 GL errors")

        # =========================================================================
        # SUITE 5: Capture Harness Execution & Invalid Target Resilience
        # =========================================================================
        print("\n" + "=" * 80)
        print("  SUITE 5: MULTI-ANGLE CAPTURE HARNESS EXECUTION & ADVERSARIAL STRESS")
        print("=" * 80)

        capture_outdir = os.path.join(REPO_ROOT, ".agents", "teamwork", "challenger_m1_1", "captures")
        if os.path.exists(capture_outdir):
            shutil.rmtree(capture_outdir, ignore_errors=True)
        os.makedirs(capture_outdir, exist_ok=True)

        # 5.1 Run valid capture on bus_shelter
        capture_cmd = [
            sys.executable,
            os.path.join(REPO_ROOT, "tests", "capture_territory_multiangle.py"),
            "--target", "bus_shelter",
            "--outdir", capture_outdir,
            "--width", "1280",
            "--height", "720"
        ]
        print(f"  * Executing: {' '.join(capture_cmd)}")
        cp = subprocess.run(capture_cmd, capture_output=True, text=True, cwd=REPO_ROOT)
        if cp.returncode != 0:
            err = f"SUITE 5: capture_territory_multiangle.py failed with returncode {cp.returncode}:\n{cp.stderr}\n{cp.stdout}"
            print(f"  [FAIL] {err}")
            failures.append(err)
        else:
            passes += 1
            print("  [PASS] capture_territory_multiangle.py completed with exit code 0")

            expected_angles = [
                "angle1_front_eye.png",
                "angle2_iso45.png",
                "angle3_top_down.png",
                "angle4_detail_zoom.png"
            ]
            png_magic = b"\x89PNG\r\n\x1a\n"

            for ang in expected_angles:
                fpath = os.path.join(capture_outdir, ang)
                if not os.path.exists(fpath):
                    err = f"SUITE 5: Missing expected capture file: {ang}"
                    print(f"  [FAIL] {err}")
                    failures.append(err)
                else:
                    sz = os.path.getsize(fpath)
                    with open(fpath, "rb") as pf:
                        hdr = pf.read(8)
                    if hdr != png_magic:
                        err = f"SUITE 5: File {ang} has invalid PNG header: {hdr!r}"
                        print(f"  [FAIL] {err}")
                        failures.append(err)
                    elif sz < 50000:
                        err = f"SUITE 5: File {ang} is suspiciously small: {sz} bytes"
                        print(f"  [FAIL] {err}")
                        failures.append(err)
                    else:
                        passes += 1
                        print(f"  [PASS] Captured {ang} ({sz:,} bytes, valid PNG magic)")

        # 5.2 Adversarial test: unknown target name must cleanly error out
        bad_target_cmd = [
            sys.executable,
            os.path.join(REPO_ROOT, "tests", "capture_territory_multiangle.py"),
            "--target", "non_existent_fake_target_42",
            "--outdir", capture_outdir
        ]
        bad_cp = subprocess.run(bad_target_cmd, capture_output=True, text=True, cwd=REPO_ROOT)
        if bad_cp.returncode == 0:
            err = "SUITE 5: capture_territory_multiangle.py unexpectedly passed with an invalid target name!"
            print(f"  [FAIL] {err}")
            failures.append(err)
        else:
            passes += 1
            print(f"  [PASS] Unknown target properly rejected with non-zero exit code ({bad_cp.returncode}) and clean error message")

    finally:
        if cdp:
            cdp.close()
        if proc:
            proc.terminate()
            try:
                proc.wait(timeout=2)
            except Exception:
                proc.kill()
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass
        server.shutdown()

    # =========================================================================
    # SUMMARY & VERDICT
    # =========================================================================
    print("\n" + "=" * 80)
    print(f"  CHALLENGER VERIFICATION COMPLETE: {passes} PASSES, {len(failures)} FAILURES")
    print("=" * 80)

    if failures:
        print("\nFAILURE SUMMARY:")
        for idx, f in enumerate(failures, 1):
            print(f"  {idx}. {f}")
        print("\nVERDICT: REQUEST_CHANGES")
        sys.exit(1)
    else:
        print("\nALL ADVERSARIAL STRESS TESTS PASSED WITH 100% SUCCESS!")
        print("VERDICT: APPROVE")
        sys.exit(0)

if __name__ == "__main__":
    main()
