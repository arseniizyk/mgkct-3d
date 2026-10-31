#!/usr/bin/env python3
"""
render_floor_overlay.py

Детерминированный 2D ортогональный рендерер и генератор наложений (BTI + 3D + Координатная сетка + Навигационный граф)
для скилла map-architecture-sync проекта MGKCT 3D.

Генерирует за ~0.2 сек на этаж три файла в .agents/skills/map-architecture-sync/captures/:
  1. render_bldg<B>_floor<F>.png  — Чистый 2D ортогональный рендер этажа (плиты, лестницы, стены, двери, плашки кабинетов) без перспективных искажений.
  2. overlay_bldg<B>_floor<F>.png — Попиксельное наложение эталонного плана БТИ (красный слой) + 3D-геометрия (синий/зеленый) + мировая координатная сетка (X, Z с шагом 1м).
  3. nav_bldg<B>_floor<F>.png     — Наложение плана БТИ + 3D-геометрии + узлов и ребер навигационного графа A* (buildCollegeNavGraph).

Использование:
  python3 .agents/skills/map-architecture-sync/scripts/render_floor_overlay.py --building 4 --floor 1
  python3 .agents/skills/map-architecture-sync/scripts/render_floor_overlay.py --all
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "../../../.."))
CAPTURES_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "../captures"))

NODE_DUMP_SCRIPT = r"""
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = process.argv[2];
const outPath = process.argv[3];
const mockCtx = new Proxy({}, { get: () => () => ({ width: 50, height: 20 }) });
const sandbox = {
    console, Math, parseInt, parseFloat, isNaN, Infinity, Set, Map, Array, Object, Date, String, Number, Boolean, RegExp,
    localStorage: { getItem: () => null, setItem: () => {} }
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.global = sandbox;
sandbox.document = {
    createElement: () => ({ getContext: () => mockCtx, width: 256, height: 64, style: {}, addEventListener: () => {} }),
    getElementById: () => null,
    addEventListener: () => {}
};
vm.createContext(sandbox);

const loadScript = (relPath) => {
    const code = fs.readFileSync(path.join(projectRoot, relPath), 'utf8');
    vm.runInContext(code, sandbox, { filename: relPath });
};

loadScript('js/vendor/three.min.js');
loadScript('js/state.js');
loadScript('js/materials.js');
loadScript('js/helpers.js');

const slabs = [];
const origAddFloorRect = sandbox.addFloorRect;
sandbox.addFloorRect = function(targetGroup, x1, z1, x2, z2, isCore = false) {
    if (targetGroup && targetGroup.userData) {
        slabs.push({
            building: targetGroup.userData.building,
            floor: targetGroup.userData.floor,
            x1: Math.min(x1, x2), z1: Math.min(z1, z2),
            x2: Math.max(x1, x2), z2: Math.max(z1, z2),
            isCore: !!isCore
        });
    }
    return origAddFloorRect.apply(this, arguments);
};

const stairs = [];
const origRegStair = sandbox.registerDynamicStairStep;
sandbox.registerDynamicStairStep = function(targetGroup, geom, sx, cz, heightRatio, yOffset = 0, isExterior = false) {
    if (targetGroup && targetGroup.userData && geom && geom.parameters) {
        stairs.push({
            building: targetGroup.userData.building,
            floor: targetGroup.userData.floor,
            cx: sx, cz: cz,
            w: geom.parameters.width,
            d: geom.parameters.depth,
            isExterior: !!isExterior
        });
    }
    return origRegStair.apply(this, arguments);
};

const columns = [];
const origAddCol = sandbox.addSquareColumn;
sandbox.addSquareColumn = function(targetGroup, cx, cz, size = 0.28, isExterior = false) {
    if (targetGroup && targetGroup.userData) {
        columns.push({
            building: targetGroup.userData.building,
            floor: targetGroup.userData.floor,
            cx, cz, size, isExterior: !!isExterior
        });
    }
    return origAddCol.apply(this, arguments);
};

loadScript('js/buildings/building1.js');
loadScript('js/buildings/building2.js');
loadScript('js/buildings/building3.js');
loadScript('js/buildings/building4.js');

for (let f = 1; f <= 7; f++) {
    const g = new sandbox.THREE.Group(); g.userData = { building: 1, floor: f };
    sandbox['buildFloor' + f](g);
}
for (let f = 1; f <= 3; f++) {
    const g = new sandbox.THREE.Group(); g.userData = { building: 2, floor: f };
    sandbox['buildBuilding2Floor' + f](g);
}
for (let f = 1; f <= 2; f++) {
    const g = new sandbox.THREE.Group(); g.userData = { building: 3, floor: f };
    sandbox['buildBuilding3Floor' + f](g);
}
for (let f = 1; f <= 3; f++) {
    const g = new sandbox.THREE.Group(); g.userData = { building: 4, floor: f };
    sandbox['buildBuilding4Floor' + f](g);
}
sandbox.flushAllPendingWalls();
loadScript('js/navigator.js');
const graph = sandbox.buildCollegeNavGraph();

const navNodes = [];
for (const [id, n] of graph.nodes.entries()) {
    navNodes.push(n);
}
const navEdges = [];
for (const [fromId, list] of graph.adj.entries()) {
    for (const e of list) {
        if (fromId < e.to) {
            navEdges.push({ from: fromId, to: e.to, weight: e.weight });
        }
    }
}

fs.writeFileSync(outPath, JSON.stringify({
    slabs,
    walls: sandbox.WALLS_REGISTRY,
    doors: sandbox.DOORS_REGISTRY,
    stairs,
    columns,
    rooms: sandbox.ROOMS_REGISTRY.map(r => ({
        text: r.text, rawText: r.rawText, floor: r.floor, building: r.building,
        x: r.x, z: r.z, isSmall: r.isSmall, isWide: r.isWide, customScale: r.customScale
    })),
    navNodes,
    navEdges
}));
"""


def get_Fonts():
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/SFNS.ttf",
        "C:\\Windows\\Fonts\\arialbd.ttf"
    ]
    for c in candidates:
        if os.path.exists(c):
            return (
                ImageFont.truetype(c, 11),
                ImageFont.truetype(c, 13),
                ImageFont.truetype(c, 15)
            )
    d = ImageFont.load_default()
    return d, d, d


def get_floor_calibration(bldg, floor, bti_path):
    if bldg == 4:
        world_bounds = (26.5, 70.5, -62.5, -23.5)
        if floor == 1:
            return (
                [(27.8, 14), (32.4, 114), (45.0, 426), (66.0, 913), (69.0, 1003)],
                [(-60.4, 20), (-49.8, 397), (-45.4, 476), (-27.4, 929), (-24.4, 995)],
                world_bounds
            )
        elif floor == 2:
            return (
                [(27.8, 36), (32.4, 127), (49.0, 513), (66.0, 903), (69.0, 987)],
                [(-61.6, 13), (-49.8, 436), (-45.4, 548), (-27.4, 953), (-24.4, 1012)],
                world_bounds
            )
        else:
            return (
                [(27.8, 12), (32.4, 79), (49.0, 448), (66.0, 821), (69.0, 882)],
                [(-61.6, 109), (-49.8, 551), (-43.6, 698), (-27.4, 1076), (-24.4, 1145)],
                world_bounds
            )

    img = cv2.imread(bti_path, cv2.IMREAD_GRAYSCALE)
    mask = (img < 100).astype(np.uint8)

    if bldg == 3:
        vert = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 150)))
        horiz = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (150, 1)))
        vx = np.where(vert.sum(axis=0) > 400)[0]
        hy = np.where(horiz.sum(axis=1) > 250)[0]
        px1, px2 = int(vx.min()), int(vx.max())
        py1, py2 = int(hy.min()), int(hy.max())
        return (
            [(-1.6, px1), (14.0, px2)],
            [(-61.6, py1), (-14.0, py2)],
            (-5.0, 17.5, -63.5, -12.0)
        )

    if bldg == 2:
        vert = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 120)))
        horiz = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (200, 1)))
        vx = np.where(vert.sum(axis=0) > 250)[0]
        hy = np.where(horiz.sum(axis=1) > 400)[0]
        px1, px2 = int(vx.min()), int(vx.max())
        py1, py2 = int(hy.min()), int(hy.max())
        return (
            [(20.4, px1), (68.0, px2)],
            [(-13.8, py1), (3.5, py2)],
            (18.0, 70.5, -17.0, 6.0)
        )

    # Корпус 1 (Этажи 1..7)
    vert = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 120)))
    horiz = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (120, 1)))
    vx = np.where(vert.sum(axis=0) > 200)[0]
    hy = np.where(horiz.sum(axis=1) > 200)[0]
    px1, px2 = int(vx.min()), int(vx.max())
    py1, py2 = int(hy.min()), int(hy.max())
    wx_max = 20.4 if floor in (1, 2, 3) else 16.0
    return (
        [(-14.0, px1), (wx_max, px2)],
        [(-14.0, py1), (14.0, py2)],
        (-16.5, 22.5, -16.5, 16.5)
    )


def warp_bti_to_world(bti_path, x_anchors, z_anchors, wx0, wx1, wz0, wz1, out_w, out_h):
    bti_gray = cv2.imread(bti_path, cv2.IMREAD_GRAYSCALE)
    out_xs = np.linspace(wx0, wx1, out_w, dtype=np.float32)
    out_zs = np.linspace(wz0, wz1, out_h, dtype=np.float32)

    wx_pts = np.array([pt[0] for pt in x_anchors], dtype=np.float32)
    px_pts = np.array([pt[1] for pt in x_anchors], dtype=np.float32)
    slope_xl = (px_pts[1] - px_pts[0]) / (wx_pts[1] - wx_pts[0])
    slope_xr = (px_pts[-1] - px_pts[-2]) / (wx_pts[-1] - wx_pts[-2])
    map_x_1d = np.interp(out_xs, wx_pts, px_pts)
    map_x_1d[out_xs < wx_pts[0]] = px_pts[0] + (out_xs[out_xs < wx_pts[0]] - wx_pts[0]) * slope_xl
    map_x_1d[out_xs > wx_pts[-1]] = px_pts[-1] + (out_xs[out_xs > wx_pts[-1]] - wx_pts[-1]) * slope_xr

    wz_pts = np.array([pt[0] for pt in z_anchors], dtype=np.float32)
    pz_pts = np.array([pt[1] for pt in z_anchors], dtype=np.float32)
    slope_zt = (pz_pts[1] - pz_pts[0]) / (wz_pts[1] - wz_pts[0])
    slope_zb = (pz_pts[-1] - pz_pts[-2]) / (wz_pts[-1] - wz_pts[-2])
    map_y_1d = np.interp(out_zs, wz_pts, pz_pts)
    map_y_1d[out_zs < wz_pts[0]] = pz_pts[0] + (out_zs[out_zs < wz_pts[0]] - wz_pts[0]) * slope_zt
    map_y_1d[out_zs > wz_pts[-1]] = pz_pts[-1] + (out_zs[out_zs > wz_pts[-1]] - wz_pts[-1]) * slope_zb

    map_x, map_y = np.meshgrid(map_x_1d, map_y_1d)
    return cv2.remap(bti_gray, map_x.astype(np.float32), map_y.astype(np.float32), cv2.INTER_LINEAR, borderValue=255)


def draw_room_badges(draw, rooms, bldg, floor, w2p, font_sm, font_md, show_coords=False):
    for r in rooms:
        if r["building"] != bldg or r["floor"] != floor:
            continue
        px, pz = w2p(r["x"], r["z"])
        raw = r.get("rawText") or r["text"]
        lines = raw.split("\n") if "\n" in raw else [r["text"]]
        if show_coords:
            lines.append(f"({r['x']:.1f},{r['z']:.1f})")
        fnt = font_sm if (r.get("isSmall") or show_coords) else font_md
        max_w = max(int(draw.textlength(line, font=fnt)) for line in lines)
        line_h = 13 if fnt == font_sm else 15
        bh = len(lines) * line_h + 6
        bw = max_w + 12
        x0, y0 = px - bw // 2, pz - bh // 2
        x1, y1 = x0 + bw, y0 + bh
        draw.rounded_rectangle([x0, y0, x1, y1], radius=4, fill=(255, 255, 255, 238), outline=(51, 65, 85, 240), width=1)
        for idx, line in enumerate(lines):
            lw = int(draw.textlength(line, font=fnt))
            color = (15, 23, 42, 255) if idx == 0 else (71, 85, 105, 255)
            draw.text((px - lw // 2, y0 + 3 + idx * line_h), line, fill=color, font=fnt)


def render_single_floor(data, bldg, floor, out_render_path=None):
    bti_path = os.path.join(PROJECT_ROOT, "planning_zip", f"Корпус {bldg}", f"{floor}.jpg")
    if not os.path.exists(bti_path):
        raise FileNotFoundError(f"BTI plan not found: {bti_path}")

    x_anchors, z_anchors, (wx0, wx1, wz0, wz1) = get_floor_calibration(bldg, floor, bti_path)
    ppm = 34.0
    out_w = int(round((wx1 - wx0) * ppm))
    out_h = int(round((wz1 - wz0) * ppm))

    def w2p(wx, wz):
        return (int(round((wx - wx0) * ppm)), int(round((wz - wz0) * ppm)))

    font_sm, font_md, font_lg = get_Fonts()
    os.makedirs(CAPTURES_DIR, exist_ok=True)

    # =========================================================================
    # 1. ЧИСТЫЙ 2D ОРТОГОНАЛЬНЫЙ РЕНДЕР (render_bldg<B>_floor<F>.png)
    # =========================================================================
    clean_img = Image.new("RGBA", (out_w, out_h), (232, 237, 242, 255))
    cdraw = ImageDraw.Draw(clean_img, "RGBA")

    # Плиты перекрытия
    for s in data["slabs"]:
        if s["building"] == bldg and s["floor"] == floor:
            p1 = w2p(s["x1"], s["z1"])
            p2 = w2p(s["x2"], s["z2"])
            fill = (226, 232, 240, 255) if s["isCore"] else (255, 255, 255, 255)
            cdraw.rectangle([p1, p2], fill=fill, outline=(148, 163, 184, 180), width=1)

    # Ступени лестниц
    for st in data["stairs"]:
        if st["building"] == bldg and st["floor"] == floor:
            p1 = w2p(st["cx"] - st.get("w", 0.5) / 2, st["cz"] - st.get("d", 0.5) / 2)
            p2 = w2p(st["cx"] + st.get("w", 0.5) / 2, st["cz"] + st.get("d", 0.5) / 2)
            cdraw.rectangle([p1, p2], fill=(219, 234, 254, 255), outline=(100, 116, 139, 210), width=1)

    # Стены
    for w in data["walls"]:
        if w["building"] == bldg and w["floor"] == floor:
            th = w.get("thickness", 0.18)
            x1, z1, x2, z2 = w["x1"], w["z1"], w["x2"], w["z2"]
            if abs(z2 - z1) < 0.01:
                p1 = w2p(min(x1, x2), z1 - th / 2)
                p2 = w2p(max(x1, x2), z1 + th / 2)
            else:
                p1 = w2p(x1 - th / 2, min(z1, z2))
                p2 = w2p(x1 + th / 2, max(z1, z2))
            cdraw.rectangle([p1, p2], fill=(241, 245, 249, 255), outline=(51, 65, 85, 255), width=1)

    # Двери
    for d in data["doors"]:
        if d["building"] == bldg and d["floor"] == floor:
            if d["isHorizontal"]:
                p1 = w2p(d["from"], d["wallCoord"] - 0.07)
                p2 = w2p(d["to"], d["wallCoord"] + 0.07)
            else:
                p1 = w2p(d["wallCoord"] - 0.07, d["from"])
                p2 = w2p(d["wallCoord"] + 0.07, d["to"])
            cdraw.rectangle([p1, p2], fill=(100, 116, 139, 255), outline=(30, 41, 59, 255), width=1)

    # Плашки кабинетов
    draw_room_badges(cdraw, data["rooms"], bldg, floor, w2p, font_sm, font_md, show_coords=False)

    # Заголовок
    cdraw.rounded_rectangle([12, 12, 310, 42], radius=6, fill=(15, 23, 42, 220))
    cdraw.text((22, 19), f"МГКЦТ 3D — Корпус {bldg}, Этаж {floor} (2D Ortho)", fill=(248, 250, 252, 255), font=font_md)

    render_path = out_render_path or os.path.join(CAPTURES_DIR, f"render_bldg{bldg}_floor{floor}.png")
    clean_img.convert("RGB").save(render_path)

    # =========================================================================
    # 2. НАЛОЖЕНИЕ БТИ + 3D + КООРДИНАТНАЯ СЕТКА (overlay_bldg<B>_floor<F>.png)
    # =========================================================================
    warped_bti = warp_bti_to_world(bti_path, x_anchors, z_anchors, wx0, wx1, wz0, wz1, out_w, out_h)
    canvas = np.full((out_h, out_w, 3), 248, dtype=np.uint8)
    bti_ink = (255 - warped_bti).astype(np.float32) / 255.0
    canvas[:, :, 0] = np.clip(248 - bti_ink * 18, 0, 255).astype(np.uint8)
    canvas[:, :, 1] = np.clip(248 - bti_ink * 190, 0, 255).astype(np.uint8)
    canvas[:, :, 2] = np.clip(248 - bti_ink * 190, 0, 255).astype(np.uint8)

    ov_img = Image.fromarray(canvas).convert("RGBA")
    odraw = ImageDraw.Draw(ov_img, "RGBA")

    # Координатная сетка 1м / 2м
    for gx in range(int(np.ceil(wx0)), int(np.floor(wx1)) + 1):
        px, _ = w2p(gx, 0)
        is_major = (gx % 2 == 0)
        col = (100, 116, 139, 95) if is_major else (148, 163, 184, 45)
        odraw.line([(px, 0), (px, out_h)], fill=col, width=1)
        if is_major:
            odraw.text((px + 2, 4), f"X={gx}", fill=(30, 41, 59, 220), font=font_sm)
            odraw.text((px + 2, out_h - 16), f"X={gx}", fill=(30, 41, 59, 220), font=font_sm)

    for gz in range(int(np.ceil(wz0)), int(np.floor(wz1)) + 1):
        _, pz = w2p(0, gz)
        is_major = (gz % 2 == 0)
        col = (100, 116, 139, 95) if is_major else (148, 163, 184, 45)
        odraw.line([(0, pz), (out_w, pz)], fill=col, width=1)
        if is_major:
            odraw.text((4, pz + 2), f"Z={gz}", fill=(30, 41, 59, 220), font=font_sm)
            odraw.text((out_w - 48, pz + 2), f"Z={gz}", fill=(30, 41, 59, 220), font=font_sm)

    # 3D Стены (полупрозрачный синий)
    for w in data["walls"]:
        if w["building"] == bldg and w["floor"] == floor:
            th = w.get("thickness", 0.18)
            x1, z1, x2, z2 = w["x1"], w["z1"], w["x2"], w["z2"]
            if abs(z2 - z1) < 0.01:
                p1 = w2p(min(x1, x2), z1 - th / 2)
                p2 = w2p(max(x1, x2), z1 + th / 2)
            else:
                p1 = w2p(x1 - th / 2, min(z1, z2))
                p2 = w2p(x1 + th / 2, max(z1, z2))
            odraw.rectangle([p1, p2], fill=(14, 116, 144, 155), outline=(15, 23, 42, 235), width=1)

    # 3D Двери (ярко-зелёный)
    for d in data["doors"]:
        if d["building"] == bldg and d["floor"] == floor:
            if d["isHorizontal"]:
                p1 = w2p(d["from"], d["wallCoord"] - 0.12)
                p2 = w2p(d["to"], d["wallCoord"] + 0.12)
            else:
                p1 = w2p(d["wallCoord"] - 0.12, d["from"])
                p2 = w2p(d["wallCoord"] + 0.12, d["to"])
            odraw.rectangle([p1, p2], fill=(16, 185, 129, 215), outline=(6, 95, 70, 255), width=1)

    # Копируем базу для рендера графа навигации ДО отрисовки плашек
    nav_img = ov_img.copy()
    ndraw = ImageDraw.Draw(nav_img, "RGBA")

    draw_room_badges(odraw, data["rooms"], bldg, floor, w2p, font_sm, font_md, show_coords=True)
    overlay_path = os.path.join(CAPTURES_DIR, f"overlay_bldg{bldg}_floor{floor}.png")
    ov_img.convert("RGB").save(overlay_path)

    # =========================================================================
    # 3. НАЛОЖЕНИЕ НАВИГАЦИОННОГО ГРАФА A* (nav_bldg<B>_floor<F>.png)
    # =========================================================================
    node_map = {n["id"]: n for n in data["navNodes"]}
    for e in data["navEdges"]:
        u = node_map.get(e["from"])
        v = node_map.get(e["to"])
        if not u or not v:
            continue
        if u["floor"] == floor and v["floor"] == floor and (u["bldg"] == bldg or v["bldg"] == bldg):
            p1 = w2p(u["x"], u["z"])
            p2 = w2p(v["x"], v["z"])
            ndraw.line([p1, p2], fill=(124, 58, 237, 210), width=2)

    for n in data["navNodes"]:
        if n["floor"] == floor and n["bldg"] == bldg:
            px, pz = w2p(n["x"], n["z"])
            ntype = n.get("type", "corridor")
            if ntype == "room":
                col = (245, 158, 11, 255)
                r = 5
            elif ntype == "door":
                col = (16, 185, 129, 255)
                r = 3
            elif ntype in ("stair", "elevator"):
                col = (239, 68, 68, 255)
                r = 5
            else:
                col = (59, 130, 246, 230)
                r = 3
            ndraw.ellipse([px - r, pz - r, px + r, pz + r], fill=col, outline=(15, 23, 42, 255))

    draw_room_badges(ndraw, data["rooms"], bldg, floor, w2p, font_sm, font_md, show_coords=False)
    nav_path = os.path.join(CAPTURES_DIR, f"nav_bldg{bldg}_floor{floor}.png")
    nav_img.convert("RGB").save(nav_path)

    return render_path, overlay_path, nav_path


def main():
    parser = argparse.ArgumentParser(description="MGKCT 3D Orthographic Floor & BTI Overlay Renderer")
    parser.add_argument("--building", "-b", type=int, default=1, help="Номер корпуса (1..4)")
    parser.add_argument("--floor", "-f", type=int, default=1, help="Номер этажа (1..7)")
    parser.add_argument("--output", "-o", type=str, default="", help="Путь сохранения render PNG")
    parser.add_argument("--all", action="store_true", help="Сгенерировать снимки для всех 15 этажей")
    args = parser.parse_args()

    with tempfile.NamedTemporaryFile(suffix=".js", mode="w", delete=False) as tf_js:
        tf_js.write(NODE_DUMP_SCRIPT)
        js_path = tf_js.name
    json_path = js_path + ".json"

    try:
        subprocess.run(["node", js_path, PROJECT_ROOT, json_path], check=True)
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    finally:
        if os.path.exists(js_path):
            os.remove(js_path)
        if os.path.exists(json_path):
            os.remove(json_path)

    if args.all:
        floors_map = {1: range(1, 8), 2: range(1, 4), 3: range(1, 3), 4: range(1, 4)}
        for b, fls in floors_map.items():
            for fl in fls:
                r_p, o_p, n_p = render_single_floor(data, b, fl)
                print(f"[render_floor_overlay] Корпус {b}, Этаж {fl} -> {os.path.basename(r_p)}, {os.path.basename(o_p)}, {os.path.basename(n_p)}")
    else:
        r_p, o_p, n_p = render_single_floor(data, args.building, args.floor, args.output or None)
        print(f"[render_floor_overlay] Рендер 2D     : {r_p}")
        print(f"[render_floor_overlay] Наложение БТИ : {o_p}")
        print(f"[render_floor_overlay] Граф навигации: {n_p}")


if __name__ == "__main__":
    main()
