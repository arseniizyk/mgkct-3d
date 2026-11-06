import os
import sys
import time
import json
import base64
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

OUTDIR = os.path.join(REPO_ROOT, "verification_screenshots", "latest_fixes")
os.makedirs(OUTDIR, exist_ok=True)

class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=REPO_ROOT, **kwargs)
    def log_message(self, format, *args):
        pass

def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]

def find_browser():
    for p in [CHROME_PATH, EDGE_PATH]:
        if os.path.isfile(p):
            return p
    raise FileNotFoundError("Neither Google Chrome nor Microsoft Edge was found.")

def main():
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
        "--window-size=1600,1000",
        f"http://127.0.0.1:{http_port}/index.html"
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    try:
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

        ws.send(json.dumps({
            "id": 1,
            "method": "Emulation.setDeviceMetricsOverride",
            "params": {"width": 1600, "height": 1000, "deviceScaleFactor": 1, "mobile": False}
        }))
        ws.recv()

        # Wait until scene and renderer are ready
        msg_id = 2
        for _ in range(40):
            ws.send(json.dumps({
                "id": msg_id,
                "method": "Runtime.evaluate",
                "params": {"expression": "Boolean(window.scene && window.camera && window.controls && window.requestRender)"}
            }))
            res = json.loads(ws.recv())
            if res.get("result", {}).get("result", {}).get("value") is True:
                break
            time.sleep(0.2)
            msg_id += 1

        print("[OK] MGKCT 3D Page loaded successfully.")

        # Definitions of shots
        shots = [
            {
                "name": "fix1_bus_stop_east_corner.png",
                "setup": """
                    STATE.showTerritory = true;
                    if (typeof territoryGroup !== 'undefined') territoryGroup.visible = true;
                    camera.position.set(38.0, 8.0, 31.0);
                    controls.target.set(38.0, 0.0, 26.5);
                    controls.update();
                    requestRender(10);
                """
            },
            {
                "name": "fix1_bus_stop_west_corner.png",
                "setup": """
                    STATE.showTerritory = true;
                    if (typeof territoryGroup !== 'undefined') territoryGroup.visible = true;
                    camera.position.set(-6.0, 8.0, 31.0);
                    controls.target.set(-6.0, 0.0, 26.5);
                    controls.update();
                    requestRender(10);
                """
            },
            {
                "name": "fix2_main_entrance_porch.png",
                "setup": """
                    STATE.mode = '1';
                    recalcTargetPositions();
                    STATE.showTerritory = true;
                    if (typeof territoryGroup !== 'undefined') territoryGroup.visible = true;
                    camera.position.set(13.6, 12.0, 10.3);
                    controls.target.set(13.6, 0.0, 10.3);
                    controls.update();
                    requestRender(10);
                """
            },
            {
                "name": "fix3_driveway_east_flare.png",
                "setup": """
                    STATE.showTerritory = true;
                    if (typeof territoryGroup !== 'undefined') territoryGroup.visible = true;
                    camera.position.set(74.5, 14.0, 26.35);
                    controls.target.set(74.5, 0.0, 26.35);
                    controls.update();
                    requestRender(10);
                """
            },
            {
                "name": "fix4_floor2_no_clipping.png",
                "setup": """
                    STATE.mode = '2';
                    recalcTargetPositions();
                    STATE.showTerritory = true;
                    if (typeof territoryGroup !== 'undefined') territoryGroup.visible = true;
                    camera.position.set(3.0, 20.0, 11.5);
                    controls.target.set(3.0, 0.0, 11.5);
                    controls.update();
                    requestRender(10);
                """
            },
            {
                "name": "fix4_floor2_skywalk_bridge.png",
                "setup": """
                    STATE.mode = '2';
                    recalcTargetPositions();
                    STATE.showTerritory = true;
                    if (typeof territoryGroup !== 'undefined') territoryGroup.visible = true;
                    camera.position.set(18.2, 16.0, -5.8);
                    controls.target.set(18.2, 0.0, -5.8);
                    controls.update();
                    requestRender(10);
                """
            }
        ]

        for s in shots:
            msg_id += 1
            ws.send(json.dumps({
                "id": msg_id,
                "method": "Runtime.evaluate",
                "params": {"expression": s["setup"]}
            }))
            ws.recv()
            time.sleep(0.5)

            msg_id += 1
            ws.send(json.dumps({
                "id": msg_id,
                "method": "Page.captureScreenshot",
                "params": {"format": "png"}
            }))
            res = json.loads(ws.recv())
            b64data = res.get("result", {}).get("data", "")
            out_path = os.path.join(OUTDIR, s["name"])
            with open(out_path, "wb") as f:
                f.write(base64.b64decode(b64data))
            print(f"[CAPTURED] {s['name']} -> {out_path} ({len(b64data)} bytes)")

        ws.close()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except Exception:
            proc.kill()
        server.shutdown()

if __name__ == "__main__":
    main()
