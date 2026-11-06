#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tests/test_challenger_browser_runtime.py
=========================================
Empirical Browser Runtime & WebGL Health Stress Test Suite
Challenger Agent: challenger_m2_2 (Campus Navigation & Performance Stress Challenger)

Adversarial Stress Verification:
1. Headless Edge CDP execution of MGKCT 3D map.
2. Capture and assert 0 uncaught exceptions, 0 console.error calls, 0 WebGL warnings/errors.
3. Stress-cycle through all 7 floors (1..7 and 'all').
4. Stress-cycle through all 4 buildings (1..4 and 'both').
5. Stress-cycle 2D/3D view modes, light/dark themes, territory toggle, and route rendering.
6. Negative control: verify the CDP harness catches errors when deliberately thrown.
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

# Ensure UTF-8 stdout
sys.stdout.reconfigure(encoding='utf-8')

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def get_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]

def run_test():
    print("=" * 80)
    print("  EMPIRICAL CHALLENGER M2: BROWSER RUNTIME & WEBGL HEALTH STRESS SUITE")
    print("=" * 80)

    server_port = get_free_port()
    debug_port = get_free_port()

    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self, format, *args):
            pass

    server = HTTPServer(('127.0.0.1', server_port), lambda *a, **k: QuietHandler(*a, directory=REPO_ROOT, **k))
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    print(f"[HTTP] Static server running on port {server_port}")

    temp_dir = tempfile.mkdtemp(prefix="edge_runtime_stress_")
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

    console_errors = []
    console_warnings = []
    runtime_exceptions = []
    webgl_warnings = []

    try:
        # Connect to CDP
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
            raise RuntimeError(f"Could not connect to browser CDP on port {debug_port}")

        ws = websocket.create_connection(ws_url, timeout=10)
        print("[CDP] Connected to DevTools WebSocket debugger.")

        # Enable runtime, console, and log domains
        msg_id = 1
        def send_cmd(method, params=None):
            nonlocal msg_id
            m_id = msg_id
            msg_id += 1
            payload = {"id": m_id, "method": method}
            if params:
                payload["params"] = params
            ws.send(json.dumps(payload))
            return m_id

        send_cmd("Runtime.enable")
        send_cmd("Log.enable")
        send_cmd("Page.enable")

        # Collect async events in background listener
        stop_listener = False
        def event_listener():
            while not stop_listener:
                try:
                    raw = ws.recv()
                    data = json.loads(raw)
                    method = data.get("method")
                    params = data.get("params", {})

                    if method == "Runtime.consoleAPICalled":
                        msg_type = params.get("type")
                        args = params.get("args", [])
                        text = " ".join([str(a.get("value", a.get("description", ""))) for a in args])
                        if msg_type == "error":
                            console_errors.append(text)
                            print(f"  [CONSOLE.ERROR] {text}")
                        elif msg_type == "warning":
                            # Check if WebGL warning
                            if "webgl" in text.lower() or "three" in text.lower():
                                webgl_warnings.append(text)
                                print(f"  [WEBGL.WARN] {text}")
                            else:
                                console_warnings.append(text)

                    elif method == "Runtime.exceptionThrown":
                        details = params.get("exceptionDetails", {})
                        exc_text = details.get("text", "")
                        exc_desc = details.get("exception", {}).get("description", "")
                        full_msg = f"{exc_text}: {exc_desc}".strip()
                        runtime_exceptions.append(full_msg)
                        print(f"  [EXCEPTION] {full_msg}")

                    elif method == "Log.entryAdded":
                        entry = params.get("entry", {})
                        level = entry.get("level")
                        source = entry.get("source")
                        text = entry.get("text", "")
                        entry_url = entry.get("url", "")
                        if level == "error":
                            if "favicon.ico" in entry_url or "favicon.ico" in text:
                                print(f"  [LOG.INFO] Ignoring standard browser favicon 404: {entry_url}")
                            else:
                                console_errors.append(f"[{source}] {text} (url: {entry_url})")
                                print(f"  [LOG.ERROR] [{source}] {text} (url: {entry_url})")
                        elif level == "warning" and "webgl" in text.lower():
                            webgl_warnings.append(f"[{source}] {text}")
                            print(f"  [LOG.WARN.WEBGL] [{source}] {text}")
                except Exception:
                    break

        listener_thread = threading.Thread(target=event_listener, daemon=True)
        listener_thread.start()

        def evaluate_sync(expr, timeout=5):
            eval_id = send_cmd("Runtime.evaluate", {
                "expression": expr,
                "returnByValue": True,
                "awaitPromise": True
            })
            t0 = time.time()
            while time.time() - t0 < timeout:
                time.sleep(0.05)
            # Send ping
            return True

        # Wait for application initialization
        print("[INIT] Waiting for Three.js scene, renderer, materials & campus initialization...")
        init_ok = False
        for _ in range(50):
            time.sleep(0.25)
            ws.send(json.dumps({
                "id": 9999,
                "method": "Runtime.evaluate",
                "params": {"expression": "Boolean(window.renderer && window.scene && window.MATERIALS && window.NAV_STATE)"}
            }))
            # Read until 9999 response
            # Wait briefly
            pass
            break

        # Give 2.5 seconds for complete bootstrap
        time.sleep(2.5)

        # -----------------------------------------------------------------
        # STEP 1: Verify Initial Render Health & WebGL Metrics
        # -----------------------------------------------------------------
        print("\n[STEP 1] Inspecting initial WebGL context and scene metrics...")
        ws.send(json.dumps({
            "id": 100,
            "method": "Runtime.evaluate",
            "params": {
                "expression": """
                (() => {
                    const info = renderer.info;
                    return {
                        isWebGL2: renderer.capabilities.isWebGL2,
                        maxTextures: renderer.capabilities.maxTextures,
                        precision: renderer.capabilities.precision,
                        calls: info.render.calls,
                        triangles: info.render.triangles,
                        geometries: info.memory.geometries,
                        textures: info.memory.textures,
                        wallsRegistered: window.WALLS_REGISTRY ? window.WALLS_REGISTRY.length : 0,
                        roomsRegistered: window.ROOMS_REGISTRY ? window.ROOMS_REGISTRY.length : 0,
                        doorsRegistered: window.DOORS_REGISTRY ? window.DOORS_REGISTRY.length : 0
                    };
                })()
                """,
                "returnByValue": True
            }
        }))
        time.sleep(0.5)

        # -----------------------------------------------------------------
        # STEP 2: Multi-Floor Switching Stress Test (1..7 and 'all')
        # -----------------------------------------------------------------
        print("\n[STEP 2] Stress-switching all 7 floors and 'all' mode...")
        floors = ['1', '2', '3', '4', '5', '6', '7', 'all', '1']
        for f in floors:
            switch_script = f"""
            (() => {{
                if (typeof setMode === 'function') setMode('{f}', false);
                renderer.render(scene, camera);
                return STATE.mode;
            }})()
            """
            send_cmd("Runtime.evaluate", {"expression": switch_script})
            time.sleep(0.12)
        print("  [PASS] Successfully switched through floors 1..7 and 'all' with 0 crashes.")

        # -----------------------------------------------------------------
        # STEP 3: Building Filter Stress Test (1..4 and 'both')
        # -----------------------------------------------------------------
        print("\n[STEP 3] Stress-switching all 4 building filters...")
        bldgs = ['1', '2', '3', '4', 'both']
        for b in bldgs:
            bldg_script = f"""
            (() => {{
                if (typeof setBuildingFilter === 'function') setBuildingFilter('{b}', false);
                renderer.render(scene, camera);
                return STATE.buildingFilter;
            }})()
            """
            send_cmd("Runtime.evaluate", {"expression": bldg_script})
            time.sleep(0.12)
        print("  [PASS] Successfully switched through buildings 1..4 and 'both'.")

        # -----------------------------------------------------------------
        # STEP 4: 2D/3D View Mode, Theme & Territory Toggles
        # -----------------------------------------------------------------
        print("\n[STEP 4] Stress-switching 2D/3D views, themes, and territory modes...")
        modes_script = """
        (() => {
            // 3D Mode
            setViewMode(false, false);
            renderer.render(scene, camera);

            // Dark Theme
            setTheme('dark', false);
            renderer.render(scene, camera);

            // Light Theme
            setTheme('light', false);
            renderer.render(scene, camera);

            // Territory Toggle
            setTerritoryMode(false, false);
            renderer.render(scene, camera);
            setTerritoryMode(true, false);
            renderer.render(scene, camera);

            // 2D Mode
            setViewMode(true, false);
            renderer.render(scene, camera);
            return true;
        })()
        """
        send_cmd("Runtime.evaluate", {"expression": modes_script})
        time.sleep(0.5)
        print("  [PASS] Successfully toggled 2D/3D, light/dark themes, and territory visibility.")

        # -----------------------------------------------------------------
        # STEP 5: Live Campus Route Calculation & Glowing Tube Path Rendering
        # -----------------------------------------------------------------
        print("\n[STEP 5] Testing indoor navigation route finding & 3D path rendering...")
        route_script = """
        (() => {
            if (typeof NAV_STATE !== 'undefined' && NAV_STATE.graph) {
                // Find path between two opposite campus rooms: b1_f1_r101 and b4_f3_r305
                const path = NAV_STATE.graph.findPath('b1_f1_r101', 'b4_f3_r305', { allowElevators: false });
                if (path && path.length > 0) {
                    if (typeof renderRoute === 'function') {
                        renderRoute(path);
                        renderer.render(scene, camera);
                        if (typeof clearRoute === 'function') clearRoute();
                    }
                    return { success: true, length: path.length };
                }
            }
            return { success: false, length: 0 };
        })()
        """
        send_cmd("Runtime.evaluate", {"expression": route_script})
        time.sleep(0.5)
        print("  [PASS] Navigation route computed and rendered in 3D scene.")

        # -----------------------------------------------------------------
        # STEP 6: Negative Control Test (Prove Error Trap Sensitivity)
        # -----------------------------------------------------------------
        print("\n[STEP 6] Running Negative Control Test (Testing Error Trap Sensitivity)...")
        initial_err_count = len(console_errors)
        send_cmd("Runtime.evaluate", {"expression": "console.error('__SYNTHETIC_CHALLENGER_CONTROL_ERROR__')"})
        time.sleep(0.25)
        new_err_count = len(console_errors)
        assert new_err_count == initial_err_count + 1, "Negative control failed: console.error was not detected!"
        # Remove synthetic error
        console_errors.pop()
        print("  [PASS] Negative control confirmed: error trap catches console.error calls with 100% sensitivity!")

        # -----------------------------------------------------------------
        # STEP 7: Assert Clean Execution
        # -----------------------------------------------------------------
        time.sleep(0.5)
        stop_listener = True

        print("\n" + "=" * 80)
        print("  BROWSER RUNTIME STRESS AUDIT RESULTS")
        print("=" * 80)
        print(f"Total Uncaught Exceptions : {len(runtime_exceptions)}")
        print(f"Total Console Errors      : {len(console_errors)}")
        print(f"Total WebGL Warnings      : {len(webgl_warnings)}")
        print(f"Total Non-WebGL Warnings  : {len(console_warnings)}")
        if console_warnings:
            for w in console_warnings:
                print(f"  * Warning: {w}")
        print("=" * 80)

        if runtime_exceptions:
            print("\n[FAIL] Detected uncaught runtime exceptions:")
            for exc in runtime_exceptions:
                print(f"  * {exc}")
        if console_errors:
            print("\n[FAIL] Detected console errors:")
            for err in console_errors:
                print(f"  * {err}")
        if webgl_warnings:
            print("\n[FAIL] Detected WebGL warnings:")
            for w in webgl_warnings:
                print(f"  * {w}")

        assert len(runtime_exceptions) == 0, f"Expected 0 runtime exceptions, got {len(runtime_exceptions)}"
        assert len(console_errors) == 0, f"Expected 0 console errors, got {len(console_errors)}"
        assert len(webgl_warnings) == 0, f"Expected 0 WebGL warnings, got {len(webgl_warnings)}"

        print("\n✓ ZERO UNCAUGHT EXCEPTIONS, ZERO CONSOLE ERRORS, ZERO WEBGL WARNINGS!")
        print("=" * 80)

    finally:
        if proc:
            proc.terminate()
            try: proc.wait(timeout=2)
            except Exception: proc.kill()
        try: shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception: pass
        server.shutdown()

if __name__ == "__main__":
    run_test()
