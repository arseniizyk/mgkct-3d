import os
import sys
import json
import base64
import requests
import websocket
from PIL import Image

def probe_cdp():
    import subprocess
    import tempfile
    import time
    from http.server import SimpleHTTPRequestHandler, HTTPServer
    import threading

    EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

    http_port = 8765
    debug_port = 9876

    class QuietHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=REPO_ROOT, **kwargs)
        def log_message(self, *a): pass

    server = HTTPServer(('127.0.0.1', http_port), QuietHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()

    temp_dir = tempfile.mkdtemp(prefix="probe_")
    cmd = [
        EDGE_PATH,
        "--headless=new",
        f"--remote-debugging-port={debug_port}",
        f"--user-data-dir={temp_dir}",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        f"http://127.0.0.1:{http_port}/index.html"
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    try:
        ws_url = None
        for _ in range(30):
            time.sleep(0.3)
            try:
                r = requests.get(f"http://127.0.0.1:{debug_port}/json")
                for it in r.json():
                    if it.get("type") == "page":
                        ws_url = it.get("webSocketDebuggerUrl")
                        break
                if ws_url:
                    break
            except Exception:
                pass

        ws = websocket.create_connection(ws_url, timeout=10)

        # 1. Override device metrics to 1920x1080
        ws.send(json.dumps({
            "id": 1,
            "method": "Emulation.setDeviceMetricsOverride",
            "params": {
                "width": 1920,
                "height": 1080,
                "deviceScaleFactor": 1,
                "mobile": False
            }
        }))
        ws.recv()

        # 2. Wait for renderer
        time.sleep(1.0)

        # Resize renderer in JS to match 1920x1080
        ws.send(json.dumps({
            "id": 2,
            "method": "Runtime.evaluate",
            "params": {
                "expression": "(() => { renderer.setSize(1920, 1080); camera.aspect = 1920/1080; camera.updateProjectionMatrix(); renderer.render(scene, camera); return [window.innerWidth, window.innerHeight]; })()"
            }
        }))
        res = json.loads(ws.recv())
        print("Inner size after override:", res)

        # 3. Capture screenshot
        ws.send(json.dumps({"id": 3, "method": "Page.captureScreenshot", "params": {"format": "png"}}))
        raw = json.loads(ws.recv())
        data = base64.b64decode(raw["result"]["data"])
        
        test_out = os.path.join(r"c:\Users\Администратор\Desktop\map\mgkct-3d\.agents\teamwork\challenger_m1_2\captures", "probe_1920.png")
        with open(test_out, "wb") as f:
            f.write(data)

        with Image.open(test_out) as im:
            print("Captured image dimensions:", im.size)

        ws.close()
    finally:
        proc.terminate()
        server.shutdown()

if __name__ == "__main__":
    probe_cdp()
