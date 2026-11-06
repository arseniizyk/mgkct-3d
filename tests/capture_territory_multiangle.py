#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
tests/capture_territory_multiangle.py
======================================
Production Multi-Angle Visual Capture & Verification Harness for MGKCT 3D Campus Territory.

Standardized CLI Tool:
    python tests/capture_territory_multiangle.py --target <name> --outdir <dir> [--width 1920 --height 1080] [--theme <light|dark>]

Supports 15 canonical territory targets and generates 4 canonical views per target:
    1. angle1_front_eye.png    (Front / Eye-Level, 8-12 deg elevation, aligned with principal face)
    2. angle2_iso45.png        (45-degree Isometric, 32 deg elevation, showing 3D volume & depth)
    3. angle3_top_down.png     (Top-Down Plan view, 89.2 deg elevation, verifying alignment & boundaries)
    4. angle4_detail_zoom.png  (Detail Zoom close-up on joints, textures, fittings, and bevels)
"""

import os
import sys
import time
import json
import math
import shutil
import base64
import socket
import argparse
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

# 15 Canonical Territory Targets Catalog
TERRITORY_TARGETS = {
    "bus_stop_side_glass": {
        "label": "Боковое стекло автобусного павильона (без круглых спайдеров)",
        "center": [15.75, 1.35, 23.4],
        "bbox": [1.2, 2.4, 2.2],
        "azimuth_deg": 90.0,
        "detail_focus": [15.75, 1.35, 23.4],
    },
    "driveway_lawn_junction": {
        "label": "Примыкание въезда к дороге (скос заменен газоном)",
        "center": [75.5, 0.0, 26.5],
        "bbox": [10.0, 1.0, 8.0],
        "azimuth_deg": 0.0,
        "detail_focus": [77.0, 0.0, 26.5],
    },
    "bus_shelter": {
        "label": "Павильон автобусной остановки с навесом и скамьями",
        "center": [12.0, 1.35, 23.4],
        "bbox": [7.6, 2.65, 2.1],
        "azimuth_deg": 0.0,
        "detail_focus": [9.0, 0.46, 22.8],
    },
    "bus_bench": {
        "label": "Скамья автобусной остановки с деревянными ламелями",
        "center": [9.0, 0.46, 22.8],
        "bbox": [3.2, 0.6, 0.6],
        "azimuth_deg": 0.0,
        "detail_focus": [9.0, 0.46, 22.8],
    },
    "bus_markings": {
        "label": "Желтая зигзагообразная разметка 1.17 в кармане остановки",
        "center": [16.0, 0.03, 26.8],
        "bbox": [20.0, 0.1, 2.4],
        "azimuth_deg": 0.0,
        "detail_focus": [16.0, 0.03, 26.8],
    },
    "signs_pedestrian": {
        "label": "Пешеходный переход 'Зебра' 1.14.1 и знаки 5.19",
        "center": [54.0, 1.5, 35.5],
        "bbox": [5.0, 3.0, 14.6],
        "azimuth_deg": -90.0,
        "detail_focus": [53.5, 2.5, 27.7],
    },
    "signs_bus": {
        "label": "Дорожный знак 5.16 'Остановка автобуса'",
        "center": [32.0, 1.4, 25.0],
        "bbox": [0.6, 2.8, 0.4],
        "azimuth_deg": 0.0,
        "detail_focus": [32.0, 2.6, 25.0],
    },
    "tree_birch": {
        "label": "Береза европейская (Betula pendula) с меловой корой",
        "center": [26.0, 2.2, 10.2],
        "bbox": [3.6, 4.4, 3.6],
        "azimuth_deg": 45.0,
        "detail_focus": [26.0, 0.95, 10.2],
        "is_tree": True,
    },
    "tree_linden": {
        "label": "Липа мелколистная (Tilia cordata) с объемной кроной",
        "center": [46.0, 2.2, 10.2],
        "bbox": [3.8, 4.5, 3.8],
        "azimuth_deg": 0.0,
        "detail_focus": [46.0, 0.95, 10.2],
        "is_tree": True,
    },
    "tree_spruce": {
        "label": "Ель обыкновенная (Picea abies) ярусная коническая",
        "center": [80.8, 2.8, 22.0],
        "bbox": [3.2, 5.2, 3.2],
        "azimuth_deg": 90.0,
        "detail_focus": [80.8, 0.95, 22.0],
        "is_tree": True,
    },
    "forecourt_paving": {
        "label": "Мощение парадной площади и променада колледжа",
        "center": [0.0, 0.06, 18.0],
        "bbox": [16.0, 0.2, 8.0],
        "azimuth_deg": 0.0,
        "detail_focus": [0.0, 0.06, 18.0],
    },
    "campus_full": {
        "label": "Полный обзор кампуса колледжа",
        "center": [25.0, 0.0, -25.0],
        "bbox": [120.0, 1.0, 120.0],
        "azimuth_deg": 0.0,
        "detail_focus": [25.0, 0.0, -25.0],
    },
    "campus_bench": {
        "label": "Эргономичная парковая скамья на променаде",
        "center": [24.0, 0.52, 17.8],
        "bbox": [2.8, 0.88, 0.75],
        "azimuth_deg": 0.0,
        "detail_focus": [24.0, 0.52, 17.8],
    },
    "entrance_stele": {
        "label": "Архитектурная входная стела с символикой МГКЦТ",
        "center": [-5.0, 1.45, 18.5],
        "bbox": [2.8, 2.9, 1.4],
        "azimuth_deg": 0.0,
        "detail_focus": [-5.0, 1.75, 18.5],
    },
    "bike_rack": {
        "label": "Велосипедная парковка у парадной площади",
        "center": [-14.0, 0.55, 20.5],
        "bbox": [4.6, 1.05, 1.2],
        "azimuth_deg": 0.0,
        "detail_focus": [-14.0, 0.55, 20.5],
    },
    "trash_bin": {
        "label": "Урна парковая металлическая на променаде",
        "center": [26.2, 0.48, 17.8],
        "bbox": [0.65, 0.95, 0.65],
        "azimuth_deg": 0.0,
        "detail_focus": [26.2, 0.68, 17.8],
    },
    "street_lamp": {
        "label": "Опора уличного освещения со светодиодным светильником",
        "center": [52.0, 2.7, 27.0],
        "bbox": [1.6, 5.4, 0.6],
        "azimuth_deg": 90.0,
        "detail_focus": [53.0, 5.05, 27.0],
    },
    "perimeter_fence": {
        "label": "Модульное металлическое ограждение периметра",
        "center": [-20.0, 0.8, 24.5],
        "bbox": [8.0, 1.6, 1.0],
        "azimuth_deg": 0.0,
        "detail_focus": [-20.0, 0.8, 24.5],
    },
    "barrier_gate": {
        "label": "Автоматический шлагбаум въезда на территорию",
        "center": [74.5, 0.7, 24.5],
        "bbox": [4.5, 1.4, 1.0],
        "azimuth_deg": 0.0,
        "detail_focus": [72.5, 0.8, 24.5],
    },
    "manhole_drain": {
        "label": "Чугунный ливневый люк и водоотвод",
        "center": [72.0, 0.05, 24.5],
        "bbox": [1.8, 0.2, 1.8],
        "azimuth_deg": 45.0,
        "detail_focus": [72.0, 0.05, 24.5],
    }
}

# Aliases for backwards compatibility with exploration scripts
TARGET_ALIASES = {
    "bus_zigzag": "bus_markings",
    "bus_sign": "signs_bus",
    "crosswalk_zebra": "signs_pedestrian",
    "tree_round_b2": "tree_birch",
    "tree_cone_east": "tree_spruce",
    "street_lamp_52": "street_lamp",
    "promenade_curb_junction": "manhole_drain",
    "campus_waste_bin": "trash_bin",
    "park_bin": "trash_bin",
    "bicycle_station": "bike_rack",
    "stele": "entrance_stele",
}

def resolve_target(name):
    if name in TERRITORY_TARGETS:
        return name
    if name in TARGET_ALIASES:
        return TARGET_ALIASES[name]
    norm = name.lower().replace("-", "_").strip()
    if norm in TERRITORY_TARGETS:
        return norm
    if norm in TARGET_ALIASES:
        return TARGET_ALIASES[norm]
    raise ValueError(f"Unknown target '{name}'. Available: {list(TERRITORY_TARGETS.keys())}")

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
    def log_message(self, *a): pass

def compute_camera_angles(target_def, target_key=""):
    tx, ty, tz = target_def["center"]
    wx, hy, dz = target_def["bbox"]
    radius = 0.5 * math.sqrt(wx*wx + hy*hy + dz*dz)
    radius = max(radius, 1.2)

    # 42 deg vertical FOV (matching PerspectiveCamera in js/main.js)
    fov_v = 42.0 * math.pi / 180.0
    base_dist = (radius * 1.15) / math.sin(fov_v / 2.0)

    az_rad = target_def.get("azimuth_deg", 0.0) * math.pi / 180.0
    fx, fy, fz = target_def.get("detail_focus", [tx, ty, tz])

    angles = []

    # 1. Angle 1: Front / Eye-Level
    d1 = base_dist * 1.05
    el1 = 10.0 * math.pi / 180.0
    cx1 = tx + d1 * math.cos(el1) * math.sin(az_rad)
    cy1 = max(ty + d1 * math.sin(el1), 1.6)
    cz1 = tz + d1 * math.cos(el1) * math.cos(az_rad)
    angles.append(("angle1_front_eye", tx, ty, tz, cx1, cy1, cz1))

    # 2. Angle 2: 45-degree Isometric close-up
    d2 = base_dist * 0.95
    el2 = 32.0 * math.pi / 180.0
    az2 = az_rad + (45.0 * math.pi / 180.0)
    cx2 = tx + d2 * math.cos(el2) * math.sin(az2)
    cy2 = ty + d2 * math.sin(el2)
    cz2 = tz + d2 * math.cos(el2) * math.cos(az2)
    angles.append(("angle2_iso45", tx, ty, tz, cx2, cy2, cz2))

    # 3. Angle 3: Top-Down Plan view
    d3 = base_dist * 1.18
    el3 = 89.2 * math.pi / 180.0
    cx3 = tx + d3 * math.cos(el3) * math.sin(az_rad)
    cy3 = ty + d3 * math.sin(el3)
    cz3 = tz + d3 * math.cos(el3) * math.cos(az_rad)
    angles.append(("angle3_top_down", tx, 0.0, tz, cx3, cy3, cz3))

    # 4. Angle 4: Detail zoom on joints / fittings / texture / bark
    is_tree = target_def.get("is_tree", False) or (isinstance(target_key, str) and target_key.startswith("tree_"))
    if is_tree:
        # Trees have canopy foliage starting at y = 1.4..1.6m.
        # To inspect textured trunk bark without canopy foliage occlusion,
        # position the detail camera at eye/trunk level below the crown line.
        trunk_fy = min(fy, 0.95) if fy > 0 else 0.95
        d4 = 1.6
        el4 = 5.0 * math.pi / 180.0
        az4 = az_rad + math.pi - (20.0 * math.pi / 180.0)
        cx4 = fx + d4 * math.cos(el4) * math.sin(az4)
        cy4 = trunk_fy + d4 * math.sin(el4)
        cz4 = fz + d4 * math.cos(el4) * math.cos(az4)
        angles.append(("angle4_detail_zoom", fx, trunk_fy, fz, cx4, cy4, cz4))
    else:
        d4 = max(radius * 0.7, 1.8)
        el4 = 22.0 * math.pi / 180.0
        az4 = az_rad + math.pi - (25.0 * math.pi / 180.0)
        cx4 = fx + d4 * math.cos(el4) * math.sin(az4)
        cy4 = fy + d4 * math.sin(el4)
        cz4 = fz + d4 * math.cos(el4) * math.cos(az4)
        angles.append(("angle4_detail_zoom", fx, fy, fz, cx4, cy4, cz4))

    return angles

def capture_target(target_name, base_outdir, width=1920, height=1080, theme="light"):
    target_key = resolve_target(target_name)
    target_def = TERRITORY_TARGETS[target_key]
    os.makedirs(base_outdir, exist_ok=True)

    # Subdirectory for this specific target
    target_subdir = os.path.join(base_outdir, target_key)
    os.makedirs(target_subdir, exist_ok=True)

    http_port = find_free_port()
    debug_port = find_free_port()

    server = HTTPServer(('127.0.0.1', http_port), QuietHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    browser_bin = find_browser()
    temp_dir = tempfile.mkdtemp(prefix="mgkct_cap_")

    cmd = [
        browser_bin,
        "--headless=new",
        f"--remote-debugging-port={debug_port}",
        f"--user-data-dir={temp_dir}",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        f"--window-size={width},{height}",
        f"http://127.0.0.1:{http_port}/index.html"
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    captured_files = []
    try:
        # Connect to CDP
        ws_url = None
        for _ in range(35):
            time.sleep(0.3)
            try:
                r = requests.get(f"http://127.0.0.1:{debug_port}/json", timeout=2)
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

        # 1. Override device metrics to guarantee exact viewport dimensions (e.g. 1920x1080)
        ws.send(json.dumps({
            "id": 1,
            "method": "Emulation.setDeviceMetricsOverride",
            "params": {
                "width": width,
                "height": height,
                "deviceScaleFactor": 1,
                "mobile": False
            }
        }))
        ws.recv()

        # Wait for page readiness (renderer, scene, controls initialized)
        for _ in range(40):
            ws.send(json.dumps({
                "id": 2,
                "method": "Runtime.evaluate",
                "params": {"expression": "Boolean(window.renderer && window.scene && window.controls)"}
            }))
            resp = json.loads(ws.recv())
            if resp.get("result", {}).get("result", {}).get("value") is True:
                break
            time.sleep(0.25)

        # 2. Setup clean 3D scene & camera controls
        setup_script = f"""
        (() => {{
            if (typeof setTheme === 'function') {{
                setTheme('{theme}', false);
            }}
            setTerritoryMode(true, false);
            STATE.is2D = false;
            apply2DControls(false);

            // Enforce exact renderer and camera projection dimensions
            renderer.setSize({width}, {height});
            camera.aspect = {width} / {height};
            camera.updateProjectionMatrix();

            // Inject absolute UI lockdown CSS
            const style = document.createElement('style');
            style.innerHTML = `
                header, nav, aside, [class*="ui-overlay"], [class*="glass-panel"], [class*="map-fab"], [class*="floor-switcher"],
                #bottom-search-bar, #search-modal, #search-backdrop, #navigator-modal, #navigator-backdrop, #labels-overlay-canvas {{
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                }}
            `;
            document.head.appendChild(style);

            // Hide all 2D UI panels, drawer modals, and Retina labels canvas
            Array.from(document.body.children).forEach(el => {{
                if (el.id !== 'canvas-container') {{
                    el.style.setProperty('display', 'none', 'important');
                }}
            }});

            // Set flexible control bounds for multi-angle orbital camera
            controls.minDistance = 0.05;
            controls.maxDistance = 2500;
            controls.minPolarAngle = 0;
            controls.maxPolarAngle = Math.PI - 0.001;
            controls.minAzimuthAngle = -Infinity;
            controls.maxAzimuthAngle = Infinity;

            renderer.shadowMap.needsUpdate = true;
            return true;
        }})()
        """
        ws.send(json.dumps({"id": 3, "method": "Runtime.evaluate", "params": {"expression": setup_script}}))
        ws.recv()

        angles = compute_camera_angles(target_def, target_key=target_key)

        for idx, (ang_name, tx, ty, tz, cx, cy, cz) in enumerate(angles):
            render_script = f"""
            (() => {{
                controls.target.set({tx:.4f}, {ty:.4f}, {tz:.4f});
                camera.position.set({cx:.4f}, {cy:.4f}, {cz:.4f});
                controls.update();
                camera.lookAt(controls.target);
                renderer.shadowMap.needsUpdate = true;
                renderer.render(scene, camera);
                return true;
            }})()
            """
            ws.send(json.dumps({"id": 10 + idx, "method": "Runtime.evaluate", "params": {"expression": render_script}}))
            ws.recv()

            # Small pause for renderer buffer flush
            time.sleep(0.1)

            ws.send(json.dumps({"id": 20 + idx, "method": "Page.captureScreenshot", "params": {"format": "png"}}))
            raw_msg = ws.recv()
            resp = json.loads(raw_msg)
            img_bytes = base64.b64decode(resp["result"]["data"])

            # Save in target subdirectory
            sub_file = os.path.join(target_subdir, f"{ang_name}.png")
            with open(sub_file, "wb") as f:
                f.write(img_bytes)

            # Also save directly in base_outdir if capturing a single target
            base_file = os.path.join(base_outdir, f"{ang_name}.png")
            if base_outdir != target_subdir:
                with open(base_file, "wb") as f:
                    f.write(img_bytes)

            captured_files.append((ang_name, sub_file, len(img_bytes)))
            print(f"  [CAPTURE] {target_key} -> {ang_name}.png ({len(img_bytes):,} bytes)")

        ws.close()
        return captured_files

    finally:
        if proc:
            proc.terminate()
            try: proc.wait(timeout=2)
            except Exception: proc.kill()
        try: shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception: pass
        server.shutdown()

def main():
    parser = argparse.ArgumentParser(description="Multi-Angle Automated Visual Capture for MGKCT 3D Campus Territory")
    parser.add_argument("--target", "-t", required=True, help="Target name (e.g. bus_shelter, street_lamp, or 'all')")
    parser.add_argument("--outdir", "-o", required=True, help="Output directory for captured PNGs")
    parser.add_argument("--width", type=int, default=1920, help="Viewport width in pixels (default: 1920)")
    parser.add_argument("--height", type=int, default=1080, help="Viewport height in pixels (default: 1080)")
    parser.add_argument("--theme", choices=["light", "dark"], default="light", help="Scene theme (default: light)")

    args = parser.parse_args()

    print("================================================================================")
    print("  MGKCT 3D — STANDARDIZED MULTI-ANGLE TERRITORY CAPTURE HARNESS")
    print("================================================================================")
    print(f"  * Viewport Resolution : {args.width}x{args.height}")
    print(f"  * Scene Theme         : {args.theme}")
    print(f"  * Base Output Dir     : {args.outdir}")

    targets_to_capture = []
    if args.target.lower() == "all":
        targets_to_capture = list(TERRITORY_TARGETS.keys())
    else:
        targets_to_capture = [resolve_target(args.target)]

    total_shots = 0
    start_time = time.time()

    for tgt in targets_to_capture:
        print(f"\n[TARGET] {tgt} — {TERRITORY_TARGETS[tgt]['label']}")
        shots = capture_target(tgt, args.outdir, width=args.width, height=args.height, theme=args.theme)
        total_shots += len(shots)

    elapsed = time.time() - start_time
    print("\n================================================================================")
    print(f"  ✓ Successfully captured {total_shots} high-resolution views in {elapsed:.2f}s!")
    print("================================================================================")

if __name__ == "__main__":
    main()
